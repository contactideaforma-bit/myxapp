"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Silhouette from "./Silhouette";
import { POSITIONS, type Position } from "@/data/positions";

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

export default function Kamasutra() {
  const [supabase] = useState(() => createClient());
  const [marques, setMarques] = useState<Record<string, Omit<Marque, "pos_key">>>({});
  const [filtre, setFiltre] = useState<(typeof FILTRES)[number]["cle"]>("toutes");
  const [ouverte, setOuverte] = useState<Position | null>(null);
  const [charge, setCharge] = useState(true);

  const charger = useCallback(async () => {
    const { data } = await supabase.rpc("positions_overview");
    const table: Record<string, Omit<Marque, "pos_key">> = {};
    ((data ?? []) as Marque[]).forEach(({ pos_key, ...reste }) => {
      table[pos_key] = reste;
    });
    setMarques(table);
    setCharge(false);
  }, [supabase]);

  useEffect(() => {
    charger();
  }, [charger]);

  const etat = (key: string) => marques[key] ?? VIDE;

  async function basculer(key: string, champ: "wants" | "done" | "loved") {
    const actuel = etat(key);
    const valeur = !actuel[`my_${champ}` as keyof typeof actuel];

    // Optimiste : on n'invente pas la reciprocite, elle revient du serveur
    setMarques((p) => ({
      ...p,
      [key]: { ...(p[key] ?? VIDE), [`my_${champ}`]: valeur },
    }));

    await supabase.rpc("set_position_mark", {
      p_key: key,
      p_wants: champ === "wants" ? valeur : null,
      p_done: champ === "done" ? valeur : null,
      p_loved: champ === "loved" ? valeur : null,
    });
    charger();
  }

  const liste = useMemo(() => {
    return POSITIONS.filter((p) => {
      const e = etat(p.key);
      if (filtre === "communes") return e.both_want;
      if (filtre === "testees") return e.my_done || e.partner_done;
      if (filtre === "coups") return e.my_loved || e.partner_loved;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtre, marques]);

  const communes = POSITIONS.filter((p) => etat(p.key).both_want).length;

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
                <Silhouette figure={p.key} className="h-28 w-full" />
                <div className="absolute right-2 top-2 flex gap-1 text-xs">
                  {e.both_want && <span title="Envie commune">✨</span>}
                  {(e.my_loved || e.partner_loved) && <span title="Coup de cœur">🔥</span>}
                  {(e.my_done || e.partner_done) && <span title="Déjà testée">✓</span>}
                </div>
              </div>
              <div className="p-3">
                <p className="font-display text-base leading-tight">{p.nom}</p>
                <p className="mt-0.5 text-[11px] text-brume">{p.sousTitre}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------ Fiche detaillee */}
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

            <Silhouette figure={ouverte.key} className="mx-auto h-40 w-full" />

            <h2 className="mt-2 text-center font-display text-2xl">{ouverte.nom}</h2>
            <p className="text-center text-xs uppercase tracking-[0.2em] text-brume">
              {ouverte.sousTitre}
            </p>

            <div className="mt-4 flex justify-center gap-6 text-[11px] text-brume">
              <span>
                Difficulté{" "}
                <b className="text-orrose">{"●".repeat(ouverte.difficulte)}</b>
                <span className="opacity-30">{"●".repeat(3 - ouverte.difficulte)}</span>
              </span>
              <span>
                Intensité <b className="text-orrose">{"●".repeat(ouverte.intensite)}</b>
                <span className="opacity-30">{"●".repeat(3 - ouverte.intensite)}</span>
              </span>
            </div>

            <p className="mt-5 text-sm leading-relaxed text-champagne">
              {ouverte.description}
            </p>

            <p className="mt-4 rounded-xl border border-bord bg-velours-clair p-3 text-sm leading-relaxed text-brume">
              <span className="text-orrose">Le détail qui compte — </span>
              {ouverte.conseil}
            </p>

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

            <button
              onClick={() => setOuverte(null)}
              className="btn btn-fantome mt-5"
            >
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
