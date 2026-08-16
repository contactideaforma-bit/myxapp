-- =====================================================================
--  myXapp — Lot 4 : jeux et challenges
--
--  Une partie = un theme choisi a deux, puis des defis tires a tour de
--  role. L'etat est partage : la carte tiree apparait en direct chez
--  l'autre grace au temps reel.
-- =====================================================================

create table if not exists public.game_state (
  couple_id    uuid primary key references public.couples(id) on delete cascade,
  theme        text,
  current_key  text,
  drawn_by     uuid references auth.users(id) on delete set null,
  drawn_at     timestamptz,
  updated_at   timestamptz not null default now()
);

create table if not exists public.game_history (
  id            uuid primary key default gen_random_uuid(),
  couple_id     uuid not null references public.couples(id) on delete cascade,
  theme         text not null,
  challenge_key text not null,
  status        text not null check (status in ('releve', 'passe')),
  resolved_by   uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists game_history_couple_idx
  on public.game_history(couple_id, created_at desc);

alter table public.game_state   enable row level security;
alter table public.game_history enable row level security;

drop policy if exists "game_state_select" on public.game_state;
create policy "game_state_select" on public.game_state for select
  using (couple_id = public.my_couple_id());

drop policy if exists "game_history_select" on public.game_history;
create policy "game_history_select" on public.game_history for select
  using (couple_id = public.my_couple_id());

-- Les ecritures passent par des RPC : impossible de bricoler l'etat.

create or replace function public.set_game_theme(p_theme text)
returns public.game_state
language plpgsql
security definer set search_path = public
as $$
declare
  cid uuid := public.my_couple_id();
  row public.game_state;
begin
  if cid is null then raise exception 'NO_COUPLE'; end if;

  insert into public.game_state (couple_id, theme, current_key, drawn_by, drawn_at)
  values (cid, p_theme, null, null, null)
  on conflict (couple_id) do update
    set theme       = excluded.theme,
        current_key = null,
        drawn_by    = null,
        drawn_at    = null,
        updated_at  = now()
  returning * into row;

  return row;
end;
$$;

create or replace function public.draw_challenge(p_key text)
returns public.game_state
language plpgsql
security definer set search_path = public
as $$
declare
  cid uuid := public.my_couple_id();
  row public.game_state;
begin
  if cid is null then raise exception 'NO_COUPLE'; end if;

  update public.game_state
  set current_key = p_key,
      drawn_by    = auth.uid(),
      drawn_at    = now(),
      updated_at  = now()
  where couple_id = cid
  returning * into row;

  if not found then raise exception 'NO_THEME'; end if;
  return row;
end;
$$;

create or replace function public.resolve_challenge(p_status text)
returns public.game_state
language plpgsql
security definer set search_path = public
as $$
declare
  cid uuid := public.my_couple_id();
  cur public.game_state;
  row public.game_state;
begin
  if cid is null then raise exception 'NO_COUPLE'; end if;
  if p_status not in ('releve', 'passe') then raise exception 'BAD_STATUS'; end if;

  select * into cur from public.game_state where couple_id = cid;
  if not found or cur.current_key is null then raise exception 'NO_CHALLENGE'; end if;

  insert into public.game_history (couple_id, theme, challenge_key, status, resolved_by)
  values (cid, coalesce(cur.theme, '?'), cur.current_key, p_status, auth.uid());

  update public.game_state
  set current_key = null,
      drawn_by    = null,
      drawn_at    = null,
      updated_at  = now()
  where couple_id = cid
  returning * into row;

  return row;
end;
$$;

-- Temps reel (idempotent)
do $$
begin
  begin
    alter publication supabase_realtime add table public.game_state;
  exception when duplicate_object then null;
  end;
end $$;
