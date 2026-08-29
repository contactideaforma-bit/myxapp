/* =====================================================================
   DÉS COQUINS — les faces des deux dés et les minuteurs.
   Les index (positions dans les tableaux) sont stockés dans l'état
   partagé de la partie : on peut reformuler les textes, mais ne pas
   réordonner ni retirer de faces sans y penser.
   ===================================================================== */

export const DE_ACTIONS = [
  "Embrasser",
  "Caresser",
  "Masser",
  "Souffler sur",
  "Mordiller",
  "Effleurer",
  "Chatouiller",
  "Lécher",
] as const;

export const DE_ENDROITS = [
  "le cou",
  "les lèvres",
  "l'oreille",
  "le ventre",
  "le bas du dos",
  "l'intérieur des cuisses",
  "la nuque",
  "là où tu veux",
] as const;

export const MINUTEURS = [
  { s: 30, nom: "30 s" },
  { s: 60, nom: "1 min" },
  { s: 120, nom: "2 min" },
] as const;
