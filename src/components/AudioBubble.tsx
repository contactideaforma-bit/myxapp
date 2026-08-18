"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/lib/types";

/** Lecteur compact, avec une onde décorative qui se remplit à la lecture. */
export default function AudioBubble({
  message,
  estMoi,
}: {
  message: Message;
  estMoi: boolean;
}) {
  const [supabase] = useState(() => createClient());
  const [url, setUrl] = useState<string | null>(null);
  const [joue, setJoue] = useState(false);
  const [avance, setAvance] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const duree = Math.max(1, Math.round((message.duree_ms ?? 0) / 1000));

  // Onde stable : dérivée de l'identifiant, donc identique des deux côtés.
  const barres = Array.from({ length: 28 }, (_, i) => {
    const g = message.id.charCodeAt(i % message.id.length) + i * 7;
    return 28 + ((g * 13) % 62);
  });

  useEffect(() => {
    let annule = false;
    (async () => {
      if (!message.storage_path) return;
      const { data } = await supabase.storage
        .from("intimate")
        .createSignedUrl(message.storage_path, 3600);
      if (!annule) setUrl(data?.signedUrl ?? null);
    })();
    return () => {
      annule = true;
    };
  }, [message.storage_path, supabase]);

  function basculer() {
    const a = audioRef.current;
    if (!a) return;
    if (joue) {
      a.pause();
    } else {
      a.play();
    }
  }

  return (
    <div
      className={`flex w-64 items-center gap-3 rounded-bulle px-3 py-2.5 ${
        estMoi
          ? "bg-gradient-to-br from-bordeaux to-bordeaux-vif text-white"
          : "border border-bord bg-velours-clair text-champagne"
      }`}
    >
      <button
        onClick={basculer}
        disabled={!url}
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm transition active:scale-90 ${
          estMoi ? "bg-nuit/30" : "bg-bordeaux/40"
        } disabled:opacity-40`}
      >
        {joue ? "⏸" : "▶"}
      </button>

      <div className="flex h-8 min-w-0 flex-1 items-center gap-[2px]">
        {barres.map((h, i) => {
          const atteint = (i / barres.length) * 100 <= avance;
          return (
            <span
              key={i}
              className="w-full rounded-full transition-opacity"
              style={{
                height: `${h}%`,
                background: estMoi ? "#fff" : "var(--color-orrose)",
                opacity: atteint ? 1 : 0.3,
              }}
            />
          );
        })}
      </div>

      <span className="shrink-0 text-[11px] tabular-nums opacity-80">
        {Math.floor(duree / 60)}:{String(duree % 60).padStart(2, "0")}
      </span>

      {url && (
        <audio
          ref={audioRef}
          src={url}
          preload="metadata"
          onPlay={() => setJoue(true)}
          onPause={() => setJoue(false)}
          onEnded={() => {
            setJoue(false);
            setAvance(0);
          }}
          onTimeUpdate={(e) => {
            const a = e.currentTarget;
            if (a.duration) setAvance((a.currentTime / a.duration) * 100);
          }}
        />
      )}
    </div>
  );
}
