-- =====================================================================
-- 028 — Jouer en différé : le journal des coups + accusés « vu »
--
-- Problème : à distance, celui qui joue ne sait pas si l'autre a vu,
-- et celui qui revient ne sait pas ce qui s'est passé sans lui.
-- Solution : chaque coup (lancer de dés, réponse de quiz…) est
-- consigné dans game_events. Les deux voient le fil ; ouvrir un jeu
-- marque « vu » les coups de l'autre, et l'auteur voit passer son
-- ✓ en ✓✓ en temps réel — même mécanique que le journal.
-- =====================================================================

create table if not exists public.game_events (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references public.couples(id) on delete cascade,
  jeu        text not null,
  par        uuid not null references auth.users(id) on delete cascade,
  charge     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  vu_le      timestamptz          -- quand L'AUTRE a vu ce coup (null = pas encore)
);

create index if not exists game_events_flux
  on public.game_events (couple_id, jeu, created_at desc);

alter table public.game_events enable row level security;

-- Le fil est visible par les deux ; on n'écrit que ses propres coups.
create policy events_select on public.game_events
  for select using (couple_id = public.my_couple_id());
create policy events_insert on public.game_events
  for insert with check (couple_id = public.my_couple_id() and par = auth.uid());
-- Pas de policy update/delete : le « vu » passe par la fonction ci-dessous.

-- Ouvrir un jeu = avoir vu tous les coups de l'autre dans ce jeu.
-- Au passage, on jette les coups de plus de 30 jours (ce n'est pas une
-- archive : le journal intime est là pour les souvenirs).
create or replace function public.jeu_marquer_vu(p_jeu text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.game_events
  set vu_le = now()
  where couple_id = public.my_couple_id()
    and jeu = p_jeu
    and par <> auth.uid()
    and vu_le is null;

  delete from public.game_events
  where couple_id = public.my_couple_id()
    and created_at < now() - interval '30 days';
end;
$$;

-- Combien de coups de l'autre je n'ai pas encore vus, par jeu.
-- Nourrit les badges des tuiles du hub.
create or replace function public.jeux_non_vus()
returns jsonb
language sql
security definer stable set search_path = public
as $$
  select coalesce(jsonb_object_agg(jeu, n), '{}'::jsonb)
  from (
    select jeu, count(*) as n
    from public.game_events
    where couple_id = public.my_couple_id()
      and par <> auth.uid()
      and vu_le is null
    group by jeu
  ) t;
$$;

alter publication supabase_realtime add table public.game_events;

-- ------------------------------------------------- Pastille « Jeux »
-- Les coups non vus comptent désormais dans la pastille de l'onglet
-- (en plus des défis résolus et des nouveaux accords).
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
      + (select count(*) from public.onp_reponses a
         join public.onp_reponses b
           on b.couple_id = a.couple_id and b.carte = a.carte and b.user_id = autre
         where a.couple_id = cid and a.user_id = moi
           and a.reponse in ('oui', 'peutetre')
           and b.reponse in ('oui', 'peutetre')
           and b.updated_at > d_jeu)
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
