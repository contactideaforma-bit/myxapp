-- =====================================================================
-- 027 — Socle des mini-jeux : game_sessions
--
-- Une ligne par (couple, jeu) : l'état PARTAGÉ de la partie, en JSON.
-- Les deux la lisent et l'écrivent ; le temps réel la diffuse — c'est
-- ce qui fait que chacun voit exactement la même chose, à distance.
-- Premier client : les Dés coquins (jeu = 'des'). Servira ensuite au
-- quiz « Tu me connais ? » et à Action ou Vérité.
--
-- ⚠ L'état ici est visible par LES DEUX. Tout ce qui doit rester
-- secret (réponses du quiz avant révélation…) passera par des tables
-- à RLS « chacun ses lignes » + signal, sur le modèle onp_* (026).
-- =====================================================================

create table if not exists public.game_sessions (
  couple_id  uuid not null references public.couples(id) on delete cascade,
  jeu        text not null,
  etat       jsonb not null default '{}'::jsonb,
  maj_par    uuid,
  updated_at timestamptz not null default now(),
  primary key (couple_id, jeu)
);

alter table public.game_sessions enable row level security;

create policy sessions_select on public.game_sessions
  for select using (couple_id = public.my_couple_id());
create policy sessions_insert on public.game_sessions
  for insert with check (couple_id = public.my_couple_id());
create policy sessions_update on public.game_sessions
  for update using (couple_id = public.my_couple_id())
  with check (couple_id = public.my_couple_id());

-- Qui a joué, quand — rempli par la base, pas par le client.
create or replace function public.sessions_touche()
returns trigger
language plpgsql
as $$
begin
  new.maj_par := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists sessions_touche on public.game_sessions;
create trigger sessions_touche before insert or update on public.game_sessions
  for each row execute function public.sessions_touche();

alter publication supabase_realtime add table public.game_sessions;
