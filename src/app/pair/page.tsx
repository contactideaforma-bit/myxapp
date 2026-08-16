"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/Logo";
import type { Couple } from "@/lib/types";

const MESSAGES_ERREUR: Record<string, string> = {
  INVALID_CODE: "Ce code n'existe pas. Vérifiez les 6 caractères.",
  COUPLE_FULL: "Ce code a déjà été utilisé par quelqu'un d'autre.",
  ALREADY_PAIRED: "Vous êtes déjà lié·e à quelqu'un.",
  CANNOT_PAIR_WITH_SELF: "C'est votre propre code 😉 — envoyez-le à votre partenaire.",
};

export default function PairPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [couple, setCouple] = useState<Couple | null>(null);
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [copie, setCopie] = useState(false);

  const charger = useCallback(async () => {
    const { data, error } = await supabase.rpc("create_or_get_couple");
    if (error) {
      setErreur(error.message);
    } else {
      const c = (Array.isArray(data) ? data[0] : data) as Couple;
      setCouple(c);
      if (c?.member_b) router.replace("/chat");
    }
    setChargement(false);
  }, [supabase, router]);

  useEffect(() => {
    charger();
  }, [charger]);

  // Dès que le/la partenaire rejoint, on bascule automatiquement sur le chat
  useEffect(() => {
    if (!couple || couple.member_b) return;
    const canal = supabase
      .channel(`couple-${couple.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "couples", filter: `id=eq.${couple.id}` },
        (payload) => {
          if ((payload.new as Couple).member_b) router.replace("/chat");
        }
      )
      .subscribe();

    const sondage = setInterval(charger, 5000);
    return () => {
      supabase.removeChannel(canal);
      clearInterval(sondage);
    };
  }, [couple, supabase, router, charger]);

  async function rejoindre(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    const propre = code.trim().toUpperCase();
    if (propre.length !== 6) return setErreur("Le code fait 6 caractères.");

    const { error } = await supabase.rpc("join_couple", { p_code: propre });
    if (error) {
      const cle = Object.keys(MESSAGES_ERREUR).find((k) => error.message.includes(k));
      setErreur(cle ? MESSAGES_ERREUR[cle] : error.message);
      return;
    }
    router.replace("/chat");
    router.refresh();
  }

  async function copier() {
    if (!couple?.invite_code) return;
    await navigator.clipboard.writeText(couple.invite_code);
    setCopie(true);
    setTimeout(() => setCopie(false), 1800);
  }

  async function deconnexion() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (chargement) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-brume" style={{ animation: "pulse-doux 1.6s infinite" }}>
          Un instant…
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-6 py-12">
      <Logo />

      {/* MON CODE */}
      <section className="carte p-6 text-center">
        <h2 className="font-display text-xl">Votre code de liaison</h2>
        <p className="mt-1 text-sm text-brume">
          Transmettez-le à votre partenaire. Il ne fonctionne qu'une seule fois.
        </p>

        <button
          onClick={copier}
          className="group mt-5 w-full rounded-2xl border border-bord bg-velours-clair py-6 transition hover:border-bordeaux-vif"
        >
          <span className="font-display text-4xl tracking-[0.35em] text-orrose">
            {couple?.invite_code ?? "——————"}
          </span>
          <span className="mt-3 block text-xs uppercase tracking-widest text-brume">
            {copie ? "✓ Copié" : "Toucher pour copier"}
          </span>
        </button>

        <p className="mt-5 flex items-center justify-center gap-2 text-xs text-brume">
          <span
            className="inline-block h-2 w-2 rounded-full bg-bordeaux-vif"
            style={{ animation: "pulse-doux 1.6s infinite" }}
          />
          En attente de votre partenaire…
        </p>
      </section>

      {/* SAISIR UN CODE */}
      <section className="carte p-6">
        <h2 className="font-display text-xl">…ou entrez le sien</h2>
        <form onSubmit={rejoindre} className="mt-4 space-y-3">
          <input
            className="champ text-center font-display text-2xl uppercase tracking-[0.3em]"
            placeholder="XXXXXX"
            maxLength={6}
            autoCapitalize="characters"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          {erreur && (
            <p className="rounded-lg border border-bordeaux bg-bordeaux/15 px-3 py-2 text-sm text-orrose">
              {erreur}
            </p>
          )}
          <button className="btn" disabled={code.trim().length !== 6}>
            Nous lier
          </button>
        </form>
      </section>

      <button onClick={deconnexion} className="text-center text-xs text-brume underline">
        Se déconnecter
      </button>
    </main>
  );
}
