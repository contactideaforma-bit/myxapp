-- =====================================================================
--  DIAGNOSTIC — a executer dans Supabase > SQL Editor
--  Lance ce bloc en entier, puis envoie les 2 tableaux resultants.
-- =====================================================================

-- 1) Le correctif 003 est-il bien installe ?
select
  proname as fonction,
  (prosrc like '%mine.member_b is not null%') as correctif_003_actif
from pg_proc
where proname in ('join_couple', 'my_couple_id')
order by proname;

-- 2) Etat reel des couples (avec les emails, pour s'y retrouver)
select
  c.id,
  c.invite_code,
  c.created_at,
  c.paired_at,
  a.email as membre_a,
  b.email as membre_b
from public.couples c
left join auth.users a on a.id = c.member_a
left join auth.users b on b.id = c.member_b
order by c.created_at;
