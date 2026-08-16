export type Position = {
  key: string;
  nom: string;
  sousTitre: string;
  description: string;
  conseil: string;
  difficulte: 1 | 2 | 3;
  intensite: 1 | 2 | 3;
};

export const POSITIONS: Position[] = [
  {
    key: "etreinte",
    nom: "L'Étreinte",
    sousTitre: "Face à face, allongés",
    description:
      "La plus simple et la plus intime. Les visages se touchent, les regards ne se quittent pas, les mains restent libres. Rien ne détourne l'attention de l'autre.",
    conseil:
      "Un coussin sous les reins de celle qui est dessous change tout l'angle — et souvent tout le reste.",
    difficulte: 1,
    intensite: 2,
  },
  {
    key: "cavaliere",
    nom: "La Cavalière",
    sousTitre: "Elle mène",
    description:
      "Assise sur lui, elle décide du rythme, de la profondeur, de la lenteur. Lui a les mains libres pour la taille, les hanches, la nuque.",
    conseil:
      "Qu'il pose ses mains sans diriger. C'est tout l'intérêt : lui rendre entièrement le tempo.",
    difficulte: 1,
    intensite: 3,
  },
  {
    key: "cuillere",
    nom: "La Cuillère",
    sousTitre: "Blottis, sur le côté",
    description:
      "Le corps entier en contact, du dos aux jambes. Douce, lente, presque paresseuse. Idéale au réveil ou quand la fatigue gagne.",
    conseil:
      "Sa main libre à lui devant, sa nuque à portée de bouche. C'est là que tout se joue.",
    difficulte: 1,
    intensite: 1,
  },
  {
    key: "levrette",
    nom: "La Levrette",
    sousTitre: "Elle devant, lui derrière",
    description:
      "Profonde, franche, vigoureuse. Le regard se perd, ce qui libère : on ose des choses qu'on n'oserait pas les yeux dans les yeux.",
    conseil:
      "Un miroir en face, ou simplement sa main dans ses cheveux : le regard revient quand on veut.",
    difficulte: 1,
    intensite: 3,
  },
  {
    key: "lotus",
    nom: "Le Lotus",
    sousTitre: "Assis, enlacés",
    description:
      "Face à face, jambes nouées autour de l'autre, les fronts qui se touchent. Peu de mouvement, beaucoup de présence. Presque une méditation.",
    conseil:
      "Respirez ensemble, au même rythme, une minute avant de bouger. L'effet est étonnant.",
    difficulte: 2,
    intensite: 2,
  },
  {
    key: "chaise",
    nom: "La Chaise",
    sousTitre: "Elle sur ses genoux",
    description:
      "Lui assis, elle sur lui, dos ou face. Fonctionne partout où il y a de quoi s'asseoir — et le hors-lit a son charme propre.",
    conseil:
      "Dos à lui, ses mains à elle sur ses genoux à lui : elle contrôle l'amplitude au millimètre.",
    difficulte: 2,
    intensite: 3,
  },
  {
    key: "ciseaux",
    nom: "Les Ciseaux",
    sousTitre: "Jambes entrelacées",
    description:
      "Allongés en travers l'un de l'autre, les jambes croisées. L'angle est inhabituel, les sensations aussi. Une position de découverte.",
    conseil:
      "Cherchez le bon angle sans vous presser. Une fois trouvé, ne bougez plus rien d'autre.",
    difficulte: 3,
    intensite: 2,
  },
  {
    key: "arche",
    nom: "L'Arche",
    sousTitre: "Bassin relevé",
    description:
      "Elle allongée, le bassin surélevé par ses appuis ou par un coussin. Le corps s'ouvre, l'angle se creuse.",
    conseil: "Deux oreillers valent mieux qu'un effort de gainage. Personne n'est là pour souffrir.",
    difficulte: 2,
    intensite: 3,
  },
  {
    key: "debout",
    nom: "Debout",
    sousTitre: "Contre le mur",
    description:
      "L'urgence même. Celle du couloir, de la porte à peine refermée, du moment où on n'a pas envie d'attendre la chambre.",
    conseil:
      "Une différence de taille se règle avec une marche, un rebord, ou simplement en la soulevant.",
    difficulte: 3,
    intensite: 3,
  },
  {
    key: "bord_du_lit",
    nom: "Le Bord du lit",
    sousTitre: "Elle assise, lui debout",
    description:
      "Elle au bord du matelas, lui debout devant. La hauteur est parfaite, les mains sont partout, et le regard reste face à face.",
    conseil: "Une table ou un plan de travail fait exactement le même office. Explorez la maison.",
    difficulte: 1,
    intensite: 3,
  },
  {
    key: "papillon",
    nom: "Le Papillon",
    sousTitre: "Jambes relevées",
    description:
      "Elle allongée, jambes hautes contre son torse à lui ou sur ses épaules. Profonde, enveloppante, un peu vertigineuse.",
    conseil: "À réserver aux moments détendus : le corps a besoin d'être souple pour en profiter.",
    difficulte: 2,
    intensite: 3,
  },
  {
    key: "ancre",
    nom: "L'Ancre",
    sousTitre: "À plat ventre",
    description:
      "Elle sur le ventre, lui allongé sur elle. Tout le corps se touche, les mouvements sont courts, l'intensité est ailleurs — dans le poids, la chaleur, la lenteur.",
    conseil: "Sa bouche à lui contre sa nuque à elle. C'est le détail qui fait basculer.",
    difficulte: 1,
    intensite: 2,
  },
];
