/* eslint-disable */
// Moteur de rendu d avatars — genere du SVG a partir d un squelette.
// Toutes les valeurs viennent de nos propres donnees numeriques et d une
// palette fermee : rien ne provient d une saisie libre.

/* Moteur de rendu d'avatars poses — sortie SVG pure */

export const COIFFURES = ["rase", "court", "carre", "long", "boucle", "chignon"] as const;
export const VISAGES = ["doux", "neutre", "intense"] as const;

const ang = (a: any, b: any) => Math.atan2(b[1] - a[1], b[0] - a[0]);
const dec = (pt: any, a: number, d: number) => [pt[0] + Math.cos(a) * d, pt[1] + Math.sin(a) * d];
const mil = (a: any, b: any) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const f = (n: number) => Math.round(n * 10) / 10;
const P = (a: any) => `${f(a[0])},${f(a[1])}`;

function os(de: any, via: any, a: any, w: number, couleur: string) {
  return `<path d="M${P(de)} Q${P(via)} ${P(a)}" stroke="${couleur}" stroke-width="${f(w)}"
    fill="none" stroke-linecap="round"/>`;
}

/* Toutes les membrures d'un corps, a une epaisseur donnee */
function torse(s: any, k: number, morpho: number, couleur: string, gonfle = 0) {
  // morpho : 0 = epaules larges, 1 = hanches larges
  const a = ang(s.c, s.b) + Math.PI / 2;
  const lEp = (7.5 + (1 - morpho) * 3.5) * k + gonfle / 2;
  const lHa = (6 + morpho * 4) * k + gonfle / 2;
  const e1 = dec(s.c, a, lEp), e2 = dec(s.c, a, -lEp);
  const h1 = dec(s.b, a, lHa), h2 = dec(s.b, a, -lHa);
  return `<path d="M${P(e1)} L${P(h1)} L${P(h2)} L${P(e2)} Z" fill="${couleur}"
    stroke="${couleur}" stroke-width="${f(4 + gonfle)}" stroke-linejoin="round"/>`;
}

function ossature(s: any, k: number, couleur: string, gonfle = 0, morpho = 0.5) {
  const epaule = [(s.c[0] * 2 + s.b[0]) / 3, (s.c[1] * 2 + s.b[1]) / 3];
  return [
    torse(s, k, morpho, couleur, gonfle),
    os(s.b, s.jg[0], s.jg[1], 11 * k + gonfle, couleur),
    os(s.b, s.jd[0], s.jd[1], 11 * k + gonfle, couleur),
    os(epaule, s.bg[0], s.bg[1], 7.5 * k + gonfle, couleur),
    os(epaule, s.bd[0], s.bd[1], 7.5 * k + gonfle, couleur),
  ].join("");
}

/* ------------------------------------------------------------------ TETE */
function tete(s: any, av: any, regard: any) {
  const r = 13.5 * (0.94 + (av.corpulence ?? 1) * 0.06);
  const aFace = ang(s.t, regard);          // on regarde l'autre
  const aDos = aFace + Math.PI;
  const peau = av.carnation;
  const chev = av.couleurCheveux;

  /* --- chevelure : posee a l'arriere du crane, jamais sur le corps --- */
  const dos = dec(s.t, aDos, r * 0.3);
  const rot = (a: number) => (a * 180) / Math.PI;
  let cheveux = "";

  switch (av.cheveux) {
    case "rase":
      cheveux = `<circle cx="${f(dos[0])}" cy="${f(dos[1])}" r="${f(r * 0.95)}" fill="${chev}" opacity="0.5"/>`;
      break;
    case "court":
      cheveux = `<circle cx="${f(dos[0])}" cy="${f(dos[1])}" r="${f(r * 1.02)}" fill="${chev}"/>`;
      break;
    case "carre": {
      const q = dec(dos, aDos, r * 0.7);
      cheveux =
        `<circle cx="${f(dos[0])}" cy="${f(dos[1])}" r="${f(r * 1.06)}" fill="${chev}"/>` +
        `<ellipse cx="${f(q[0])}" cy="${f(q[1])}" rx="${f(r * 0.95)}" ry="${f(r * 0.8)}" fill="${chev}"
           transform="rotate(${f(rot(aFace))} ${f(q[0])} ${f(q[1])})"/>`;
      break;
    }
    case "long": {
      const q = dec(dos, aDos, r * 1.15);
      cheveux =
        `<circle cx="${f(dos[0])}" cy="${f(dos[1])}" r="${f(r * 1.06)}" fill="${chev}"/>` +
        `<ellipse cx="${f(q[0])}" cy="${f(q[1])}" rx="${f(r * 1.35)}" ry="${f(r * 0.85)}" fill="${chev}"
           transform="rotate(${f(rot(aFace))} ${f(q[0])} ${f(q[1])})"/>`;
      break;
    }
    case "boucle": {
      cheveux = `<circle cx="${f(dos[0])}" cy="${f(dos[1])}" r="${f(r * 1.12)}" fill="${chev}"/>`;
      for (let i = 0; i < 5; i++) {
        const c = dec(dos, aDos + (i - 2) * 0.62, r * 0.95);
        cheveux += `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${f(r * 0.42)}" fill="${chev}"/>`;
      }
      break;
    }
    case "chignon": {
      const q = dec(dos, aDos, r * 1.15);
      cheveux =
        `<circle cx="${f(dos[0])}" cy="${f(dos[1])}" r="${f(r * 1.02)}" fill="${chev}"/>` +
        `<circle cx="${f(q[0])}" cy="${f(q[1])}" r="${f(r * 0.55)}" fill="${chev}"/>`;
      break;
    }
    default:
      cheveux = `<circle cx="${f(dos[0])}" cy="${f(dos[1])}" r="${f(r * 1.02)}" fill="${chev}"/>`;
  }

  /* --- visage, tourne vers l'autre --- */
  const expr = (({ doux: [2.2, 3.2], neutre: [2, 0], intense: [1.5, -2.4] } as Record<string, number[]>)[av.visage]) ?? [1.8, 0];
  const perp = aFace + Math.PI / 2;
  const centreYeux = dec(s.t, aFace, r * 0.34);
  const o1 = dec(centreYeux, perp, r * 0.34);
  const o2 = dec(centreYeux, perp, -r * 0.34);
  const bouche = dec(s.t, aFace, r * 0.66);
  const b1 = dec(bouche, perp, r * 0.26);
  const b2 = dec(bouche, perp, -r * 0.26);
  const bMid = dec(bouche, aFace, expr[1] * 0.6);

  const barbe = av.pilosite
    ? `<path d="M${P(dec(dec(s.t, aFace, r * 0.42), perp, r * 0.62))}
         Q${P(dec(s.t, aFace, r * 0.92))} ${P(dec(dec(s.t, aFace, r * 0.42), perp, -r * 0.62))}"
         stroke="${chev}" stroke-width="${f(r * 0.42)}" fill="none" stroke-linecap="round" opacity="0.9"/>`
    : "";

  return `${cheveux}
    <circle cx="${f(s.t[0])}" cy="${f(s.t[1])}" r="${f(r)}" fill="${peau}"/>
    ${barbe}
    <circle cx="${f(o1[0])}" cy="${f(o1[1])}" r="${expr[0]}" fill="#1A1116"/>
    <circle cx="${f(o2[0])}" cy="${f(o2[1])}" r="${expr[0]}" fill="#1A1116"/>
    <path d="M${P(b1)} Q${P(bMid)} ${P(b2)}" stroke="#1A1116" stroke-width="1.6"
      fill="none" stroke-linecap="round"/>`;
}

