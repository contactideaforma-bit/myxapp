"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES_QUIZ, QUESTIONS_QUIZ, QUESTION_PAR_CLE } from "@/data/quiz";
import ReactionCoup from "@/components/ReactionCoup";

/* =====================================================================
   TU ME CONNAIS ? — pour chaque question : je donne MA vérité, puis je
   parie sur la réponse de l'autre. Rien ne se dévoile tant qu'on n'a
   pas joué (la base ne rend que ce qui est mérité) ; une question jouée
   des deux côtés entre au fil : ✓✓ vu, badge, réaction.
   ===================================================================== */

type Ligne = { verite: string | null; devine: string | null };

type Resultat = {
  question: string;
  ma_verite: string | null;
  ma_devine: string | null;
  sa_verite: string | null;
  sa_devine: string | null;
};

type Ev = { id: string; par: string; vu_le: string | null; reaction: string | null };

export default function TuMeConnais({
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
  const [mes, setMes] = useState<Record<string, Ligne>>({});
  const [resultats, setResultats] = useState<Record<string, Resultat>>({});
  const [evenements, setEvenements] = useState<Record<string, Ev>>({});
  const [autreCompte, setAutreCompte] = useState(0);
  const [charge, setCharge] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const pushRef = useRef(0);

  /* ------------------------------------------------ Chargement */
  const relever = useCallback(async () => {
    const [{ data: res }, { data: prog }, { data: evs }] = await Promise.all([
      supabase.rpc("quiz_resultats"),
      supabase.rpc("quiz_progression"),
      supabase
        .from("game_events")
        .select("id, par, vu_le, reaction, charge")
        .eq("couple_id", coupleId)
        .eq("jeu", "quiz")
        .limit(200),
    ]);

    const carte: Record<string, Resultat> = {};
    ((res ?? []) as Resultat[]).forEach((r) => {
      carte[r.question] = r;
    });
    setResultats(carte);
    setAutreCompte(((prog ?? {}) as { autre?: number }).autre ?? 0);

    const evCarte: Record<string, Ev> = {};
    ((evs ?? []) as (Ev & { charge: { question?: string } })[]).forEach((e) => {
      if (e.charge?.question) evCarte[e.charge.question] = e;
    });
    setEvenements(evCarte);
  }, [supabase, coupleId]);

  const charger = useCallback(async () => {
    const { data } = await supabase
      .from("quiz_reponses")
      .select("question, verite, devine")
      .eq("couple_id", coupleId)
      .eq("user_id", userId);
    const carte: Record<string, Ligne> = {};
    ((data ?? []) as ({ question: string } & Ligne)[]).forEach((r) => {
      carte[r.question] = { verite: r.verite, devine: r.devine };
    });
    setMes(carte);
    await relever();
    setCharge(false);
  }, [supabase, coupleId, userId, relever]);

  /* Regarder les résultats = les avoir vus. (⚠ rpc sans .then ne part pas) */
  const marquerVu = useCallback(() => {
    supabase.rpc("jeu_marquer_vu", { p_jeu: "quiz" }).then(
      () => relever(),
      () => {}
    );
  }, [supabase, relever]);

  useEffect(() => {
    charger().then(marquerVu);
  }, [charger, marquerVu]);

  /* Les réponses de l'autre arrivent par le signal ; les ✓✓ et
     réactions par game_events. */
  useEffect(() => {
    const canal = supabase
      .channel(`quiz-${coupleId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "quiz_activite",
          filter: `couple_id=eq.${coupleId}`,
        },
        () => relever()
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
          if (ligne && ligne.jeu !== "quiz") return;
          relever();
          if (p.eventType === "INSERT" && ligne?.par && ligne.par !== userId) marquerVu();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [supabase, coupleId, userId, relever, marquerVu]);

  /* ------------------------------------------------ Répondre */
  function prevenir() {
    const t = Date.now();
    if (t - pushRef.current < 5 * 60_000) return;
    pushRef.current = t;
    fetch("/api/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        genre: "jeu",
        apercu: "💬 Le quiz vous attend — à vous de jouer !",
        prenom: monPrenom,
      }),
    }).catch(() => {});
  }

  async function repondre(question: string, champ: "verite" | "devine", valeur: string) {
    setErreur(null);
    const avant = mes[question] ?? { verite: null, devine: null };
    const apres = { ...avant, [champ]: valeur };
    setMes((p) => ({ ...p, [question]: apres }));

    const { error } = await supabase
      .from("quiz_reponses")
      .upsert(
        { couple_id: coupleId, user_id: userId, question, [champ]: valeur },
        { onConflict: "couple_id,user_id,question" }
      );
    if (error) setErreur(error.message);
    else {
      await relever();
      if (apres.verite && apres.devine) prevenir(); // question jouée en entier
    }
  }

  /* ------------------------------------------------ Dérivés */
  const jouees = QUESTIONS_QUIZ.filter((q) => mes[q.cle]?.verite && mes[q.cle]?.devine);
  const courante = QUESTIONS_QUIZ.find((q) => !mes[q.cle]?.verite || !mes[q.cle]?.devine) ?? null;
  const etape: "verite" | "devine" = courante && mes[courante.cle]?.verite ? "devine" : "verite";

  /** Questions révélées : la vérité de l'autre est visible. */
  const revelees = QUESTIONS_QUIZ.filter((q) => resultats[q.cle]?.sa_verite);
  const mesJustes = revelees.filter((q) => resultats[q.cle].ma_devine === resultats[q.cle].sa_verite).length;
  const sesReponses = QUESTIONS_QUIZ.filter(
    (q) => resultats[q.cle]?.sa_devine && resultats[q.cle]?.ma_verite
  );
  const sesJustes = sesReponses.filter((q) => resultats[q.cle].sa_devine === resultats[q.cle].ma_verite).length;

  const texteOption = (question: string, cle: string | null) =>
    QUESTION_PAR_CLE[question]?.options.find((o) => o.cle === cle)?.texte ?? "?";

  if (charge) {
    return <p className="py-20 text-center text-sm text-brume">…</p>;
  }

  /* ================================================ RENDU */
  return (
    <div className="mx-auto max-w-md px-5 py-8">
      <header className="mb-6">
        <button onClick={retour} className="text-xs text-brume">
          ← Les jeux
        </button>
        <h1 className="mt-2 font-display text-3xl">Tu me connais ?</h1>
        <p className="mt-1 text-sm leading-relaxed text-brume">
          Répondez sur vous, pariez sur l&apos;autre. La vérité ne se dévoile
          qu&apos;une fois votre pari verrouillé.
        </p>
        <p className="mt-2 text-xs text-brume">
          Vous : {jouees.length} jouée{jouees.length > 1 ? "s" : ""} · {partenaire} : {autreCompte}
          {revelees.length > 0 && (
            <>
              {" "}· score : vous {mesJustes}/{revelees.length}
              {sesReponses.length > 0 && ` — ${partenaire} ${sesJustes}/${sesReponses.length}`}
            </>
          )}
        </p>
      </header>

      {erreur && <p className="mb-4 text-center text-sm text-orrose">{erreur}</p>}

      {/* ---------------------------------------------- Question en cours */}
      {courante ? (
        <div key={`${courante.cle}-${etape}`} className="anim-monte">
          <div className="carte relative overflow-hidden p-6">
            <span className="absolute -right-6 -top-6 text-8xl opacity-[0.06]">
              {CATEGORIES_QUIZ.find((c) => c.n === courante.categorie)?.icone}
            </span>
            <p className="text-[10px] uppercase tracking-[0.25em] text-brume">
              {CATEGORIES_QUIZ.find((c) => c.n === courante.categorie)?.nom} ·{" "}
              {etape === "verite" ? "D'abord vous" : `Et pour ${partenaire} ?`}
            </p>
            <p className="relative mt-3 font-display text-xl leading-snug text-champagne">
              {etape === "verite"
                ? courante.question
                : `À votre avis, ${partenaire} répondra quoi ?`}
            </p>
            {etape === "devine" && (
              <p className="mt-1 text-sm text-brume">« {courante.question} »</p>
            )}

            <div className="relative mt-5 space-y-2">
              {courante.options.map((o) => (
                <button
                  key={o.cle}
                  onClick={() => repondre(courante.cle, etape, o.cle)}
                  className="carte block w-full p-3 text-left text-sm transition hover:border-bordeaux-vif"
                >
                  {o.texte}
                </button>
              ))}
            </div>
          </div>
          {etape === "verite" && (
            <p className="mt-3 text-center text-[11px] leading-relaxed text-brume">
              Votre réponse restera cachée tant que {partenaire} n&apos;aura pas parié dessus.
            </p>
          )}
        </div>
      ) : (
        <div className="anim-monte carte grid h-40 place-items-center border-dashed p-6 text-center">
          <div>
            <p className="text-3xl">🏁</p>
            <p className="mt-2 max-w-[16rem] text-sm leading-relaxed text-brume">
              Vous avez tout joué ! Les dernières révélations tomberont quand {partenaire} aura
              fini aussi.
            </p>
          </div>
        </div>
      )}

      {/* ---------------------------------------------- Révélations */}
      {revelees.length > 0 && (
        <section className="mt-10">
          <p className="mb-2 text-[10px] uppercase tracking-[0.25em] text-brume">Révélations</p>
          <div className="space-y-2.5">
            {[...revelees].reverse().map((q) => {
              const r = resultats[q.cle];
              const ev = evenements[q.cle];
              const juste = r.ma_devine === r.sa_verite;
              const sonPari = r.sa_devine && r.ma_verite;
              const sonJuste = sonPari && r.sa_devine === r.ma_verite;
              return (
                <div key={q.cle} className="carte p-4">
                  <p className="font-display text-lg leading-snug text-champagne">{q.question}</p>

                  <p className="mt-2 text-sm leading-relaxed">
                    <span className="text-brume">Votre pari : </span>
                    {texteOption(q.cle, r.ma_devine)}{" "}
                    {juste ? "🎯" : (
                      <>
                        <span className="text-brume">— en vrai : </span>
                        {texteOption(q.cle, r.sa_verite)}
                      </>
                    )}
                  </p>

                  {sonPari && (
                    <p className="mt-1 text-sm leading-relaxed">
                      <span className="text-brume">{partenaire} a parié : </span>
                      {texteOption(q.cle, r.sa_devine)}{" "}
                      {sonJuste ? (
                        <span title={`${partenaire} vous connaît par cœur`}>🎯</span>
                      ) : (
                        <>
                          <span className="text-brume">— vous aviez dit : </span>
                          {texteOption(q.cle, r.ma_verite)}
                        </>
                      )}
                    </p>
                  )}

                  {ev && (
                    <div className="mt-2 flex items-center gap-2">
                      {ev.par === userId && (
                        <span
                          className="text-[10px]"
                          style={{ color: ev.vu_le ? "var(--color-menthe)" : "var(--color-brume)" }}
                        >
                          {ev.vu_le ? `✓✓ vu par ${partenaire}` : `✓ pas encore vu par ${partenaire}`}
                        </span>
                      )}
                      <span className="ml-auto">
                        <ReactionCoup
                          deMoi={ev.par === userId}
                          reaction={ev.reaction}
                          onChoisir={(em) =>
                            supabase.rpc("jeu_reagir", { p_event: ev.id, p_emoji: em }).then(
                              () => relever(),
                              () => {}
                            )
                          }
                        />
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {revelees.length === 0 && jouees.length > 0 && (
        <p className="mt-8 text-center text-[11px] leading-relaxed text-brume">
          Vos paris sont posés — les révélations tomberont quand {partenaire} aura joué les mêmes
          questions. 🔮
        </p>
      )}
    </div>
  );
}
