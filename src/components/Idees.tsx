"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Idee = {
  id: string;
  registre: string;
  intensite: number;
  demande: string | null;
  reponse: string;
  favori: boolean;
  created_at: string;
};

const REGISTRES = [
  { cle: "soiree", label: "Une soirée", emoji: "🌙" },
  { cle: "rituel", label: "Un rituel", emoji: "🕯️" },
  { cle: "discussion", label: "Une conversation", emoji: "💬" },
  { cle: "surprise", label: "Une surprise", emoji: "🎁" },
  { cle: "jeu", label: "Un jeu", emoji: "🎲" },
  { cle: "hors_lit", label: "Hors de la chambre", emoji: "🚪" },
];

const INTENSITES = [
  { n: 1, label: "Tendre" },
  { n: 2, label: "Sensuel" },
  { n: 3, label: "Brûlant" },
];

/** Rend le format renvoye par le modele : titre, texte, puces, chute. */
function Rendu({ texte }: { texte: string }) {
  const lignes = texte.split("\n").filter((l) => l.trim());
  return (
    <div className="space-y-2">
      {lignes.map((l, i) => {
        const t = l.trim();
        if (t.startsWith("# "))
          return (
            <h3 key={i} className="font-display text-xl text-orrose">
              {t.slice(2)}
            </h3>
          );
        if (t.startsWith("> "))
          return (
            <p
              key={i}
              className="mt-3 border-l-2 border-bordeaux-vif pl-3 text-sm italic leading-relaxed text-brume"
            >
              {t.slice(2)}
            </p>
          );
        if (/^[-•*]\s/.test(t))
          return (
            <p key={i} className="flex gap-2 text-sm leading-relaxed">
              <span className="text-bordeaux-vif">—</span>
              <span>{t.replace(/^[-•*]\s/, "")}</span>
            </p>
          );
        if (t.endsWith(":") || t.endsWith(" :"))
          return (
            <p key={i} className="pt-1 text-xs uppercase tracking-widest text-brume">
              {t.replace(/\s*:$/, "")}
            </p>
          );
        return (
          <p key={i} className="text-sm leading-relaxed text-champagne">
            {t}
          </p>
        );
      })}
    </div>
  );
}

