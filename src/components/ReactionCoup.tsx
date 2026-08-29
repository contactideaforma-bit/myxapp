"use client";

import { useState } from "react";

/* =====================================================================
   RÉACTION À UN COUP — partagé par tous les mini-jeux.
   L'auteur d'un coup voit la réaction de l'autre ; le non-auteur peut
   en poser une (ou la retirer en re-tapant le même emoji).
   ===================================================================== */

export const EMOJIS_COUP = ["❤️", "🔥", "😈", "😅", "👏"];

export default function ReactionCoup({
  deMoi,
  reaction,
  onChoisir,
}: {
  /** Le coup est-il de moi ? (l'auteur ne réagit pas à son propre coup) */
  deMoi: boolean;
  reaction: string | null;
  onChoisir: (emoji: string | null) => void;
}) {
  const [ouvert, setOuvert] = useState(false);

  if (deMoi) {
    return reaction ? <span className="shrink-0 text-sm leading-none">{reaction}</span> : null;
  }

  return (
    <span className="relative flex shrink-0 items-center">
      <button
        onClick={() => setOuvert((v) => !v)}
        className="grid h-7 w-7 place-items-center rounded-full border border-bord text-xs text-brume transition hover:border-bordeaux-vif"
        aria-label="Réagir"
      >
        {reaction ?? "+"}
      </button>
      {ouvert && (
        <span
          className="anim-monte absolute right-0 top-8 z-10 flex gap-1.5 rounded-full border border-bord px-2.5 py-1.5"
          style={{ background: "var(--color-velours)", boxShadow: "0 10px 24px -8px rgba(0,0,0,0.6)" }}
        >
          {EMOJIS_COUP.map((e) => (
            <button
              key={e}
              className="text-base leading-none transition hover:scale-125"
              onClick={() => {
                onChoisir(reaction === e ? null : e);
                setOuvert(false);
              }}
            >
              {e}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
