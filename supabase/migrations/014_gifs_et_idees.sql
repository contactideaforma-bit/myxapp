-- =====================================================================
--  myXapp — GIF, bibliotheque personnelle, et journal des idees
-- =====================================================================

-- ------------------------------------------------- 1. Messages de type GIF
-- Un GIF externe est stocke comme une URL dans body ; un GIF a vous
-- passe par storage_path comme n'importe quelle image.
alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages
  add constraint messages_kind_check check (kind in ('text', 'image', 'gif'));

-- ------------------------------------------------- 2. Votre bibliotheque
create table if not exists public.stickers (
  id           uuid primary key default gen_random_uuid(),
  couple_id    uuid not null references public.couples(id) on delete cascade,
  storage_path text not null,
  legende      text,
  added_by     uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists stickers_couple_idx
  on public.stickers(couple_id, created_at desc);

alter table public.stickers enable row level security;

drop policy if exists "stickers_select" on public.stickers;
create policy "stickers_select" on public.stickers for select
  using (couple_id = public.my_couple_id());

drop policy if exists "stickers_insert" on public.stickers;
create policy "stickers_insert" on public.stickers for insert
  with check (couple_id = public.my_couple_id() and added_by = auth.uid());

drop policy if exists "stickers_update" on public.stickers;
create policy "stickers_update" on public.stickers for update
  using (couple_id = public.my_couple_id())
  with check (couple_id = public.my_couple_id());

drop policy if exists "stickers_delete" on public.stickers;
create policy "stickers_delete" on public.stickers for delete
  using (couple_id = public.my_couple_id());

-- ------------------------------------------------- 3. Journal des idees
create table if not exists public.idees (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references public.couples(id) on delete cascade,
  registre   text not null,
  intensite  int  not null default 2 check (intensite between 1 and 3),
  demande    text,
  reponse    text not null,
  favori     boolean not null default false,
  cree_par   uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idees_couple_idx
  on public.idees(couple_id, created_at desc);

alter table public.idees enable row level security;

drop policy if exists "idees_select" on public.idees;
create policy "idees_select" on public.idees for select
  using (couple_id = public.my_couple_id());

drop policy if exists "idees_insert" on public.idees;
create policy "idees_insert" on public.idees for insert
  with check (couple_id = public.my_couple_id() and cree_par = auth.uid());

drop policy if exists "idees_update" on public.idees;
create policy "idees_update" on public.idees for update
  using (couple_id = public.my_couple_id())
  with check (couple_id = public.my_couple_id());

drop policy if exists "idees_delete" on public.idees;
create policy "idees_delete" on public.idees for delete
  using (couple_id = public.my_couple_id());

-- Temps reel : l'idee tiree apparait chez l'autre
do $$
begin
  begin
    alter publication supabase_realtime add table public.idees;
  exception when duplicate_object then null;
  end;
end $$;
