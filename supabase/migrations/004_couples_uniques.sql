-- =====================================================================
--  myXapp — Fin des lignes "couples" ambigues
--
--  Cause du bug : create_or_get_couple() et join_couple() faisaient toutes
--  deux un "select ... limit 1" SANS tri. Quand un compte possedait a la
--  fois une ligne en attente et une ligne formee, chaque fonction pouvait
--  tomber sur une ligne differente -> la page affichait "en attente"
--  pendant que la liaison repondait ALREADY_PAIRED.
--
--  Correction : tri deterministe partout (couple forme prioritaire),
--  nettoyage des lignes fantomes, et garde-fou en base.
--
--  A coller dans Supabase > SQL Editor > New query > Run
-- =====================================================================

-- ------------------------------------------------- 1. Nettoyage
-- Supprime les lignes "en attente" des comptes qui sont deja formes.
delete from public.couples c
where c.member_b is null
  and exists (
    select 1
    from public.couples f
    where f.member_b is not null
      and (f.member_a = c.member_a or f.member_b = c.member_a)
  );

-- Ne garde que la plus ancienne ligne en attente par compte.
delete from public.couples c
where c.member_b is null
  and exists (
    select 1
    from public.couples o
    where o.member_b is null
      and o.member_a = c.member_a
      and o.created_at < c.created_at
  );

-- ------------------------------------------------- 2. Garde-fou
-- Un compte ne peut plus avoir deux codes en attente simultanement.
create unique index if not exists couples_une_attente_par_compte
  on public.couples (member_a)
  where member_b is null;

-- ------------------------------------------------- 3. Lecture deterministe
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

create or replace function public.create_or_get_couple()
returns public.couples
language plpgsql
security definer set search_path = public
as $$
declare
  uid   uuid := auth.uid();
  row   public.couples;
  code  text;
  tries int := 0;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into row
  from public.couples
  where member_a = uid or member_b = uid
  order by (member_b is null), created_at   -- couple forme d'abord
  limit 1;

  if found then
    return row;
  end if;

  loop
    tries := tries + 1;
    code := public.gen_invite_code();
    begin
      insert into public.couples (member_a, invite_code)
      values (uid, code)
      returning * into row;
      return row;
    exception when unique_violation then
      -- code deja pris, ou ligne en attente creee entre-temps
      select * into row
      from public.couples
      where member_a = uid and member_b is null
      limit 1;
      if found then
        return row;
      end if;
      if tries > 10 then
        raise exception 'CODE_GENERATION_FAILED';
      end if;
    end;
  end loop;
end;
$$;

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

  select * into mine
  from public.couples
  where member_a = uid or member_b = uid
  order by (member_b is null), created_at   -- couple forme d'abord
  limit 1;

  if found and mine.member_b is not null then
    raise exception 'ALREADY_PAIRED';
  end if;

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

  -- Toutes mes lignes en attente disparaissent (aucune n'a jamais servi)
  delete from public.couples
  where member_a = uid and member_b is null;

  update public.couples
  set member_b    = uid,
      paired_at   = now(),
      invite_code = null
  where id = target.id
  returning * into target;

  return target;
end;
$$;
