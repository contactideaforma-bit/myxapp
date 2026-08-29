-- =====================================================================
-- 031 — « Vu » sur les Scénarios (Intime)
--
-- Même mécanique que les pages du journal (024) : quand l'un ouvre un
-- scénario écrit par l'autre, on le note ; l'auteur voit ✓✓.
-- Subtilité : une MODIFICATION du texte remet le compteur à zéro —
-- côté client, un « vu » ne compte que si vu_le >= updated_at.
--
-- À coller dans Supabase > SQL Editor > New query > Run
-- =====================================================================

create table if not exists public.scenario_reads (
  scenario_id uuid not null references public.scenarios(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  vu_le       timestamptz not null default now(),
  primary key (scenario_id, user_id)
);

alter table public.scenario_reads enable row level security;

-- Les deux voient qui a lu quoi (dans leur couple).
drop policy if exists scenario_reads_select on public.scenario_reads;
create policy scenario_reads_select on public.scenario_reads for select
  using (
    exists (
      select 1 from public.scenarios s
      where s.id = scenario_id and s.couple_id = public.my_couple_id()
    )
  );

-- On ne marque « vu » que pour soi, jamais sur ses propres textes.
drop policy if exists scenario_reads_insert on public.scenario_reads;
create policy scenario_reads_insert on public.scenario_reads for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.scenarios s
      where s.id = scenario_id
        and s.couple_id = public.my_couple_id()
        and s.auteur is distinct from auth.uid()
    )
  );

drop policy if exists scenario_reads_update on public.scenario_reads;
create policy scenario_reads_update on public.scenario_reads for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Un seul appel côté client : insère ou rafraîchit la date de lecture.
create or replace function public.scenario_marquer_lu(p_scenario uuid)
returns void
language sql
security definer set search_path = public
as $$
  insert into public.scenario_reads (scenario_id, user_id, vu_le)
  select p_scenario, auth.uid(), now()
  from public.scenarios s
  where s.id = p_scenario
    and s.couple_id = public.my_couple_id()
    and s.auteur is distinct from auth.uid()
  on conflict (scenario_id, user_id) do update set vu_le = now();
$$;

alter publication supabase_realtime add table public.scenario_reads;
