-- =====================================================================
--  myXapp — Vidéo dans la galerie
-- =====================================================================

-- Le bucket n'acceptait que des images, et plafonnait à 10 Mo.
update storage.buckets
set file_size_limit = 104857600,  -- 100 Mo
    allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic',
      'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'
    ]
where id = 'intimate';

alter table public.gallery_items
  add column if not exists kind text not null default 'image';

do $$
begin
  alter table public.gallery_items
    add constraint gallery_kind_valide check (kind in ('image', 'video'));
exception when duplicate_object then null;
end $$;
