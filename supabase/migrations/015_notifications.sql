-- =====================================================================
--  myXapp — Notifications push
--
--  Un abonnement par navigateur/appareil. La cle p256dh et l'auth sont
--  celles du navigateur : elles ne servent qu'a chiffrer la charge utile
--  a destination de CET appareil.
-- =====================================================================

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  couple_id  uuid references public.couples(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists push_user_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

-- Je ne gere que MES propres abonnements. L'envoi vers le/la partenaire
-- passe par la route serveur, qui utilise la cle service_role.
drop policy if exists "push_select_own" on public.push_subscriptions;
create policy "push_select_own" on public.push_subscriptions for select
  using (user_id = auth.uid());

drop policy if exists "push_insert_own" on public.push_subscriptions;
create policy "push_insert_own" on public.push_subscriptions for insert
  with check (user_id = auth.uid());

drop policy if exists "push_delete_own" on public.push_subscriptions;
create policy "push_delete_own" on public.push_subscriptions for delete
  using (user_id = auth.uid());

-- ------------------------------------------------- Discretion
-- 'discret'  : la notification ne dit rien du contenu
-- 'apercu'   : elle montre le debut du message
alter table public.profiles
  add column if not exists notif_style text not null default 'discret';

do $$
begin
  alter table public.profiles
    add constraint notif_style_valide check (notif_style in ('discret', 'apercu'));
exception when duplicate_object then null;
end $$;

-- ------------------------------------------------- Cibles d'envoi
-- Renvoie les abonnements du/de la partenaire, et son choix de discretion.
-- security definer : evite d'avoir a poser une cle service_role sur le
-- serveur web pour lire les abonnements de l'autre.
create or replace function public.partner_push_targets()
returns table (endpoint text, p256dh text, cle_auth text, style text)
language sql
security definer stable set search_path = public
as $$
  select s.endpoint, s.p256dh, s.auth, coalesce(p.notif_style, 'discret')
  from public.couples c
  join public.push_subscriptions s
    on s.user_id = case when c.member_a = auth.uid() then c.member_b else c.member_a end
  left join public.profiles p on p.id = s.user_id
  where c.id = public.my_couple_id();
$$;

-- Nettoyage d'un abonnement mort (410 Gone renvoye par le service push)
create or replace function public.remove_push_endpoint(p_endpoint text)
returns void
language sql
security definer set search_path = public
as $$
  delete from public.push_subscriptions s
  using public.couples c
  where s.endpoint = p_endpoint
    and c.id = public.my_couple_id()
    and s.user_id in (c.member_a, c.member_b);
$$;
