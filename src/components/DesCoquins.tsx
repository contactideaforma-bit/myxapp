"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DE_ACTIONS, DE_ENDROITS, MINUTEURS } from "@/data/des";

/* =====================================================================
   DÉS COQUINS — un lancer, une seule vérité : celui qui lance écrit le
   résultat dans game_sessions, le temps réel le diffuse, et LES DEUX
   téléphones jouent la même animation vers les mêmes faces.
   Minuteur partagé : posé dans l'état, décompté chez les deux.
   ===================================================================== */

type EtatDes = {
  seq: number;
  a: number;
  e: number;
  par: string;
  lance_le: string;
  minuteur_fin: string | null;
};

/** Un coup du journal de la partie — permet de jouer en différé. */
type Coup = {
  id: string;
  par: string;
  charge: { a: number; e: number };
  created_at: string;
  vu_le: string | null;
};

const alea = (n: number) => Math.floor(Math.random() * n);

const fmtHeure = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

function depuis(iso: string, maintenant: number): string {
  const s = Math.max(0, (maintenant - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 24 * 3600) return `il y a ${Math.floor(s / 3600)} h`;
  return `le ${new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} à ${fmtHeure.format(new Date(iso))}`;
}

export default function DesCoquins({
  coupleId,
  userId,
  partenaire,
  monPrenom,
  retour,
}: {
  coupleId: string;
  userId: string;
  partenaire: string;
  monPrenom: string;
  retour: () => void;
}) {
  const [supabase] = useState(() => createClient());
  const [etat, setEtat] = useState<EtatDes | null>(null);
  const [affiche, setAffiche] = useState<{ a: number; e: number } | null>(null);
  const [flux, setFlux] = useState<Coup[]>([]);
  const [roule, setRoule] = useState(false);
  const [charge, setCharge] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [tic, setTic] = useState(Date.now());
  const seqVuRef = useRef(0);
  const pushRef = useRef(0);
  const sonneRef = useRef(0);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ------------------------------------------------ Journal des coups */
  const chargerFlux = useCallback(async () => {
    const { data } = await supabase
      .from("game_events")
      .select("id, par, charge, created_at, vu_le")
      .eq("couple_id", coupleId)
      .eq("jeu", "des")
      .order("created_at", { ascending: false })
      .limit(12);
    setFlux((data ?? []) as Coup[]);
  }, [supabase, coupleId]);

  /* Ouvrir le jeu (ou voir arriver un coup) = l'avoir vu.
     ⚠ rpc sans .then ne part jamais (piège n°1). */
  const marquerVu = useCallback(() => {
    supabase.rpc("jeu_marquer_vu", { p_jeu: "des" }).then(
      () => {},
      () => {}
    );
  }, [supabase]);

  /* ------------------------------------------------ Animation */
  const animerVers = useCallback((final: { a: number; e: number }) => {
    if (animRef.current) clearInterval(animRef.current);
    setRoule(true);
    const debut = Date.now();
    animRef.current = setInterval(() => {
      if (Date.now() - debut > 900) {
        if (animRef.current) clearInterval(animRef.current);
        animRef.current = null;
        setAffiche(final);
        setRoule(false);
        try {
          navigator.vibrate?.(40);
        } catch {
          /* pas grave */
        }
      } else {
        setAffiche({ a: alea(DE_ACTIONS.length), e: alea(DE_ENDROITS.length) });
      }
    }, 90);
  }, []);

  useEffect(() => () => {
    if (animRef.current) clearInterval(animRef.current);
  }, []);

  /* ------------------------------------------------ Chargement */
  const charger = useCallback(
    async (animer: boolean) => {
      const { data } = await supabase
        .from("game_sessions")
        .select("etat")
        .eq("couple_id", coupleId)
        .eq("jeu", "des")
        .maybeSingle();
      const e = ((data?.etat ?? null) as EtatDes | null) ?? null;
      setEtat(e);
      if (e && typeof e.seq === "number") {
        if (e.seq !== seqVuRef.current) {
          seqVuRef.current = e.seq;
          if (animer) animerVers({ a: e.a, e: e.e });
          else setAffiche({ a: e.a, e: e.e });
        }
      }
      setCharge(false);
    },
    [supabase, coupleId, animerVers]
  );

  useEffect(() => {
    charger(false);
    chargerFlux().then(marquerVu);
  }, [charger, chargerFlux, marquerVu]);

  /* Le lancer de l'autre arrive par ici — et son « vu » sur mes coups aussi. */
  useEffect(() => {
    const canal = supabase
      .channel(`des-${coupleId}`)
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
          if (!ligne || ligne.jeu === "des") charger(true);
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
          const ligne = p.new as { jeu?: string; par?: string } | null;
          if (ligne && ligne.jeu !== "des") return;
          chargerFlux();
          // Un coup de l'autre pendant que j'ai le jeu ouvert : vu aussitôt.
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

  /* Horloge du minuteur. */
  useEffect(() => {
    if (!etat?.minuteur_fin) return;
    const t = setInterval(() => setTic(Date.now()), 250);
    return () => clearInterval(t);
  }, [etat?.minuteur_fin]);

  /* ------------------------------------------------ Actions */
  function prevenir() {
    const t = Date.now();
    if (t - pushRef.current < 5 * 60_000) return;
    pushRef.current = t;
    fetch("/api/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        genre: "jeu",
        apercu: "🎲 Les dés sont lancés — viens jouer !",
        prenom: monPrenom,
      }),
    }).catch(() => {});
  }

  async function lancer() {
    setErreur(null);
    const nouveau: EtatDes = {
      seq: (etat?.seq ?? 0) + 1,
      a: alea(DE_ACTIONS.length),
      e: alea(DE_ENDROITS.length),
      par: userId,
      lance_le: new Date().toISOString(),
      minuteur_fin: null,
    };
    seqVuRef.current = nouveau.seq;
    setEtat(nouveau);
    animerVers({ a: nouveau.a, e: nouveau.e });
    const { error } = await supabase
      .from("game_sessions")
      .upsert({ couple_id: coupleId, jeu: "des", etat: nouveau }, { onConflict: "couple_id,jeu" });
    if (error) setErreur(error.message);
    else {
      // Le coup entre au journal : l'autre le verra même en différé.
      await supabase
        .from("game_events")
        .insert({ couple_id: coupleId, jeu: "des", par: userId, charge: { a: nouveau.a, e: nouveau.e } });
      chargerFlux();
      prevenir();
    }
  }

  async function poserMinuteur(secondes: number) {
    if (!etat) return;
    const maj: EtatDes = {
      ...etat,
      minuteur_fin: new Date(Date.now() + secondes * 1000).toISOString(),
    };
    setEtat(maj);
    const { error } = await supabase
      .from("game_sessions")
      .upsert({ couple_id: coupleId, jeu: "des", etat: maj }, { onConflict: "couple_id,jeu" });
    if (error) setErreur(error.message);
  }

  /* ------------------------------------------------ Dérivés */
  const finMinuteur = etat?.minuteur_fin ? new Date(etat.minuteur_fin).getTime() : null;
  const restant = finMinuteur ? Math.max(0, Math.ceil((finMinuteur - tic) / 1000)) : null;
  const tempsEcoule = finMinuteur !== null && restant === 0;

  useEffect(() => {
    if (tempsEcoule && finMinuteur && sonneRef.current !== finMinuteur) {
      sonneRef.current = finMinuteur;
      try {
        navigator.vibrate?.([120, 60, 120]);
      } catch {
        /* pas grave */
      }
    }
  }, [tempsEcoule, finMinuteur]);

  const dernierParMoi = etat?.par === userId;

  if (charge) {
    return <p className="py-20 text-center text-sm text-brume">…</p>;
  }

  /* ================================================ RENDU */
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col px-5 py-8">
      <header className="mb-6">
        <button onClick={retour} className="text-xs text-brume">
          ← Les jeux
        </button>
        <h1 className="mt-2 font-display text-3xl">Dés coquins</h1>
        <p className="mt-1 text-sm leading-relaxed text-brume">
          Un seul lancer, deux téléphones : {partenaire} voit exactement les mêmes dés que vous,
          au même moment.
        </p>
      </header>

      {erreur && <p className="mb-4 text-center text-sm text-orrose">{erreur}</p>}

      <div className="flex flex-1 flex-col justify-center">
        {/* ------------------------------------------ Les deux dés */}
        <div className="grid grid-cols-2 gap-3">
          <div className="carte grid h-36 place-items-center p-4 text-center">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-brume">Action</p>
              <p
                className="mt-2 font-display text-xl leading-snug text-champagne"
                style={{ opacity: roule ? 0.7 : 1 }}
              >
                {affiche ? DE_ACTIONS[affiche.a] : "?"}
              </p>
            </div>
          </div>
          <div className="carte grid h-36 place-items-center p-4 text-center">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-brume">Endroit</p>
              <p
                className="mt-2 font-display text-xl leading-snug text-champagne"
                style={{ opacity: roule ? 0.7 : 1 }}
              >
                {affiche ? DE_ENDROITS[affiche.e] : "?"}
              </p>
            </div>
          </div>
        </div>

        {/* ------------------------------------------ Résultat */}
        {affiche && !roule && etat && (
          <div className="anim-monte mt-4 text-center">
            <p className="font-display text-lg text-champagne">
              « {DE_ACTIONS[affiche.a]} {DE_ENDROITS[affiche.e]} »
            </p>
            <p className="mt-1 text-[11px] text-brume">
              Lancé par {dernierParMoi ? "vous" : partenaire}
              {dernierParMoi ? ` — à ${partenaire} d'obéir 😏` : " — à vous de jouer 😏"}
            </p>
          </div>
        )}

        {/* ------------------------------------------ Minuteur */}
        {etat && affiche && !roule && (
          <div className="mt-5 text-center">
            {restant !== null && !tempsEcoule ? (
              <p className="font-display text-4xl text-champagne" style={{ fontVariantNumeric: "tabular-nums" }}>
                {Math.floor(restant / 60)}:{String(restant % 60).padStart(2, "0")}
              </p>
            ) : tempsEcoule ? (
              <p className="anim-monte font-display text-xl text-orrose">Temps écoulé 🔔</p>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <span className="text-[11px] text-brume">Minuteur :</span>
                {MINUTEURS.map((m) => (
                  <button
                    key={m.s}
                    onClick={() => poserMinuteur(m.s)}
                    className="rounded-full border border-bord px-3 py-1 text-xs text-brume transition hover:border-bordeaux-vif hover:text-champagne"
                  >
                    {m.nom}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------ Lancer */}
        <button className="btn mt-8 w-full" disabled={roule} onClick={lancer}>
          {roule ? "…" : etat ? "Relancer les dés" : "Lancer les dés"}
        </button>
        {etat && dernierParMoi && !roule && (
          <p className="mt-3 text-center text-[11px] text-brume">
            Le dernier lancer est de vous — laissez {partenaire} tenter sa chance ?
          </p>
        )}
      </div>

      {/* ------------------------------------------ Le fil des lancers */}
      {flux.length > 0 && (
        <section className="mt-10">
          <p className="mb-2 text-[10px] uppercase tracking-[0.25em] text-brume">Derniers lancers</p>
          <div className="space-y-1.5">
            {flux.map((c) => {
              const deMoi = c.par === userId;
              return (
                <div key={c.id} className="carte flex items-center gap-3 px-3 py-2.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: deMoi ? "var(--color-bordeaux-vif)" : "var(--color-menthe)" }}
                  />
                  <p className="min-w-0 flex-1 truncate text-sm">
                    <span className="text-brume">{deMoi ? "Vous" : partenaire} : </span>
                    {DE_ACTIONS[c.charge.a]} {DE_ENDROITS[c.charge.e]}
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
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-center text-[10px] leading-relaxed text-brume">
            ✓✓ = {partenaire} l&apos;a vu. Le fil s&apos;efface au bout de 30 jours.
          </p>
        </section>
      )}
    </div>
  );
}
