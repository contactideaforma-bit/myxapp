"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Item = {
  id: string;
  couple_id: string;
  uploader_id: string;
  storage_path: string;
  caption: string | null;
  favorite: boolean;
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
  const verifierSession = useCallback(async () => {
    const { data } = await supabase.rpc("vault_is_unlocked");
    const ok = data === true;
    setOuvert(ok);
    if (ok) charger();
    return ok;
  }, [supabase, charger]);

  useEffect(() => {
    verifierSession();
    const t = setInterval(verifierSession, 60_000);
    return () => clearInterval(t);
  }, [verifierSession]);

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
  async function ajouter(fichier: File) {
    if (!fichier.type.startsWith("image/")) return;
    setOccupe(true);
    const ext = fichier.name.split(".").pop()?.toLowerCase() || "jpg";
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
      });
      if (error) setErreur(error.message);
      else await charger();
    }
    setOccupe(false);
    armerMinuterie();
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
            {items.length} photo{items.length > 1 ? "s" : ""} · session de 15 min
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
        accept="image/*"
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
              Ajoutez une première image. Elle ne quittera jamais ce coffre.
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
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={urls[item.storage_path]}
                  alt=""
                  className="h-full w-full object-cover"
                  draggable={false}
                />
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
            {urls[ouvre.storage_path] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={urls[ouvre.storage_path]}
                alt=""
                onClick={(e) => e.stopPropagation()}
                onContextMenu={(e) => e.preventDefault()}
                className="max-h-full max-w-full rounded-2xl object-contain"
                draggable={false}
              />
            )}
          </div>

          <div
            className="flex items-center justify-center gap-3 p-6"
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
