-- =====================================================================
--  myXapp — Storage privé pour les photos
--  À exécuter APRÈS 001_schema.sql
-- =====================================================================

-- Bucket privé (jamais d'URL publique : uniquement des URL signées 60 s)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'intimate',
  'intimate',
  false,
  10485760,  -- 10 Mo
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']
)
on conflict (id) do update
  set public = false,
      file_size_limit = 10485760;

-- Convention de nommage des fichiers : <couple_id>/<user_id>-<timestamp>.<ext>
-- La 1re partie du chemin doit correspondre à mon couple.

drop policy if exists "intimate_select" on storage.objects;
create policy "intimate_select" on storage.objects for select
  to authenticated
  using (
    bucket_id = 'intimate'
    and (storage.foldername(name))[1] = public.my_couple_id()::text
  );

drop policy if exists "intimate_insert" on storage.objects;
create policy "intimate_insert" on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'intimate'
    and (storage.foldername(name))[1] = public.my_couple_id()::text
  );

drop policy if exists "intimate_delete" on storage.objects;
create policy "intimate_delete" on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'intimate'
    and (storage.foldername(name))[1] = public.my_couple_id()::text
  );
