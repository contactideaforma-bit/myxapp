-- =====================================================================
-- 033 — Les stickers deviennent un vrai type de message
--
-- Jusqu'ici un sticker partait comme kind 'image' : il fallait le
-- toucher pour l'afficher, et supprimer le message effaçait le fichier
-- de la BIBLIOTHÈQUE (même storage_path !). Avec kind 'sticker' :
-- affichage automatique, lecture en boucle pour les stickers animés,
-- et la suppression du message ne touche plus au fichier partagé.
--
-- À coller dans Supabase > SQL Editor > New query > Run
-- =====================================================================

alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages
  add constraint messages_kind_check
  check (kind in ('text', 'image', 'gif', 'audio', 'video', 'sticker'));
