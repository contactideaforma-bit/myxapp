-- =====================================================================
--  myXapp — L'humeur du soir
--
--  Un seul geste pour dire où l'on en est, sans avoir à le demander.
--  Contrairement aux fantasmes, ce n'est PAS secret : c'est fait pour
--  être vu par l'autre — c'est tout l'intérêt.
-- =====================================================================

create table if not exists public.humeurs (
  couple_id  uuid not null references public.couples(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  niveau     int  not null check (niveau between 1 and 5),
  note       text,
  updated_at timestamptz not null default now(),
  primary key (couple_id, user_id)
);

alter table public.humeurs enable row level security;

drop policy if exists "humeurs_select" on public.humeurs;
create policy "humeurs_select" on public.humeurs for select
  using (couple_id = public.my_couple_id());

drop policy if exists "humeurs_ecrire" on public.humeurs;
create policy "humeurs_ecrire" on public.humeurs for all
  using (user_id = auth.uid() and couple_id = public.my_couple_id())
  with check (user_id = auth.uid() and couple_id = public.my_couple_id());

create or replace function public.set_humeur(p_niveau int, p_note text default null)
returns void
language sql
security definer set search_path = public
as $$
  insert into public.humeurs (couple_id, user_id, niveau, note, updated_at)
  values (public.my_couple_id(), auth.uid(), p_niveau, nullif(trim(p_note), ''), now())
  on conflict (couple_id, user_id) do update
    set niveau = excluded.niveau,
        note = excluded.note,
        updated_at = now();
$$;

-- L'humeur retombe d'elle-même après 18 h : elle dit « ce soir »,
-- pas « en permanence ».
create or replace function public.humeurs_du_moment()
returns table (user_id uuid, niveau int, note text, updated_at timestamptz)
language sql
security definer stable set search_path = public
as $$
  select h.user_id, h.niveau, h.note, h.updated_at
  from public.humeurs h
  where h.couple_id = public.my_couple_id()
    and h.updated_at > now() - interval '18 hours';
$$;

do $$
begin
  begin alter publication supabase_realtime add table public.humeurs;
  exception when duplicate_object then null; end;
end $$;
