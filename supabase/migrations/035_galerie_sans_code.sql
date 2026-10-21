-- 035 — Galerie sans code
-- La galerie s'ouvre désormais sans code : il suffit d'être membre du couple.
-- Toutes les policies (gallery_items, commentaires, Storage 'intimate',
-- dossier_autorise) passent par vault_is_unlocked() : on change cette seule
-- fonction, rien n'est effacé. Le code éventuellement défini reste en base
-- (inutilisé) ; pour revenir au code, restaurer la fonction de la migration 006.

create or replace function public.vault_is_unlocked()
returns boolean
language sql
security definer stable set search_path = public
as $$
  select auth.uid() is not null and public.my_couple_id() is not null;
$$;
