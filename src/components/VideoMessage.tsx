"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/lib/types";

/* =====================================================================
   VIDÉO DANS LA CONVERSATION — rien ne se télécharge avant qu'on le
   demande (les vidéos pèsent lourd), et l'URL signée dure 1 h pour
   tenir toute la lecture, y compris les sauts dans la timeline.
   ===================================================================== */

export default function VideoMessage({ message }: { message: Message }) {
  const [supabase] = useState(() => createClient());
  const [url, setUrl] = useState<string | null>(null);
  const [charge, setCharge] = useState(false);

  async function afficher() {
    if (url || charge || !message.storage_path) return;
    setCharge(true);
    const { data } = await supabase.storage
      .from("intimate")
      .createSignedUrl(message.storage_path, 3600);
    setUrl(data?.signedUrl ?? null);
    setCharge(false);
  }

  if (!url) {
    return (
      <button
        onClick={afficher}
        className="group relative h-40 w-56 overflow-hidden rounded-bulle border border-bord bg-velours-clair"
      >
        <div className="absolute inset-0 grid place-items-center gap-1">
          <span className="text-2xl">🎬</span>
          <span className="px-4 text-center text-xs text-brume">
            {charge ? "Ouverture…" : "Vidéo — toucher pour charger"}
          </span>
        </div>
      </button>
    );
  }

  return (
    <video
      src={url}
      controls
      playsInline
      preload="metadata"
      onContextMenu={(e) => e.preventDefault()}
      className="max-h-80 w-64 rounded-bulle border border-bord bg-black"
    />
  );
}
