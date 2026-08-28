-- =====================================================================
-- 025 — Prolonger la session du journal pendant l'écriture.
--
-- La session de 15 minutes était figée au moment du déverrouillage :
-- elle expirait au beau milieu d'une page et l'écran se reverrouillait,
-- texte perdu. L'app appelle désormais cette fonction (au plus toutes
-- les ~4 minutes, tant que l'on tape) pour repousser l'échéance.
-- Ne fait rien si la session est déjà expirée : il faut alors
-- ressaisir le code — le brouillon, lui, est conservé côté client.
-- =====================================================================

create or replace function public.journal_prolonger()
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  update public.journal_unlocks
  set unlocked_until = now() + interval '15 minutes'
  where user_id = auth.uid()
    and couple_id = public.my_couple_id()
    and unlocked_until > now();
  return found;
end;
$$;
