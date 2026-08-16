export type Theme = {
  key: string;
  nom: string;
  emoji: string;
  accroche: string;
  defis: { key: string; texte: string }[];
};

export const THEMES: Theme[] = [
  {
    key: "tendresse",
    nom: "Tendresse",
    emoji: "🕊️",
    accroche: "Douceur, attention, présence. On ralentit.",
    defis: [
      { key: "t1", texte: "Dis-lui trois choses que tu aimes chez elle/lui et qui n'ont rien à voir avec le physique." },
      { key: "t2", texte: "Masse-lui les épaules pendant cinq minutes, sans rien attendre en retour." },
      { key: "t3", texte: "Raconte-lui le moment précis où tu as su que c'était sérieux." },
      { key: "t4", texte: "Embrassez-vous une minute entière, sans les mains. Chronométrez." },
      { key: "t5", texte: "Décris ce que tu ressens quand elle/il entre dans une pièce." },
      { key: "t6", texte: "Prends sa main et regarde-la vraiment. Dis ce que tu y vois." },
      { key: "t7", texte: "Écris-lui un message que tu lui enverras demain, à un moment où elle/il ne s'y attend pas." },
      { key: "t8", texte: "Choisis une chanson qui vous ressemble et écoutez-la, front contre front." },
      { key: "t9", texte: "Dis-lui la chose la plus courageuse que tu l'aies vu·e faire." },
      { key: "t10", texte: "Restez enlacés en silence deux minutes. Aucun mot n'est permis." },
    ],
  },
  {
    key: "seduction",
    nom: "Séduction",
    emoji: "💋",
    accroche: "Le désir qui monte. Rien ne presse — c'est le principe.",
    defis: [
      { key: "s1", texte: "Déshabille-la/le d'un seul vêtement. Puis arrête-toi et attends." },
      { key: "s2", texte: "Embrasse chaque endroit de son corps que tu trouves sous-estimé." },
      { key: "s3", texte: "Décris à voix haute ce que tu as envie de faire — sans le faire encore." },
      { key: "s4", texte: "Bande-lui les yeux et fais-lui deviner ce que tu poses sur sa peau." },
      { key: "s5", texte: "Dix minutes de baisers. Interdiction d'aller plus loin avant la fin." },
      { key: "s6", texte: "Sers-lui un verre et fais-lui la cour comme si vous ne vous connaissiez pas." },
      { key: "s7", texte: "Trouve l'endroit de sa nuque qui la/le fait frissonner. Reste-y." },
      { key: "s8", texte: "Danse avec elle/lui, lentement, tout habillés, lumière basse." },
      { key: "s9", texte: "Effleure-la/le du bout des doigts pendant deux minutes. Sans jamais appuyer." },
      { key: "s10", texte: "Murmure-lui à l'oreille ce dont tu as envie ce soir. Un seul mot suffit." },
    ],
  },
  {
    key: "complicite",
    nom: "Complicité",
    emoji: "🎭",
    accroche: "Rires, vérités, petites découvertes.",
    defis: [
      { key: "c1", texte: "Vérité : quelle est la chose la plus inattendue qui t'ait excité·e ?" },
      { key: "c2", texte: "Imitez-vous l'un l'autre pendant une minute. Le moins ressemblant a un gage." },
      { key: "c3", texte: "Racontez chacun votre version du premier baiser. Comparez." },
      { key: "c4", texte: "Choisis un surnom pour elle/lui que personne d'autre ne connaîtra." },
      { key: "c5", texte: "Vérité : y a-t-il quelque chose que tu n'as jamais osé demander ?" },
      { key: "c6", texte: "Décrivez chacun votre soirée idéale à deux. Trouvez ce qu'elles ont en commun." },
      { key: "c7", texte: "Gage : celle/celui qui tire prépare le petit-déjeuner demain, au lit." },
      { key: "c8", texte: "Montrez-vous la photo la plus gênante de vous. Sans négocier." },
      { key: "c9", texte: "Vérité : quel moment à deux referais-tu à l'identique, sans changer une virgule ?" },
      { key: "c10", texte: "Inventez ensemble le titre du film de votre histoire." },
    ],
  },
  {
    key: "audace",
    nom: "Audace",
    emoji: "🔥",
    accroche: "On sort un peu du cadre. À deux, et seulement si les deux veulent.",
    defis: [
      { key: "a1", texte: "Changez de pièce. Là, tout de suite." },
      { key: "a2", texte: "Elle/il garde les yeux fermés du début à la fin. Toi, tu mènes." },
      { key: "a3", texte: "Envoyez-vous une photo pendant la journée de demain. Une seule." },
      { key: "a4", texte: "Ce soir, l'un des deux ne peut pas utiliser ses mains." },
      { key: "a5", texte: "Laisse-la/le décider de tout pendant les vingt prochaines minutes." },
      { key: "a6", texte: "Choisissez une position dans l'onglet Positions que vous n'avez jamais essayée." },
      { key: "a7", texte: "Lumières éteintes, une seule bougie. Rien d'autre." },
      { key: "a8", texte: "Dis à voix haute un fantasme que tu n'as jamais formulé. L'autre écoute sans commenter." },
      { key: "a9", texte: "Interdiction de parler pendant dix minutes. Tout passe par le geste." },
      { key: "a10", texte: "Recommencez exactement là où vous vous étiez arrêtés la dernière fois." },
    ],
  },
  {
    key: "confidences",
    nom: "Confidences",
    emoji: "🌙",
    accroche: "Ce qu'on n'a jamais dit à voix haute. Sans jugement, jamais.",
    defis: [
      { key: "f1", texte: "Qu'est-ce qui te fait te sentir le plus désiré·e ?" },
      { key: "f2", texte: "Y a-t-il quelque chose que tu aimerais qu'on fasse plus souvent ?" },
      { key: "f3", texte: "Quel moment de nous rejoues-tu dans ta tête ?" },
      { key: "f4", texte: "Qu'est-ce qui te met en confiance, vraiment ?" },
      { key: "f5", texte: "Y a-t-il une chose que tu voudrais essayer et que tu n'oses pas nommer ? Décris-la en trois mots." },
      { key: "f6", texte: "Quel geste de ma part te touche le plus, et que je fais sans le savoir ?" },
      { key: "f7", texte: "Qu'est-ce qui te coupe l'envie, même quand tout va bien ?" },
      { key: "f8", texte: "Où voudrais-tu qu'on parte tous les deux, sans prévenir personne ?" },
      { key: "f9", texte: "Qu'est-ce que tu n'oses pas me demander de peur que ça change quelque chose ?" },
      { key: "f10", texte: "Dis-moi une chose que tu as adorée et que je n'ai jamais su." },
    ],
  },
];

export const TOUS_LES_DEFIS = Object.fromEntries(
  THEMES.flatMap((t) => t.defis.map((d) => [d.key, { ...d, theme: t }]))
) as Record<string, { key: string; texte: string; theme: Theme }>;
