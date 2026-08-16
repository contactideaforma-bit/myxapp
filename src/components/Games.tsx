"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { THEMES, TOUS_LES_DEFIS } from "@/data/challenges";

type Etat = {
  couple_id: string;
  theme: string | null;
  current_key: string | null;
  drawn_by: string | null;
  drawn_at: string | null;
};

export default function Games({
  coupleId,
  userId,
}: {
  coupleId: string;
  userId: string;
}) {
  const [supabase] = useState(() => createClient());
  const [etat, setEtat] = useState<Etat | null>(null);
  const [dejaTires, setDejaTires] = useState<string[]>([]);
  const [releves, setReleves] = useState(0);
  const [occupe, setOccupe] = useState(false);
  const [charge, setCharge] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  /* ------------------------------------------------ Chargement */
  const charger = useCallback(async () => {
    const [{ data: e }, { data: h }] = await Promise.all([
      supabase.from("game_state").select("*").eq("couple_id", coupleId).maybeSingle(),
      supabase
        .from("game_history")
        .select("challenge_key, status")
        .eq("couple_id", coupleId)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    setEtat((e as Etat) ?? null);
    const hist = (h ?? []) as { challenge_key: string; status: string }[];
    setDejaTires(hist.map((x) => x.challenge_key));
    setReleves(hist.filter((x) => x.status === "releve").length);
    setCharge(false);
  }, [supabase, coupleId]);

  useEffect(() => {
    charger();
  }, [charger]);

  /* ------------------------------------------------ Temps reel */
  useEffect(() => {
    const canal = supabase
      .channel(`jeux-${coupleId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_state",
          filter: `couple_id=eq.${coupleId}`,
        },
        () => charger()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [supabase, coupleId, charger]);

  /* ------------------------------------------------ Actions */
  async function choisirTheme(cle: string) {
    setOccupe(true);
    setErreur(null);
    const { error } = await supabase.rpc("set_game_theme", { p_theme: cle });
    if (error) setErreur(error.message);
    await charger();
    setOccupe(false);
  }

  async function tirer() {
    const theme = THEMES.find((t) => t.key === etat?.theme);
    if (!theme) return;

    const restants = theme.defis.filter((d) => !dejaTires.includes(d.key));
    const pool = restants.length > 0 ? restants : theme.defis;
    const choisi = pool[Math.floor(Math.random() * pool.length)];

    setOccupe(true);
    setErreur(null);
    const { error } = await supabase.rpc("draw_challenge", { p_key: choisi.key });
    if (error) setErreur(error.message);
    await charger();
    setOccupe(false);
  }

  async function resoudre(statut: "releve" | "passe") {
    setOccupe(true);
    const { error } = await supabase.rpc("resolve_challenge", { p_status: statut });
    if (error) setErreur(error.message);
    await charger();
    setOccupe(false);
  }

  /* ================================================ RENDU */
  if (charge) {
    return <p className="py-20 text-center text-sm text-brume">…</p>;
  }

  const theme = THEMES.find((t) => t.key === etat?.theme);
  const defi = etat?.current_key ? TOUS_LES_DEFIS[etat.current_key] : null;
  const cestMoiQuiAiTire = etat?.drawn_by === userId;

  /* ---------------------------------------------- Choix du theme */
  if (!theme) {
    return (
      <div className="mx-auto max-w-md px-5 py-8">
        <header className="mb-6 text-center">
          <h1 className="font-display text-3xl">Jeux</h1>
          <p className="mt-1 text-sm text-brume">
            Choisissez un thème ensemble. Il donne le ton de toute la partie.
          </p>
        </header>

        {erreur && <p className="mb-4 text-center text-sm text-orrose">{erreur}</p>}

        <div className="space-y-3">
          {THEMES.map((t) => (
            <button
              key={t.key}
              disabled={occupe}
              onClick={() => choisirTheme(t.key)}
              className="carte anim-monte flex w-full items-center gap-4 p-4 text-left transition hover:border-bordeaux-vif disabled:opacity-50"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-bordeaux to-bordeaux-vif text-xl">
                {t.emoji}
              </span>
              <span className="min-w-0">
                <span className="block font-display text-lg">{t.nom}</span>
                <span className="block text-xs leading-snug text-brume">{t.accroche}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ---------------------------------------------- Partie en cours */
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col px-5 py-8">
      <header className="mb-6 text-center">
        <p className="text-4xl">{theme.emoji}</p>
        <h1 className="mt-1 font-display text-2xl">{theme.nom}</h1>
        <p className="mt-1 text-xs text-brume">
          {releves} défi{releves > 1 ? "s" : ""} relevé{releves > 1 ? "s" : ""} ·{" "}
          {theme.defis.filter((d) => !dejaTires.includes(d.key)).length} restant
          {theme.defis.filter((d) => !dejaTires.includes(d.key)).length > 1 ? "s" : ""}
        </p>
      </header>

      {erreur && <p className="mb-4 text-center text-sm text-orrose">{erreur}</p>}

      <div className="flex flex-1 flex-col justify-center">
        {defi ? (
          <div className="anim-monte carte relative overflow-hidden p-7 text-center">
            <span className="absolute -right-6 -top-6 text-8xl opacity-[0.06]">
              {theme.emoji}
            </span>
            <p className="text-[10px] uppercase tracking-[0.25em] text-brume">
              {cestMoiQuiAiTire ? "Vous avez tiré" : "Carte tirée pour vous"}
            </p>
            <p className="relative mt-4 font-display text-xl leading-relaxed text-champagne">
              {defi.texte}
            </p>

            <div className="mt-7 flex gap-2">
              <button
                className="btn"
                disabled={occupe}
                onClick={() => resoudre("releve")}
              >
                Relevé
              </button>
              <button
                className="btn btn-fantome"
                disabled={occupe}
                onClick={() => resoudre("passe")}
              >
                Passer
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="carte grid h-56 place-items-center border-dashed p-6">
              <p className="max-w-[16rem] text-sm leading-relaxed text-brume">
                {theme.accroche}
              </p>
            </div>
            <button className="btn mt-5" disabled={occupe} onClick={tirer}>
              Tirer une carte
            </button>
          </div>
        )}
      </div>

      <button
        onClick={() => choisirTheme("")}
        disabled={occupe}
        className="mt-8 text-center text-xs text-brume underline"
      >
        Changer de thème
      </button>
    </div>
  );
}
