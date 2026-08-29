"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { THEMES, TOUS_LES_DEFIS } from "@/data/challenges";
import ReactionCoup from "@/components/ReactionCoup";

type Etat = {
  couple_id: string;
  theme: string | null;
  current_key: string | null;
  drawn_by: string | null;
  drawn_at: string | null;
};

/** Un moment du jeu : tirage, défi relevé ou passé — pour jouer en différé. */
type Coup = {
  id: string;
  par: string;
  charge: { type: "tirage" | "releve" | "passe"; cle: string };
  created_at: string;
  vu_le: string | null;
  reaction: string | null;
};

const fmtHeure = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

function depuis(iso: string, maintenant: number): string {
  const s = Math.max(0, (maintenant - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 24 * 3600) return `il y a ${Math.floor(s / 3600)} h`;
  return `le ${new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} à ${fmtHeure.format(new Date(iso))}`;
}

const MOMENT: Record<Coup["charge"]["type"], { icone: string; verbe: string }> = {
  tirage: { icone: "🃏", verbe: "a tiré" },
  releve: { icone: "✅", verbe: "a relevé" },
  passe: { icone: "↷", verbe: "a passé" },
};

export default function Games({
  coupleId,
  userId,
  partenaire = "Votre moitié",
}: {
  coupleId: string;
  userId: string;
  partenaire?: string;
}) {
  const [supabase] = useState(() => createClient());
  const [etat, setEtat] = useState<Etat | null>(null);
  const [dejaTires, setDejaTires] = useState<string[]>([]);
  const [releves, setReleves] = useState(0);
  const [flux, setFlux] = useState<Coup[]>([]);
  const [occupe, setOccupe] = useState(false);
  const [charge, setCharge] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [tic, setTic] = useState(Date.now());

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

  const chargerFlux = useCallback(async () => {
    const { data } = await supabase
      .from("game_events")
      .select("id, par, charge, created_at, vu_le, reaction")
      .eq("couple_id", coupleId)
      .eq("jeu", "defis")
      .order("created_at", { ascending: false })
      .limit(12);
    setFlux((data ?? []) as Coup[]);
  }, [supabase, coupleId]);

  /* Ouvrir le jeu = avoir vu les moments de l'autre. (⚠ rpc sans .then ne part pas) */
  const marquerVu = useCallback(() => {
    supabase.rpc("jeu_marquer_vu", { p_jeu: "defis" }).then(
      () => {},
      () => {}
    );
  }, [supabase]);

  useEffect(() => {
    charger();
    chargerFlux().then(marquerVu);
  }, [charger, chargerFlux, marquerVu]);

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
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_events",
          filter: `couple_id=eq.${coupleId}`,
        },
        (p) => {
          const ligne = p.new as { jeu?: string; par?: string } | null;
          if (ligne && ligne.jeu !== "defis") return;
          chargerFlux();
          if (p.eventType === "INSERT" && ligne?.par && ligne.par !== userId) marquerVu();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [supabase, coupleId, userId, charger, chargerFlux, marquerVu]);

  /* Rafraîchit les « il y a X min » du fil. */
  useEffect(() => {
    const t = setInterval(() => setTic(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  /* ------------------------------------------------ Actions */
  const consigner = useCallback(
    async (type: Coup["charge"]["type"], cle: string) => {
      await supabase
        .from("game_events")
        .insert({ couple_id: coupleId, jeu: "defis", par: userId, charge: { type, cle } });
      chargerFlux();
    },
    [supabase, coupleId, userId, chargerFlux]
  );

  function reagir(id: string, emoji: string | null) {
    supabase.rpc("jeu_reagir", { p_event: id, p_emoji: emoji }).then(
      () => chargerFlux(),
      () => {}
    );
  }

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
    else await consigner("tirage", choisi.key);
    await charger();
    setOccupe(false);
  }

  async function resoudre(statut: "releve" | "passe") {
    const cle = etat?.current_key;
    setOccupe(true);
    const { error } = await supabase.rpc("resolve_challenge", { p_status: statut });
    if (error) setErreur(error.message);
    else if (cle) await consigner(statut, cle);
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

  /* Le fil des moments — partagé entre les deux écrans du jeu. */
  const Fil = () =>
    flux.length > 0 ? (
      <section className="mt-10">
        <p className="mb-2 text-[10px] uppercase tracking-[0.25em] text-brume">Derniers moments</p>
        <div className="space-y-1.5">
          {flux.map((c) => {
            const deMoi = c.par === userId;
            const moment = MOMENT[c.charge.type] ?? MOMENT.tirage;
            const texte = TOUS_LES_DEFIS[c.charge.cle]?.texte ?? "un défi";
            return (
              <div key={c.id} className="carte flex items-center gap-3 px-3 py-2.5">
                <span className="shrink-0 text-sm">{moment.icone}</span>
                <p className="min-w-0 flex-1 truncate text-sm">
                  <span className="text-brume">
                    {deMoi ? `Vous avez ${moment.verbe.slice(2)}` : `${partenaire} ${moment.verbe}`} :{" "}
                  </span>
                  {texte}
                </p>
                <span className="shrink-0 text-[10px] text-brume">{depuis(c.created_at, tic)}</span>
                {deMoi && (
                  <span
                    className="shrink-0 text-[10px]"
                    style={{ color: c.vu_le ? "var(--color-menthe)" : "var(--color-brume)" }}
                    title={c.vu_le ? `Vu ${depuis(c.vu_le, tic)}` : "Pas encore vu"}
                  >
                    {c.vu_le ? "✓✓" : "✓"}
                  </span>
                )}
                <ReactionCoup deMoi={deMoi} reaction={c.reaction} onChoisir={(em) => reagir(c.id, em)} />
              </div>
            );
          })}
        </div>
      </section>
    ) : null;

  /* ---------------------------------------------- Choix du theme */
  if (!theme) {
    return (
      <div className="mx-auto max-w-md px-5 py-8">
        <header className="mb-6 text-center">
          <h1 className="font-display text-3xl">Défis à deux</h1>
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

        <Fil />
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
              {cestMoiQuiAiTire ? "Vous avez tiré" : `Tirée par ${partenaire}`}
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

      <Fil />

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
