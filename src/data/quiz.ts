/* =====================================================================
   TU ME CONNAIS ? — la banque de questions.

   Chaque question se lit à la première personne (« Mon… », « Ce qui
   me… ») : on y répond une fois sur SOI (vérité), une fois en pariant
   sur la réponse de l'autre.

   RÈGLE DE CONTENU (doc projet) : jamais de questions sur le passé
   amoureux, les ex ou le « nombre » — le jeu regarde le couple
   d'aujourd'hui, pas l'historique de chacun.

   Les clés (`cle` de question et `cle` d'option) sont stockées en
   base : ne jamais les renommer ni les réutiliser. On peut reformuler
   les textes et ajouter des questions librement.
   ===================================================================== */

export type OptionQuiz = { cle: string; texte: string };

export type QuestionQuiz = {
  cle: string;
  question: string;
  options: OptionQuiz[];
  categorie: 1 | 2 | 3;
};

export const CATEGORIES_QUIZ: { n: 1 | 2 | 3; nom: string; icone: string }[] = [
  { n: 1, nom: "Tendresse", icone: "🤍" },
  { n: 2, nom: "Désir", icone: "🔥" },
  { n: 3, nom: "Nous", icone: "💞" },
];

export const QUESTIONS_QUIZ: QuestionQuiz[] = [
  /* ------------------------------------------------ 🤍 Tendresse */
  {
    cle: "t-cajole",
    question: "Mon moment préféré pour être câliné·e",
    categorie: 1,
    options: [
      { cle: "a", texte: "Au réveil" },
      { cle: "b", texte: "Le soir sur le canapé" },
      { cle: "c", texte: "Au lit, avant de dormir" },
      { cle: "d", texte: "Tout le temps, sans exception" },
    ],
  },
  {
    cle: "t-baiser",
    question: "Le baiser qui me fait le plus d'effet",
    categorie: 1,
    options: [
      { cle: "a", texte: "Doux et interminable" },
      { cle: "b", texte: "Intense et pressé" },
      { cle: "c", texte: "Dans le cou" },
      { cle: "d", texte: "Volé par surprise" },
    ],
  },
  {
    cle: "t-geste",
    question: "Le geste qui me fait fondre",
    categorie: 1,
    options: [
      { cle: "a", texte: "Une main dans mes cheveux" },
      { cle: "b", texte: "Un massage surprise" },
      { cle: "c", texte: "Être enlacé·e par derrière" },
      { cle: "d", texte: "Un mot doux en pleine journée" },
    ],
  },
  {
    cle: "t-langage",
    question: "Ma façon préférée de recevoir de l'amour",
    categorie: 1,
    options: [
      { cle: "a", texte: "Des mots qui touchent" },
      { cle: "b", texte: "Du temps rien qu'à nous" },
      { cle: "c", texte: "Des gestes tendres" },
      { cle: "d", texte: "Des attentions et des surprises" },
    ],
  },
  {
    cle: "t-soiree",
    question: "Ma soirée idéale à deux",
    categorie: 1,
    options: [
      { cle: "a", texte: "Plaid, film et rien d'autre" },
      { cle: "b", texte: "Dîner aux chandelles" },
      { cle: "c", texte: "Sortie improvisée" },
      { cle: "d", texte: "Une longue discussion au lit" },
    ],
  },
  {
    cle: "t-reveil",
    question: "Mon réveil préféré",
    categorie: 1,
    options: [
      { cle: "a", texte: "Des baisers partout" },
      { cle: "b", texte: "Le petit-déj au lit" },
      { cle: "c", texte: "Un câlin silencieux" },
      { cle: "d", texte: "Une grasse matinée collés-serrés" },
    ],
  },
  {
    cle: "t-compliment",
    question: "Le compliment qui me touche le plus",
    categorie: 1,
    options: [
      { cle: "a", texte: "Sur mon physique" },
      { cle: "b", texte: "Sur ce que je fais" },
      { cle: "c", texte: "Sur qui je suis" },
      { cle: "d", texte: "Sur nous deux" },
    ],
  },
  {
    cle: "t-apaise",
    question: "Là où j'aime qu'on me touche pour m'apaiser",
    categorie: 1,
    options: [
      { cle: "a", texte: "La tête et les cheveux" },
      { cle: "b", texte: "Le dos" },
      { cle: "c", texte: "Les mains" },
      { cle: "d", texte: "La nuque" },
    ],
  },
  {
    cle: "t-moral",
    question: "Ce qui me remonte le moral à coup sûr",
    categorie: 1,
    options: [
      { cle: "a", texte: "Un câlin sans un mot" },
      { cle: "b", texte: "Qu'on me fasse rire" },
      { cle: "c", texte: "Qu'on m'écoute vraiment" },
      { cle: "d", texte: "Qu'on me change les idées" },
    ],
  },
  {
    cle: "t-absence",
    question: "Quand on est loin l'un de l'autre, ce qui me manque le plus",
    categorie: 1,
    options: [
      { cle: "a", texte: "Ton odeur" },
      { cle: "b", texte: "Ta voix" },
      { cle: "c", texte: "Tes bras" },
      { cle: "d", texte: "Nos fous rires" },
    ],
  },
  {
    cle: "t-dimanche",
    question: "Mon dimanche parfait",
    categorie: 1,
    options: [
      { cle: "a", texte: "Au lit le plus longtemps possible" },
      { cle: "b", texte: "Une balade à deux" },
      { cle: "c", texte: "Cuisiner ensemble" },
      { cle: "d", texte: "Ne rien décider du tout" },
    ],
  },
  {
    cle: "t-photo",
    question: "Ce que je préfère qu'on garde en souvenir",
    categorie: 1,
    options: [
      { cle: "a", texte: "Nos escapades" },
      { cle: "b", texte: "Nos soirées à deux" },
      { cle: "c", texte: "Les petits moments volés" },
      { cle: "d", texte: "Rien — je préfère vivre l'instant" },
    ],
  },

  /* ------------------------------------------------ 🔥 Désir */
  {
    cle: "d-moment",
    question: "Le moment de la journée où j'ai le plus envie",
    categorie: 2,
    options: [
      { cle: "a", texte: "Le matin" },
      { cle: "b", texte: "L'après-midi" },
      { cle: "c", texte: "Le soir" },
      { cle: "d", texte: "Ça ne se commande pas" },
    ],
  },
  {
    cle: "d-allume",
    question: "Ce qui m'allume le plus vite",
    categorie: 2,
    options: [
      { cle: "a", texte: "Un regard appuyé" },
      { cle: "b", texte: "Un message coquin" },
      { cle: "c", texte: "Une caresse discrète" },
      { cle: "d", texte: "Te voir sortir de la douche" },
    ],
  },
  {
    cle: "d-endroit",
    question: "Mon endroit sensible préféré",
    categorie: 2,
    options: [
      { cle: "a", texte: "Le cou" },
      { cle: "b", texte: "Les oreilles" },
      { cle: "c", texte: "L'intérieur des cuisses" },
      { cle: "d", texte: "Le bas du dos" },
    ],
  },
  {
    cle: "d-tenue",
    question: "La tenue dans laquelle je me sens irrésistible",
    categorie: 2,
    options: [
      { cle: "a", texte: "Rien du tout" },
      { cle: "b", texte: "Un ensemble choisi avec soin" },
      { cle: "c", texte: "Ton t-shirt / ta chemise" },
      { cle: "d", texte: "Habillé·e comme pour sortir" },
    ],
  },
  {
    cle: "d-tempo",
    question: "Mon tempo préféré",
    categorie: 2,
    options: [
      { cle: "a", texte: "De longs préliminaires" },
      { cle: "b", texte: "La fougue, tout de suite" },
      { cle: "c", texte: "Alterner les deux" },
      { cle: "d", texte: "Me laisser surprendre" },
    ],
  },
  {
    cle: "d-ambiance",
    question: "Mon ambiance préférée",
    categorie: 2,
    options: [
      { cle: "a", texte: "Pénombre et bougies" },
      { cle: "b", texte: "Pleine lumière" },
      { cle: "c", texte: "Le noir complet" },
      { cle: "d", texte: "Peu importe, vraiment" },
    ],
  },
  {
    cle: "d-initiative",
    question: "Ce que je préfère",
    categorie: 2,
    options: [
      { cle: "a", texte: "Prendre les devants" },
      { cle: "b", texte: "Être désiré·e et me laisser faire" },
      { cle: "c", texte: "Un peu des deux" },
      { cle: "d", texte: "Laisser les jeux de l'app décider 😏" },
    ],
  },
  {
    cle: "d-mots",
    question: "Pendant l'amour, j'aime",
    categorie: 2,
    options: [
      { cle: "a", texte: "Les mots doux" },
      { cle: "b", texte: "Les mots crus" },
      { cle: "c", texte: "Les soupirs, sans paroles" },
      { cle: "d", texte: "Qu'on me guide" },
    ],
  },
  {
    cle: "d-apres",
    question: "Juste après, mon moment préféré",
    categorie: 2,
    options: [
      { cle: "a", texte: "Rester enlacés" },
      { cle: "b", texte: "Discuter sur l'oreiller" },
      { cle: "c", texte: "Une douche à deux" },
      { cle: "d", texte: "Un petit creux à partager" },
    ],
  },
  {
    cle: "d-fantasme",
    question: "Le type de fantasme qui me parle le plus",
    categorie: 2,
    options: [
      { cle: "a", texte: "Romantique et sensuel" },
      { cle: "b", texte: "Jeu de rôle" },
      { cle: "c", texte: "Domination douce" },
      { cle: "d", texte: "Le frisson de l'interdit" },
    ],
  },
  {
    cle: "d-rythme",
    question: "Dans un monde idéal, ce serait",
    categorie: 2,
    options: [
      { cle: "a", texte: "Tous les jours" },
      { cle: "b", texte: "Plusieurs fois par semaine" },
      { cle: "c", texte: "La qualité avant tout" },
      { cle: "d", texte: "Par vagues, selon l'envie" },
    ],
  },
  {
    cle: "d-surprise",
    question: "La surprise coquine qui me ferait le plus d'effet",
    categorie: 2,
    options: [
      { cle: "a", texte: "Un message audacieux en journée" },
      { cle: "b", texte: "Une tenue dévoilée le soir" },
      { cle: "c", texte: "Un rendez-vous mystère" },
      { cle: "d", texte: "Être réveillé·e par des caresses" },
    ],
  },

  /* ------------------------------------------------ 💞 Nous */
  {
    cle: "n-craquer",
    question: "Ce qui m'a fait craquer chez toi",
    categorie: 3,
    options: [
      { cle: "a", texte: "Ton regard" },
      { cle: "b", texte: "Ton humour" },
      { cle: "c", texte: "Ta voix" },
      { cle: "d", texte: "Ta façon d'être, tout simplement" },
    ],
  },
  {
    cle: "n-force",
    question: "Notre plus grande force à deux",
    categorie: 3,
    options: [
      { cle: "a", texte: "On rit ensemble" },
      { cle: "b", texte: "On se dit tout" },
      { cle: "c", texte: "On se désire encore" },
      { cle: "d", texte: "On se soutient, quoi qu'il arrive" },
    ],
  },
  {
    cle: "n-voyage",
    question: "Le voyage que je rêve de faire avec toi",
    categorie: 3,
    options: [
      { cle: "a", texte: "Une plage déserte" },
      { cle: "b", texte: "Une grande ville à dévorer" },
      { cle: "c", texte: "Un road-trip sans plan" },
      { cle: "d", texte: "Un chalet coupé du monde" },
    ],
  },
  {
    cle: "n-futur",
    question: "Dans dix ans, je nous vois",
    categorie: 3,
    options: [
      { cle: "a", texte: "Pareils, en mieux" },
      { cle: "b", texte: "Entourés de ceux qu'on aime" },
      { cle: "c", texte: "En voyage quelque part" },
      { cle: "d", texte: "Peu importe — ensemble" },
    ],
  },
  {
    cle: "n-dispute",
    question: "Après une dispute, ce dont j'ai besoin",
    categorie: 3,
    options: [
      { cle: "a", texte: "D'un câlin" },
      { cle: "b", texte: "De parler tout de suite" },
      { cle: "c", texte: "D'un peu d'air d'abord" },
      { cle: "d", texte: "D'humour pour dédramatiser" },
    ],
  },
  {
    cle: "n-sans-toi",
    question: "Ce que je fais quand tu n'es pas là",
    categorie: 3,
    options: [
      { cle: "a", texte: "Je pense à toi (trop)" },
      { cle: "b", texte: "Je profite du calme" },
      { cle: "c", texte: "Je regarde nos photos" },
      { cle: "d", texte: "Je prépare quelque chose pour toi" },
    ],
  },
  {
    cle: "n-rituel",
    question: "Notre rituel que je préfère",
    categorie: 3,
    options: [
      { cle: "a", texte: "Se raconter la journée" },
      { cle: "b", texte: "Le dernier câlin avant de dormir" },
      { cle: "c", texte: "Nos messages du matin" },
      { cle: "d", texte: "Nos jeux sur l'app" },
    ],
  },
  {
    cle: "n-fierte",
    question: "Ce qui me rend fier/fière de nous",
    categorie: 3,
    options: [
      { cle: "a", texte: "Notre complicité" },
      { cle: "b", texte: "Notre désir intact" },
      { cle: "c", texte: "Notre façon de tout surmonter" },
      { cle: "d", texte: "Notre grain de folie" },
    ],
  },
  {
    cle: "n-plus-souvent",
    question: "Ce que j'aimerais qu'on fasse plus souvent",
    categorie: 3,
    options: [
      { cle: "a", texte: "Sortir en amoureux" },
      { cle: "b", texte: "Rester au lit" },
      { cle: "c", texte: "Se surprendre" },
      { cle: "d", texte: "Partir à l'improviste" },
    ],
  },
  {
    cle: "n-regard",
    question: "Quand je te regarde sans rien dire, je pense…",
    categorie: 3,
    options: [
      { cle: "a", texte: "Que j'ai de la chance" },
      { cle: "b", texte: "À des choses peu avouables" },
      { cle: "c", texte: "À notre prochaine escapade" },
      { cle: "d", texte: "À nos souvenirs" },
    ],
  },
  {
    cle: "n-cadeau",
    question: "Le cadeau qui me fait le plus plaisir",
    categorie: 3,
    options: [
      { cle: "a", texte: "Du temps rien qu'à nous" },
      { cle: "b", texte: "Une attention faite main" },
      { cle: "c", texte: "Une surprise coquine" },
      { cle: "d", texte: "Peu importe, s'il vient de toi" },
    ],
  },
  {
    cle: "n-escapade",
    question: "Mon escapade idéale à deux",
    categorie: 3,
    options: [
      { cle: "a", texte: "Hôtel avec spa" },
      { cle: "b", texte: "Une nuit sous les étoiles" },
      { cle: "c", texte: "Une ville inconnue" },
      { cle: "d", texte: "Enfermés à deux, volets clos" },
    ],
  },
];

export const QUESTION_PAR_CLE: Record<string, QuestionQuiz> = Object.fromEntries(
  QUESTIONS_QUIZ.map((q) => [q.cle, q])
);