/* ------------------------------------------------------------------ CORPS */
export function corps(s: any, av: any, regard: any) {
  const k = av.corpulence ?? 1;
  const r = 13.5 * (0.94 + k * 0.06);
  return `<g>
    <g opacity="0.9">${ossature(s, k, "#0D0A0F", 5, av.morpho ?? 0.5)}</g>
    <circle cx="${f(s.t[0])}" cy="${f(s.t[1])}" r="${f(r + 2.5)}" fill="#0D0A0F" opacity="0.9"/>
    ${ossature(s, k, av.carnation, 0, av.morpho ?? 0.5)}
    ${tete(s, av, regard)}
  </g>`;
}

export function scene(pose: any, avA: any, avB: any, vb = "0 0 200 130") {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="200" height="130">
    <ellipse cx="100" cy="124" rx="90" ry="6" fill="#32263A" opacity="0.5"/>
    ${corps(pose.b, avB, pose.a.t)}
    ${corps(pose.a, avA, pose.b.t)}
  </svg>`;
}

/* ------------------------------------------------------------------ TYPES */
export type AvatarParams = {
  carnation: string;
  couleurCheveux: string;
  cheveux: string;
  visage: string;
  corpulence: number;
  morpho: number;
  pilosite: boolean;
};

export const AVATAR_DEFAUT: AvatarParams = {
  carnation: "#F2C9A8",
  couleurCheveux: "#3A1F18",
  cheveux: "court",
  visage: "neutre",
  corpulence: 1,
  morpho: 0.5,
  pilosite: false,
};

export const CARNATIONS = [
  "#FBE0C8", "#F2C9A8", "#E0AC85", "#C98D68",
  "#A96C4A", "#8A5334", "#5E3521", "#3E2317",
];
export const COULEURS_CHEVEUX = [
  "#17100E", "#3A1F18", "#6B4226", "#A9713F",
  "#D9A441", "#B0473A", "#8E5FA8", "#C9C2BD",
];

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Verrouille les valeurs avant de les injecter dans du SVG. */
export function assainir(a?: Partial<AvatarParams> | null): AvatarParams {
  const d = AVATAR_DEFAUT;
  const v = a ?? {};
  return {
    carnation: HEX.test(v.carnation ?? "") ? (v.carnation as string) : d.carnation,
    couleurCheveux: HEX.test(v.couleurCheveux ?? "") ? (v.couleurCheveux as string) : d.couleurCheveux,
    cheveux: (COIFFURES as readonly string[]).includes(v.cheveux ?? "") ? (v.cheveux as string) : d.cheveux,
    visage: (VISAGES as readonly string[]).includes(v.visage ?? "") ? (v.visage as string) : d.visage,
    corpulence: Math.min(1.3, Math.max(0.8, Number(v.corpulence) || d.corpulence)),
    morpho: Math.min(1, Math.max(0, Number(v.morpho ?? d.morpho))),
    pilosite: Boolean(v.pilosite),
  };
}
