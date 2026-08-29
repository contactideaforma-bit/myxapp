-- =====================================================================
-- 030 — Mini-jeu « Tu me connais ? »
--
-- Pour chaque question, chacun donne SA vérité (sur soi) puis parie
-- sur la réponse de l'autre. Rien ne se dévoile tant qu'on n'a pas
-- joué : je ne vois ta vérité que si j'ai verrouillé mon pari, et je
-- ne vois ton pari sur moi que si j'ai donné ma vérité.
-- Quand une question est jouée des deux côtés, elle entre au fil
-- (game_events, jeu 'quiz') : ✓✓ vu, badge, réaction — comme partout.
-- =====================================================================

-- ------------------------------------------------- 1. Réponses (secrètes)
create table if not exists public.quiz_reponses (
  couple_id  uuid not null references public.couples(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  question   text not null,
  verite     text,                 -- ma réponse sur MOI
  devine     text,                 -- mon pari sur la réponse de l'autre
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (couple_id, user_id, question)
);

alter table public.quiz_reponses enable row level security;

create policy quiz_select_own on public.quiz_reponses
  for select using (user_id = auth.uid() and couple_id = public.my_couple_id());
create policy quiz_insert_own on public.quiz_reponses
  for insert with check (user_id = auth.uid() and couple_id = public.my_couple_id());
create policy quiz_update_own on public.quiz_reponses
  for update using (user_id = auth.uid() and couple_id = public.my_couple_id())
  with check (user_id = auth.uid() and couple_id = public.my_couple_id());

create or replace function public.quiz_touche()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists quiz_touche on public.quiz_reponses;
create trigger quiz_touche before update on public.quiz_reponses
  for each row execute function public.quiz_touche();

-- ------------------------------------------------- 2. Signal temps réel
-- (même relais que le Oui/Non : la RLS bloque les événements des lignes
-- de l'autre, on tape donc sur une ligne lisible par le couple)
create table if not exists public.quiz_activite (
  couple_id uuid primary key references public.couples(id) on delete cascade,
  maj       timestamptz not null default now()
);

alter table public.quiz_activite enable row level security;
create policy quiz_activite_select on public.quiz_activite
  for select using (couple_id = public.my_couple_id());

create or replace function public.quiz_signal()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.quiz_activite (couple_id, maj)
  values (new.couple_id, now())
  on conflict (couple_id) do update set maj = now();
  return new;
end;
$$;

drop trigger if exists quiz_signal on public.quiz_reponses;
create trigger quiz_signal after insert or update on public.quiz_reponses
  for each row execute function public.quiz_signal();

alter publication supabase_realtime add table public.quiz_activite;

-- ------------------------------------------------- 3. Révélation croisée
-- Une seule fonction, qui n'expose que ce qui est mérité :
--   sa_verite : seulement si J'AI parié (ma_devine posée)
--   sa_devine : seulement si J'AI donné ma vérité
create or replace function public.quiz_resultats()
returns table (question text, ma_verite text, ma_devine text, sa_verite text, sa_devine text)
language sql
security definer stable set search_path = public
as $$
  select coalesce(m.question, a.question),
         m.verite,
         m.devine,
         case when m.devine is not null then a.verite end,
         case when m.verite is not null then a.devine end
  from (select * from public.quiz_reponses
        where couple_id = public.my_couple_id() and user_id = auth.uid()) m
  full join (select * from public.quiz_reponses
        where couple_id = public.my_couple_id() and user_id <> auth.uid()) a
    on a.question = m.question;
$$;

-- Progression : questions jouées en entier (vérité + pari), par personne.
create or replace function public.quiz_progression()
returns jsonb
language sql
security definer stable set search_path = public
as $$
  select jsonb_build_object(
    'moi',   (select count(*) from public.quiz_reponses
              where couple_id = public.my_couple_id() and user_id = auth.uid()
                and verite is not null and devine is not null),
    'autre', (select count(*) from public.quiz_reponses
              where couple_id = public.my_couple_id() and user_id <> auth.uid()
                and verite is not null and devine is not null)
  );
$$;

-- ------------------------------------------------- 4. Question jouée → fil
-- Quand les DEUX ont joué une question en entier, elle entre au fil.
-- `par` = celui dont la réponse a complété la question : c'est l'autre
-- qui aura le « nouveau » et le ✓✓ à donner.
create or replace function public.quiz_question_event()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  complet boolean;
  existe  uuid;
begin
  select count(*) = 2 into complet
  from public.quiz_reponses r
  where r.couple_id = new.couple_id
    and r.question = new.question
    and r.verite is not null
    and r.devine is not null;

  if complet then
    select id into existe
    from public.game_events
    where couple_id = new.couple_id
      and jeu = 'quiz'
      and charge->>'question' = new.question
    limit 1;

    if existe is null then
      insert into public.game_events (couple_id, jeu, par, charge)
      values (new.couple_id, 'quiz', new.user_id, jsonb_build_object('question', new.question));
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists quiz_question_event on public.quiz_reponses;
create trigger quiz_question_event after insert or update on public.quiz_reponses
  for each row execute function public.quiz_question_event();
