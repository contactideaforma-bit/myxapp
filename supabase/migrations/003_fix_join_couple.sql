-- =====================================================================
--  myXapp — Correctif de la liaison
--
--  Probleme : la page de liaison appelle create_or_get_couple() pour
--  afficher le code de l'utilisateur, ce qui lui cree une ligne "couple
--  en attente" (member_b = null). join_couple() la prenait pour un vrai
--  couple et refusait la liaison avec ALREADY_PAIRED.
--
--  Correction : un couple n'est "forme" que si member_b n'est pas null.
--  Une ligne en attente est supprimee au moment de rejoindre l'autre.
--
--  A coller dans Supabase > SQL Editor > New query > Run
-- =====================================================================

create or replace function public.join_couple(p_code text)
returns public.couples
language plpgsql
security definer set search_path = public
as $$
declare
  uid    uuid := auth.uid();
  mine   public.couples;
  target public.couples;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- Mon eventuelle ligne existante
  select * into mine
  from public.couples
  where member_a = uid or member_b = uid
  limit 1;

  -- Deja reellement en couple (les deux places occupees) -> on refuse
  if found and mine.member_b is not null then
    raise exception 'ALREADY_PAIRED';
  end if;

  -- Le couple vise par le code
  select * into target
  from public.couples
  where invite_code = upper(trim(p_code))
  limit 1;

  if not found then
    raise exception 'INVALID_CODE';
  end if;

  if target.member_b is not null then
    raise exception 'COUPLE_FULL';
  end if;

  if target.member_a = uid then
    raise exception 'CANNOT_PAIR_WITH_SELF';
  end if;

  -- On libere ma ligne en attente (elle n'a jamais servi a personne)
  if mine.id is not null then
    delete from public.couples where id = mine.id;
  end if;

  update public.couples
  set member_b    = uid,
      paired_at   = now(),
      invite_code = null          -- le code est brule apres usage
  where id = target.id
  returning * into target;

  return target;
end;
$$;

-- Defensif : si un compte traine plusieurs lignes (etat anterieur au
-- correctif), on privilegie toujours le couple reellement forme.
create or replace function public.my_couple_id()
returns uuid
language sql
security definer stable set search_path = public
as $$
  select id from public.couples
  where member_a = auth.uid() or member_b = auth.uid()
  order by (member_b is null), created_at
  limit 1;
$$;
