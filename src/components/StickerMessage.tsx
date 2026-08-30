"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/lib/types";

/* =====================================================================
   STICKER DANS LA CONVERSATION — il apparaît tout seul (pas de
   « toucher pour afficher ») et les stickers animés (clips capturés
   dans une vidéo) se jouent automatiquement, en boucle, sans son.
   ===================================================================== */

const estClip = (chemin: string) => /\.(webm|mp4|mov)$/i.test(chemin);

export default function StickerMessage({ message }: { message: Message }) {
  const [supabase] = useState(() => createClient());
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    if (!message.storage_path) return;
    supabase.storage
      .from("intimate")
      .createSignedUrl(message.storage_path, 3600)
      .then(({ data }) => {
        if (vivant) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      vivant = false;
    };
  }, [supabase, message.storage_path]);

  if (!url) {
    return (
      <div
        className="h-36 w-36 rounded-2xl bg-velours-clair"
        style={{ animation: "pulse-doux 1.4s ease-in-out infinite" }}
      />
    );
  }

  return estClip(message.storage_path ?? "") ? (
    <video
      src={url}
      autoPlay
      muted
      loop
      playsInline
      onContextMenu={(e) => e.preventDefault()}
      className="max-h-48 w-auto max-w-[12rem] rounded-2xl"
    />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      draggable={false}
      onContextMenu={(e) => e.preventDefault()}
      className="max-h-48 w-auto max-w-[12rem] rounded-2xl object-contain"
    />
  );
}
