"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import StickerVideo from "@/components/StickerVideo";

type Gif = { id: string; apercu: string; complet: string; titre: string };
type Sticker = { id: string; storage_path: string; legende: string | null };

/** Cache de séance : rouvrir le tiroir affiche les stickers immédiatement,
    le réseau ne sert plus qu'à rafraîchir en arrière-plan. */
let cacheStickers: { coupleId: string; liste: Sticker[]; urls: Record<string, string> } | null = null;

export default function GifPicker({
  coupleId,
  userId,
  ongletInitial = "giphy",
  onGiphy,
  onSticker,
  onFermer,
}: {
  coupleId: string;
  userId: string;
  ongletInitial?: "giphy" | "nous";
  onGiphy: (url: string) => void;
  onSticker: (chemin: string) => void;
  onFermer: () => void;
}) {
  const [supabase] = useState(() => createClient());
  const [onglet, setOnglet] = useState<"giphy" | "nous">(ongletInitial);

  const [q, setQ] = useState("");
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [charge, setCharge] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const [stickers, setStickers] = useState<Sticker[]>(() =>
    cacheStickers?.coupleId === coupleId ? cacheStickers.liste : []
  );
  const [urls, setUrls] = useState<Record<string, string>>(() =>
    cacheStickers?.coupleId === coupleId ? cacheStickers.urls : {}
  );
  const [confirmeId, setConfirmeId] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const fichierRef = useRef<HTMLInputElement>(null);
  /** Vidéo en attente de capture : on en tirera un sticker. */
  const [videoAScanner, setVideoAScanner] = useState<File | null>(null);

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

    const u: Record<string, string> = {};
    if (liste.length) {
      const { data: sg } = await supabase.storage
        .from("intimate")
        .createSignedUrls(liste.map((s) => s.storage_path), 3600);
      (sg ?? []).forEach((x) => {
        if (x.signedUrl && x.path) u[x.path] = x.signedUrl;
      });
      setUrls(u);
    }
    cacheStickers = { coupleId, liste, urls: u };
  }, [supabase, coupleId]);

  useEffect(() => {
    if (onglet === "nous") chargerStickers();
  }, [onglet, chargerStickers]);

  async function ajouter(fichier: File) {
    // Une vidéo ? On ouvre le cadreur : l'instant choisi deviendra un sticker.
    if (fichier.type.startsWith("video/")) {
      setVideoAScanner(fichier);
      return;
    }
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

  /** L'image capturée dans la vidéo entre dans la bibliothèque. */
  async function ajouterCapture(image: Blob) {
    setVideoAScanner(null);
    setEnvoi(true);
    const ext = image.type.includes("webp") ? "webp" : "png";
    const chemin = `${coupleId}/stickers/${userId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("intimate")
      .upload(chemin, image, { contentType: image.type || "image/png", upsert: false });
    if (!error) {
      await supabase
        .from("stickers")
        .insert({ couple_id: coupleId, storage_path: chemin, added_by: userId });
      await chargerStickers();
    }
    setEnvoi(false);
  }

  async function retirer(s: Sticker) {
    setConfirmeId(null);
    setStickers((p) => {
      const suite = p.filter((x) => x.id !== s.id);
      if (cacheStickers?.coupleId === coupleId) cacheStickers = { ...cacheStickers, liste: suite };
      return suite;
    });
    await supabase.storage.from("intimate").remove([s.storage_path]);
    await supabase.from("stickers").delete().eq("id", s.id);
  }

  /** Premier ✕ = armer (2,5 s), second = supprimer. Évite les doigts qui glissent. */
  function demanderRetrait(s: Sticker) {
    if (confirmeId === s.id) {
      retirer(s);
      return;
    }
    setConfirmeId(s.id);
    setTimeout(() => setConfirmeId((c) => (c === s.id ? null : c)), 2500);
  }

  return (
    <div
      className="voile voile-bas"
      onClick={onFermer}
    >
      <div
        className="flex h-[70dvh] w-full flex-col rounded-t-3xl border-t border-bord bg-velours"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="poignee" />

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
                accept="image/*,video/*"
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
                {envoi ? "Envoi…" : "+ Ajouter — image ou vidéo"}
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
                      onClick={() => demanderRetrait(s)}
                      className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full border text-[11px] transition"
                      style={
                        confirmeId === s.id
                          ? { background: "var(--color-bordeaux-vif)", borderColor: "var(--color-bordeaux-vif)", color: "#fff" }
                          : { background: "var(--color-nuit)", borderColor: "var(--color-bord)", color: "var(--color-brume)" }
                      }
                      aria-label={confirmeId === s.id ? "Confirmer la suppression" : "Supprimer ce sticker"}
                    >
                      {confirmeId === s.id ? "✓" : "×"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {videoAScanner && (
          <StickerVideo
            fichier={videoAScanner}
            onCapture={ajouterCapture}
            onFermer={() => setVideoAScanner(null)}
          />
        )}
      </div>
    </div>
  );
}
