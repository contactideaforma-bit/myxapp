-- =====================================================================
-- 032 — Vidéos dans la conversation
--
-- Les messages acceptent le type 'video' (fichier dans le bucket
-- intimate, même chemin que les photos du chat). Les liens vers des
-- vidéos externes (YouTube, fichiers directs) restent des messages
-- 'text' : c'est le client qui les reconnaît et les met en scène.
--
-- À coller dans Supabase > SQL Editor > New query > Run
-- =====================================================================

alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages
  add constraint messages_kind_check
  check (kind in ('text', 'image', 'gif', 'audio', 'video'));
