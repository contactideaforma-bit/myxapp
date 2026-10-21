"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * EASTER EGG — « mymy »
 * Dès qu'un message contient « mymy », une pluie de « manel » multicolores
 * et de cafards 🪳 recouvre tout l'écran pendant quelques secondes.
 * Purement décoratif : ne bloque ni le fil ni la saisie (pointer-events: none).
 */

const DUREE_MS = 6500;
const NB_GOUTTES = 70;
const TEINTES = [
  "#FF4D8D", "#F5A65B", "#5BD6E8", "#3DD6A0", "#A86BD8",
  "#FFD93D", "#FF6B6B", "#4D96FF", "#C43563", "#F0BCA8",
];

export const MOTIF_MYMY = /mymy/i;

type Goutte = {
  id: number;
  gauche: number;
  delai: number;
  duree: number;
  taille: number;
  teinte: string;
  cafard: boolean;
  rotation: number;
};

function tirer(): Goutte[] {
  return Array.from({ length: NB_GOUTTES }, (_, i) => ({
    id: i,
    gauche: Math.random() * 100,
    delai: Math.random() * 2.5,
    duree: 2.5 + Math.random() * 2,
    taille: 1 + Math.random() * 1.6,
    teinte: TEINTES[Math.floor(Math.random() * TEINTES.length)],
    cafard: Math.random() < 0.4,
    rotation: (Math.random() - 0.5) * 80,
  }));
}

/** Monté avec une `key` qui change à chaque déclenchement : la pluie repart de zéro. */
export default function PluieManel({ onFin }: { onFin: () => void }) {
  const gouttes = useMemo(() => tirer(), []);
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
      {gouttes.map((g) => (
        <span
          key={g.id}
          className="manel-goutte"
          style={{
            left: `${g.gauche}vw`,
            animationDelay: `${g.delai}s`,
            animationDuration: `${g.duree}s`,
            fontSize: `${g.taille}rem`,
            color: g.teinte,
            ["--manel-rot" as string]: `${g.rotation}deg`,
          }}
        >
          {g.cafard ? "🪳" : "manel"}
        </span>
      ))}
    </div>
  );
}
