"use client";

/**
 * Silhouettes abstraites du catalogue Kâma Sûtra.
 * Deux corps reduits a une tete et un trait : aucune anatomie.
 * Elle en or rose, lui en bordeaux vif.
 *
 * Le texte de Vatsyayana decrit avant tout des arrangements de jambes :
 * c'est donc la que se joue la difference entre les figures.
 */

type Corps = { tete: [number, number]; d: string };
type Figure = { a: Corps; b: Corps };

/* Postures recurrentes de l'amant */
const LUI_DESSUS: Corps = {
  tete: [70, 52],
  d: "M78,58 L130,78 M80,60 L74,90 M130,78 L158,92",
};
const LUI_AGENOUILLE: Corps = {
  tete: [150, 56],
  d: "M148,66 L134,86 M134,86 L126,102 M134,86 L148,102 M146,70 L120,80",
};
const LUI_ALLONGE: Corps = {
  tete: [44, 92],
  d: "M54,94 L120,94 M120,94 L150,84 M150,84 L164,96",
};

const FIGURES: Record<string, Figure> = {
  /* ---------------------------------------- Livre II, chapitre VI */
  grande_ouverte: {
    a: { tete: [46, 94], d: "M55,94 L96,74 M96,74 L128,94 M96,74 L100,102" },
    b: LUI_DESSUS,
  },
  baillement: {
    a: { tete: [46, 88], d: "M55,90 L110,92 M110,92 L138,66 M110,92 L148,104" },
    b: LUI_DESSUS,
  },
  indrani: {
    a: {
      tete: [46, 88],
      d: "M55,90 L110,92 M110,92 L126,68 M126,68 L106,62 M110,92 L128,112 M128,112 L108,114",
    },
    b: LUI_DESSUS,
  },
  enlacement: {
    a: { tete: [46, 88], d: "M55,90 L112,92 M112,92 L158,94" },
    b: LUI_DESSUS,
  },
  pression: {
    a: { tete: [46, 88], d: "M55,90 L112,92 M112,92 L150,84 M112,92 L150,98" },
    b: LUI_DESSUS,
  },
  entrelacement: {
    a: { tete: [46, 88], d: "M55,90 L112,92 M112,92 L156,94 M112,92 L134,70" },
    b: LUI_DESSUS,
  },
  jument: {
    a: {
      tete: [110, 38],
      d: "M110,48 L112,82 M112,82 L92,94 M112,82 L134,94 M104,58 L86,66 M117,58 L136,64",
    },
    b: LUI_ALLONGE,
  },
  elevation: {
    a: { tete: [46, 90], d: "M55,92 L110,94 M110,94 L116,58 M110,94 L130,58" },
    b: LUI_DESSUS,
  },
  jambes_epaules: {
    a: { tete: [44, 92], d: "M54,94 L104,96 M104,96 L116,60 M104,96 L134,66" },
    b: LUI_AGENOUILLE,
  },
  pressee: {
    a: { tete: [46, 92], d: "M55,94 L108,94 M108,94 L94,68 M108,94 L110,66" },
    b: LUI_AGENOUILLE,
  },
  demi_pressee: {
    a: { tete: [46, 92], d: "M55,94 L108,94 M108,94 L98,66 M108,94 L154,96" },
    b: LUI_DESSUS,
  },
  bambou_fendu: {
    a: { tete: [44, 92], d: "M54,94 L108,96 M108,96 L114,58 M108,96 L156,98" },
    b: LUI_AGENOUILLE,
  },
  clou_plante: {
    a: { tete: [44, 92], d: "M54,94 L108,96 M108,96 L84,58 M108,96 L156,98" },
    b: LUI_AGENOUILLE,
  },
  crabe: {
    a: { tete: [46, 92], d: "M55,94 L106,94 M106,94 L86,74 M106,94 L94,70" },
    b: LUI_DESSUS,
  },
  empilee: {
    a: { tete: [46, 92], d: "M55,94 L108,94 M108,94 L132,66 M108,94 L140,76" },
    b: LUI_DESSUS,
  },
  lotus: {
    a: { tete: [78, 42], d: "M78,52 L78,84 M78,84 L56,92 M78,84 L104,92 M78,62 L106,56" },
    b: { tete: [122, 42], d: "M122,52 L122,84 M122,84 L144,92 M122,84 L96,92 M122,62 L94,56" },
  },
  volte: {
    a: { tete: [44, 92], d: "M54,94 L112,94 M112,94 L150,86 M112,94 L150,100" },
    b: {
      tete: [128, 50],
      d: "M126,60 L104,76 M104,76 L86,92 M104,76 L104,98 M124,64 L146,74",
    },
  },
  soutenue: {
    a: { tete: [84, 30], d: "M84,40 L84,78 M84,78 L74,104 M84,78 L92,104 M84,52 L114,48" },
    b: { tete: [116, 30], d: "M116,40 L116,78 M116,78 L108,104 M116,78 L126,104 M116,52 L86,48" },
  },
  suspendue: {
    a: { tete: [96, 42], d: "M96,52 L98,76 M98,76 L74,84 M98,76 L76,96 M96,58 L120,50" },
    b: {
      tete: [128, 34],
      d: "M128,44 L128,84 M128,84 L120,106 M128,84 L138,106 M128,58 L100,66",
    },
  },
  vache: {
    a: { tete: [54, 64], d: "M64,68 L118,66 M68,68 L66,98 M114,66 L118,98" },
    b: {
      tete: [154, 48],
      d: "M152,58 L134,80 M134,80 L126,100 M134,80 L148,100 M150,62 L124,70",
    },
  },

  /* ---------------------------------------- Livre II, chapitre VIII */
  tenailles: {
    a: {
      tete: [104, 44],
      d: "M104,54 L110,82 M110,82 L88,94 M110,82 L132,94 M104,60 L80,72 M108,60 L134,70",
    },
    b: LUI_ALLONGE,
  },
  toupie: {
    a: {
      tete: [110, 40],
      d: "M110,50 L112,84 M112,84 L86,90 M112,84 L138,90 M104,60 L78,52 M118,60 L144,68",
    },
    b: LUI_ALLONGE,
  },
  balancoire: {
    a: { tete: [112, 44], d: "M112,54 L114,82 M114,82 L92,94 M114,82 L136,94 M108,62 L88,74" },
    b: { tete: [40, 94], d: "M50,96 L96,72 M96,72 L138,90 M96,72 L96,102" },
  },
};

export default function Silhouette({
  figure,
  className = "",
}: {
  figure: string;
  className?: string;
}) {
  const f = FIGURES[figure] ?? FIGURES.enlacement;

  const trait = (c: Corps, couleur: string) => (
    <g
      stroke={couleur}
      strokeWidth={7}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      opacity={0.95}
    >
      <circle cx={c.tete[0]} cy={c.tete[1]} r={8.5} fill={couleur} stroke="none" />
      <path d={c.d} />
    </g>
  );

  return (
    <svg viewBox="0 0 200 124" className={className} aria-hidden>
      <ellipse cx="100" cy="112" rx="86" ry="7" fill="#32263A" opacity="0.55" />
      {trait(f.b, "#A32E52")}
      {trait(f.a, "#E8B4A0")}
    </svg>
  );
}
