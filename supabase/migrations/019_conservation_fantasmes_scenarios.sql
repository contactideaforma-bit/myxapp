-- =====================================================================
--  myXapp — Conservation 24 h, messages enregistrés,
--           Fantasmes (listes à cocher) et Scénarios (textes)
-- =====================================================================

-- ------------------------------------------------- 1. Messages gardés
alter table public.messages
  add column if not exists is_saved boolean not null default false;

create index if not exists messages_saved_idx
  on public.messages(couple_id) where is_saved;

create or replace function public.toggle_saved(p_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare v boolean;
begin
  update public.messages
  set is_saved = not is_saved
  where id = p_id and couple_id = public.my_couple_id()
  returning is_saved into v;
  if not found then raise exception 'MESSAGE_INTROUVABLE'; end if;
  return v;
end;
$$;

-- La purge efface les éphémères expirés ET tout ce qui a plus de 24 h,
-- SAUF ce qui a été explicitement enregistré.
create or replace function public.purge_expired()
returns void
language sql
security definer set search_path = public
as $$
  delete from public.messages
  where couple_id = public.my_couple_id()
    and (
      (expires_at is not null and expires_at < now())
      or (not is_saved and created_at < now() - interval '24 hours')
    );
$$;

-- ------------------------------------------------- 2. Présence lisible
create or replace function public.partner_status()
returns jsonb
language sql
security definer stable set search_path = public
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'en_ligne', p.last_active_at > now() - interval '60 seconds',
        'vu_le', p.last_active_at
      )
      from public.couples c
      join public.profiles p
        on p.id = case when c.member_a = auth.uid() then c.member_b else c.member_a end
      where c.id = public.my_couple_id()
    ),
    jsonb_build_object('en_ligne', false, 'vu_le', null)
  );
$$;

-- ------------------------------------------------- 3. Fantasmes
create table if not exists public.fantasy_lists (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references public.couples(id) on delete cascade,
  titre      text not null,
  emoji      text not null default '🔥',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.fantasy_items (
  id       uuid primary key default gen_random_uuid(),
  list_id  uuid not null references public.fantasy_lists(id) on delete cascade,
  texte    text not null,
  rang     int  not null default 0,
  created_at timestamptz not null default now()
);

-- Une ligne = « je l'ai coché ». L'absence de ligne = non coché.
create table if not exists public.fantasy_checks (
  item_id uuid not null references public.fantasy_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_id, user_id)
);

alter table public.fantasy_lists  enable row level security;
alter table public.fantasy_items  enable row level security;
alter table public.fantasy_checks enable row level security;

drop policy if exists "fl_all" on public.fantasy_lists;
create policy "fl_all" on public.fantasy_lists for all
  using (couple_id = public.my_couple_id())
  with check (couple_id = public.my_couple_id());

create or replace function public.liste_est_a_nous(p_list uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.fantasy_lists l
    where l.id = p_list and l.couple_id = public.my_couple_id()
  );
$$;

drop policy if exists "fi_all" on public.fantasy_items;
create policy "fi_all" on public.fantasy_items for all
  using (public.liste_est_a_nous(list_id))
  with check (public.liste_est_a_nous(list_id));

-- Je ne vois QUE mes propres coches : celles de l'autre restent secrètes
-- tant que la réciprocité n'est pas établie (voir fantasy_overview).
drop policy if exists "fc_own" on public.fantasy_checks;
create policy "fc_own" on public.fantasy_checks for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Seule cette fonction croise les deux côtés.
create or replace function public.fantasy_overview(p_list uuid)
returns table (item_id uuid, ma_coche boolean, les_deux boolean)
language sql
security definer stable set search_path = public
as $$
  select
    i.id,
    exists (select 1 from public.fantasy_checks c
            where c.item_id = i.id and c.user_id = auth.uid()),
    exists (select 1 from public.fantasy_checks c
            where c.item_id = i.id and c.user_id = auth.uid())
    and exists (select 1 from public.fantasy_checks c
            where c.item_id = i.id and c.user_id <> auth.uid())
  from public.fantasy_items i
  join public.fantasy_lists l on l.id = i.list_id
  where i.list_id = p_list and l.couple_id = public.my_couple_id();
$$;

-- ------------------------------------------------- 4. Scénarios
create table if not exists public.scenarios (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references public.couples(id) on delete cascade,
  titre      text not null default 'Sans titre',
  contenu    text not null default '',
  auteur     uuid references auth.users(id) on delete set null,
  favori     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scenarios_couple_idx
  on public.scenarios(couple_id, updated_at desc);

alter table public.scenarios enable row level security;

drop policy if exists "sc_all" on public.scenarios;
create policy "sc_all" on public.scenarios for all
  using (couple_id = public.my_couple_id())
  with check (couple_id = public.my_couple_id());

-- ------------------------------------------------- 5. Temps réel
do $$
begin
  begin alter publication supabase_realtime add table public.scenarios;
  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.fantasy_items;
  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.fantasy_checks;
  exception when duplicate_object then null; end;
end $$;
