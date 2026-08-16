-- =====================================================================
--  myXapp — Schéma v0
--  À coller dans Supabase > SQL Editor > New query > Run
-- =====================================================================

-- ---------------------------------------------------------------- 1. PROFILS
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Mon amour',
  emoji        text not null default '🔥',
  created_at   timestamptz not null default now()
);

-- Crée automatiquement un profil à chaque inscription
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- 2. COUPLES
create table if not exists public.couples (
  id          uuid primary key default gen_random_uuid(),
  member_a    uuid not null references auth.users(id) on delete cascade,
  member_b    uuid references auth.users(id) on delete cascade,
  invite_code text unique,
  created_at  timestamptz not null default now(),
  paired_at   timestamptz,
  constraint different_members check (member_b is null or member_a <> member_b)
);

create index if not exists couples_member_a_idx on public.couples(member_a);
create index if not exists couples_member_b_idx on public.couples(member_b);

-- ---------------------------------------------------------------- 3. MESSAGES
create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  couple_id    uuid not null references public.couples(id) on delete cascade,
  sender_id    uuid not null references auth.users(id) on delete cascade,
  kind         text not null default 'text' check (kind in ('text', 'image')),
  body         text,
  storage_path text,
  view_once    boolean not null default false,
  opened_at    timestamptz,
  expires_at   timestamptz,         -- null = message permanent
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists messages_couple_created_idx
  on public.messages(couple_id, created_at desc);

-- ================================================================ HELPERS

-- Le couple de l'utilisateur courant (évite la récursion dans les policies)
create or replace function public.my_couple_id()
returns uuid
language sql
security definer stable set search_path = public
as $$
  select id from public.couples
  where member_a = auth.uid() or member_b = auth.uid()
  limit 1;
$$;

-- Génère un code lisible de 6 caractères (sans I, O, 0, 1 pour éviter les erreurs)
create or replace function public.gen_invite_code()
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result   text := '';
  i        int;
begin
  for i in 1..6 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end;
$$;

-- ================================================================ RPC

-- Crée (ou retrouve) mon couple et me renvoie mon code d'invitation
create or replace function public.create_or_get_couple()
returns public.couples
language plpgsql
security definer set search_path = public
as $$
declare
  uid    uuid := auth.uid();
  row    public.couples;
  code   text;
  tries  int := 0;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into row from public.couples
  where member_a = uid or member_b = uid
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
      if tries > 10 then raise exception 'CODE_GENERATION_FAILED'; end if;
    end;
  end loop;
end;
$$;

-- Rejoindre le couple de mon/ma partenaire grâce à son code
create or replace function public.join_couple(p_code text)
returns public.couples
language plpgsql
security definer set search_path = public
as $$
declare
  uid    uuid := auth.uid();
  target public.couples;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- déjà en couple ?
  if exists (select 1 from public.couples where member_a = uid or member_b = uid) then
    raise exception 'ALREADY_PAIRED';
  end if;

  select * into target from public.couples
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

  update public.couples
  set member_b    = uid,
      paired_at   = now(),
      invite_code = null           -- le code est brûlé après usage
  where id = target.id
  returning * into target;

  return target;
end;
$$;

-- Marque une photo "vue unique" comme ouverte (une seule fois, par le destinataire)
create or replace function public.open_view_once(p_message_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  update public.messages m
  set opened_at = now()
  where m.id = p_message_id
    and m.view_once
    and m.opened_at is null
    and m.sender_id <> uid
    and m.couple_id = public.my_couple_id();
end;
$$;

-- Accusés de lecture
create or replace function public.mark_read()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  update public.messages
  set read_at = now()
  where couple_id = public.my_couple_id()
    and sender_id <> uid
    and read_at is null;
end;
$$;

-- Purge des messages expirés (appelée par le client + cron optionnel)
create or replace function public.purge_expired()
returns void
language sql
security definer set search_path = public
as $$
  delete from public.messages
  where expires_at is not null and expires_at < now();
$$;

-- ================================================================ RLS

alter table public.profiles enable row level security;
alter table public.couples  enable row level security;
alter table public.messages enable row level security;

-- PROFILS : je vois le mien + celui de mon/ma partenaire
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1 from public.couples c
      where (c.member_a = auth.uid() and c.member_b = profiles.id)
         or (c.member_b = auth.uid() and c.member_a = profiles.id)
    )
  );

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- COUPLES : lecture seule de mon couple (création/jointure passent par les RPC)
drop policy if exists "couples_select" on public.couples;
create policy "couples_select" on public.couples for select
  using (member_a = auth.uid() or member_b = auth.uid());

drop policy if exists "couples_delete" on public.couples;
create policy "couples_delete" on public.couples for delete
  using (member_a = auth.uid() or member_b = auth.uid());

-- MESSAGES : strictement réservés aux 2 membres du couple
drop policy if exists "messages_select" on public.messages;
create policy "messages_select" on public.messages for select
  using (couple_id = public.my_couple_id());

drop policy if exists "messages_insert" on public.messages;
create policy "messages_insert" on public.messages for insert
  with check (sender_id = auth.uid() and couple_id = public.my_couple_id());

drop policy if exists "messages_delete" on public.messages;
create policy "messages_delete" on public.messages for delete
  using (couple_id = public.my_couple_id());

-- ================================================================ REALTIME
-- (idempotent : ne casse pas si on relance le script)
do $$
begin
  begin
    alter publication supabase_realtime add table public.messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.couples;
  exception when duplicate_object then null;
  end;
end $$;
