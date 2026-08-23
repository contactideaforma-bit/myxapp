"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Ligne = { user_id: string; niveau: number; note: string | null; updated_at: string };

export const NIVEAUX = [
  { n: 1, emoji: "😴", label: "Fatigué·e", couleur: "#7C8AA0" },
  { n: 2, emoji: "🌙", label: "Câlin", couleur: "#A86BD8" },
  { n: 3, emoji: "😌", label: "Bien", couleur: "#5BD6E8" },
  { n: 4, emoji: "💋", label: "Envie", couleur: "#F5A65B" },
  { n: 5, emoji: "🔥", label: "Brûlant·e", couleur: "#FF4D8D" },
];

export default function Humeur({
  coupleId,
  userId,
  partenaire,
}: {
  coupleId: string;
  userId: string;
  partenaire: string;
}) {
  const [supabase] = useState(() => createClient());
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [note, setNote] = useState("");

  const charger = useCallback(async () => {
    const { data } = await supabase.rpc("humeurs_du_moment");
    setLignes((data ?? []) as Ligne[]);
  }, [supabase]);

  useEffect(() => {
    charger();
    const canal = supabase
      .channel(`humeur-${coupleId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "humeurs" }, () =>
        charger()
      )
      .subscribe();
    const t = setInterval(charger, 60_000);
    return () => {
      supabase.removeChannel(canal);
      clearInterval(t);
    };
  }, [supabase, coupleId, charger]);

  const mienne = lignes.find((l) => l.user_id === userId);
  const sienne = lignes.find((l) => l.user_id !== userId);
  const nivSien = NIVEAUX.find((x) => x.n === sienne?.niveau);
  const nivMien = NIVEAUX.find((x) => x.n === mienne?.niveau);

  async function poser(n: number) {
    await supabase.rpc("set_humeur", { p_niveau: n, p_note: note || null });
    setNote("");
    setOuvert(false);
    charger();
    // On prévient l'autre seulement quand l'envie monte.
    if (n >= 4) {
      fetch("/api/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ genre: "humeur", apercu: "" }),
      }).catch(() => {});
    }
  }

  return (
    <>
      <button
        onClick={() => setOuvert(true)}
        className="flex shrink-0 items-center gap-1 rounded-full border border-bord px-2.5 py-1.5 text-xs transition"
        style={nivSien ? { borderColor: nivSien.couleur } : undefined}
        title="L'humeur du soir"
      >
        <span className="text-sm">{nivSien?.emoji ?? "·"}</span>
        <span className="text-[10px] text-brume">{nivMien?.emoji ?? "?"}</span>
      </button>

      {ouvert && (
        <div
          className="voile voile-bas"
          onClick={() => setOuvert(false)}
        >
          <div
            className="feuille max-h-[86dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="poignee" />

            <h2 className="titre-section font-display text-2xl">Ce soir</h2>
            <p className="mt-1 text-xs leading-relaxed text-brume">
              Un seul geste pour dire où vous en êtes. Ça se voit des deux
              côtés, et ça s&apos;efface tout seul après 18 heures.
            </p>

            {/* Où en est l'autre */}
            <div className="mt-4 rounded-xl border border-bord bg-velours-clair p-3">
              <p className="text-[10px] uppercase tracking-widest text-brume">
                {partenaire}
              </p>
              {nivSien ? (
                <p className="mt-1 flex items-center gap-2">
                  <span className="text-2xl">{nivSien.emoji}</span>
                  <span style={{ color: nivSien.couleur }}>{nivSien.label}</span>
                </p>
              ) : (
                <p className="mt-1 text-sm text-brume">N&apos;a rien dit encore.</p>
              )}
              {sienne?.note && (
                <p className="mt-1 text-sm italic text-champagne">« {sienne.note} »</p>
              )}
            </div>

            {/* Mon humeur */}
            <p className="mb-2 mt-5 text-xs uppercase tracking-widest text-brume">
              Et vous ?
            </p>
            <div className="flex gap-1.5">
              {NIVEAUX.map((niv) => {
                const actif = mienne?.niveau === niv.n;
                return (
                  <button
                    key={niv.n}
                    onClick={() => poser(niv.n)}
                    className="flex flex-1 flex-col items-center gap-1 rounded-2xl border py-3 transition active:scale-95"
                    style={{
                      borderColor: actif ? niv.couleur : "var(--color-bord)",
                      background: actif
                        ? `color-mix(in srgb, ${niv.couleur} 22%, transparent)`
                        : "var(--color-velours-clair)",
                    }}
                  >
                    <span className="text-2xl">{niv.emoji}</span>
                    <span
                      className="text-[9px] leading-tight"
                      style={{ color: actif ? niv.couleur : "var(--color-brume)" }}
                    >
                      {niv.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <input
              className="champ mt-3"
              placeholder="Un mot, si vous voulez…"
              value={note}
              maxLength={90}
              onChange={(e) => setNote(e.target.value)}
            />

            <button className="btn btn-fantome mt-4" onClick={() => setOuvert(false)}>
              Fermer
            </button>
          </div>
        </div>
      )}
    </>
  );
}
