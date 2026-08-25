-- =====================================================================
--  myXapp — 024 : « Vu » sur les pages du journal
--
--  Quand l'un ouvre une page écrite par l'autre, on le note. L'auteur
--  voit alors « Vu par … · il y a 2 h ». Gardé par la session journal,
--  comme le reste. La dernière connexion du/de la partenaire vient de
--  profiles.last_active_at (018), déjà tenu à jour par ping_presence().
--
--  A coller dans Supabase > SQL Editor > New query > Run
-- =====================================================================

create table if not exists public.journal_reads (
  entry_id  uuid not null references public.journal_entries(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  vu_le     timestamptz not null default now(),
  primary key (entry_id, user_id)
);

alter table public.journal_reads enable row level security;

-- Les deux voient qui a lu quoi (dans leur couple, session ouverte).
drop policy if exists "journal_reads_select" on public.journal_reads;
create policy "journal_reads_select" on public.journal_reads for select
  using (
    public.journal_is_unlocked()
    and exists (
      select 1 from public.journal_entries e
      where e.id = entry_id and e.couple_id = public.my_couple_id()
    )
  );

-- On ne marque « vu » que pour soi, et jamais sur ses propres pages.
drop policy if exists "journal_reads_insert" on public.journal_reads;
create policy "journal_reads_insert" on public.journal_reads for insert
  with check (
    user_id = auth.uid()
    and public.journal_is_unlocked()
    and exists (
      select 1 from public.journal_entries e
      where e.id = entry_id
        and e.couple_id = public.my_couple_id()
        and e.auteur <> auth.uid()
    )
  );

drop policy if exists "journal_reads_update" on public.journal_reads;
create policy "journal_reads_update" on public.journal_reads for update
  using (user_id = auth.uid() and public.journal_is_unlocked())
  with check (user_id = auth.uid() and public.journal_is_unlocked());

-- Un seul appel côté client : insère ou rafraîchit la date de lecture.
create or replace function public.journal_marquer_lu(p_entry uuid)
returns void
language sql
security definer set search_path = public
as $$
  insert into public.journal_reads (entry_id, user_id, vu_le)
  select p_entry, auth.uid(), now()
  from public.journal_entries e
  where e.id = p_entry
    and e.couple_id = public.my_couple_id()
    and e.auteur <> auth.uid()
    and public.journal_is_unlocked()
  on conflict (entry_id, user_id) do update set vu_le = now();
$$;