export default function Idees({
  coupleId,
  userId,
}: {
  coupleId: string;
  userId: string;
}) {
  const [supabase] = useState(() => createClient());

  const [registre, setRegistre] = useState("soiree");
  const [intensite, setIntensite] = useState(2);
  const [precision, setPrecision] = useState("");
  const [encours, setEncours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [journal, setJournal] = useState<Idee[]>([]);
  const [onglet, setOnglet] = useState<"nouvelle" | "journal">("nouvelle");

  const charger = useCallback(async () => {
    const { data } = await supabase
      .from("idees")
      .select("*")
      .eq("couple_id", coupleId)
      .order("created_at", { ascending: false })
      .limit(60);
    setJournal((data ?? []) as Idee[]);
  }, [supabase, coupleId]);

  useEffect(() => {
    charger();
    const canal = supabase
      .channel(`idees-${coupleId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "idees", filter: `couple_id=eq.${coupleId}` },
        () => charger()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [supabase, coupleId, charger]);

  async function demander() {
    setEncours(true);
    setErreur(null);
    try {
      const rep = await fetch("/api/idees", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          registre,
          intensite,
          precision,
          eviter: journal
            .filter((i) => i.registre === registre)
            .slice(0, 10)
            .map((i) => i.reponse.split("\n")[0].replace(/^#\s*/, "")),
        }),
      });
      const json = await rep.json();
      if (!rep.ok) throw new Error(json.error ?? "erreur");

      await supabase.from("idees").insert({
        couple_id: coupleId,
        registre,
        intensite,
        demande: precision || null,
        reponse: json.texte,
        cree_par: userId,
      });
      setPrecision("");
      await charger();
      setOnglet("journal");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "erreur");
    }
    setEncours(false);
  }

  async function basculerFavori(i: Idee) {
    setJournal((p) => p.map((x) => (x.id === i.id ? { ...x, favori: !x.favori } : x)));
    await supabase.from("idees").update({ favori: !i.favori }).eq("id", i.id);
  }

  async function supprimer(i: Idee) {
    setJournal((p) => p.filter((x) => x.id !== i.id));
    await supabase.from("idees").delete().eq("id", i.id);
  }

  return (
    <div className="mx-auto max-w-md px-5 py-7">
      <header className="mb-5 text-center">
        <h1 className="font-display text-3xl">Idées</h1>
        <p className="mt-1 text-sm text-brume">
          De quoi avez-vous envie ? Tout ce qui sort ici est partagé.
        </p>
      </header>

      <div className="mb-5 flex rounded-xl bg-velours-clair p-1 text-sm">
        {(["nouvelle", "journal"] as const).map((o) => (
          <button
            key={o}
            onClick={() => setOnglet(o)}
            className={`flex-1 rounded-lg py-2 transition ${
              onglet === o ? "bg-bordeaux text-white" : "text-brume"
            }`}
          >
            {o === "nouvelle" ? "Nouvelle idée" : `Journal (${journal.length})`}
          </button>
        ))}
      </div>

      {onglet === "nouvelle" ? (
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-xs uppercase tracking-widest text-brume">Registre</p>
            <div className="grid grid-cols-2 gap-2">
              {REGISTRES.map((r) => (
                <button
                  key={r.cle}
                  onClick={() => setRegistre(r.cle)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                    registre === r.cle
                      ? "border-bordeaux-vif bg-bordeaux/25 text-orrose"
                      : "border-bord bg-velours-clair text-brume"
                  }`}
                >
                  <span>{r.emoji}</span>
                  <span className="min-w-0 truncate">{r.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs uppercase tracking-widest text-brume">Intensité</p>
            <div className="flex gap-2">
              {INTENSITES.map((i) => (
                <button
                  key={i.n}
                  onClick={() => setIntensite(i.n)}
                  className={`flex-1 rounded-xl border py-2.5 text-sm transition ${
                    intensite === i.n
                      ? "border-bordeaux-vif bg-bordeaux/25 text-orrose"
                      : "border-bord bg-velours-clair text-brume"
                  }`}
                >
                  {i.label}
                </button>
              ))}
            </div>
          </div>

          <textarea
            className="champ min-h-20 resize-none"
            placeholder="Une précision ? « on a peu de temps », « on est chez ses parents », « elle adore les surprises »…"
            value={precision}
            maxLength={400}
            onChange={(e) => setPrecision(e.target.value)}
          />

          {erreur && (
            <p className="rounded-xl border border-bordeaux bg-bordeaux/15 px-4 py-2.5 text-sm text-orrose">
              {erreur}
            </p>
          )}

          <button className="btn" onClick={demander} disabled={encours}>
            {encours ? "Une seconde…" : "Trouver une idée"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {journal.length === 0 && (
            <p className="py-16 text-center text-sm text-brume">
              Rien encore. Demandez une première idée.
            </p>
          )}
          {journal.map((i) => (
            <article key={i.id} className="carte anim-monte p-4">
              <Rendu texte={i.reponse} />
              <div className="mt-4 flex items-center gap-2 border-t border-bord pt-3 text-[11px] text-brume">
                <span>
                  {new Date(i.created_at).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                <span className="flex-1" />
                <button
                  onClick={() => basculerFavori(i)}
                  className={`rounded-lg border px-2.5 py-1 transition ${
                    i.favori ? "border-bordeaux-vif text-orrose" : "border-bord"
                  }`}
                >
                  🔥
                </button>
                <button
                  onClick={() => supprimer(i)}
                  className="rounded-lg border border-bord px-2.5 py-1"
                >
                  Retirer
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
