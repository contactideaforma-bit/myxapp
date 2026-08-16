-- =====================================================================
--  myXapp — Illustrations personnelles du catalogue
--
--  Le catalogue (textes, noms, ordre) reste commun et en lecture seule.
--  Les IMAGES, elles, appartiennent au couple : chacun depose les
--  siennes, personne d'autre ne les voit.
--
--  Fichiers : {couple_id}/positions/{cle}.{ext} dans le bucket prive
--  'intimate' — donc deja couvert par les policies posees en 002 et 006.
-- =====================================================================

create table if not exists public.position_images (
  couple_id    uuid not null references public.couples(id)   on delete cascade,
  position_key text not null references public.positions(key) on delete cascade,
  storage_path text not null,
  updated_by   uuid references auth.users(id) on delete set null,
  updated_at   timestamptz not null default now(),
  primary key (couple_id, position_key)
);

alter table public.position_images enable row level security;

drop policy if exists "pos_images_select" on public.position_images;
create policy "pos_images_select" on public.position_images for select
  using (couple_id = public.my_couple_id());

drop policy if exists "pos_images_insert" on public.position_images;
create policy "pos_images_insert" on public.position_images for insert
  with check (couple_id = public.my_couple_id() and updated_by = auth.uid());

drop policy if exists "pos_images_update" on public.position_images;
create policy "pos_images_update" on public.position_images for update
  using (couple_id = public.my_couple_id())
  with check (couple_id = public.my_couple_id());

drop policy if exists "pos_images_delete" on public.position_images;
create policy "pos_images_delete" on public.position_images for delete
  using (couple_id = public.my_couple_id());
