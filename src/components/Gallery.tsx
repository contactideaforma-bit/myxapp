"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { compresserImage, poidsLisible } from "@/lib/compression";

type Item = {
  id: string;
  couple_id: string;
  uploader_id: string;
  storage_path: string;
  caption: string | null;
  favorite: boolean;
  kind: "image" | "video";
  created_at: string;
};

const DUREE_SESSION_MS = 15 * 60 * 1000;

export default function Gallery({
  coupleId,
  userId,
  pinPose,
}: {
  coupleId: string;
  userId: string;
  pinPose: boolean;
}) {
  const [supabase] = useState(() => createClient());

  const [ouvert, setOuvert] = useState<boolean | null>(null); // null = on verifie
  const [saisie, setSaisie] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [bloqueJusqua, setBloqueJusqua] = useState<number | null>(null);

  const [items, setItems] = useState<Item[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [ouvre, setOuvre] = useState<Item | null>(null);
  const [commentaires, setCommentaires] = useState<
    { id: string; item_id: string; auteur: string | null; texte: string; created_at: string }[]
  >([]);
  const [nouveauCom, setNouveauCom] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [chargement, setChargement] = useState(false);

  const fichierRef = useRef<HTMLInputElement>(null);
  const minuterieRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ------------------------------------------------ Chargement des photos */
  const charger = useCallback(async () => {
    setChargement(true);
    const { data } = await supabase
      .from("gallery_items")
      .select("*")
      .eq("couple_id", coupleId)
      .order("created_at", { ascending: false });

    const liste = (data ?? []) as Item[];
    setItems(liste);

    if (liste.length) {
      const { data: signees } = await supabase.storage
        .from("intimate")
        .createSignedUrls(liste.map((i) => i.storage_path), 3600);
      const table: Record<string, string> = {};
      (signees ?? []).forEach((s) => {
        if (s.signedUrl && s.path) table[s.path] = s.signedUrl;
      });
      setUrls(table);
    } else {
      setUrls({});
    }
    setChargement(false);
  }, [supabase, coupleId]);

  /* ------------------------------------------------ Etat de la session */
  /* La verification periodique ne fait QUE verifier : elle ne recharge
     plus les photos ni ne re-signe les URL toutes les minutes. */
  const verifierSession = useCallback(async () => {
    const { data } = await supabase.rpc("vault_is_unlocked");
    const ok = data === true;
    setOuvert((avant) => {
      if (avant === true && !ok) {
        setItems([]);
        setUrls({});
      }
      return ok;
    });
    return ok;
  }, [supabase]);

  useEffect(() => {
    let vivant = true;
    (async () => {
      const ok = await verifierSession();
      if (ok && vivant) charger();
    })();
    const t = setInterval(verifierSession, 60_000);
    return () => {
      vivant = false;
      clearInterval(t);
    };
  }, [verifierSession, charger]);

  /* ------------------------------------------------ Verrouillage auto */
  function armerMinuterie() {
    if (minuterieRef.current) clearTimeout(minuterieRef.current);
    minuterieRef.current = setTimeout(() => {
      setOuvert(false);
      setItems([]);
      setUrls({});
    }, DUREE_SESSION_MS);
  }

  useEffect(() => {
    return () => {
      if (minuterieRef.current) clearTimeout(minuterieRef.current);
    };
  }, []);

  /* ------------------------------------------------ Deverrouillage */
  const tenter = useCallback(
    async (code: string) => {
      setOccupe(true);
      setErreur(null);
      const { data, error } = await supabase.rpc("unlock_vault", { p_pin: code });
      setOccupe(false);
      setSaisie("");

      if (error) {
        setErreur(
          error.message.includes("NO_PIN")
            ? "Aucun code n'est défini. Rendez-vous dans Profil."
            : error.message
        );
        return;
      }

      const r = data as { ok: boolean; restant?: number; bloque_jusqua?: string };
      if (r.ok) {
        setErreur(null);
        setBloqueJusqua(null);
        setOuvert(true);
        armerMinuterie();
        charger();
      } else if (r.bloque_jusqua) {
        setBloqueJusqua(new Date(r.bloque_jusqua).getTime());
        setErreur("Trop d'essais. Réessayez dans 5 minutes.");
      } else {
        setErreur(
          `Code incorrect — ${r.restant} essai${(r.restant ?? 0) > 1 ? "s" : ""} avant blocage.`
        );
      }
    },
    [supabase, charger]
  );

  useEffect(() => {
    if (saisie.length === 4 && !occupe) tenter(saisie);
  }, [saisie, occupe, tenter]);

  async function verrouiller() {
    await supabase.rpc("lock_vault");
    if (minuterieRef.current) clearTimeout(minuterieRef.current);
    setOuvert(false);
    setItems([]);
    setUrls({});
    setOuvre(null);
  }

  /* ------------------------------------------------ Ajout / suppression */
  async function ajouter(brut: File) {
    const estVideo = brut.type.startsWith("video/");
    if (!brut.type.startsWith("image/") && !estVideo) return;
    setOccupe(true);

    // Les photos sont allégées ici ; les vidéos ne peuvent pas l'être
    // dans le navigateur, on prévient clairement.
    const fichier = estVideo ? brut : await compresserImage(brut);
    if (fichier.size > 100 * 1024 * 1024) {
      setErreur(
        `Fichier trop lourd (${poidsLisible(fichier.size)}) — 100 Mo maximum. ` +
          "Filmez plus court, ou réduisez la qualité vidéo dans les Réglages de l'iPhone."
      );
      setOccupe(false);
      return;
    }
    const ext = fichier.name.split(".").pop()?.toLowerCase() || (estVideo ? "mp4" : "jpg");
    const chemin = `${coupleId}/vault/${userId}-${Date.now()}.${ext}`;

    const { error: errUp } = await supabase.storage
      .from("intimate")
      .upload(chemin, fichier, { upsert: false });

    if (errUp) {
      setErreur(errUp.message);
    } else {
      const { error } = await supabase.from("gallery_items").insert({
        couple_id: coupleId,
        uploader_id: userId,
        storage_path: chemin,
        kind: estVideo ? "video" : "image",
      });
      if (error) setErreur(error.message);
      else await charger();
    }
    setOccupe(false);
    armerMinuterie();
  }

  /* ------------------------------------------------ Commentaires */
  const chargerCommentaires = useCallback(
    async (itemId: string) => {
      const { data } = await supabase
        .from("gallery_comments")
        .select("id, item_id, auteur, texte, created_at")
        .eq("item_id", itemId)
        .order("created_at");
      setCommentaires(data ?? []);
    },
    [supabase]
  );

  useEffect(() => {
    if (ouvre) chargerCommentaires(ouvre.id);
    else setCommentaires([]);
  }, [ouvre, chargerCommentaires]);

  async function commenter() {
    const t = nouveauCom.trim();
    if (!t || !ouvre) return;
    setNouveauCom("");
    await supabase.from("gallery_comments").insert({
      item_id: ouvre.id,
      couple_id: coupleId,
      auteur: userId,
      texte: t,
    });
    chargerCommentaires(ouvre.id);
  }

  async function supprimerCommentaire(id: string) {
    setCommentaires((p) => p.filter((c) => c.id !== id));
    await supabase.from("gallery_comments").delete().eq("id", id);
  }

  async function basculerFavori(item: Item) {
    const nouveau = !item.favorite;
    setItems((p) => p.map((i) => (i.id === item.id ? { ...i, favorite: nouveau } : i)));
    setOuvre((o) => (o && o.id === item.id ? { ...o, favorite: nouveau } : o));
    await supabase.from("gallery_items").update({ favorite: nouveau }).eq("id", item.id);
  }

  async function supprimer(item: Item) {
    setOccupe(true);
    await supabase.storage.from("intimate").remove([item.storage_path]);
    await supabase.from("gallery_items").delete().eq("id", item.id);
    setItems((p) => p.filter((i) => i.id !== item.id));
    setOuvre(null);
    setOccupe(false);
  }

  /* ================================================ RENDU */

  if (ouvert === null) {
    return (
      <div className="grid h-full place-items-center">
        <p className="text-sm text-brume" style={{ animation: "pulse-doux 1.6s infinite" }}>
          …
        </p>
      </div>
    );
  }

  /* ---------------------------------------------- Aucun code defini */
  if (!pinPose) {
    return (
      <div className="mx-auto grid h-full max-w-md place-items-center px-8 text-center">
        <div className="space-y-3">
          <span className="text-3xl">🔐</span>
          <h1 className="font-display text-2xl">La galerie est scellée</h1>
          <p className="text-sm leading-relaxed text-brume">
            Définissez d&apos;abord un code à 4 chiffres. Sans lui, ni la base ni le
            stockage ne laisseront sortir la moindre image.
          </p>
          <Link href="/profil" className="btn mt-2 inline-flex">
            Définir le code
          </Link>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------- Ecran de deverrouillage */
  if (!ouvert) {
    const bloque = bloqueJusqua !== null && bloqueJusqua > Date.now();
    return (
      <div className="mx-auto grid h-full max-w-xs place-items-center px-6">
        <div className="w-full text-center">
          <span className="text-3xl">🕯️</span>
          <h1 className="mt-2 font-display text-2xl">Votre galerie</h1>
          <p className="mt-1 text-sm text-brume">Entrez votre code</p>

          <div className="my-7 flex justify-center gap-4">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`h-3.5 w-3.5 rounded-full border transition ${
                  i < saisie.length
                    ? "border-bordeaux-vif bg-bordeaux-vif"
                    : "border-bord bg-transparent"
                }`}
              />
            ))}
          </div>

          {erreur && <p className="mb-4 text-sm text-orrose">{erreur}</p>}

          <div className="grid grid-cols-3 gap-3">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "←"].map((t, i) =>
              t === "" ? (
                <span key={i} />
              ) : (
                <button
                  key={i}
                  disabled={occupe || bloque}
                  onClick={() =>
                    setSaisie((s) =>
                      t === "←" ? s.slice(0, -1) : s.length < 4 ? s + t : s
                    )
                  }
                  className="grid h-14 place-items-center rounded-2xl border border-bord bg-velours-clair font-display text-xl transition hover:border-bordeaux-vif disabled:opacity-30"
                >
                  {t}
                </button>
              )
            )}
          </div>

          <p className="mt-6 text-[11px] leading-relaxed text-brume">
            Après 5 essais manqués, l&apos;accès se bloque 5 minutes.
          </p>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------- Galerie ouverte */
  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-bord bg-velours/80 px-4 py-3 backdrop-blur">
        <div className="flex-1">
          <h1 className="font-display text-xl leading-tight">Galerie</h1>
          <p className="text-xs text-brume">
            {items.length} élément{items.length > 1 ? "s" : ""} · session de 15 min
          </p>
        </div>
        <button
          onClick={() => fichierRef.current?.click()}
          disabled={occupe}
          className="rounded-lg border border-bord px-3 py-1.5 text-xs text-orrose transition hover:border-bordeaux-vif"
        >
          + Ajouter
        </button>
        <button
          onClick={verrouiller}
          className="rounded-lg border border-bord px-3 py-1.5 text-xs text-brume transition hover:border-bordeaux-vif"
        >
          🔒
        </button>
      </header>

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

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {chargement && items.length === 0 && (
          <p className="mt-16 text-center text-sm text-brume">Ouverture…</p>
        )}

        {!chargement && items.length === 0 && (
          <div className="mx-auto mt-20 max-w-xs text-center">
            <p className="font-display text-2xl text-orrose">Rien encore</p>
            <p className="mt-2 text-sm text-brume">
              Ajoutez une photo ou une vidéo. Rien ne quittera ce coffre.
            </p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-1.5">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => setOuvre(item)}
              className="anim-monte relative aspect-square overflow-hidden rounded-xl border border-bord bg-velours-clair"
            >
              {urls[item.storage_path] ? (
                item.kind === "video" ? (
                  <>
                    <video
                      src={urls[item.storage_path]}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                    <span className="absolute inset-0 grid place-items-center">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-nuit/70 text-xs text-champagne">
                        ▶
                      </span>
                    </span>
                  </>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={urls[item.storage_path]}
                    alt=""
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                )
              ) : (
                <span className="grid h-full place-items-center text-brume">·</span>
              )}
              {item.favorite && (
                <span className="absolute right-1 top-1 text-xs drop-shadow">🔥</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------------------- Visionneuse */}
      {ouvre && (
        <div
          className="fixed inset-0 z-40 flex flex-col bg-nuit/95 backdrop-blur"
          onClick={() => setOuvre(null)}
        >
          <div className="flex justify-end p-4">
            <button className="text-2xl text-brume" onClick={() => setOuvre(null)}>
              ×
            </button>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center px-4">
            {urls[ouvre.storage_path] &&
              (ouvre.kind === "video" ? (
                <video
                  src={urls[ouvre.storage_path]}
                  onClick={(e) => e.stopPropagation()}
                  className="max-h-full max-w-full rounded-2xl"
                  controls
                  autoPlay
                  playsInline
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={urls[ouvre.storage_path]}
                  alt=""
                  onClick={(e) => e.stopPropagation()}
                  onContextMenu={(e) => e.preventDefault()}
                  className="max-h-full max-w-full rounded-2xl object-contain"
                  draggable={false}
                />
              ))}
          </div>

          <div
            className="max-h-[38dvh] shrink-0 overflow-y-auto border-t border-bord bg-velours/95 px-4 py-3"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-2 text-[10px] uppercase tracking-widest text-brume">
              {commentaires.length
                ? `${commentaires.length} commentaire${commentaires.length > 1 ? "s" : ""}`
                : "Aucun commentaire"}
            </p>

            <div className="space-y-2">
              {commentaires.map((c) => {
                const deMoi = c.auteur === userId;
                return (
                  <div
                    key={c.id}
                    className={`flex items-start gap-2 rounded-xl border px-3 py-2 ${
                      deMoi
                        ? "border-bordeaux-vif/60 bg-bordeaux/20"
                        : "border-bord bg-velours-clair"
                    }`}
                  >
                    <span
                      className="mt-0.5 h-2 w-2 shrink-0 rounded-full"
                      style={{
                        background: deMoi
                          ? "var(--color-bordeaux-vif)"
                          : "var(--color-amethyste)",
                      }}
                    />
                    <span className="min-w-0 flex-1 text-sm leading-snug">{c.texte}</span>
                    {deMoi && (
                      <button
                        onClick={() => supprimerCommentaire(c.id)}
                        className="shrink-0 text-xs text-brume"
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex gap-2">
              <input
                className="champ min-w-0 flex-1"
                placeholder="Un mot sur cette image…"
                value={nouveauCom}
                maxLength={280}
                onChange={(e) => setNouveauCom(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && commenter()}
              />
              <button className="btn w-auto shrink-0 px-5" onClick={commenter}>
                ↑
              </button>
            </div>
          </div>

          <div
            className="flex shrink-0 items-center justify-center gap-3 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => basculerFavori(ouvre)}
              className={`rounded-xl border px-4 py-2 text-sm transition ${
                ouvre.favorite
                  ? "border-bordeaux-vif bg-bordeaux/30 text-orrose"
                  : "border-bord text-brume"
              }`}
            >
              🔥 Coup de cœur
            </button>
            <button
              onClick={() => supprimer(ouvre)}
              disabled={occupe}
              className="rounded-xl border border-bord px-4 py-2 text-sm text-brume transition hover:border-bordeaux-vif"
            >
              Supprimer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
