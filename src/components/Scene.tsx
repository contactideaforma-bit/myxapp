"use client";

import { scene, corps, assainir, type AvatarParams } from "@/lib/avatar-engine";
import { POSES } from "@/data/poses";

/** Une posture du catalogue, jouee par vos deux avatars. */
export default function Scene({
  pose,
  a,
  b,
  className = "",
}: {
  pose: string;
  a?: Partial<AvatarParams> | null;
  b?: Partial<AvatarParams> | null;
  className?: string;
}) {
  const p = POSES[pose] ?? POSES.enlacement;
  const svg = scene(p, assainir(a), assainir(b));
  return (
    <div
      className={`[&>svg]:h-full [&>svg]:w-full ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/* Silhouette debout, de face — pour le profil et l'en-tete */
const DEBOUT = {
  t: [100, 30],
  c: [100, 46],
  b: [100, 82],
  bg: [[80, 66], [72, 92]],
  bd: [[120, 66], [128, 92]],
  jg: [[92, 102], [90, 124]],
  jd: [[110, 102], [112, 124]],
};

export function Portrait({
  a,
  className = "",
  regardeVers = "droite",
}: {
  a?: Partial<AvatarParams> | null;
  className?: string;
  regardeVers?: "droite" | "gauche";
}) {
  const cible = regardeVers === "droite" ? [190, 26] : [10, 26];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="55 8 90 124">
    ${corps(DEBOUT, assainir(a), cible)}
  </svg>`;
  return (
    <div
      className={`[&>svg]:h-full [&>svg]:w-full ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
