"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * EASTER EGG — « manel »
 * Dès qu'un message contient « manel », une explosion d'étrons 💩 part du
 * centre de l'écran dans toutes les directions. Purement décoratif.
 */

const DUREE_MS = 3200;
const NB_ETRONS = 48;

export const MOTIF_MANEL = /manel/i;

type Etron = { id: number; dx: number; dy: number; taille: number; delai: number; rot: number };

function tirer(): Etron[] {
  return Array.from({ length: NB_ETRONS }, (_, i) => {
    const angle = (i / NB_ETRONS) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const portee = 30 + Math.random() * 45; // en vmax, pour sortir de l'écran
    return {
      id: i,
      dx: Math.cos(angle) * portee,
      dy: Math.sin(angle) * portee,
      taille: 1.4 + Math.random() * 2.2,
      delai: Math.random() * 0.25,
      rot: (Math.random() - 0.5) * 720,
    };
  });
}

/** Monté avec une `key` qui change à chaque déclenchement. */
export default function ExplosionEtron({ onFin }: { onFin: () => void }) {
  const etrons = useMemo(() => tirer(), []);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      onFin();
    }, DUREE_MS);
    return () => clearTimeout(t);
  }, [onFin]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[60] overflow-hidden select-none"
    >
      {etrons.map((e) => (
        <span
          key={e.id}
          className="etron-eclat"
          style={{
            fontSize: `${e.taille}rem`,
            animationDelay: `${e.delai}s`,
            ["--etron-dx" as string]: `${e.dx}vmax`,
            ["--etron-dy" as string]: `${e.dy}vmax`,
            ["--etron-rot" as string]: `${e.rot}deg`,
          }}
        >
          💩
        </span>
      ))}
    </div>
  );
}
