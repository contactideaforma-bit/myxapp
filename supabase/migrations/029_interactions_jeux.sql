-- =====================================================================
-- 029 — Interactions dans les jeux
--
-- 1. Le partenaire peut réagir d'un emoji à un coup (dés, défis, accord).
-- 2. On peut effacer une réponse Oui/Non/Peut-être.
-- 3. Chaque ACCORD Oui/Non devient un coup du fil (jeu 'ouinon') via un
--    trigger : il hérite ainsi de toute la mécanique game_events —
--    accusés ✓✓ vu, badge « nouveau » sur le hub, pastille, réaction.
--    L'accord disparaît du fil si une réponse change ou s'efface.
-- =====================================================================

-- ------------------------------------------------- 1. Réactions
alter table public.game_events add column if not exists reaction text;

-- Seul le NON-auteur du coup peut réagir (ou retirer sa réaction : null).
create or replace function public.jeu_reagir(p_event uuid, p_emoji text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if p_emoji is not null and char_length(p_emoji) > 8 then
    raise exception 'EMOJI_TROP_LONG';
  end if;
  update public.game_events
  set reaction = p_emoji
  where id = p_event
    and couple_id = public.my_couple_id()
    and par <> auth.uid();
end;
$$;

-- ------------------------------------------------- 2. Effacer sa réponse
drop policy if exists onp_delete_own on public.onp_reponses;
create policy onp_delete_own on public.onp_reponses
  for delete using (user_id = auth.uid() and couple_id = public.my_couple_id());

-- ------------------------------------------------- 3. Accords → fil
create or replace function public.onp_accord_event()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  la_carte  text;
  le_couple uuid;
  l_auteur  uuid;
  accord    boolean;
  existe    uuid;
begin
  if tg_op = 'DELETE' then
    la_carte := old.carte; le_couple := old.couple_id; l_auteur := old.user_id;
  else
    la_carte := new.carte; le_couple := new.couple_id; l_auteur := new.user_id;
  end if;

  -- L'accord existe-t-il APRÈS l'opération ?
  select count(*) = 2 into accord
  from public.onp_reponses r
  where r.couple_id = le_couple
    and r.carte = la_carte
    and r.reponse in ('oui', 'peutetre');

  select id into existe
  from public.game_events
  where couple_id = le_couple
    and jeu = 'ouinon'
    and charge->>'carte' = la_carte
  limit 1;

  if accord and existe is null then
    -- `par` = celui dont la réponse vient de former l'accord :
    -- c'est l'AUTRE qui devra le « voir ».
    insert into public.game_events (couple_id, jeu, par, charge)
    values (le_couple, 'ouinon', l_auteur, jsonb_build_object('carte', la_carte));
  elsif not accord and existe is not null then
    delete from public.game_events where id = existe;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists onp_accord_event on public.onp_reponses;
create trigger onp_accord_event
  after insert or update or delete on public.onp_reponses
  for each row execute function public.onp_accord_event();

-- Rattrapage : les accords déjà formés entrent dans le fil (non vus).
insert into public.game_events (couple_id, jeu, par, charge)
select a.couple_id, 'ouinon',
       case when a.updated_at >= b.updated_at then a.user_id else b.user_id end,
       jsonb_build_object('carte', a.carte)
from public.onp_reponses a
join public.onp_reponses b
  on b.couple_id = a.couple_id and b.carte = a.carte and b.user_id > a.user_id
where a.reponse in ('oui', 'peutetre')
  and b.reponse in ('oui', 'peutetre')
  and not exists (
    select 1 from public.game_events e
    where e.couple_id = a.couple_id and e.jeu = 'ouinon'
      and e.charge->>'carte' = a.carte
  );

-- ------------------------------------------------- 4. Pastille « Jeux »
-- Les accords passent désormais par game_events : on retire l'ancien
-- comptage direct des accords pour ne pas compter double.
create or replace function public.nouveautes()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  cid   uuid := public.my_couple_id();
  moi   uuid := auth.uid();
  autre uuid;
  d_gal timestamptz;
  d_int timestamptz;
  d_jeu timestamptz;
  d_ide timestamptz;
  d_jou timestamptz;
begin
  if cid is null then return '{}'::jsonb; end if;

  select case when c.member_a = moi then c.member_b else c.member_a end
  into autre from public.couples c where c.id = cid;

  select coalesce(max(vu_le), 'epoch') into d_gal from public.vues where user_id = moi and rubrique = 'galerie';
  select coalesce(max(vu_le), 'epoch') into d_int from public.vues where user_id = moi and rubrique = 'intime';
  select coalesce(max(vu_le), 'epoch') into d_jeu from public.vues where user_id = moi and rubrique = 'jeux';
  select coalesce(max(vu_le), 'epoch') into d_ide from public.vues where user_id = moi and rubrique = 'idees';
  select coalesce(max(vu_le), 'epoch') into d_jou from public.vues where user_id = moi and rubrique = 'journal';

  return jsonb_build_object(
    'galerie', (
      select count(*) from public.gallery_items g
      where g.couple_id = cid and g.uploader_id = autre and g.created_at > d_gal
    ),
    'intime', (
      select
        (select count(*) from public.scenarios s
         where s.couple_id = cid and s.auteur = autre and s.updated_at > d_int)
      + (select count(*) from public.fantasy_items i
         join public.fantasy_lists l on l.id = i.list_id
         where l.couple_id = cid and i.created_by = autre and i.created_at > d_int)
    ),
    'jeux', (
      (select count(*) from public.game_history h
       where h.couple_id = cid and h.resolved_by = autre and h.created_at > d_jeu)
      + (select count(*) from public.game_events e
         where e.couple_id = cid and e.par = autre and e.vu_le is null)
    ),
    'idees', (
      select count(*) from public.idees i
      where i.couple_id = cid and i.cree_par = autre and i.created_at > d_ide
    ),
    'journal', (
      select count(*) from public.journal_entries j
      where j.couple_id = cid and j.auteur = autre and j.updated_at > d_jou
    )
  );
end;
$$;
