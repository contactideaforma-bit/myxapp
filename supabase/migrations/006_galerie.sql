-- =====================================================================
--  myXapp — Lot 2 : galerie verrouillee, reellement contrainte cote serveur
--
--  Principe : le PIN n'ouvre pas un ecran, il ouvre une SESSION en base.
--  Sans session valide, la base refuse les lignes ET le Storage refuse
--  les fichiers — meme avec la cle anon et les outils de developpement.
--
--  A coller dans Supabase > SQL Editor > New query > Run
-- =====================================================================

-- ------------------------------------------------- 1. Anti force brute
alter table public.couples
  add column if not exists pin_fails       int not null default 0,
  add column if not exists pin_locked_until timestamptz;

-- Le hash du PIN et les compteurs ne doivent JAMAIS partir vers le client.
-- (En Postgres, un GRANT SELECT au niveau table couvre toutes les colonnes :
--  il faut donc le retirer puis re-accorder colonne par colonne.)
revoke select on public.couples from authenticated;
grant select (
  id, member_a, member_b, invite_code, created_at, paired_at, nickname, since_date
) on public.couples to authenticated;
revoke all on public.couples from anon;

-- ------------------------------------------------- 2. Sessions de coffre
create table if not exists public.vault_unlocks (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  couple_id      uuid not null references public.couples(id) on delete cascade,
  unlocked_until timestamptz not null
);

alter table public.vault_unlocks enable row level security;
-- Aucune policy : la table n'est accessible QUE par les fonctions ci-dessous.

create or replace function public.vault_is_unlocked()
returns boolean
language sql
security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.vault_unlocks
    where user_id = auth.uid()
      and couple_id = public.my_couple_id()
      and unlocked_until > now()
  );
$$;

create or replace function public.unlock_vault(p_pin text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  c        public.couples;
  correct  boolean;
  echecs   int;
begin
  select * into c from public.couples where id = public.my_couple_id();
  if not found then
    raise exception 'NO_COUPLE';
  end if;
  if c.gallery_pin is null then
    raise exception 'NO_PIN';
  end if;

  -- Verrouillage temporaire apres 5 essais rates
  if c.pin_locked_until is not null and c.pin_locked_until > now() then
    return jsonb_build_object(
      'ok', false,
      'bloque_jusqua', c.pin_locked_until,
      'restant', 0
    );
  end if;

  correct := (c.gallery_pin = extensions.crypt(p_pin, c.gallery_pin));

  if correct then
    update public.couples
    set pin_fails = 0, pin_locked_until = null
    where id = c.id;

    insert into public.vault_unlocks (user_id, couple_id, unlocked_until)
    values (auth.uid(), c.id, now() + interval '15 minutes')
    on conflict (user_id) do update
      set unlocked_until = excluded.unlocked_until,
          couple_id      = excluded.couple_id;

    return jsonb_build_object('ok', true);
  end if;

  echecs := c.pin_fails + 1;
  update public.couples
  set pin_fails = echecs,
      pin_locked_until = case when echecs >= 5 then now() + interval '5 minutes' end
  where id = c.id;

  return jsonb_build_object(
    'ok', false,
    'restant', greatest(0, 5 - echecs),
    'bloque_jusqua', case when echecs >= 5 then now() + interval '5 minutes' end
  );
end;
$$;

create or replace function public.lock_vault()
returns void
language sql
security definer set search_path = public
as $$
  delete from public.vault_unlocks where user_id = auth.uid();
$$;

-- ------------------------------------------------- 3. La galerie
create table if not exists public.gallery_items (
  id           uuid primary key default gen_random_uuid(),
  couple_id    uuid not null references public.couples(id) on delete cascade,
  uploader_id  uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  caption      text,
  favorite     boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists gallery_couple_idx
  on public.gallery_items(couple_id, created_at desc);

alter table public.gallery_items enable row level security;

-- Etre du couple ne suffit pas : il faut une session de coffre ouverte.
drop policy if exists "gallery_select" on public.gallery_items;
create policy "gallery_select" on public.gallery_items for select
  using (couple_id = public.my_couple_id() and public.vault_is_unlocked());

drop policy if exists "gallery_insert" on public.gallery_items;
create policy "gallery_insert" on public.gallery_items for insert
  with check (
    uploader_id = auth.uid()
    and couple_id = public.my_couple_id()
    and public.vault_is_unlocked()
  );

drop policy if exists "gallery_update" on public.gallery_items;
create policy "gallery_update" on public.gallery_items for update
  using (couple_id = public.my_couple_id() and public.vault_is_unlocked())
  with check (couple_id = public.my_couple_id() and public.vault_is_unlocked());

drop policy if exists "gallery_delete" on public.gallery_items;
create policy "gallery_delete" on public.gallery_items for delete
  using (couple_id = public.my_couple_id() and public.vault_is_unlocked());

-- ------------------------------------------------- 4. Storage : dossier vault
-- Les photos de la galerie vivent sous {couple_id}/vault/...
-- Meme sans session ouverte, l'URL signee est refusee a la source.
drop policy if exists "intimate_select" on storage.objects;
create policy "intimate_select" on storage.objects for select
  to authenticated
  using (
    bucket_id = 'intimate'
    and (storage.foldername(name))[1] = public.my_couple_id()::text
    and (
      (storage.foldername(name))[2] is distinct from 'vault'
      or public.vault_is_unlocked()
    )
  );

drop policy if exists "intimate_insert" on storage.objects;
create policy "intimate_insert" on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'intimate'
    and (storage.foldername(name))[1] = public.my_couple_id()::text
    and (
      (storage.foldername(name))[2] is distinct from 'vault'
      or public.vault_is_unlocked()
    )
  );

drop policy if exists "intimate_delete" on storage.objects;
create policy "intimate_delete" on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'intimate'
    and (storage.foldername(name))[1] = public.my_couple_id()::text
    and (
      (storage.foldername(name))[2] is distinct from 'vault'
      or public.vault_is_unlocked()
    )
  );

-- ------------------------------------------------- 5. Menage
-- Supprime les sessions expirees (appelee par le client de temps en temps)
create or replace function public.purge_vault_sessions()
returns void
language sql
security definer set search_path = public
as $$
  delete from public.vault_unlocks where unlocked_until < now() - interval '1 day';
$$;
