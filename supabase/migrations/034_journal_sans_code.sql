-- 034 — Journal sans code
-- Le journal s'ouvre désormais sans code : il suffit d'être membre du couple.
-- Toutes les policies (entrées, lectures, Storage 'journal') passent par
-- journal_is_unlocked() : on change cette seule fonction, rien n'est effacé.
-- Le code éventuellement défini reste en base (inutilisé), réversible à tout moment.

create or replace function public.journal_is_unlocked()
returns boolean
language sql
security definer stable set search_path = public
as $$
  select auth.uid() is not null and public.my_couple_id() is not null;
$$;
