"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Chargeur from "@/components/Chargeur";
import { ACTIONS, VERITES, CARTE_AV_PAR_CLE } from "@/data/actionverite";
import ReactionCoup from "@/components/ReactionCoup";

/* =====================================================================
   ACTION OU VÉRITÉ — tour par tour, pensé pour le différé.
   L'état de la partie (à qui le tour, quelle carte) vit dans
   game_sessions ; chaque carte relevée ou passée entre au fil
   game_events (✓✓ vu, badge, réaction). La réponse elle-même se donne
   dans « Nous » : texte, vocal ou photo éphémère.
   ===================================================================== */

type EtatAV = {
  seq: number;
  tour: string;               // à qui de jouer
  choix: "action" | "verite" | null;
  carte: string | null;
  depuis: string;
};

type Coup = {
  id: string;
  par: string;
  charge: { type: "fait" | "passe"; choix: "action" | "verite"; carte: string };
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

export default function ActionVerite({
  coupleId,
  userId,
  partenaireId,
  partenaire,
  monPrenom,
  retour,
}: {
  coupleId: string;
  userId: string;
  partenaireId: string;
  partenaire: string;
  monPrenom: string;
  retour: () => void;
}) {
  const [supabase] = useState(() => createClient());
  const [etat, setEtat] = useState<EtatAV | null>(null);
  const [flux, setFlux] = useState<Coup[]>([]);
  const [charge, setCharge] = useState(true);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [tic, setTic] = useState(Date.now());
  const pushRef = useRef(0);

  /* ------------------------------------------------ Chargement */
  const chargerFlux = useCallback(async () => {
    const { data } = await supabase
      .from("game_events")
      .select("id, par, charge, created_at, vu_le, reaction")
      .eq("couple_id", coupleId)
      .eq("jeu", "av")
      .order("created_at", { ascending: false })
      .limit(12);
    setFlux((data ?? []) as Coup[]);
  }, [supabase, coupleId]);

  const chargerEtat = useCallback(async () => {
    const { data } = await supabase
      .from("game_sessions")
      .select("etat")
      .eq("couple_id", coupleId)
      .eq("jeu", "av")
      .maybeSingle();
    setEtat(((data?.etat ?? null) as EtatAV | null) ?? null);
    setCharge(false);
  }, [supabase, coupleId]);

  const marquerVu = useCallback(() => {
    supabase.rpc("jeu_marquer_vu", { p_jeu: "av" }).then(
      () => {},
      () => {}
    );
  }, [supabase]);

  useEffect(() => {
    chargerEtat();
    chargerFlux().then(marquerVu);
  }, [chargerEtat, chargerFlux, marquerVu]);

  useEffect(() => {
    const canal = supabase
      .channel(`av-${coupleId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_sessions",
          filter: `couple_id=eq.${coupleId}`,
        },
        (p) => {
          const ligne = p.new as { jeu?: string } | null;
          if (!ligne || ligne.jeu === "av") chargerEtat();
        }
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
          const ligne = (p.new ?? p.old) as { jeu?: string; par?: string } | null;
          if (ligne && ligne.jeu !== "av") return;
          chargerFlux();
          if (p.eventType === "INSERT" && ligne?.par && ligne.par !== userId) marquerVu();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [supabase, coupleId, userId, chargerEtat, chargerFlux, marquerVu]);

  useEffect(() => {
    const t = setInterval(() => setTic(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  /* ------------------------------------------------ Actions */
  async function poserEtat(nouveau: EtatAV) {
    setEtat(nouveau);
    const { error } = await supabase
      .from("game_sessions")
      .upsert({ couple_id: coupleId, jeu: "av", etat: nouveau }, { onConflict: "couple_id,jeu" });
    if (error) setErreur(error.message);
  }

  function prevenir(texte: string) {
    const t = Date.now();
    if (t - pushRef.current < 60_000) return;
    pushRef.current = t;
    fetch("/api/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ genre: "jeu", apercu: texte, prenom: monPrenom }),
    }).catch(() => {});
  }

  function commencer() {
    poserEtat({ seq: 1, tour: userId, choix: null, carte: null, depuis: new Date().toISOString() });
  }

  function choisir(choix: "action" | "verite") {
    if (!etat) return;
    // On évite de retomber sur les cartes récentes.
    const recentes = new Set(flux.map((c) => c.charge.carte));
    const paquet = choix === "action" ? ACTIONS : VERITES;
    const dispo = paquet.filter((c) => !recentes.has(c.cle));
    const source = dispo.length > 0 ? dispo : paquet;
    const carte = source[Math.floor(Math.random() * source.length)];
    poserEtat({ ...etat, choix, carte: carte.cle, depuis: new Date().toISOString() });
  }

  async function terminer(type: "fait" | "passe") {
    if (!etat || !etat.choix || !etat.carte || occupe) return;
    setOccupe(true);
    await supabase.from("game_events").insert({
      couple_id: coupleId,
      jeu: "av",
      par: userId,
      charge: { type, choix: etat.choix, carte: etat.carte },
    });
    await poserEtat({
      seq: etat.seq + 1,
      tour: partenaireId,
      choix: null,
      carte: null,
      depuis: new Date().toISOString(),
    });
    chargerFlux();
    prevenir("🎭 À ton tour — Action ou Vérité !");
    setOccupe(false);
  }

  function reagir(id: string, emoji: string | null) {
    supabase.rpc("jeu_reagir", { p_event: id, p_emoji: emoji }).then(
      () => chargerFlux(),
      () => {}
    );
  }

  /* ------------------------------------------------ Dérivés */
  const monTour = etat?.tour === userId;
  const carte = etat?.carte ? CARTE_AV_PAR_CLE[etat.carte] : null;

  if (charge) {
    return <Chargeur />;
  }

  /* ================================================ RENDU */
  return (
    <div className="mx-auto max-w-md px-5 py-8">
      <header className="mb-6">
        <button onClick={retour} className="text-xs text-brume">
          ← Les jeux
        </button>
        <h1 className="mt-2 font-display text-3xl">Action ou Vérité</h1>
        <p className="mt-1 text-sm leading-relaxed text-brume">
          Chacun son tour, même à distance : la réponse se donne dans « Nous » —
          texte, vocal ou photo éphémère.
        </p>
      </header>

      {erreur && <p className="mb-4 text-center text-sm text-orrose">{erreur}</p>}

      {/* ---------------------------------------------- La table */}
      {!etat ? (
        <div className="anim-monte text-center">
          <div className="carte grid h-48 place-items-center border-dashed p-6">
            <p className="max-w-[16rem] text-sm leading-relaxed text-brume">
              Personne n&apos;a encore ouvert le bal. Le courage, ça se récompense… 😏
            </p>
          </div>
          <button className="btn mt-5" onClick={commencer}>
            Je commence
          </button>
        </div>
      ) : monTour ? (
        !carte ? (
          <div className="anim-monte">
            <p className="mb-3 text-center text-[10px] uppercase tracking-[0.25em] text-brume">
              À vous de jouer
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => choisir("action")}
                className="carte grid h-40 place-items-center p-4 text-center transition hover:border-bordeaux-vif"
              >
                <span>
                  <span className="block text-3xl">🎬</span>
                  <span className="mt-2 block font-display text-xl">Action</span>
                </span>
              </button>
              <button
                onClick={() => choisir("verite")}
                className="carte grid h-40 place-items-center p-4 text-center transition hover:border-bordeaux-vif"
              >
                <span>
                  <span className="block text-3xl">💬</span>
                  <span className="mt-2 block font-display text-xl">Vérité</span>
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div className="anim-monte">
            <div className="carte relative overflow-hidden p-7 text-center">
              <span className="absolute -right-6 -top-6 text-8xl opacity-[0.06]">
                {etat.choix === "action" ? "🎬" : "💬"}
              </span>
              <p className="text-[10px] uppercase tracking-[0.25em] text-brume">
                {etat.choix === "action" ? "Votre action" : "Votre vérité"}
              </p>
              <p className="relative mt-4 font-display text-xl leading-relaxed text-champagne">
                {carte.texte}
              </p>
            </div>
            <Link href="/chat" className="btn btn-fantome mt-5 w-full">
              Répondre dans « Nous » 💬
            </Link>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button className="btn" disabled={occupe} onClick={() => terminer("fait")}>
                C&apos;est fait ✔
              </button>
              <button className="btn btn-fantome" disabled={occupe} onClick={() => terminer("passe")}>
                Je passe ↷
              </button>
            </div>
            <p className="mt-3 text-center text-[11px] leading-relaxed text-brume">
              « C&apos;est fait » passe la main à {partenaire}. Passer aussi — mais on le saura. 😏
            </p>
          </div>
        )
      ) : (
        <div className="anim-monte carte p-6 text-center">
          <p className="text-3xl">⏳</p>
          <p className="mt-2 font-display text-lg">C&apos;est au tour de {partenaire}</p>
          {carte ? (
            <p className="mt-2 text-sm leading-relaxed text-brume">
              {etat.choix === "action" ? "🎬 Action en cours" : "💬 Vérité en cours"} : « {carte.texte} »
            </p>
          ) : (
            <p className="mt-2 text-sm text-brume">
              {partenaire} n&apos;a pas encore choisi entre action et vérité…
            </p>
          )}
          <p className="mt-3 text-[11px] text-brume">
            Depuis {depuis(etat.depuis, tic)} — la pastille vous préviendra.
          </p>
        </div>
      )}

      {/* ---------------------------------------------- Le fil */}
      {flux.length > 0 && (
        <section className="mt-10">
          <p className="mb-2 text-[10px] uppercase tracking-[0.25em] text-brume">Dernières cartes</p>
          <div className="space-y-1.5">
            {flux.map((c) => {
              const deMoi = c.par === userId;
              const texte = CARTE_AV_PAR_CLE[c.charge.carte]?.texte ?? "une carte";
              return (
                <div key={c.id} className="carte flex items-center gap-3 px-3 py-2.5">
                  <span className="shrink-0 text-sm">{c.charge.choix === "action" ? "🎬" : "💬"}</span>
                  <p className="min-w-0 flex-1 truncate text-sm">
                    <span className="text-brume">
                      {deMoi ? "Vous avez" : `${partenaire} a`} {c.charge.type === "fait" ? "relevé" : "passé"} :{" "}
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
      )}
    </div>
  );
}
