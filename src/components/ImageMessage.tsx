"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/lib/types";

export default function ImageMessage({
  message,
  estMoi,
  onOuvrir,
}: {
  message: Message;
  estMoi: boolean;
  onOuvrir: (id: string) => void;
}) {
  const [supabase] = useState(() => createClient());
  const [url, setUrl] = useState<string | null>(null);
  const [charge, setCharge] = useState(false);

  const consommee = message.view_once && !!message.opened_at;

  async function afficher() {
    if (url || charge || !message.storage_path) return;
    setCharge(true);
    const { data } = await supabase.storage
      .from("intimate")
      .createSignedUrl(message.storage_path, 60);
    setUrl(data?.signedUrl ?? null);
    setCharge(false);
    if (message.view_once && !estMoi && !message.opened_at) onOuvrir(message.id);
  }

  // Photo « vue unique » déjà ouverte : plus rien à montrer
  if (consommee && !url) {
    return (
      <div className="flex h-32 w-52 flex-col items-center justify-center gap-1 rounded-bulle border border-dashed border-bord text-brume">
        <span className="text-xl">🕯️</span>
        <span className="text-xs">Photo consumée</span>
      </div>
    );
  }

  if (!url) {
    return (
      <button
        onClick={afficher}
        className="group relative h-40 w-56 overflow-hidden rounded-bulle border border-bord bg-velours-clair"
      >
        <div className="absolute inset-0 grid place-items-center gap-1">
          <span className="text-2xl">{message.view_once ? "🔥" : "🖼️"}</span>
          <span className="px-4 text-center text-xs text-brume">
            {charge
              ? "Ouverture…"
              : message.view_once
                ? estMoi
                  ? "Vue unique · envoyée"
                  : "Vue unique — toucher pour ouvrir"
                : "Toucher pour afficher"}
          </span>
        </div>
      </button>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      onContextMenu={(e) => e.preventDefault()}
      className="max-h-80 w-56 rounded-bulle border border-bord object-cover select-none"
      draggable={false}
    />
  );
}
