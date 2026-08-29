/* =====================================================================
   ACTION OU VÉRITÉ — les deux paquets de cartes.

   Pensé pour le jeu À DISTANCE : la plupart des actions se relèvent
   par message, vocal ou photo éphémère dans « Nous ».

   RÈGLE DE CONTENU (doc projet) : jamais de questions sur le passé
   amoureux, les ex ou le « nombre » — le jeu regarde le couple
   d'aujourd'hui.

   Les clés sont stockées en base (game_events) : ne jamais les
   renommer ; on peut reformuler les textes et ajouter des cartes.
   ===================================================================== */

export type CarteAV = { cle: string; texte: string };

export const VERITES: CarteAV[] = [
  { cle: "v-fantasme-ose", texte: "Quel est le fantasme que tu n'as jamais osé me demander ?" },
  { cle: "v-soiree-ideale", texte: "Décris-moi ta soirée idéale avec moi… sans aucune censure." },
  { cle: "v-tenue-effet", texte: "Qu'est-ce que je porte qui te fait le plus d'effet ?" },
  { cle: "v-rougir", texte: "Quel moment avec moi te fait encore rougir quand tu y repenses ?" },
  { cle: "v-lieu-reve", texte: "Où rêves-tu qu'on le fasse, un jour ?" },
  { cle: "v-partie-corps", texte: "Quelle partie de mon corps préfères-tu — et pourquoi celle-là ?" },
  { cle: "v-plus-souvent", texte: "Qu'aimerais-tu que je te fasse plus souvent ?" },
  { cle: "v-baiser-parfait", texte: "C'est quoi, pour toi, le baiser parfait ?" },
  { cle: "v-reve-nuit", texte: "Raconte un rêve (un vrai, de nuit) que tu as fait sur moi." },
  { cle: "v-24h", texte: "24 h sans aucune obligation, rien que nous : raconte, heure par heure." },
  { cle: "v-surnom", texte: "Quel mot ou surnom aimerais-tu m'entendre murmurer plus souvent ?" },
  { cle: "v-craquer", texte: "Qu'est-ce qui te fait craquer chez moi quand je ne m'en rends pas compte ?" },
  { cle: "v-maintenant", texte: "De quoi as-tu envie, là, tout de suite, très exactement ?" },
  { cle: "v-audace", texte: "Quelle est la chose la plus audacieuse que tu aimerais qu'on essaie ?" },
  { cle: "v-reveil", texte: "Comment rêves-tu que je te réveille ?" },
  { cle: "v-tenue-reve", texte: "Quelle tenue rêverais-tu de me voir porter un soir ?" },
  { cle: "v-deconcentre", texte: "Qu'est-ce que je fais qui te déconcentre complètement ?" },
  { cle: "v-seduire", texte: "Si tu devais me séduire comme au premier jour, tu commencerais par quoi ?" },
  { cle: "v-caresse", texte: "Quel endroit de ton corps est-ce que je ne caresse pas assez ?" },
  { cle: "v-pas-sage", texte: "Avoue : à quel moment de la journée penses-tu à moi de façon pas très sage ?" },
  { cle: "v-ambiance", texte: "Qu'est-ce qui te met dans l'ambiance à coup sûr ?" },
  { cle: "v-escapade", texte: "Décris notre prochaine escapade idéale — surtout le soir." },
  { cle: "v-chanson", texte: "Quelle chanson te fait penser à nous… ou à nos nuits ?" },
  { cle: "v-murmure", texte: "Qu'aimerais-tu m'entendre te murmurer à l'oreille ?" },
];

export const ACTIONS: CarteAV[] = [
  { cle: "a-vocal-chuchote", texte: "Envoie un vocal en chuchotant ce que tu me feras la prochaine fois qu'on se voit." },
  { cle: "a-photo-choix", texte: "Envoie une photo de toi, là, tout de suite — cadrage de ton choix. 😏" },
  { cle: "a-scenario", texte: "Écris-moi le début d'un scénario coquin ; à moi d'écrire la suite." },
  { cle: "a-trois-phrases", texte: "Écris-moi trois phrases qui me feront rougir en pleine journée." },
  { cle: "a-une-piece", texte: "Décris ce que tu portes… puis retire une pièce, et prouve-le en photo éphémère." },
  { cle: "a-lecture", texte: "Enregistre un vocal où tu lis un de nos Scénarios de ta voix la plus troublante." },
  { cle: "a-endroit-baiser", texte: "Envoie une photo de l'endroit exact où tu veux être embrassé·e." },
  { cle: "a-sous-entendus", texte: "Pendant 1 heure, chacun de tes messages doit contenir un sous-entendu." },
  { cle: "a-habilleur", texte: "Ce soir, c'est toi qui choisis ma tenue… ou son absence." },
  { cle: "a-selfie-regard", texte: "Envoie un selfie avec ton regard le plus irrésistible." },
  { cle: "a-surprise", texte: "Prépare une surprise pour notre prochain moment à deux — indice interdit." },
  { cle: "a-21h", texte: "Ce soir à 21 h précises, écris-moi ce qui te passe par la tête à cet instant." },
  { cle: "a-emojis", texte: "Raconte ta prochaine envie uniquement en emojis ; je dois deviner." },
  { cle: "a-souvenir", texte: "Vocal : raconte notre souvenir le plus brûlant, avec tous les détails." },
  { cle: "a-sous-draps", texte: "Envoie une photo éphémère prise sous les draps." },
  { cle: "a-compliment", texte: "Écris-moi un compliment interdit aux moins de 18 ans." },
  { cle: "a-danse", texte: "Danse sur une chanson en pensant très fort à moi — 10 secondes de vidéo si tu oses." },
  { cle: "a-ouinon", texte: "File dans Oui/Non/Peut-être et réponds à 5 cartes Brûlantes, tout de suite." },
  { cle: "a-des", texte: "Lance les Dés coquins et jure d'honorer le résultat à notre prochain tête-à-tête." },
  { cle: "a-si-jetais-la", texte: "Décris en vocal ce que tu ferais si j'étais dans la pièce, là." },
  { cle: "a-partie-preferee", texte: "Envoie une photo de la partie de ton corps que TU préfères." },
  { cle: "a-haiku", texte: "Écris un haïku (trois vers) sur ta prochaine envie." },
  { cle: "a-silence", texte: "Interdiction de m'écrire pendant 1 h… puis rattrape tout en un seul message." },
  { cle: "a-prenom", texte: "Envoie un vocal où tu ne dis que mon prénom — mais de façon inoubliable." },
];

export const CARTE_AV_PAR_CLE: Record<string, CarteAV> = Object.fromEntries(
  [...VERITES, ...ACTIONS].map((c) => [c.cle, c])
);
