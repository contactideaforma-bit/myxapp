-- =====================================================================
--  myXapp — Messages vocaux, commentaires de galerie,
--           auteurs visibles et pastilles « nouveau »
-- =====================================================================

-- ------------------------------------------------- 1. Messages vocaux
alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages
  add constraint messages_kind_check check (kind in ('text', 'image', 'gif', 'audio'));

alter table public.messages
  add column if not exists duree_ms int;

update storage.buckets
set allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic',
      'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v',
      'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav'
    ]
where id = 'intimate';

-- ------------------------------------------------- 2. Commentaires de galerie
create table if not exists public.gallery_comments (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references public.gallery_items(id) on delete cascade,
  couple_id  uuid not null references public.couples(id) on delete cascade,
  auteur     uuid references auth.users(id) on delete set null,
  texte      text not null,
  created_at timestamptz not null default now()
);

create index if not exists gc_item_idx on public.gallery_comments(item_id, created_at);

alter table public.gallery_comments enable row level security;

-- Comme la galerie : il faut une session de coffre ouverte.
drop policy if exists "gc_all" on public.gallery_comments;
create policy "gc_all" on public.gallery_comments for all
  using (couple_id = public.my_couple_id() and public.vault_is_unlocked())
  with check (
    couple_id = public.my_couple_id()
    and public.vault_is_unlocked()
    and auteur = auth.uid()
  );

-- ------------------------------------------------- 3. Auteur des éléments Intime
alter table public.fantasy_items
  add column if not exists created_by uuid references auth.users(id) on delete set null;

-- ------------------------------------------------- 4. Pastilles « nouveau »
-- Une ligne par personne et par rubrique : la date de dernière visite.
create table if not exists public.vues (
  user_id    uuid not null references auth.users(id) on delete cascade,
  rubrique   text not null,
  vu_le      timestamptz not null default now(),
  primary key (user_id, rubrique)
);

alter table public.vues enable row level security;

drop policy if exists "vues_own" on public.vues;
create policy "vues_own" on public.vues for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.marquer_vu(p_rubrique text)
returns void
language sql
security definer set search_path = public
as $$
  insert into public.vues (user_id, rubrique, vu_le)
  values (auth.uid(), p_rubrique, now())
  on conflict (user_id, rubrique) do update set vu_le = now();
$$;

-- Compte ce que l'AUTRE a produit depuis ma dernière visite, par rubrique.
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
begin
  if cid is null then return '{}'::jsonb; end if;

  select case when c.member_a = moi then c.member_b else c.member_a end
  into autre from public.couples c where c.id = cid;

  select coalesce(max(vu_le), 'epoch') into d_gal from public.vues
    where user_id = moi and rubrique = 'galerie';
  select coalesce(max(vu_le), 'epoch') into d_int from public.vues
    where user_id = moi and rubrique = 'intime';
  select coalesce(max(vu_le), 'epoch') into d_jeu from public.vues
    where user_id = moi and rubrique = 'jeux';
  select coalesce(max(vu_le), 'epoch') into d_ide from public.vues
    where user_id = moi and rubrique = 'idees';

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
      select count(*) from public.game_history h
      where h.couple_id = cid and h.resolved_by = autre and h.created_at > d_jeu
    ),
    'idees', (
      select count(*) from public.idees i
      where i.couple_id = cid and i.cree_par = autre and i.created_at > d_ide
    )
  );
end;
$$;

do $$
begin
  begin alter publication supabase_realtime add table public.gallery_comments;
  exception when duplicate_object then null; end;
end $$;
