-- =====================================================================
--  myXapp — Chat : suppression et accuses de lecture
-- =====================================================================

-- Je ne peux supprimer que MES messages. Pour tout effacer d'un coup,
-- il y a clear_conversation() ci-dessous, qui est un geste explicite.
drop policy if exists "messages_delete" on public.messages;
create policy "messages_delete" on public.messages for delete
  using (sender_id = auth.uid() and couple_id = public.my_couple_id());

create or replace function public.clear_conversation()
returns void
language sql
security definer set search_path = public
as $$
  delete from public.messages where couple_id = public.my_couple_id();
$$;

-- mark_read() renvoyait void ; elle renvoie desormais un entier.
-- Postgres refuse de changer le type de retour via create or replace :
-- il faut la supprimer d'abord.
drop function if exists public.mark_read();

-- Marque comme lus les messages recus, et renvoie combien l'ont ete
-- (permet au client de savoir s'il doit rafraichir).
create or replace function public.mark_read()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  n integer;
begin
  update public.messages
  set read_at = now()
  where couple_id = public.my_couple_id()
    and sender_id <> auth.uid()
    and read_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- La suppression doit remonter en temps reel avec assez d'infos pour
-- retrouver la ligne chez l'autre.
alter table public.messages replica identity full;
