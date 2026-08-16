"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Silhouette from "./Silhouette";

export type PositionDB = {
  key: string;
  nom: string;
  sous_titre: string | null;
  description: string | null;
  conseil: string | null;
  difficulte: number;
  intensite: number;
  figure: string | null;
  image_path: string | null;
  image_credit: string | null;
  image_source_url: string | null;
  ordre: number;
};

type Marque = {
  pos_key: string;
  my_wants: boolean;
  my_done: boolean;
  my_loved: boolean;
  both_want: boolean;
  partner_done: boolean;
  partner_loved: boolean;
};

const VIDE: Omit<Marque, "pos_key"> = {
  my_wants: false,
  my_done: false,
  my_loved: false,
  both_want: false,
  partner_done: false,
  partner_loved: false,
};

const FILTRES = [
  { cle: "toutes", label: "Toutes" },
  { cle: "communes", label: "✨ Envies communes" },
  { cle: "testees", label: "Déjà testées" },
  { cle: "coups", label: "🔥 Coups de cœur" },
] as const;

/** Illustration importée, fondue dans la charte : inversée puis teintée. */
function Duotone({ src, className = "" }: { src: string; className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-nuit ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        draggable={false}
        onContextMenu={(e) => e.preventDefault()}
        className="h-full w-full object-contain opacity-90 grayscale invert contrast-110"
      />
      <span className="pointer-events-none absolute inset-0 bg-bordeaux mix-blend-color" />
      <span className="pointer-events-none absolute inset-0 bg-orrose/20 mix-blend-soft-light" />
    </div>
  );
}

