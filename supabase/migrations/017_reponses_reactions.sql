-- =====================================================================
--  myXapp — Répondre à un message, et y réagir
-- =====================================================================

-- ------------------------------------------------- 1. Réponse ciblée
alter table public.messages
  add column if not exists reply_to uuid references public.messages(id) on delete set null;

create index if not exists messages_reply_idx on public.messages(reply_to);

-- ------------------------------------------------- 2. Réactions
-- Une seule réaction par personne et par message, comme dans iMessage :
-- réagir à nouveau remplace, réagir avec le même emoji retire.
create table if not exists public.reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  emoji      text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table public.reactions enable row level security;

-- Le message visé doit appartenir à notre conversation.
create or replace function public.message_est_a_nous(p_message uuid)
returns boolean
language sql
security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.messages m
    where m.id = p_message and m.couple_id = public.my_couple_id()
  );
$$;

drop policy if exists "reactions_select" on public.reactions;
create policy "reactions_select" on public.reactions for select
  using (public.message_est_a_nous(message_id));

drop policy if exists "reactions_insert" on public.reactions;
create policy "reactions_insert" on public.reactions for insert
  with check (user_id = auth.uid() and public.message_est_a_nous(message_id));

drop policy if exists "reactions_update" on public.reactions;
create policy "reactions_update" on public.reactions for update
  using (user_id = auth.uid() and public.message_est_a_nous(message_id))
  with check (user_id = auth.uid());

drop policy if exists "reactions_delete" on public.reactions;
create policy "reactions_delete" on public.reactions for delete
  using (user_id = auth.uid() and public.message_est_a_nous(message_id));

-- ------------------------------------------------- 3. Temps réel
alter table public.reactions replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.reactions;
  exception when duplicate_object then null;
  end;
end $$;
