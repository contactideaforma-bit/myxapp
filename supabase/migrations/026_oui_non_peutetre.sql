-- =====================================================================
-- 026 — Mini-jeu « Oui / Non / Peut-être »
--
-- Chacun répond de son côté au même paquet de cartes d'envies ; seuls
-- les ACCORDS mutuels (oui/peut-être des deux) se révèlent. Les « non »
-- et les réponses non croisées restent secrets — même mécanique de
-- réciprocité que les fantasmes.
--
-- Temps réel : la RLS empêche de recevoir les événements des lignes de
-- l'autre, donc chaque réponse « tape » sur une ligne d'activité lisible
-- par le couple ; le client réagit au signal et rappelle onp_accords().
-- =====================================================================

-- ------------------------------------------------- 1. Réponses (secrètes)
create table if not exists public.onp_reponses (
  couple_id  uuid not null references public.couples(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  carte      text not null,
  reponse    text not null check (reponse in ('oui', 'non', 'peutetre')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (couple_id, user_id, carte)
);

alter table public.onp_reponses enable row level security;

-- Chacun ne lit et n'écrit QUE ses propres réponses.
create policy onp_select_own on public.onp_reponses
  for select using (user_id = auth.uid() and couple_id = public.my_couple_id());
create policy onp_insert_own on public.onp_reponses
  for insert with check (user_id = auth.uid() and couple_id = public.my_couple_id());
create policy onp_update_own on public.onp_reponses
  for update using (user_id = auth.uid() and couple_id = public.my_couple_id())
  with check (user_id = auth.uid() and couple_id = public.my_couple_id());

create or replace function public.onp_touche()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists onp_touche on public.onp_reponses;
create trigger onp_touche before update on public.onp_reponses
  for each row execute function public.onp_touche();

-- ------------------------------------------------- 2. Signal temps réel
create table if not exists public.onp_activite (
  couple_id uuid primary key references public.couples(id) on delete cascade,
  maj       timestamptz not null default now()
);

alter table public.onp_activite enable row level security;
create policy onp_activite_select on public.onp_activite
  for select using (couple_id = public.my_couple_id());
-- Pas de policy d'écriture : seul le trigger (security definer) écrit.

create or replace function public.onp_signal()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.onp_activite (couple_id, maj)
  values (new.couple_id, now())
  on conflict (couple_id) do update set maj = now();
  return new;
end;
$$;

drop trigger if exists onp_signal on public.onp_reponses;
create trigger onp_signal after insert or update on public.onp_reponses
  for each row execute function public.onp_signal();

alter publication supabase_realtime add table public.onp_activite;

-- ------------------------------------------------- 3. Les accords
-- Uniquement les cartes où LES DEUX ont répondu oui ou peut-être.
create or replace function public.onp_accords()
returns table (carte text, ma_reponse text, sa_reponse text, forme_le timestamptz)
language sql
security definer stable set search_path = public
as $$
  select a.carte, a.reponse, b.reponse, greatest(a.updated_at, b.updated_at)
  from public.onp_reponses a
  join public.onp_reponses b
    on b.couple_id = a.couple_id and b.carte = a.carte and b.user_id <> a.user_id
  where a.couple_id = public.my_couple_id()
    and a.user_id = auth.uid()
    and a.reponse in ('oui', 'peutetre')
    and b.reponse in ('oui', 'peutetre')
  order by greatest(a.updated_at, b.updated_at) desc;
$$;

-- ------------------------------------------------- 4. Progression
-- Mes réponses en détail (via la table, RLS) ; celles de l'autre en
-- NOMBRE seulement — jamais leur contenu.
create or replace function public.onp_progression()
returns jsonb
language sql
security definer stable set search_path = public
as $$
  select jsonb_build_object(
    'moi',   (select count(*) from public.onp_reponses
              where couple_id = public.my_couple_id() and user_id = auth.uid()),
    'autre', (select count(*) from public.onp_reponses
              where couple_id = public.my_couple_id() and user_id <> auth.uid())
  );
$$;

-- ------------------------------------------------- 5. Pastille « Jeux »
-- La pastille compte désormais aussi les accords formés/ravivés par une
-- réponse de l'autre depuis ma dernière visite de la rubrique.
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
