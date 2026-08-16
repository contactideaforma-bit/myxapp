"use client";

/**
 * Silhouettes abstraites : deux corps rendus en traits, sans anatomie.
 * Chaque figure = une tete (cercle) + un chemin (colonne, bras, jambes).
 * Corps A en or rose, corps B en bordeaux vif.
 */

type Corps = { tete: [number, number]; d: string };
type Figure = { a: Corps; b: Corps };

const FIGURES: Record<string, Figure> = {
  etreinte: {
    a: { tete: [46, 86], d: "M55,88 L112,90 M112,90 L138,72 M138,72 L152,92" },
    b: { tete: [70, 52], d: "M78,58 L130,76 M80,60 L74,88 M130,76 L158,88" },
  },
  cavaliere: {
    a: { tete: [44, 90], d: "M54,92 L120,92 M120,92 L146,78 M146,78 L160,94" },
    b: { tete: [110, 38], d: "M110,48 L112,82 M112,82 L92,94 M112,82 L134,94 M104,58 L86,66 M117,58 L136,64" },
  },
  cuillere: {
    a: { tete: [66, 84], d: "M76,86 L128,90 M128,90 L154,80 M128,90 L156,96" },
    b: { tete: [46, 62], d: "M56,66 L110,72 M110,72 L140,62 M110,72 L142,80" },
  },
  levrette: {
    a: { tete: [54, 62], d: "M64,66 L118,64 M68,68 L66,98 M114,66 L118,98" },
    b: { tete: [154, 48], d: "M152,58 L134,80 M134,80 L126,100 M134,80 L148,100 M150,62 L124,70" },
  },
  lotus: {
    a: { tete: [78, 42], d: "M78,52 L78,84 M78,84 L56,92 M78,84 L104,92 M78,62 L106,56" },
    b: { tete: [122, 42], d: "M122,52 L122,84 M122,84 L144,92 M122,84 L96,92 M122,62 L94,56" },
  },
  chaise: {
    a: { tete: [90, 42], d: "M90,52 L96,84 M96,84 L74,98 M96,84 L114,98 M92,60 L120,58" },
    b: { tete: [120, 52], d: "M120,62 L120,88 M120,88 L94,90 M94,90 L92,104 M120,70 L96,66" },
  },
  ciseaux: {
    a: { tete: [40, 70], d: "M50,74 L104,80 M104,80 L148,66 M104,80 L144,92" },
    b: { tete: [162, 92], d: "M152,90 L100,86 M100,86 L60,98 M100,86 L58,76" },
  },
  arche: {
    a: { tete: [50, 94], d: "M60,92 L94,68 M94,68 L128,92 M94,68 L98,98" },
    b: { tete: [152, 52], d: "M150,62 L136,84 M136,84 L128,102 M136,84 L150,102 M148,66 L126,76" },
  },
  debout: {
    a: { tete: [84, 30], d: "M84,40 L84,78 M84,78 L74,104 M84,78 L92,104 M84,52 L114,48" },
    b: { tete: [116, 30], d: "M116,40 L116,78 M116,78 L108,104 M116,78 L126,104 M116,52 L86,48" },
  },
  bord_du_lit: {
    a: { tete: [64, 56], d: "M64,66 L66,92 M66,92 L94,92 M94,92 L94,104 M66,74 L92,70" },
    b: { tete: [122, 34], d: "M122,44 L122,86 M122,86 L112,104 M122,86 L132,104 M122,58 L92,64" },
  },
  papillon: {
    a: { tete: [44, 92], d: "M54,94 L104,96 M104,96 L118,62 M104,96 L136,68" },
    b: { tete: [152, 56], d: "M150,66 L134,86 M134,86 L126,102 M134,86 L148,102 M148,70 L122,78" },
  },
  ancre: {
    a: { tete: [46, 92], d: "M56,94 L136,96 M136,96 L160,88" },
    b: { tete: [70, 60], d: "M78,64 L134,80 M78,64 L74,92 M134,80 L158,94" },
  },
};

export default function Silhouette({
  figure,
  className = "",
}: {
  figure: string;
  className?: string;
}) {
  const f = FIGURES[figure] ?? FIGURES.etreinte;

  const trait = (c: Corps, couleur: string, opacite: number) => (
    <g
      stroke={couleur}
      strokeWidth={7}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      opacity={opacite}
    >
      <circle cx={c.tete[0]} cy={c.tete[1]} r={8.5} fill={couleur} stroke="none" />
      <path d={c.d} />
    </g>
  );

  return (
    <svg viewBox="0 0 200 120" className={className} aria-hidden>
      {/* le lit, suggere */}
      <ellipse cx="100" cy="108" rx="86" ry="7" fill="#32263A" opacity="0.55" />
      {trait(f.b, "#A32E52", 0.95)}
      {trait(f.a, "#E8B4A0", 0.95)}
    </svg>
  );
}
