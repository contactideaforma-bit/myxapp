-- =====================================================================
--  myXapp — Présence réelle, vérifiée côté serveur
--
--  Les garde-fous precedents dependaient du canal temps reel (fragile)
--  et de la propriete « focused » des fenetres, qu'iOS ne renseigne pas
--  de facon fiable. On enregistre desormais un battement de coeur en
--  base : la route d'envoi consulte cette valeur avant de notifier.
-- =====================================================================

alter table public.profiles
  add column if not exists last_active_at timestamptz;

-- Battement de coeur, appele par le client toutes les 25 secondes
-- tant que l'application est visible, quel que soit l'onglet.
create or replace function public.ping_presence()
returns void
language sql
security definer set search_path = public
as $$
  update public.profiles set last_active_at = now() where id = auth.uid();
$$;

-- Le/la partenaire a-t-il regarde l'application recemment ?
create or replace function public.partner_is_active(p_secondes int default 50)
returns boolean
language sql
security definer stable set search_path = public
as $$
  select coalesce(
    (
      select p.last_active_at > now() - make_interval(secs => p_secondes)
      from public.couples c
      join public.profiles p
        on p.id = case when c.member_a = auth.uid() then c.member_b else c.member_a end
      where c.id = public.my_couple_id()
    ),
    false
  );
$$;
