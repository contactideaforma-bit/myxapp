-- =====================================================================
--  myXapp — Catalogue de positions en base + mode d'illustration
--
--  Le catalogue quitte le code : on peut ajouter, corriger, importer
--  sans redeployer. Chaque couple choisit son rendu : silhouettes
--  abstraites (discret) ou illustrations detaillees (importees).
-- =====================================================================

-- ------------------------------------------------- 1. Bucket du catalogue
-- Prive comme le reste : contenu non personnel, mais rien de public
-- ne sortira jamais de cette application.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('positions', 'positions', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
on conflict (id) do update
  set public = false, file_size_limit = 5242880;

drop policy if exists "positions_read" on storage.objects;
create policy "positions_read" on storage.objects for select
  to authenticated
  using (bucket_id = 'positions');

-- ------------------------------------------------- 2. Le catalogue
create table if not exists public.positions (
  key              text primary key,
  nom              text not null,
  sous_titre       text,
  description      text,
  conseil          text,
  difficulte       int  not null default 1 check (difficulte between 1 and 3),
  intensite        int  not null default 1 check (intensite  between 1 and 3),
  figure           text,          -- cle de silhouette SVG (mode discret)
  image_path       text,          -- fichier dans le bucket 'positions'
  image_credit     text,          -- "Seedfeeder — CC BY-SA 3.0"
  image_source_url text,
  source           text not null default 'maison',
  a_relire         boolean not null default false,
  ordre            int  not null default 100,
  active           boolean not null default true
);

alter table public.positions enable row level security;

-- Catalogue commun : lecture pour tout compte connecte, ecriture reservee
-- au service_role (donc au script d'import, jamais au navigateur).
drop policy if exists "positions_select" on public.positions;
create policy "positions_select" on public.positions for select
  to authenticated
  using (active);

-- ------------------------------------------------- 3. Mode d'illustration
alter table public.couples
  add column if not exists illustration_mode text not null default 'silhouette';

do $$
begin
  alter table public.couples
    add constraint illustration_mode_valide
    check (illustration_mode in ('silhouette', 'detaillee'));
exception when duplicate_object then null;
end $$;

-- On reaccorde la liste complete des colonnes lisibles (le GRANT au
-- niveau table a ete retire en 006 : toute nouvelle colonne doit etre
-- ajoutee ici, sinon elle reste invisible cote client).
grant select (
  id, member_a, member_b, invite_code, created_at, paired_at,
  nickname, since_date, illustration_mode
) on public.couples to authenticated;

create or replace function public.set_illustration_mode(p_mode text)
returns text
language plpgsql
security definer set search_path = public
as $$
begin
  if p_mode not in ('silhouette', 'detaillee') then
    raise exception 'BAD_MODE';
  end if;

  update public.couples
  set illustration_mode = p_mode
  where id = public.my_couple_id();

  if not found then raise exception 'NO_COUPLE'; end if;
  return p_mode;
end;
$$;

-- ------------------------------------------------- 4. Amorce du catalogue
insert into public.positions
  (key, nom, sous_titre, description, conseil, difficulte, intensite, figure, ordre)
values
 ('etreinte', 'L''Étreinte', 'Face à face, allongés',
  'La plus simple et la plus intime. Les visages se touchent, les regards ne se quittent pas, les mains restent libres. Rien ne détourne l''attention de l''autre.',
  'Un coussin sous les reins de celle qui est dessous change tout l''angle — et souvent tout le reste.', 1, 2, 'etreinte', 10),

 ('cavaliere', 'La Cavalière', 'Elle mène',
  'Assise sur lui, elle décide du rythme, de la profondeur, de la lenteur. Lui a les mains libres pour la taille, les hanches, la nuque.',
  'Qu''il pose ses mains sans diriger. C''est tout l''intérêt : lui rendre entièrement le tempo.', 1, 3, 'cavaliere', 20),

 ('cuillere', 'La Cuillère', 'Blottis, sur le côté',
  'Le corps entier en contact, du dos aux jambes. Douce, lente, presque paresseuse. Idéale au réveil ou quand la fatigue gagne.',
  'Sa main libre à lui devant, sa nuque à portée de bouche. C''est là que tout se joue.', 1, 1, 'cuillere', 30),

 ('levrette', 'La Levrette', 'Elle devant, lui derrière',
  'Profonde, franche, vigoureuse. Le regard se perd, ce qui libère : on ose des choses qu''on n''oserait pas les yeux dans les yeux.',
  'Un miroir en face, ou simplement sa main dans ses cheveux : le regard revient quand on veut.', 1, 3, 'levrette', 40),

 ('lotus', 'Le Lotus', 'Assis, enlacés',
  'Face à face, jambes nouées autour de l''autre, les fronts qui se touchent. Peu de mouvement, beaucoup de présence. Presque une méditation.',
  'Respirez ensemble, au même rythme, une minute avant de bouger. L''effet est étonnant.', 2, 2, 'lotus', 50),

 ('chaise', 'La Chaise', 'Elle sur ses genoux',
  'Lui assis, elle sur lui, dos ou face. Fonctionne partout où il y a de quoi s''asseoir — et le hors-lit a son charme propre.',
  'Dos à lui, ses mains à elle sur ses genoux à lui : elle contrôle l''amplitude au millimètre.', 2, 3, 'chaise', 60),

 ('ciseaux', 'Les Ciseaux', 'Jambes entrelacées',
  'Allongés en travers l''un de l''autre, les jambes croisées. L''angle est inhabituel, les sensations aussi. Une position de découverte.',
  'Cherchez le bon angle sans vous presser. Une fois trouvé, ne bougez plus rien d''autre.', 3, 2, 'ciseaux', 70),

 ('arche', 'L''Arche', 'Bassin relevé',
  'Elle allongée, le bassin surélevé par ses appuis ou par un coussin. Le corps s''ouvre, l''angle se creuse.',
  'Deux oreillers valent mieux qu''un effort de gainage. Personne n''est là pour souffrir.', 2, 3, 'arche', 80),

 ('debout', 'Debout', 'Contre le mur',
  'L''urgence même. Celle du couloir, de la porte à peine refermée, du moment où on n''a pas envie d''attendre la chambre.',
  'Une différence de taille se règle avec une marche, un rebord, ou simplement en la soulevant.', 3, 3, 'debout', 90),

 ('bord_du_lit', 'Le Bord du lit', 'Elle assise, lui debout',
  'Elle au bord du matelas, lui debout devant. La hauteur est parfaite, les mains sont partout, et le regard reste face à face.',
  'Une table ou un plan de travail fait exactement le même office. Explorez la maison.', 1, 3, 'bord_du_lit', 100),

 ('papillon', 'Le Papillon', 'Jambes relevées',
  'Elle allongée, jambes hautes contre son torse à lui ou sur ses épaules. Profonde, enveloppante, un peu vertigineuse.',
  'À réserver aux moments détendus : le corps a besoin d''être souple pour en profiter.', 2, 3, 'papillon', 110),

 ('ancre', 'L''Ancre', 'À plat ventre',
  'Elle sur le ventre, lui allongé sur elle. Tout le corps se touche, les mouvements sont courts, l''intensité est ailleurs — dans le poids, la chaleur, la lenteur.',
  'Sa bouche à lui contre sa nuque à elle. C''est le détail qui fait basculer.', 1, 2, 'ancre', 120)

on conflict (key) do update
  set nom         = excluded.nom,
      sous_titre  = excluded.sous_titre,
      description = excluded.description,
      conseil     = excluded.conseil,
      difficulte  = excluded.difficulte,
      intensite   = excluded.intensite,
      figure      = excluded.figure,
      ordre       = excluded.ordre;
