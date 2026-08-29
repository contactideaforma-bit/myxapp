"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CARTES_ONP, CARTE_PAR_CLE, INTENSITES_ONP, type IntensiteONP } from "@/data/ouinon";
import ReactionCoup from "@/components/ReactionCoup";

/* =====================================================================
   OUI / NON / PEUT-ÊTRE — chacun répond de son côté au même paquet
   de cartes ; seuls les accords mutuels (oui/peut-être des deux) se
   révèlent, en temps réel. Les « non » restent secrets à jamais.
   ===================================================================== */

type Reponse = "oui" | "non" | "peutetre";

type Accord = {
  carte: string;
  ma_reponse: Reponse;
  sa_reponse: Reponse;
  forme_le: string;
};

/** Le coup game_events associé à un accord : porte le ✓✓ vu et la réaction. */
type EvAccord = {
  id: string;
  par: string;
  vu_le: string | null;
  reaction: string | null;
};

const ETIQUETTE: Record<Reponse, string> = { oui: "Oui", peutetre: "Peut-être", non: "Non" };

const fmtHeureONP = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

function depuisONP(iso: string, maintenant: number): string {
  const s = Math.max(0, (maintenant - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 24 * 3600) return `il y a ${Math.floor(s / 3600)} h`;
  return `le ${new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} à ${fmtHeureONP.format(new Date(iso))}`;
}

export default function OuiNonPeutEtre({
  coupleId,
  userId,
  partenaire,
  retour,
}: {
  coupleId: string;
  userId: string;
  partenaire: string;
  retour: () => void;
}) {
  const [supabase] = useState(() => createClient());
  const [mesReponses, setMesReponses] = useState<Record<string, Reponse>>({});
  const [accords, setAccords] = useState<Accord[]>([]);
  const [evenements, setEvenements] = useState<Record<string, EvAccord>>({});
  const [autreCompte, setAutreCompte] = useState(0);
  const [charge, setCharge] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ecran, setEcran] = useState<"menu" | "cartes" | "accords">("menu");
  const [intensite, setIntensite] = useState<IntensiteONP>(1);
  const [flashAccord, setFlashAccord] = useState(false);
  const [tic, setTic] = useState(Date.now());
  const nbAccordsRef = useRef<number | null>(null);

  /* ------------------------------------------------ Chargement */
  const relever = useCallback(async () => {
    const [{ data: acc }, { data: prog }, { data: evs }] = await Promise.all([
      supabase.rpc("onp_accords"),
      supabase.rpc("onp_progression"),
      supabase
        .from("game_events")
        .select("id, par, vu_le, reaction, charge")
        .eq("couple_id", coupleId)
        .eq("jeu", "ouinon")
        .limit(200),
    ]);
    const liste = (acc ?? []) as Accord[];
    setAccords(liste);
    setAutreCompte(((prog ?? {}) as { autre?: number }).autre ?? 0);

    const carte: Record<string, EvAccord> = {};
    ((evs ?? []) as (EvAccord & { charge: { carte?: string } })[]).forEach((e) => {
      if (e.charge?.carte) carte[e.charge.carte] = e;
    });
    setEvenements(carte);

    // Petit feu d'artifice quand un nouvel accord se forme.
    if (nbAccordsRef.current !== null && liste.length > nbAccordsRef.current) {
      setFlashAccord(true);
      setTimeout(() => setFlashAccord(false), 4000);
    }
    nbAccordsRef.current = liste.length;
  }, [supabase, coupleId]);

  /* Regarder les accords = les avoir vus. (⚠ rpc sans .then ne part pas) */
  const marquerVu = useCallback(() => {
    supabase.rpc("jeu_marquer_vu", { p_jeu: "ouinon" }).then(
      () => relever(),
      () => {}
    );
  }, [supabase, relever]);

  function reagir(id: string, emoji: string | null) {
    supabase.rpc("jeu_reagir", { p_event: id, p_emoji: emoji }).then(
      () => relever(),
      () => {}
    );
  }

  const charger = useCallback(async () => {
    const { data } = await supabase
      .from("onp_reponses")
      .select("carte, reponse")
      .eq("couple_id", coupleId)
      .eq("user_id", userId);
    const carte: Record<string, Reponse> = {};
    ((data ?? []) as { carte: string; reponse: Reponse }[]).forEach((r) => {
      carte[r.carte] = r.reponse;
    });
    setMesReponses(carte);
    await relever();
    setCharge(false);
  }, [supabase, coupleId, userId, relever]);

  useEffect(() => {
    charger();
  }, [charger]);

  /* Quand l'autre répond, le trigger tape sur onp_activite → on relève.
     Les coups (accords, vu, réactions) arrivent par game_events. */
  useEffect(() => {
    const canal = supabase
      .channel(`onp-${coupleId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "onp_activite",
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
          const ligne = (p.new ?? p.old) as { jeu?: string } | null;
          if (!ligne || ligne.jeu === "ouinon") relever();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [supabase, coupleId, relever]);

  /* Ouvrir l'écran des accords marque les nouveaux comme vus. */
  useEffect(() => {
    if (ecran === "accords") marquerVu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ecran, accords.length]);

  /* Rafraîchit les « il y a X min ». */
  useEffect(() => {
    const t = setInterval(() => setTic(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  /* ------------------------------------------------ Répondre */
  async function repondre(carte: string, reponse: Reponse) {
    setErreur(null);
    setMesReponses((p) => ({ ...p, [carte]: reponse }));
    const { error } = await supabase
      .from("onp_reponses")
      .upsert(
        { couple_id: coupleId, user_id: userId, carte, reponse },
        { onConflict: "couple_id,user_id,carte" }
      );
    if (error) setErreur(error.message);
    else await relever(); // ma réponse a peut-être formé un accord
  }

  /** Effacer une réponse : la carte revient dans le paquet ; si elle
      formait un accord, il disparaît (trigger côté base). */
  async function effacer(carte: string) {
    setErreur(null);
    setMesReponses((p) => {
      const suite = { ...p };
      delete suite[carte];
      return suite;
    });
    const { error } = await supabase
      .from("onp_reponses")
      .delete()
      .eq("couple_id", coupleId)
      .eq("user_id", userId)
      .eq("carte", carte);
    if (error) setErreur(error.message);
    else await relever();
  }

  /* ------------------------------------------------ Dérivés */
  const cartesNiveau = CARTES_ONP.filter((c) => c.intensite === intensite);
  const restantes = cartesNiveau.filter((c) => !mesReponses[c.cle]);
  const carteCourante = restantes[0] ?? null;
  const totalRepondu = Object.keys(mesReponses).length;
  const accordsOui = accords.filter((a) => a.ma_reponse === "oui" && a.sa_reponse === "oui");
  const accordsPeutEtre = accords.filter((a) => a.ma_reponse !== "oui" || a.sa_reponse !== "oui");

  /** Une carte d'accord : le texte, qui a vu, et la réaction de l'autre. */
  const AccordCarte = ({ accord, details = false }: { accord: Accord; details?: boolean }) => {
    const ev = evenements[accord.carte];
    const deMoi = ev?.par === userId; // mon dernier « oui » a formé l'accord
    return (
      <div className="carte anim-monte p-4">
        <p className="font-display text-lg leading-snug text-champagne">
          {CARTE_PAR_CLE[accord.carte]?.texte ?? accord.carte}
        </p>
        {details && (
          <p className="mt-1 text-[11px] text-brume">
            Vous : {ETIQUETTE[accord.ma_reponse]} · {partenaire} : {ETIQUETTE[accord.sa_reponse]}
          </p>
        )}
        {ev && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] text-brume">{depuisONP(accord.forme_le, tic)}</span>
            {deMoi && (
              <span
                className="text-[10px]"
                style={{ color: ev.vu_le ? "var(--color-menthe)" : "var(--color-brume)" }}
              >
                {ev.vu_le ? `✓✓ vu par ${partenaire}` : `✓ pas encore vu par ${partenaire}`}
              </span>
            )}
            <span className="ml-auto">
              <ReactionCoup
                deMoi={deMoi}
                reaction={ev.reaction}
                onChoisir={(em) => reagir(ev.id, em)}
              />
            </span>
          </div>
        )}
      </div>
    );
  };

  if (charge) {
    return <p className="py-20 text-center text-sm text-brume">…</p>;
  }

  /* ================================================ RENDU */
  return (
    <div className="mx-auto max-w-md px-5 py-8">
      <header className="mb-6">
        <button onClick={ecran === "menu" ? retour : () => setEcran("menu")} className="text-xs text-brume">
          ← {ecran === "menu" ? "Les jeux" : "Oui / Non / Peut-être"}
        </button>
        <h1 className="mt-2 font-display text-3xl">Oui / Non / Peut-être</h1>
        <p className="mt-1 text-sm leading-relaxed text-brume">
          Répondez chacun de votre côté. Seules les envies partagées se dévoilent —
          vos « non » restent votre secret.
        </p>
      </header>

      {flashAccord && (
        <div
          className="anim-monte carte mb-4 p-3 text-center text-sm"
          style={{ borderColor: "rgba(61,214,160,0.4)" }}
        >
          💘 Nouvel accord ! Vous avez une envie en commun de plus.
        </div>
      )}

      {erreur && <p className="mb-4 text-center text-sm text-orrose">{erreur}</p>}

      {/* ---------------------------------------------- Menu */}
      {ecran === "menu" && (
        <div className="space-y-3">
          <button
            onClick={() => setEcran("accords")}
            className="carte anim-monte flex w-full items-center gap-4 p-4 text-left transition hover:border-bordeaux-vif"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-bordeaux to-bordeaux-vif text-xl">
              💘
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-lg">
                {accords.length > 0
                  ? `${accords.length} accord${accords.length > 1 ? "s" : ""}`
                  : "Aucun accord… pour l'instant"}
              </span>
              <span className="block text-xs leading-snug text-brume">
                Vous : {totalRepondu} réponse{totalRepondu > 1 ? "s" : ""} · {partenaire} : {autreCompte}
              </span>
            </span>
            {accords.length > 0 && <span className="text-brume">→</span>}
          </button>

          <p className="pt-2 text-[10px] uppercase tracking-[0.25em] text-brume">Choisir un paquet</p>

          {INTENSITES_ONP.map((n) => {
            const cartes = CARTES_ONP.filter((c) => c.intensite === n.n);
            const faites = cartes.filter((c) => mesReponses[c.cle]).length;
            return (
              <button
                key={n.n}
                onClick={() => {
                  setIntensite(n.n);
                  setEcran("cartes");
                }}
                className="carte anim-monte flex w-full items-center gap-4 p-4 text-left transition hover:border-bordeaux-vif"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-bordeaux to-bordeaux-vif text-xl">
                  {n.icone}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-lg">{n.nom}</span>
                  <span className="block text-xs leading-snug text-brume">{n.accroche}</span>
                </span>
                <span className="shrink-0 text-xs text-brume">
                  {faites}/{cartes.length}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ---------------------------------------------- Cartes */}
      {ecran === "cartes" && (
        <div>
          <p className="mb-3 text-center text-xs text-brume">
            {INTENSITES_ONP.find((n) => n.n === intensite)?.icone}{" "}
            {INTENSITES_ONP.find((n) => n.n === intensite)?.nom} ·{" "}
            {cartesNiveau.length - restantes.length}/{cartesNiveau.length}
          </p>

          {carteCourante ? (
            <div key={carteCourante.cle} className="anim-monte">
              <div className="carte relative overflow-hidden p-7 text-center">
                <span className="absolute -right-6 -top-6 text-8xl opacity-[0.06]">💘</span>
                <p className="text-[10px] uppercase tracking-[0.25em] text-brume">Ça vous tente ?</p>
                <p className="relative mt-4 min-h-[5.5rem] font-display text-xl leading-relaxed text-champagne">
                  {carteCourante.texte}
                </p>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2">
                <button className="btn btn-fantome" onClick={() => repondre(carteCourante.cle, "non")}>
                  Non
                </button>
                <button className="btn btn-fantome" onClick={() => repondre(carteCourante.cle, "peutetre")}>
                  Peut-être
                </button>
                <button className="btn" onClick={() => repondre(carteCourante.cle, "oui")}>
                  Oui
                </button>
              </div>
              <p className="mt-4 text-center text-[11px] leading-relaxed text-brume">
                {partenaire} ne verra votre réponse que si les deux disent oui ou peut-être.
              </p>
            </div>
          ) : (
            <div className="anim-monte carte grid h-40 place-items-center border-dashed p-6 text-center">
              <div>
                <p className="text-3xl">🎉</p>
                <p className="mt-2 max-w-[16rem] text-sm leading-relaxed text-brume">
                  Paquet terminé ! Les accords apparaîtront dès que {partenaire} aura répondu aussi.
                </p>
              </div>
            </div>
          )}

          {/* Vos réponses, juste en dessous : modifiables, effaçables. */}
          {cartesNiveau.some((c) => mesReponses[c.cle]) && (
            <section className="mt-8">
              <p className="mb-2 text-[10px] uppercase tracking-[0.25em] text-brume">
                Vos réponses dans ce paquet
              </p>
              <div className="space-y-2">
                {cartesNiveau
                  .filter((c) => mesReponses[c.cle])
                  .map((c) => (
                    <div key={c.cle} className="carte p-3">
                      <div className="flex items-start gap-2">
                        <p className="min-w-0 flex-1 text-sm leading-snug">
                          {c.texte}
                          {evenements[c.cle] && (
                            <span className="ml-1.5 text-xs" title="Accord !">💘</span>
                          )}
                        </p>
                        <button
                          onClick={() => effacer(c.cle)}
                          className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs text-brume transition hover:text-orrose"
                          aria-label="Effacer cette réponse"
                          title="Effacer — la carte reviendra dans le paquet"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="mt-2 flex gap-1">
                        {(["non", "peutetre", "oui"] as Reponse[]).map((r) => (
                          <button
                            key={r}
                            onClick={() => repondre(c.cle, r)}
                            className="rounded-full border px-2 py-1 text-[10px] transition"
                            style={{
                              borderColor: mesReponses[c.cle] === r ? "var(--color-bordeaux-vif)" : "var(--color-bord)",
                              background: mesReponses[c.cle] === r ? "var(--color-bordeaux)" : "transparent",
                              color: mesReponses[c.cle] === r ? "#fff" : "var(--color-brume)",
                            }}
                          >
                            {ETIQUETTE[r]}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ---------------------------------------------- Accords */}
      {ecran === "accords" && (
        <div className="space-y-5">
          {accords.length === 0 && (
            <div className="carte grid h-56 place-items-center border-dashed p-6 text-center">
              <p className="max-w-[16rem] text-sm leading-relaxed text-brume">
                Rien en commun pour l'instant — continuez à répondre chacun de votre côté,
                la magie opère toute seule.
              </p>
            </div>
          )}

          {accordsOui.length > 0 && (
            <section>
              <p className="mb-2 text-[10px] uppercase tracking-[0.25em] text-brume">
                💘 Oui des deux côtés
              </p>
              <div className="space-y-2">
                {accordsOui.map((a) => (
                  <AccordCarte key={a.carte} accord={a} />
                ))}
              </div>
            </section>
          )}

          {accordsPeutEtre.length > 0 && (
            <section>
              <p className="mb-2 text-[10px] uppercase tracking-[0.25em] text-brume">
                ✨ À explorer — un « peut-être » dans l'air
              </p>
              <div className="space-y-2">
                {accordsPeutEtre.map((a) => (
                  <AccordCarte key={a.carte} accord={a} details />
                ))}
              </div>
            </section>
          )}

          <p className="text-center text-[11px] leading-relaxed text-brume">
            Une envie en commun ? Glissez-la dans la conversation… ou laissez-la mijoter. 😏
          </p>
        </div>
      )}
    </div>
  );
}
