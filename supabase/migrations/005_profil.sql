-- =====================================================================
--  myXapp — Lot 1 : profils enrichis, identite du couple, PIN galerie
--  A coller dans Supabase > SQL Editor > New query > Run
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ------------------------------------------------- Profils
alter table public.profiles
  add column if not exists avatar_path text,
  add column if not exists bio         text;

-- ------------------------------------------------- Identite du couple
alter table public.couples
  add column if not exists nickname     text,   -- "Nos nuits blanches"
  add column if not exists since_date   date,   -- depuis quand ensemble
  add column if not exists gallery_pin  text;   -- hash bcrypt, jamais le PIN en clair

-- ------------------------------------------------- Infos du couple (RPC)
-- On passe par une fonction plutot qu'une policy UPDATE : impossible pour
-- un membre de bidouiller member_a / member_b / invite_code.
create or replace function public.update_couple_info(
  p_nickname   text default null,
  p_since_date date default null
)
returns public.couples
language plpgsql
security definer set search_path = public
as $$
declare
  row public.couples;
begin
  update public.couples
  set nickname   = coalesce(nullif(trim(p_nickname), ''), nickname),
      since_date = coalesce(p_since_date, since_date)
  where id = public.my_couple_id()
  returning * into row;

  if not found then
    raise exception 'NO_COUPLE';
  end if;
  return row;
end;
$$;

-- ------------------------------------------------- PIN de la galerie
create or replace function public.set_gallery_pin(p_pin text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if p_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN_FORMAT';
  end if;

  update public.couples
  set gallery_pin = extensions.crypt(p_pin, extensions.gen_salt('bf'))
  where id = public.my_couple_id();

  if not found then
    raise exception 'NO_COUPLE';
  end if;
end;
$$;

create or replace function public.check_gallery_pin(p_pin text)
returns boolean
language sql
security definer stable set search_path = public
as $$
  select coalesce(gallery_pin = extensions.crypt(p_pin, gallery_pin), false)
  from public.couples
  where id = public.my_couple_id();
$$;

create or replace function public.has_gallery_pin()
returns boolean
language sql
security definer stable set search_path = public
as $$
  select coalesce(gallery_pin is not null, false)
  from public.couples
  where id = public.my_couple_id();
$$;

-- ------------------------------------------------- Storage : policy UPDATE
-- Manquait dans 002 : necessaire pour l'upload d'avatar en mode upsert.
drop policy if exists "intimate_update" on storage.objects;
create policy "intimate_update" on storage.objects for update
  to authenticated
  using (
    bucket_id = 'intimate'
    and (storage.foldername(name))[1] = public.my_couple_id()::text
  )
  with check (
    bucket_id = 'intimate'
    and (storage.foldername(name))[1] = public.my_couple_id()::text
  );
