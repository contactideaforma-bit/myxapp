"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Games from "@/components/Games";
import OuiNonPeutEtre from "@/components/OuiNonPeutEtre";
import DesCoquins from "@/components/DesCoquins";

/* =====================================================================
   JEUX — le salon. Chaque mini-jeu est une pièce ; on entre, on ressort.
   Les tuiles « bientôt » annoncent la suite (dés, quiz, action/vérité).
   ===================================================================== */

type Vue = "accueil" | "defis" | "ouinon" | "des";

const A_VENIR = [
  { icone: "💬", nom: "Tu me connais ?", accroche: "L'un répond, l'autre devine. Révélation simultanée." },
  { icone: "🎭", nom: "Action ou Vérité", accroche: "Tour par tour, réponses par texte, vocal ou photo." },
];

export default function JeuxHub({
  coupleId,
  userId,
  partenaire,
  monPrenom,
}: {
  coupleId: string;
  userId: string;
  partenaire: string;
  monPrenom: string;
}) {
  const [vue, setVue] = useState<Vue>("accueil");
  const [supabase] = useState(() => createClient());
  /** Coups de l'autre pas encore vus, par jeu — pour les badges des tuiles. */
  const [nonVus, setNonVus] = useState<Record<string, number>>({});

  useEffect(() => {
    if (vue !== "accueil") return;
    supabase.rpc("jeux_non_vus").then(({ data }) => {
      setNonVus((data ?? {}) as Record<string, number>);
    });
  }, [vue, supabase]);

  const Badge = ({ jeu }: { jeu: string }) => {
    const n = nonVus[jeu] ?? 0;
    if (!n) return null;
    return (
      <span
        className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
        style={{ background: "var(--color-bordeaux-vif)" }}
      >
        {n} nouveau{n > 1 ? "x" : ""}
      </span>
    );
  };

  if (vue === "defis") {
    return (
      <div>
        <div className="mx-auto max-w-md px-5 pt-6">
          <button onClick={() => setVue("accueil")} className="text-xs text-brume">
            ← Les jeux
          </button>
        </div>
        <Games coupleId={coupleId} userId={userId} />
      </div>
    );
  }

  if (vue === "ouinon") {
    return (
      <OuiNonPeutEtre
        coupleId={coupleId}
        userId={userId}
        partenaire={partenaire}
        retour={() => setVue("accueil")}
      />
    );
  }

  if (vue === "des") {
    return (
      <DesCoquins
        coupleId={coupleId}
        userId={userId}
        partenaire={partenaire}
        monPrenom={monPrenom}
        retour={() => setVue("accueil")}
      />
    );
  }

  /* ---------------------------------------------- Accueil */
  return (
    <div className="mx-auto max-w-md px-5 py-8">
      <header className="mb-6 text-center">
        <h1 className="font-display text-3xl">Jeux</h1>
        <p className="mt-1 text-sm text-brume">
          À deux, même à distance — chacun sur son téléphone, la même partie.
        </p>
      </header>

      <div className="space-y-3">
        <button
          onClick={() => setVue("ouinon")}
          className="carte anim-monte flex w-full items-center gap-4 p-4 text-left transition hover:border-bordeaux-vif"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-bordeaux to-bordeaux-vif text-xl">
            💘
          </span>
          <span className="min-w-0">
            <span className="block font-display text-lg">Oui / Non / Peut-être</span>
            <span className="block text-xs leading-snug text-brume">
              Répondez chacun de votre côté ; seules les envies partagées se dévoilent.
            </span>
          </span>
        </button>

        <button
          onClick={() => setVue("des")}
          className="carte anim-monte flex w-full items-center gap-4 p-4 text-left transition hover:border-bordeaux-vif"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-bordeaux to-bordeaux-vif text-xl">
            🎲
          </span>
          <span className="min-w-0">
            <span className="block font-display text-lg">Dés coquins</span>
            <span className="block text-xs leading-snug text-brume">
              Un lancer, deux téléphones — action, endroit, minuteur partagé.
            </span>
          </span>
          <Badge jeu="des" />
        </button>

        <button
          onClick={() => setVue("defis")}
          className="carte anim-monte flex w-full items-center gap-4 p-4 text-left transition hover:border-bordeaux-vif"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-bordeaux to-bordeaux-vif text-xl">
            🃏
          </span>
          <span className="min-w-0">
            <span className="block font-display text-lg">Défis à deux</span>
            <span className="block text-xs leading-snug text-brume">
              5 thèmes, 50 défis — la carte tirée s'affiche chez vous deux en même temps.
            </span>
          </span>
        </button>

        <p className="pt-3 text-[10px] uppercase tracking-[0.25em] text-brume">Bientôt sur la table</p>

        {A_VENIR.map((j) => (
          <div key={j.nom} className="carte flex w-full items-center gap-4 border-dashed p-4 opacity-60">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-bord text-xl">
              {j.icone}
            </span>
            <span className="min-w-0">
              <span className="block font-display text-lg">{j.nom}</span>
              <span className="block text-xs leading-snug text-brume">{j.accroche}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
