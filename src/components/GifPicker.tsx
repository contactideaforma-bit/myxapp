"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Gif = { id: string; apercu: string; complet: string; titre: string };
type Sticker = { id: string; storage_path: string; legende: string | null };

export default function GifPicker({
  coupleId,
  userId,
  onGiphy,
  onSticker,
  onFermer,
}: {
  coupleId: string;
  userId: string;
  onGiphy: (url: string) => void;
  onSticker: (chemin: string) => void;
  onFermer: () => void;
}) {
  const [supabase] = useState(() => createClient());
  const [onglet, setOnglet] = useState<"giphy" | "nous">("giphy");

  const [q, setQ] = useState("");
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [charge, setCharge] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [envoi, setEnvoi] = useState(false);
  const fichierRef = useRef<HTMLInputElement>(null);

  /* -------------------------------------------------- Giphy */
  const chercher = useCallback(
    async (terme: string) => {
      setCharge(true);
      setErreur(null);
      try {
        const rep = await fetch(`/api/gifs?q=${encodeURIComponent(terme)}`);
        const json = await rep.json();
        if (!rep.ok) throw new Error(json.error ?? "erreur");
        setGifs(json.gifs ?? []);
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "erreur");
        setGifs([]);
      }
      setCharge(false);
    },
    []
  );

  useEffect(() => {
    if (onglet !== "giphy") return;
    const t = setTimeout(() => chercher(q), q ? 380 : 0);
    return () => clearTimeout(t);
  }, [q, onglet, chercher]);

  /* -------------------------------------------------- Bibliothèque */
  const chargerStickers = useCallback(async () => {
    const { data } = await supabase
      .from("stickers")
      .select("id, storage_path, legende")
      .eq("couple_id", coupleId)
      .order("created_at", { ascending: false });
    const liste = (data ?? []) as Sticker[];
    setStickers(liste);

    if (liste.length) {
      const { data: sg } = await supabase.storage
        .from("intimate")
        .createSignedUrls(liste.map((s) => s.storage_path), 3600);
      const u: Record<string, string> = {};
      (sg ?? []).forEach((x) => {
        if (x.signedUrl && x.path) u[x.path] = x.signedUrl;
      });
      setUrls(u);
    }
  }, [supabase, coupleId]);

  useEffect(() => {
    if (onglet === "nous") chargerStickers();
  }, [onglet, chargerStickers]);

  async function ajouter(fichier: File) {
    if (!fichier.type.startsWith("image/")) return;
    setEnvoi(true);
    const ext = (fichier.name.split(".").pop() || "gif").toLowerCase();
    const chemin = `${coupleId}/stickers/${userId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("intimate")
      .upload(chemin, fichier, { upsert: false });
    if (!error) {
      await supabase
        .from("stickers")
        .insert({ couple_id: coupleId, storage_path: chemin, added_by: userId });
      await chargerStickers();
    }
    setEnvoi(false);
  }

  async function retirer(s: Sticker) {
    setStickers((p) => p.filter((x) => x.id !== s.id));
    await supabase.storage.from("intimate").remove([s.storage_path]);
    await supabase.from("stickers").delete().eq("id", s.id);
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end bg-nuit/80 backdrop-blur"
      onClick={onFermer}
    >
      <div
        className="flex h-[70dvh] w-full flex-col rounded-t-3xl border-t border-bord bg-velours"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto my-3 h-1 w-10 shrink-0 rounded-full bg-bord" />

        <div className="mx-4 mb-3 flex shrink-0 rounded-xl bg-velours-clair p-1 text-sm">
          {(["giphy", "nous"] as const).map((o) => (
            <button
              key={o}
              onClick={() => setOnglet(o)}
              className={`flex-1 rounded-lg py-2 transition ${
                onglet === o ? "bg-bordeaux text-white" : "text-brume"
              }`}
            >
              {o === "giphy" ? "GIF" : "À nous"}
            </button>
          ))}
        </div>

        {onglet === "giphy" ? (
          <>
            <div className="mx-4 mb-3 shrink-0">
              <input
                className="champ"
                placeholder="Chercher un GIF…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoFocus
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
              {erreur && (
                <p className="rounded-xl border border-bordeaux bg-bordeaux/15 px-4 py-3 text-sm text-orrose">
                  {erreur}
                </p>
              )}
              {charge && !gifs.length && (
                <p className="py-10 text-center text-sm text-brume">…</p>
              )}
              <div className="columns-2 gap-2 [&>*]:mb-2">
                {gifs.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => onGiphy(g.complet)}
                    className="block w-full overflow-hidden rounded-xl border border-bord"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={g.apercu} alt={g.titre} className="w-full" loading="lazy" />
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="mx-4 mb-3 shrink-0">
              <input
                ref={fichierRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) ajouter(f);
                  e.target.value = "";
                }}
              />
              <button
                className="btn"
                disabled={envoi}
                onClick={() => fichierRef.current?.click()}
              >
                {envoi ? "Envoi…" : "+ Ajouter à notre bibliothèque"}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
              {stickers.length === 0 && (
                <p className="py-10 text-center text-sm leading-relaxed text-brume">
                  Votre bibliothèque est vide.
                  <br />
                  Ce que vous y mettez n&apos;obéit qu&apos;à vous.
                </p>
              )}
              <div className="grid grid-cols-3 gap-2">
                {stickers.map((s) => (
                  <div key={s.id} className="relative">
                    <button
                      onClick={() => onSticker(s.storage_path)}
                      className="block aspect-square w-full overflow-hidden rounded-xl border border-bord bg-velours-clair"
                    >
                      {urls[s.storage_path] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={urls[s.storage_path]}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      )}
                    </button>
                    <button
                      onClick={() => retirer(s)}
                      className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full border border-bord bg-nuit text-[10px] text-brume"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
