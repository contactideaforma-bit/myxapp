-- =====================================================================
--  myXapp — Lot 3 : kamasutra
--
--  Chacun marque de son cote. "Deja teste" et "coup de coeur" sont
--  partages, mais l'ENVIE reste secrete : elle n'est revelee que si
--  les deux l'ont cochee. Personne ne se decouvre seul.
-- =====================================================================

create table if not exists public.position_marks (
  couple_id     uuid not null references public.couples(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  position_key  text not null,
  wants         boolean not null default false,   -- SECRET jusqu'a reciprocite
  done          boolean not null default false,   -- partage
  loved         boolean not null default false,   -- partage
  updated_at    timestamptz not null default now(),
  primary key (couple_id, user_id, position_key)
);

alter table public.position_marks enable row level security;

-- On ne lit QUE ses propres marques. L'envie de l'autre est inaccessible.
drop policy if exists "marks_select_own" on public.position_marks;
create policy "marks_select_own" on public.position_marks for select
  using (user_id = auth.uid() and couple_id = public.my_couple_id());

drop policy if exists "marks_upsert_own" on public.position_marks;
create policy "marks_upsert_own" on public.position_marks for insert
  with check (user_id = auth.uid() and couple_id = public.my_couple_id());

drop policy if exists "marks_update_own" on public.position_marks;
create policy "marks_update_own" on public.position_marks for update
  using (user_id = auth.uid() and couple_id = public.my_couple_id())
  with check (user_id = auth.uid() and couple_id = public.my_couple_id());

-- ------------------------------------------------- Vue d'ensemble
-- Seule cette fonction peut croiser les deux cotes. Elle ne renvoie
-- l'envie de l'autre que si la mienne est cochee aussi.
create or replace function public.positions_overview()
returns table (
  pos_key        text,
  my_wants       boolean,
  my_done        boolean,
  my_loved       boolean,
  both_want      boolean,
  partner_done   boolean,
  partner_loved  boolean
)
language sql
security definer stable set search_path = public
as $$
  with cid as (select public.my_couple_id() as id),
  moi as (
    select * from public.position_marks
    where couple_id = (select id from cid) and user_id = auth.uid()
  ),
  autre as (
    select * from public.position_marks
    where couple_id = (select id from cid) and user_id <> auth.uid()
  ),
  cles as (
    select position_key from moi
    union
    select position_key from autre
  )
  select
    k.position_key as pos_key,
    coalesce(m.wants, false),
    coalesce(m.done,  false),
    coalesce(m.loved, false),
    coalesce(m.wants, false) and coalesce(a.wants, false),  -- reciprocite seule
    coalesce(a.done,  false),
    coalesce(a.loved, false)
  from cles k
  left join moi   m on m.position_key = k.position_key
  left join autre a on a.position_key = k.position_key;
$$;

-- ------------------------------------------------- Ecriture
create or replace function public.set_position_mark(
  p_key   text,
  p_wants boolean default null,
  p_done  boolean default null,
  p_loved boolean default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  cid uuid := public.my_couple_id();
begin
  if cid is null then
    raise exception 'NO_COUPLE';
  end if;

  insert into public.position_marks (couple_id, user_id, position_key, wants, done, loved)
  values (cid, auth.uid(), p_key,
          coalesce(p_wants, false), coalesce(p_done, false), coalesce(p_loved, false))
  on conflict (couple_id, user_id, position_key) do update
    set wants      = coalesce(p_wants, position_marks.wants),
        done       = coalesce(p_done,  position_marks.done),
        loved      = coalesce(p_loved, position_marks.loved),
        updated_at = now();
end;
$$;
