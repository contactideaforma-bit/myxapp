"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/Logo";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"connexion" | "inscription">("inscription");
  const [prenom, setPrenom] = useState("");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setChargement(true);

    try {
      if (mode === "inscription") {
        const { error } = await supabase.auth.signUp({
          email,
          password: motDePasse,
          options: { data: { display_name: prenom || email.split("@")[0] } },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: motDePasse,
        });
        if (error) throw error;
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      const m = err instanceof Error ? err.message : "Une erreur est survenue";
      setErreur(
        m.includes("Invalid login")
          ? "Email ou mot de passe incorrect."
          : m.includes("already registered")
            ? "Ce compte existe déjà — connecte-toi."
            : m.includes("Email not confirmed")
              ? "Email non confirmé. Désactive la confirmation d'email dans Supabase (voir README)."
              : m
      );
    } finally {
      setChargement(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12">
      <Logo size={52} />

      <form onSubmit={envoyer} className="carte mt-10 space-y-4 p-6">
        <div className="flex rounded-xl bg-velours-clair p-1">
          {(["inscription", "connexion"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setErreur(null);
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-medium capitalize transition ${
                mode === m
                  ? "bg-bordeaux text-white"
                  : "text-brume hover:text-champagne"
              }`}
            >
              {m === "inscription" ? "Créer un compte" : "Se connecter"}
            </button>
          ))}
        </div>

        {mode === "inscription" && (
          <input
            className="champ"
            placeholder="Ton prénom (ou ton petit nom…)"
            value={prenom}
            onChange={(e) => setPrenom(e.target.value)}
            maxLength={40}
          />
        )}

        <input
          className="champ"
          type="email"
          required
          autoComplete="email"
          placeholder="Adresse email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="champ"
          type="password"
          required
          minLength={6}
          autoComplete={mode === "inscription" ? "new-password" : "current-password"}
          placeholder="Mot de passe (6 caractères min.)"
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
        />

        {erreur && (
          <p className="rounded-lg border border-bordeaux bg-bordeaux/15 px-3 py-2 text-sm text-orrose">
            {erreur}
          </p>
        )}

        <button className="btn" disabled={chargement}>
          {chargement ? "…" : mode === "inscription" ? "Créer mon compte" : "Entrer"}
        </button>

        <p className="pt-1 text-center text-xs leading-relaxed text-brume">
          Vos échanges sont privés : seules les deux personnes liées par le code
          peuvent y accéder.
        </p>
      </form>
    </main>
  );
}
