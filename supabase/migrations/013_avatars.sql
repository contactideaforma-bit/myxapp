-- =====================================================================
--  myXapp — Avatars personnalisables
--  Les parametres sont de simples valeurs (carnation, coiffure, visage,
--  corpulence, morphologie) : rien qui derive d'une photo.
-- =====================================================================

alter table public.profiles
  add column if not exists avatar jsonb not null default '{}'::jsonb;
