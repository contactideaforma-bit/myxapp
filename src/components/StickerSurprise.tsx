"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * EASTER EGG — « myriam »
 * Dès qu'un message contient « myriam », un sticker de la bibliothèque du
 * couple est tiré au hasard et surgit en plein centre de l'écran, en grand.
 * Un sticker animé (clip) se joue tout seul, muet. Purement décoratif.
 * S'il n'y a aucun sticker dans la bibliothèque, il ne se passe rien.
 */

const DUREE_MS = 4800;

export const MOTIF_MYRIAM = /myriam/i;

const estClip = (chemin: string) => /\.(webm|mp4|mov)$/i.test(chemin);

/** Monté avec une `key` qui change à chaque déclenchement. */
export default function StickerSurprise({
  coupleId,
  onFin,
}: {
  coupleId: string;
  onFin: () => void;
}) {
  const [supabase] = useState(() => createClient());
  const [sticker, setSticker] = useState<{ url: string; clip: boolean } | null>(null);
  const [sortie, setSortie] = useState(false);

  /* Tirage au sort d'un sticker + URL signée. */
  useEffect(() => {
    let vivant = true;
    (async () => {
      const { data } = await supabase
        .from("stickers")
        .select("storage_path")
        .eq("couple_id", coupleId);
      const liste = (data ?? []) as { storage_path: string }[];
      if (!liste.length) {
        if (vivant) onFin();
        return;
      }
      const choisi = liste[Math.floor(Math.random() * liste.length)];
      const { data: sg } = await supabase.storage
        .from("intimate")
        .createSignedUrl(choisi.storage_path, 600);
      if (!vivant) return;
      if (!sg?.signedUrl) {
        onFin();
        return;
      }
      setSticker({ url: sg.signedUrl, clip: estClip(choisi.storage_path) });
    })();
    return () => {
      vivant = false;
    };
  }, [supabase, coupleId, onFin]);

  /* Le chrono ne démarre qu'une fois le sticker affiché. */
  useEffect(() => {
    if (!sticker) return;
    const tSortie = setTimeout(() => setSortie(true), DUREE_MS - 500);
    const tFin = setTimeout(onFin, DUREE_MS);
    return () => {
      clearTimeout(tSortie);
      clearTimeout(tFin);
    };
  }, [sticker, onFin]);

  if (!sticker) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[60] grid place-items-center select-none"
    >
      <div className={sortie ? "sticker-surprise sticker-surprise-sortie" : "sticker-surprise"}>
        {sticker.clip ? (
          <video
            src={sticker.url}
            autoPlay
            muted
            loop
            playsInline
            className="sticker-surprise-media"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={sticker.url} alt="" draggable={false} className="sticker-surprise-media" />
        )}
      </div>
    </div>
  );
}
