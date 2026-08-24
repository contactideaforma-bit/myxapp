-- =====================================================================
--  myXapp — 023 : Journal intime du couple
--
--  Même principe que la galerie : le code n'ouvre pas un écran, il ouvre
--  une SESSION en base (15 min). Sans session, ni les lignes ni les
--  photos ne sortent. Le code du journal est distinct de celui de la
--  galerie — la base refuse qu'ils soient identiques, dans les deux sens.
--
--  A coller dans Supabase > SQL Editor > New query > Run
-- =====================================================================

-- ------------------------------------------------- 1. Code du journal
alter table public.couples
  add column if not exists journal_pin          text,
  add column if not exists journal_fails        int not null default 0,
  add column if not exists journal_locked_until timestamptz;
-- (Le GRANT SELECT de 006 est colonne par colonne : ces trois colonnes
--  ne partent donc jamais vers le client.)

create or replace function public.set_journal_pin(p_pin text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  c public.couples;
begin
  if p_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN_FORMAT';
  end if;

  select * into c from public.couples where id = public.my_couple_id();
  if not found then
    raise exception 'NO_COUPLE';
  end if;

  -- Le journal ne s'ouvre pas avec la clé de la galerie.
  if c.gallery_pin is not null
     and c.gallery_pin = extensions.crypt(p_pin, c.gallery_pin) then
    raise exception 'PIN_SAME_AS_GALLERY';
  end if;

  update public.couples
  set journal_pin = extensions.crypt(p_pin, extensions.gen_salt('bf')),
      journal_fails = 0,
      journal_locked_until = null
  where id = c.id;
end;
$$;

-- Et réciproquement : changer le code galerie ne peut pas recopier
-- celui du journal.
create or replace function public.set_gallery_pin(p_pin text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  c public.couples;
begin
  if p_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN_FORMAT';
  end if;

  select * into c from public.couples where id = public.my_couple_id();
  if not found then
    raise exception 'NO_COUPLE';
  end if;

  if c.journal_pin is not null
     and c.journal_pin = extensions.crypt(p_pin, c.journal_pin) then
    raise exception 'PIN_SAME_AS_JOURNAL';
  end if;

  update public.couples
  set gallery_pin = extensions.crypt(p_pin, extensions.gen_salt('bf'))
  where id = c.id;
end;
$$;

create or replace function public.has_journal_pin()
returns boolean
language sql
security definer stable set search_path = public
as $$
  select coalesce(journal_pin is not null, false)
  from public.couples
  where id = public.my_couple_id();
$$;

-- ------------------------------------------------- 2. Sessions du journal
create table if not exists public.journal_unlocks (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  couple_id      uuid not null references public.couples(id) on delete cascade,
  unlocked_until timestamptz not null
);

alter table public.journal_unlocks enable row level security;
-- Aucune policy : accessible uniquement par les fonctions ci-dessous.

create or replace function public.journal_is_unlocked()
returns boolean
language sql
security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.journal_unlocks
    where user_id = auth.uid()
      and couple_id = public.my_couple_id()
      and unlocked_until > now()
  );
$$;

create or replace function public.unlock_journal(p_pin text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  c       public.couples;
  correct boolean;
  echecs  int;
begin
  select * into c from public.couples where id = public.my_couple_id();
  if not found then
    raise exception 'NO_COUPLE';
  end if;
  if c.journal_pin is null then
    raise exception 'NO_PIN';
  end if;

  if c.journal_locked_until is not null and c.journal_locked_until > now() then
    return jsonb_build_object('ok', false, 'bloque_jusqua', c.journal_locked_until, 'restant', 0);
  end if;

  correct := (c.journal_pin = extensions.crypt(p_pin, c.journal_pin));

  if correct then
    update public.couples
    set journal_fails = 0, journal_locked_until = null
    where id = c.id;

    insert into public.journal_unlocks (user_id, couple_id, unlocked_until)
    values (auth.uid(), c.id, now() + interval '15 minutes')
    on conflict (user_id) do update
      set unlocked_until = excluded.unlocked_until,
          couple_id      = excluded.couple_id;

    return jsonb_build_object('ok', true);
  end if;

  echecs := c.journal_fails + 1;
  update public.couples
  set journal_fails = echecs,
      journal_locked_until = case when echecs >= 5 then now() + interval '5 minutes' end
  where id = c.id;

  return jsonb_build_object(
    'ok', false,
    'restant', greatest(0, 5 - echecs),
    'bloque_jusqua', case when echecs >= 5 then now() + interval '5 minutes' end
  );
end;
$$;

create or replace function public.lock_journal()
returns void
language sql
security definer set search_path = public
as $$
  delete from public.journal_unlocks where user_id = auth.uid();
$$;

-- ------------------------------------------------- 3. Les entrées
create table if not exists public.journal_entries (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null references public.couples(id) on delete cascade,
  auteur      uuid not null references auth.users(id) on delete cascade,
  jour        date not null default current_date,
  titre       text,
  contenu     text not null default '',
  heureux     text,            -- ce qui m'a rendu(e) heureux(se)
  triste      text,            -- ce qui m'a rendu(e) triste
  humeur      text,            -- un émoji
  meteo       smallint check (meteo between 1 and 5),  -- météo intérieure
  tags        text[] not null default '{}',
  favori      boolean not null default false,
  photo_path  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists journal_couple_idx
  on public.journal_entries(couple_id, jour desc, created_at desc);

alter table public.journal_entries enable row level security;

-- Lecture : les deux, session ouverte.
drop policy if exists "journal_select" on public.journal_entries;
create policy "journal_select" on public.journal_entries for select
  using (couple_id = public.my_couple_id() and public.journal_is_unlocked());

drop policy if exists "journal_insert" on public.journal_entries;
create policy "journal_insert" on public.journal_entries for insert
  with check (
    auteur = auth.uid()
    and couple_id = public.my_couple_id()
    and public.journal_is_unlocked()
  );

-- Modification / suppression : l'auteur seulement. On peut lire l'autre,
-- pas réécrire ses mots.
drop policy if exists "journal_update" on public.journal_entries;
create policy "journal_update" on public.journal_entries for update
  using (auteur = auth.uid() and public.journal_is_unlocked())
  with check (auteur = auth.uid() and public.journal_is_unlocked());

drop policy if exists "journal_delete" on public.journal_entries;
create policy "journal_delete" on public.journal_entries for delete
  using (auteur = auth.uid() and public.journal_is_unlocked());

create or replace function public.journal_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists journal_touch on public.journal_entries;
create trigger journal_touch before update on public.journal_entries
  for each row execute function public.journal_touch();

-- ------------------------------------------------- 4. Storage : dossier journal
-- Photos sous {couple_id}/journal/... : gardées par la session journal,
-- comme {couple_id}/vault/... l'est par la session galerie.
create or replace function public.dossier_autorise(p_dossier text)
returns boolean
language sql
security definer stable set search_path = public
as $$
  select case p_dossier
    when 'vault'   then public.vault_is_unlocked()
    when 'journal' then public.journal_is_unlocked()
    else true
  end;
$$;

drop policy if exists "intimate_select" on storage.objects;
create policy "intimate_select" on storage.objects for select
  to authenticated
  using (
    bucket_id = 'intimate'
    and (storage.foldername(name))[1] = public.my_couple_id()::text
    and public.dossier_autorise((storage.foldername(name))[2])
  );

drop policy if exists "intimate_insert" on storage.objects;
create policy "intimate_insert" on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'intimate'
    and (storage.foldername(name))[1] = public.my_couple_id()::text
    and public.dossier_autorise((storage.foldername(name))[2])
  );

drop policy if exists "intimate_delete" on storage.objects;
create policy "intimate_delete" on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'intimate'
    and (storage.foldername(name))[1] = public.my_couple_id()::text
    and public.dossier_autorise((storage.foldername(name))[2])
  );

-- ------------------------------------------------- 5. Pastille « nouveau »
create or replace function public.nouveautes()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  cid   uuid := public.my_couple_id();
  moi   uuid := auth.uid();
  autre uuid;
  d_gal timestamptz;
  d_int timestamptz;
  d_jeu timestamptz;
  d_ide timestamptz;
  d_jou timestamptz;
begin
  if cid is null then return '{}'::jsonb; end if;

  select case when c.member_a = moi then c.member_b else c.member_a end
  into autre from public.couples c where c.id = cid;

  select coalesce(max(vu_le), 'epoch') into d_gal from public.vues where user_id = moi and rubrique = 'galerie';
  select coalesce(max(vu_le), 'epoch') into d_int from public.vues where user_id = moi and rubrique = 'intime';
  select coalesce(max(vu_le), 'epoch') into d_jeu from public.vues where user_id = moi and rubrique = 'jeux';
  select coalesce(max(vu_le), 'epoch') into d_ide from public.vues where user_id = moi and rubrique = 'idees';
  select coalesce(max(vu_le), 'epoch') into d_jou from public.vues where user_id = moi and rubrique = 'journal';

  return jsonb_build_object(
    'galerie', (
      select count(*) from public.gallery_items g
      where g.couple_id = cid and g.uploader_id = autre and g.created_at > d_gal
    ),
    'intime', (
      select
        (select count(*) from public.scenarios s
         where s.couple_id = cid and s.auteur = autre and s.updated_at > d_int)
      + (select count(*) from public.fantasy_items i
         join public.fantasy_lists l on l.id = i.list_id
         where l.couple_id = cid and i.created_by = autre and i.created_at > d_int)
    ),
    'jeux', (
      select count(*) from public.game_history h
      where h.couple_id = cid and h.resolved_by = autre and h.created_at > d_jeu
    ),
    'idees', (
      select count(*) from public.idees i
      where i.couple_id = cid and i.cree_par = autre and i.created_at > d_ide
    ),
    'journal', (
      select count(*) from public.journal_entries j
      where j.couple_id = cid and j.auteur = autre and j.updated_at > d_jou
    )
  );
end;
$$;

-- ------------------------------------------------- 6. Ménage
create or replace function public.purge_journal_sessions()
returns void
language sql
security definer set search_path = public
as $$
  delete from public.journal_unlocks where unlocked_until < now() - interval '1 day';
$$;
