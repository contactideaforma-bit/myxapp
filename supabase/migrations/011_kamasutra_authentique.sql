-- =====================================================================
--  myXapp — Catalogue authentique du Kâma Sûtra
--
--  Source : Vâtsyâyana, Kâma Sûtra, Livre II « De l'union sexuelle »,
--  chapitre VI (les vingt premieres) et chapitre VIII (les trois ou la
--  femme prend le role actif). Traduction anglaise de Richard Burton
--  (1883), domaine public.
--
--  Les positions a plusieurs partenaires du chapitre VI (« union unie »,
--  « troupeau de vaches ») sont volontairement ecartees : hors sujet.
-- =====================================================================

alter table public.positions
  add column if not exists nom_original text;   -- nom de Burton

-- ------------------------------------------------- Le catalogue
insert into public.positions
  (key, nom, nom_original, sous_titre, description, conseil, difficulte, intensite, figure, source, ordre)
values

 ('grande_ouverte', 'La Grande Ouverte', 'Widely opened position', 'Elle, tête basse, bassin relevé',
  'La première que décrit Vâtsyâyana. Elle abaisse la tête et relève le bassin ; le corps dessine une courbe qui ouvre tout l''angle.',
  'Un coussin sous les reins fait le travail que le texte demande aux muscles. Personne n''est là pour souffrir.', 1, 2, 'grande_ouverte', 'kamasutra', 10),

 ('baillement', 'Le Bâillement', 'Yawning position', 'Cuisses relevées et écartées',
  'Elle relève les cuisses et les tient largement écartées. Le nom vient de l''ampleur de l''ouverture, comme un bâillement.',
  'C''est une position d''amplitude, pas de vitesse. Le texte insiste sur la lenteur qu''elle appelle.', 1, 2, 'baillement', 'kamasutra', 20),

 ('indrani', 'La Position d''Indrâni', 'Position of Indrani', 'Cuisses repliées sur les côtés',
  'Nommée d''après l''épouse d''Indra. Elle replie les cuisses et les ramène de part et d''autre du buste. Vâtsyâyana la réserve à ce qu''il appelle « l''union haute ».',
  'Le texte prévient : elle demande de la pratique. Approchez-la progressivement, sur plusieurs soirs.', 3, 3, 'indrani', 'kamasutra', 30),

 ('enlacement', 'L''Enlacement', 'Clasping position', 'Jambes tendues, l''une sur l''autre',
  'Les jambes des deux amants sont tendues et posées l''une sur l''autre. Vâtsyâyana en donne deux formes : de côté, et l''un sur l''autre.',
  'La forme couchée sur le côté est celle qu''il recommande pour durer. C''est la position du temps long.', 1, 1, 'enlacement', 'kamasutra', 40),

 ('pression', 'La Pression', 'Pressing position', 'L''enlacement, resserré',
  'Depuis l''enlacement, elle le presse entre ses cuisses. Le texte la présente comme une variation, pas comme une position à part — le passage de l''une à l''autre fait tout.',
  'Ne changez rien d''autre. C''est le seul resserrement qui doit se remarquer.', 1, 2, 'pression', 'kamasutra', 50),

 ('entrelacement', 'L''Entrelacement', 'Twining position', 'Une cuisse en travers',
  'Elle pose une cuisse en travers de celle de son amant. Léger déport, angle nouveau, appui différent.',
  'Ce déséquilibre volontaire libère une main. Servez-vous-en.', 1, 2, 'entrelacement', 'kamasutra', 60),

 ('jument', 'La Jument', 'Mare''s position', 'Elle retient, elle décide',
  'La seule position du chapitre qui ne décrive pas une posture mais un geste intérieur : elle le retient et le garde. Vâtsyâyana précise qu''elle ne s''apprend que par la pratique, et l''attribue aux femmes du pays d''Andhra.',
  'Elle se travaille seule, à froid, avant de se tenter à deux. C''est un muscle, pas une intention.', 3, 3, 'jument', 'kamasutra', 70),

 ('elevation', 'L''Élévation', 'Rising position', 'Les deux cuisses droites vers le haut',
  'Elle lève les deux cuisses tendues à la verticale. Attribuée par Vâtsyâyana au maître Suvarnanâbha, comme les huit suivantes.',
  'Ses jambes appuyées contre le torse de son amant tiendront mieux que sa seule force.', 2, 3, 'elevation', 'kamasutra', 80),

 ('jambes_epaules', 'Les Jambes aux épaules', 'Yawning position (Suvarnanâbha)', 'Ses jambes sur ses épaules à lui',
  'Elle pose ses jambes sur les épaules de son amant. Burton lui donne le même nom qu''au bâillement ; c''en est la forme la plus ouverte.',
  'Profonde par construction. Le texte recommande d''y venir progressivement, jamais d''emblée.', 2, 3, 'jambes_epaules', 'kamasutra', 90),

 ('pressee', 'La Pressée', 'Pressed position', 'Jambes repliées contre son torse',
  'Ses jambes à elle, repliées, sont tenues contre la poitrine de son amant. Le corps se referme, la profondeur augmente.',
  'Ses mains à lui sur ses genoux à elle : c''est lui qui règle l''amplitude, et il doit le savoir.', 2, 3, 'pressee', 'kamasutra', 100),

 ('demi_pressee', 'La Demi-pressée', 'Half pressed position', 'Une jambe repliée, une tendue',
  'La pressée, mais une seule jambe repliée ; l''autre reste tendue. L''asymétrie change l''appui et adoucit l''ensemble.',
  'Alternez la jambe repliée. Le texte présente ces variations comme un enchaînement, pas comme un choix figé.', 1, 2, 'demi_pressee', 'kamasutra', 110),

 ('bambou_fendu', 'Le Bambou fendu', 'Splitting of a bamboo', 'Une jambe sur l''épaule, puis l''autre',
  'Elle place une jambe sur l''épaule de son amant et tend l''autre, puis échange — encore et encore. L''image du bambou qu''on fend vient de ce mouvement alterné.',
  'Tout est dans l''alternance, régulière et sans hâte. Une position figée n''est plus celle-là.', 2, 3, 'bambou_fendu', 'kamasutra', 120),

 ('clou_plante', 'Le Clou planté', 'Fixing of a nail', 'Une jambe haute, une tendue',
  'Une jambe remontée jusqu''à la hauteur de la tête de son amant, l''autre restée tendue. Vâtsyâyana la range parmi celles qui demandent de l''entraînement.',
  'Souplesse requise, sincèrement. À réserver aux soirs où le corps suit.', 3, 3, 'clou_plante', 'kamasutra', 130),

 ('crabe', 'Le Crabe', 'Crab''s position', 'Jambes repliées sur le ventre',
  'Elle replie les deux jambes et les ramène sur son ventre. Le corps se recroqueville, tout se resserre.',
  'Position courte par nature. Le texte la donne comme un passage, entre deux autres.', 2, 2, 'crabe', 'kamasutra', 140),

 ('empilee', 'L''Empilée', 'Packed position', 'Les cuisses l''une sur l''autre',
  'Ses cuisses relevées et posées l''une sur l''autre, empilées. Étroite, fermée, d''une intensité particulière.',
  'L''étroitesse est le sujet. Ralentissez de moitié.', 2, 3, 'empilee', 'kamasutra', 150),

 ('lotus', 'Le Lotus', 'Lotus-like position', 'Jambes croisées, comme en méditation',
  'Les jambes croisées à la manière du lotus de la méditation. Vâtsyâyana emprunte directement à la posture assise du yoga.',
  'Respirez ensemble une minute avant de bouger. La filiation avec la méditation n''est pas un hasard.', 3, 2, 'lotus', 'kamasutra', 160),

 ('volte', 'La Volte', 'Turning position', 'Il fait un tour complet',
  'Il pivote entièrement sans se retirer, tandis qu''elle le tient embrassé. Vâtsyâyana précise que celle-là ne s''apprend que par la pratique.',
  'Personne ne la réussit du premier coup. Riez-en, c''est prévu par le texte lui-même.', 3, 3, 'volte', 'kamasutra', 170),

 ('soutenue', 'L''Union soutenue', 'Supported congress', 'Debout, appuyés',
  'Debout tous les deux, s''appuyant l''un sur l''autre ou contre un mur. La plus immédiate — celle du couloir, de la porte à peine refermée.',
  'Le mur travaille pour vous. Une différence de taille se règle avec une marche ou un rebord.', 2, 3, 'soutenue', 'kamasutra', 180),

 ('suspendue', 'L''Union suspendue', 'Suspended congress', 'Il la porte, dos au mur',
  'Il s''adosse au mur, elle s''assied sur ses mains jointes, les bras autour de son cou, et prend appui des pieds contre la paroi.',
  'Le mur porte l''essentiel du poids, pas les bras. Sinon, ça ne durera pas trente secondes.', 3, 3, 'suspendue', 'kamasutra', 190),

 ('vache', 'L''Union de la vache', 'Congress of a cow', 'Elle sur les mains et les pieds',
  'Elle se tient sur les mains et les pieds, il la couvre par-derrière. Vâtsyâyana ouvre ensuite tout un registre d''unions à la manière des animaux — le chien, la chèvre, le cerf, le tigre, l''éléphant.',
  'Le regard se perd, et c''est précisément ce qui libère. Une main dans les cheveux le ramène quand on veut.', 1, 3, 'vache', 'kamasutra', 200),

 ('tenailles', 'Les Tenailles', 'The pair of tongs', 'Elle au-dessus, elle retient',
  'Chapitre VIII, quand la femme prend le rôle de l''homme. Elle le retient en elle, le presse, et le garde ainsi longuement.',
  'Le mouvement s''arrête, l''intensité non. Tenez plus longtemps que ce qui semble raisonnable.', 2, 3, 'tenailles', 'kamasutra', 210),

 ('toupie', 'La Toupie', 'The top', 'Elle tourne sur elle-même',
  'Elle pivote comme une roue, sans interrompre l''union. Vâtsyâyana la présente comme l''un des trois gestes qui ne s''acquièrent que par la pratique.',
  'Un appui des mains sur son torse à lui rend la rotation possible. Sans appui, c''est une chute.', 3, 3, 'toupie', 'kamasutra', 220),

 ('balancoire', 'La Balançoire', 'The swing', 'Il soulève, elle tourne',
  'Il soulève le bassin, elle fait tourner le sien. Deux mouvements distincts qui se répondent — le troisième geste de la femme active.',
  'Cherchez le contretemps, pas la synchronisation. C''est le décalage qui fait la balançoire.', 2, 3, 'balancoire', 'kamasutra', 230)

on conflict (key) do update
  set nom          = excluded.nom,
      nom_original = excluded.nom_original,
      sous_titre   = excluded.sous_titre,
      description  = excluded.description,
      conseil      = excluded.conseil,
      difficulte   = excluded.difficulte,
      intensite    = excluded.intensite,
      figure       = excluded.figure,
      source       = excluded.source,
      ordre        = excluded.ordre,
      active       = true;

-- ------------------------------------------------- Nettoyage
-- On retire l'ancien catalogue maison et les illustrations importees
-- qui ne venaient pas du Kâma Sûtra.
delete from public.positions where source <> 'kamasutra';

-- Les marques orphelines (envies, tests) des anciennes cles disparaissent.
delete from public.position_marks
where position_key not in (select key from public.positions);