export default function Kamasutra({
  coupleId,
  userId,
  modeInitial,
}: {
  coupleId: string;
  userId: string;
  modeInitial: string;
}) {
  const [supabase] = useState(() => createClient());

  const [positions, setPositions] = useState<PositionDB[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [imagesCouple, setImagesCouple] = useState<Record<string, string>>({});
  const [urlsCouple, setUrlsCouple] = useState<Record<string, string>>({});
  const [televerse, setTeleverse] = useState<string | null>(null);
  const [marques, setMarques] = useState<Record<string, Omit<Marque, "pos_key">>>({});
  const [mode, setMode] = useState(modeInitial);
  const [filtre, setFiltre] = useState<(typeof FILTRES)[number]["cle"]>("toutes");
  const [ouverte, setOuverte] = useState<PositionDB | null>(null);
  const [credits, setCredits] = useState(false);
  const [charge, setCharge] = useState(true);

  /* ------------------------------------------------ Chargement */
  const charger = useCallback(async () => {
    const [{ data: pos }, { data: mk }, { data: imgs }] = await Promise.all([
      supabase.from("positions").select("*").eq("active", true).order("ordre"),
      supabase.rpc("positions_overview"),
      supabase.from("position_images").select("position_key, storage_path"),
    ]);

    // Illustrations deposees par le couple : elles priment sur tout
    const perso: Record<string, string> = {};
    ((imgs ?? []) as { position_key: string; storage_path: string }[]).forEach((i) => {
      perso[i.position_key] = i.storage_path;
    });
    setImagesCouple(perso);

    const cheminsPerso = Object.values(perso);
    if (cheminsPerso.length) {
      const { data: sp } = await supabase.storage
        .from("intimate")
        .createSignedUrls(cheminsPerso, 3600);
      const up: Record<string, string> = {};
      (sp ?? []).forEach((x) => {
        if (x.signedUrl && x.path) up[x.path] = x.signedUrl;
      });
      setUrlsCouple(up);
    } else {
      setUrlsCouple({});
    }

    const liste = (pos ?? []) as PositionDB[];
    setPositions(liste);

    const table: Record<string, Omit<Marque, "pos_key">> = {};
    ((mk ?? []) as Marque[]).forEach(({ pos_key, ...reste }) => {
      table[pos_key] = reste;
    });
    setMarques(table);

    const chemins = liste.map((p) => p.image_path).filter(Boolean) as string[];
    if (chemins.length) {
      const { data: signees } = await supabase.storage
        .from("positions")
        .createSignedUrls(chemins, 3600);
      const u: Record<string, string> = {};
      (signees ?? []).forEach((s) => {
        if (s.signedUrl && s.path) u[s.path] = s.signedUrl;
      });
      setUrls(u);
    }

    setCharge(false);
  }, [supabase]);

  useEffect(() => {
    charger();
  }, [charger]);

  const etat = useCallback(
    (key: string) => marques[key] ?? VIDE,
    [marques]
  );

  async function basculer(key: string, champ: "wants" | "done" | "loved") {
    const actuel = etat(key);
    const valeur = !actuel[`my_${champ}` as keyof typeof actuel];
    setMarques((p) => ({ ...p, [key]: { ...(p[key] ?? VIDE), [`my_${champ}`]: valeur } }));
    await supabase.rpc("set_position_mark", {
      p_key: key,
      p_wants: champ === "wants" ? valeur : null,
      p_done: champ === "done" ? valeur : null,
      p_loved: champ === "loved" ? valeur : null,
    });
    charger();
  }

  async function changerMode(nouveau: string) {
    setMode(nouveau);
    await supabase.rpc("set_illustration_mode", { p_mode: nouveau });
  }

  const liste = useMemo(
    () =>
      positions.filter((p) => {
        const e = etat(p.key);
        if (filtre === "communes") return e.both_want;
        if (filtre === "testees") return e.my_done || e.partner_done;
        if (filtre === "coups") return e.my_loved || e.partner_loved;
        return true;
      }),
    [positions, filtre, etat]
  );

  const communes = positions.filter((p) => etat(p.key).both_want).length;
  const illustrees = positions.filter(
    (p) => imagesCouple[p.key] || p.image_path
  ).length;

  /** Visuel d'une position selon le mode choisi, avec repli automatique. */
  const visuel = (p: PositionDB, classe: string) => {
    if (mode === "detaillee") {
      // 1. l'image deposee par le couple, telle quelle
      const chemin = imagesCouple[p.key];
      const perso = chemin ? urlsCouple[chemin] : null;
      if (perso) {
        return (
          <div className={`relative overflow-hidden bg-nuit ${classe}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={perso}
              alt=""
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              className="h-full w-full object-cover"
            />
          </div>
        );
      }
      // 2. a defaut, une illustration du catalogue, harmonisee
      const url = p.image_path ? urls[p.image_path] : null;
      if (url) return <Duotone src={url} className={classe} />;
    }
    // 3. sinon la silhouette
    return <Silhouette figure={p.figure ?? p.key} className={classe} />;
  };

  /* ------------------------------------------------ Depot d'illustration */
  async function deposer(key: string, fichier: File) {
    if (!fichier.type.startsWith("image/")) return;
    setTeleverse(key);

    const ext = (fichier.name.split(".").pop() || "jpg").toLowerCase();
    const chemin = `${coupleId}/positions/${key}.${ext}`;

    const { error: errUp } = await supabase.storage
      .from("intimate")
      .upload(chemin, fichier, { upsert: true, cacheControl: "0" });

    if (!errUp) {
      await supabase.from("position_images").upsert(
        {
          couple_id: coupleId,
          position_key: key,
          storage_path: chemin,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "couple_id,position_key" }
      );
      setMode("detaillee");
      await supabase.rpc("set_illustration_mode", { p_mode: "detaillee" });
      await charger();
    }
    setTeleverse(null);
  }

  async function retirer(key: string) {
    const chemin = imagesCouple[key];
    setTeleverse(key);
    if (chemin) await supabase.storage.from("intimate").remove([chemin]);
    await supabase
      .from("position_images")
      .delete()
      .eq("couple_id", coupleId)
      .eq("position_key", key);
    await charger();
    setTeleverse(null);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <header className="mb-5 text-center">
        <h1 className="font-display text-3xl">Positions</h1>
        <p className="mt-1 text-sm text-brume">
          Cochez vos envies chacun de votre côté.
          <br />
          Elles ne se révèlent que si elles se répondent.
        </p>
        {communes > 0 && (
          <p className="mt-2 text-sm text-orrose">
            ✨ {communes} envie{communes > 1 ? "s" : ""} en commun
          </p>
        )}
      </header>

      {/* Mode d'illustration — masque tant qu'aucune image n'est importee */}
      {illustrees > 0 && (
      <div className="mb-4 flex items-center gap-1 rounded-xl border border-bord bg-velours-clair p-1 text-xs">
        {[
          { cle: "silhouette", label: "Silhouettes", aide: "discret" },
          { cle: "detaillee", label: "Illustrations", aide: `${illustrees} dispo` },
        ].map((m) => (
          <button
            key={m.cle}
            onClick={() => changerMode(m.cle)}
            className={`flex-1 rounded-lg py-2 transition ${
              mode === m.cle ? "bg-bordeaux text-white" : "text-brume hover:text-champagne"
            }`}
          >
            {m.label}
            <span className="ml-1 opacity-60">· {m.aide}</span>
          </button>
        ))}
      </div>
      )}

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 text-xs">
        {FILTRES.map((f) => (
          <button
            key={f.cle}
            onClick={() => setFiltre(f.cle)}
            className={`shrink-0 rounded-full border px-3 py-1.5 transition ${
              filtre === f.cle
                ? "border-bordeaux-vif bg-bordeaux/30 text-orrose"
                : "border-bord text-brume"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {charge && <p className="py-16 text-center text-sm text-brume">…</p>}

      {!charge && liste.length === 0 && (
        <p className="py-16 text-center text-sm text-brume">
          Rien dans ce filtre pour l&apos;instant.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {liste.map((p) => {
          const e = etat(p.key);
          return (
            <button
              key={p.key}
              onClick={() => setOuverte(p)}
              className="anim-monte carte overflow-hidden p-0 text-left transition hover:border-bordeaux-vif"
            >
              <div className="relative bg-velours-clair">
                {visuel(p, "h-28 w-full")}
                <div className="absolute right-2 top-2 flex gap-1 text-xs">
                  {e.both_want && <span title="Envie commune">✨</span>}
                  {(e.my_loved || e.partner_loved) && <span title="Coup de cœur">🔥</span>}
                  {(e.my_done || e.partner_done) && <span title="Déjà testée">✓</span>}
                </div>
              </div>
              <div className="p-3">
                <p className="font-display text-base leading-tight">{p.nom}</p>
                <p className="mt-0.5 text-[11px] text-brume">{p.sous_titre}</p>
              </div>
            </button>
          );
        })}
      </div>

      {mode === "detaillee" && illustrees > 0 && (
        <button
          onClick={() => setCredits(true)}
          className="mx-auto mt-6 block text-[11px] text-brume underline"
        >
          Crédits et licences des illustrations
        </button>
      )}

      {/* ------------------------------------------------ Fiche */}
      {ouverte && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-nuit/85 backdrop-blur"
          onClick={() => setOuverte(null)}
        >
          <div
            className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-bord bg-velours px-5 pb-8 pt-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-bord" />

            {visuel(ouverte, "h-48 w-full rounded-2xl")}

            <h2 className="mt-3 text-center font-display text-2xl">{ouverte.nom}</h2>
            <p className="text-center text-xs uppercase tracking-[0.2em] text-brume">
              {ouverte.sous_titre}
            </p>

            <div className="mt-4 flex justify-center gap-6 text-[11px] text-brume">
              <span>
                Difficulté <b className="text-orrose">{"●".repeat(ouverte.difficulte)}</b>
                <span className="opacity-30">{"●".repeat(3 - ouverte.difficulte)}</span>
              </span>
              <span>
                Intensité <b className="text-orrose">{"●".repeat(ouverte.intensite)}</b>
                <span className="opacity-30">{"●".repeat(3 - ouverte.intensite)}</span>
              </span>
            </div>

            {ouverte.description && (
              <p className="mt-5 text-sm leading-relaxed text-champagne">
                {ouverte.description}
              </p>
            )}

            {ouverte.conseil && (
              <p className="mt-4 rounded-xl border border-bord bg-velours-clair p-3 text-sm leading-relaxed text-brume">
                <span className="text-orrose">Le détail qui compte — </span>
                {ouverte.conseil}
              </p>
            )}

            {(() => {
              const e = etat(ouverte.key);
              return (
                <div className="mt-5 space-y-2">
                  <Bascule
                    actif={e.my_wants}
                    onClick={() => basculer(ouverte.key, "wants")}
                    titre="J'en ai envie"
                    aide={
                      e.both_want
                        ? "✨ Vous l'avez cochée tous les deux"
                        : "Secret — révélé seulement si l'autre la coche aussi"
                    }
                    surligne={e.both_want}
                  />
                  <Bascule
                    actif={e.my_done}
                    onClick={() => basculer(ouverte.key, "done")}
                    titre="Déjà testée"
                    aide={e.partner_done ? "Coché par vous deux" : "Visible par l'autre"}
                  />
                  <Bascule
                    actif={e.my_loved}
                    onClick={() => basculer(ouverte.key, "loved")}
                    titre="🔥 Coup de cœur"
                    aide={e.partner_loved ? "L'autre aussi l'adore" : "Visible par l'autre"}
                  />
                </div>
              );
            })()}

            {/* -------------------------------------- Illustration perso */}
            <div className="mt-5 rounded-xl border border-bord bg-velours-clair p-4">
              <p className="text-xs uppercase tracking-widest text-brume">
                Illustration
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-brume">
                Déposez votre propre image pour cette position. Elle part dans votre
                espace privé — personne d&apos;autre que vous deux n&apos;y accède.
              </p>

              <div className="mt-3 flex gap-2">
                <label
                  className={`btn cursor-pointer ${
                    televerse === ouverte.key ? "pointer-events-none opacity-50" : ""
                  }`}
                >
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) deposer(ouverte.key, f);
                      e.target.value = "";
                    }}
                  />
                  {televerse === ouverte.key
                    ? "Envoi…"
                    : imagesCouple[ouverte.key]
                      ? "Remplacer"
                      : "Déposer une image"}
                </label>

                {imagesCouple[ouverte.key] && (
                  <button
                    className="btn btn-fantome"
                    disabled={televerse === ouverte.key}
                    onClick={() => retirer(ouverte.key)}
                  >
                    Retirer
                  </button>
                )}
              </div>
            </div>

            {ouverte.image_credit && mode === "detaillee" && (
              <p className="mt-4 text-center text-[10px] leading-relaxed text-brume">
                Illustration : {ouverte.image_credit}
              </p>
            )}

            <button onClick={() => setOuverte(null)} className="btn btn-fantome mt-5">
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------ Crédits */}
      {credits && (
        <div
          className="fixed inset-0 z-40 grid place-items-center bg-nuit/90 px-6 backdrop-blur"
          onClick={() => setCredits(false)}
        >
          <div
            className="carte max-h-[80dvh] w-full max-w-md overflow-y-auto p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-xl">Crédits</h2>
            <p className="mt-2 text-sm leading-relaxed text-brume">
              Les illustrations détaillées proviennent de Wikimedia Commons et sont
              réutilisées selon leur licence Creative Commons. Chaque auteur est
              crédité ci-dessous.
            </p>
            <ul className="mt-4 space-y-2 text-[11px] text-brume">
              {positions
                .filter((p) => p.image_credit)
                .map((p) => (
                  <li key={p.key} className="border-b border-bord pb-2">
                    <span className="text-champagne">{p.nom}</span> — {p.image_credit}
                    {p.image_source_url && (
                      <>
                        {" · "}
                        <a
                          href={p.image_source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          source
                        </a>
                      </>
                    )}
                  </li>
                ))}
            </ul>
            <button onClick={() => setCredits(false)} className="btn btn-fantome mt-5">
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Bascule({
  actif,
  onClick,
  titre,
  aide,
  surligne = false,
}: {
  actif: boolean;
  onClick: () => void;
  titre: string;
  aide: string;
  surligne?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
        surligne
          ? "border-orrose bg-bordeaux/25"
          : actif
            ? "border-bordeaux-vif bg-bordeaux/25"
            : "border-bord bg-velours-clair hover:border-bordeaux"
      }`}
    >
      <span
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border text-[11px] ${
          actif ? "border-orrose bg-orrose text-nuit" : "border-bord"
        }`}
      >
        {actif ? "✓" : ""}
      </span>
      <span className="min-w-0">
        <span className="block text-sm">{titre}</span>
        <span className="block text-[11px] text-brume">{aide}</span>
      </span>
    </button>
  );
}
