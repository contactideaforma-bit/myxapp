/* =====================================================================
   OUI / NON / PEUT-ÊTRE — le paquet de cartes d'envies.

   Chacun répond de son côté ; seuls les accords mutuels se révèlent.
   Les clés (`cle`) sont stockées en base : NE JAMAIS les renommer ni
   les réutiliser — on peut reformuler `texte` librement, ajouter des
   cartes, mais une clé retirée doit rester orpheline.
   ===================================================================== */

export type IntensiteONP = 1 | 2 | 3;

export type CarteONP = {
  cle: string;
  texte: string;
  intensite: IntensiteONP;
};

export const INTENSITES_ONP: { n: IntensiteONP; nom: string; icone: string; accroche: string }[] = [
  { n: 1, nom: "Douce", icone: "🌸", accroche: "Tendresse, complicité, premières étincelles." },
  { n: 2, nom: "Épicée", icone: "🌶️", accroche: "On monte d'un cran — jeux, surprises, frissons." },
  { n: 3, nom: "Brûlante", icone: "🔥", accroche: "Pour les envies qu'on n'ose pas toujours dire." },
];

export const CARTES_ONP: CarteONP[] = [
  /* ------------------------------------------------ 🌸 Douce */
  { cle: "d-massage", texte: "Un long massage aux huiles, des épaules jusqu'aux pieds", intensite: 1 },
  { cle: "d-bain", texte: "Prendre un bain ou une douche à deux, sans se presser", intensite: 1 },
  { cle: "d-baiser", texte: "S'embrasser longuement, comme au tout premier soir", intensite: 1 },
  { cle: "d-danser", texte: "Danser collés-serrés dans le salon, lumière tamisée", intensite: 1 },
  { cle: "d-nus", texte: "Dormir nus, peau contre peau, toute la nuit", intensite: 1 },
  { cle: "d-deshabiller", texte: "Se déshabiller l'un l'autre, très lentement", intensite: 1 },
  { cle: "d-lumiere", texte: "Faire l'amour lumière allumée, sans se cacher", intensite: 1 },
  { cle: "d-sieste", texte: "Une sieste crapuleuse un dimanche après-midi", intensite: 1 },
  { cle: "d-messages", texte: "S'envoyer des messages doux et coquins toute une journée", intensite: 1 },
  { cle: "d-compliments", texte: "Se murmurer à l'oreille ce qu'on aime chez le corps de l'autre", intensite: 1 },
  { cle: "d-petit-dej", texte: "Petit-déjeuner au lit… et y rester toute la matinée", intensite: 1 },
  { cle: "d-regard", texte: "Se regarder dans les yeux, sans parler, jusqu'à craquer", intensite: 1 },
  { cle: "d-caresses", texte: "Une soirée caresses uniquement — tout sauf aller plus loin", intensite: 1 },
  { cle: "d-parfum", texte: "Choisir le parfum ou la tenue de l'autre pour la soirée", intensite: 1 },
  { cle: "d-souvenirs", texte: "Se raconter notre meilleur souvenir à deux… en détail", intensite: 1 },
  { cle: "d-reveil", texte: "Se réveiller l'un l'autre en douceur, avec des baisers", intensite: 1 },
  { cle: "d-cine", texte: "Un film sous le plaid, les mains qui se baladent", intensite: 1 },
  { cle: "d-slow", texte: "Tout faire deux fois plus lentement que d'habitude", intensite: 1 },

  /* ------------------------------------------------ 🌶️ Épicée */
  { cle: "e-yeux-bandes", texte: "Se bander les yeux et se laisser guider", intensite: 2 },
  { cle: "e-glacon", texte: "Jouer avec un glaçon sur la peau de l'autre", intensite: 2 },
  { cle: "e-gourmand", texte: "Chantilly, chocolat, fruits… le corps de l'autre en dessert", intensite: 2 },
  { cle: "e-foulard", texte: "Attacher les mains avec un foulard", intensite: 2 },
  { cle: "e-ailleurs", texte: "Faire l'amour ailleurs que dans la chambre", intensite: 2 },
  { cle: "e-roleplay", texte: "Jouer les inconnus qui se rencontrent dans un bar", intensite: 2 },
  { cle: "e-photo", texte: "Recevoir une photo très suggestive en pleine journée", intensite: 2 },
  { cle: "e-lecture", texte: "Se lire un texte érotique à voix haute", intensite: 2 },
  { cle: "e-douche", texte: "Se rejoindre sous la douche… sans prévenir", intensite: 2 },
  { cle: "e-matin", texte: "Se réveiller par des caresses qui ne s'arrêtent pas", intensite: 2 },
  { cle: "e-quickie", texte: "Un moment volé, improvisé, quand l'envie frappe", intensite: 2 },
  { cle: "e-sous-vetements", texte: "Porter les sous-vêtements que l'autre a choisis", intensite: 2 },
  { cle: "e-soiree-menee", texte: "Une soirée où l'un de nous deux décide de TOUT", intensite: 2 },
  { cle: "e-sextoy", texte: "Découvrir un sextoy ensemble", intensite: 2 },
  { cle: "e-devant", texte: "Se caresser devant le regard de l'autre", intensite: 2 },
  { cle: "e-vocal", texte: "S'envoyer un vocal qui fait monter la température", intensite: 2 },
  { cle: "e-striptease", texte: "Un strip-tease rien que pour l'autre, musique comprise", intensite: 2 },
  { cle: "e-interdit-mains", texte: "Faire monter le désir sans utiliser les mains", intensite: 2 },

  /* ------------------------------------------------ 🔥 Brûlante */
  { cle: "b-fessee", texte: "Une fessée, pour jouer", intensite: 3 },
  { cle: "b-domination", texte: "Jouer à dominer / se laisser dominer, en douceur", intensite: 3 },
  { cle: "b-surpris", texte: "Un endroit où l'on pourrait presque se faire surprendre", intensite: 3 },
  { cle: "b-menottes", texte: "Des menottes, pour de vrai cette fois", intensite: 3 },
  { cle: "b-bougie", texte: "Une bougie de massage à la cire chaude", intensite: 3 },
  { cle: "b-privation", texte: "Yeux bandés ET oreilles couvertes : ne rien voir venir", intensite: 3 },
  { cle: "b-fantasme", texte: "Réaliser un fantasme coché dans nos listes", intensite: 3 },
  { cle: "b-miroir", texte: "Le faire devant un miroir", intensite: 3 },
  { cle: "b-hotel", texte: "Une nuit d'hôtel réservée juste pour ça", intensite: 3 },
  { cle: "b-deux-fois", texte: "Deux fois dans la même journée", intensite: 3 },
  { cle: "b-tenue", texte: "Une tenue ou un accessoire qui change tout", intensite: 3 },
  { cle: "b-frustration", texte: "Interdiction de se toucher toute la soirée… jusqu'à craquer", intensite: 3 },
  { cle: "b-video", texte: "Un appel vidéo très intime quand on est loin l'un de l'autre", intensite: 3 },
  { cle: "b-montrer", texte: "Montrer à l'autre exactement comment on aime être touché·e", intensite: 3 },
  { cle: "b-mot-code", texte: "Un mot de code en public qui veut dire « j'ai envie de toi »", intensite: 3 },
  { cle: "b-voiture", texte: "Dans la voiture, comme à vingt ans", intensite: 3 },
  { cle: "b-jeu-des", texte: "Laisser le hasard décider de tout, du début à la fin", intensite: 3 },
  { cle: "b-raconter", texte: "Se raconter un fantasme jamais avoué, dans le noir", intensite: 3 },
];

export const CARTE_PAR_CLE: Record<string, CarteONP> = Object.fromEntries(
  CARTES_ONP.map((c) => [c.cle, c])
);
