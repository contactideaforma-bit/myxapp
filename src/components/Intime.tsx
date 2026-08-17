"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Liste = { id: string; titre: string; emoji: string };
type Item = { id: string; list_id: string; texte: string; rang: number };
type Etat = { item_id: string; ma_coche: boolean; les_deux: boolean };
type Scenario = {
  id: string;
  titre: string;
  contenu: string;
  favori: boolean;
  auteur: string | null;
  updated_at: string;
};

const EMOJIS = ["🔥", "🌙", "💋", "🖤", "🌹", "😈", "⚡", "🍒"];

export default function Intime({
  coupleId,
  userId,
}: {
  coupleId: string;
  userId: string;
}) {
  const [supabase] = useState(() => createClient());
  const [onglet, setOnglet] = useState<"fantasmes" | "scenarios">("fantasmes");

  /* ============================================================ FANTASMES */
  const [listes, setListes] = useState<Liste[]>([]);
  const [ouverte, setOuverte] = useState<Liste | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [etats, setEtats] = useState<Record<string, Etat>>({});
  const [nouvelItem, setNouvelItem] = useState("");
  const [nouvelleListe, setNouvelleListe] = useState("");

  const chargerListes = useCallback(async () => {
    const { data } = await supabase
      .from("fantasy_lists")
      .select("id, titre, emoji")
      .eq("couple_id", coupleId)
      .order("created_at");
    setListes((data ?? []) as Liste[]);
  }, [supabase, coupleId]);

  const chargerItems = useCallback(
    async (listeId: string) => {
      const [{ data: i }, { data: e }] = await Promise.all([
        supabase
          .from("fantasy_items")
          .select("id, list_id, texte, rang")
          .eq("list_id", listeId)
          .order("rang"),
        supabase.rpc("fantasy_overview", { p_list: listeId }),
      ]);
      setItems((i ?? []) as Item[]);
      const table: Record<string, Etat> = {};
      ((e ?? []) as Etat[]).forEach((x) => (table[x.item_id] = x));
      setEtats(table);
    },
    [supabase]
  );

  useEffect(() => {
    chargerListes();
  }, [chargerListes]);

  useEffect(() => {
    if (ouverte) chargerItems(ouverte.id);
  }, [ouverte, chargerItems]);

  // Temps réel : la coche de l'autre peut révéler une correspondance
  useEffect(() => {
    if (!ouverte) return;
    const canal = supabase
      .channel(`fantasmes-${ouverte.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "fantasy_checks" }, () =>
        chargerItems(ouverte.id)
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "fantasy_items" }, () =>
        chargerItems(ouverte.id)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [supabase, ouverte, chargerItems]);

  async function creerListe() {
    const t = nouvelleListe.trim();
    if (!t) return;
    setNouvelleListe("");
    const { data } = await supabase
      .from("fantasy_lists")
      .insert({
        couple_id: coupleId,
        titre: t,
        emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
        created_by: userId,
      })
      .select()
      .single();
    await chargerListes();
    if (data) setOuverte(data as Liste);
  }

  async function ajouterItem() {
    const t = nouvelItem.trim();
    if (!t || !ouverte) return;
    setNouvelItem("");
    await supabase
      .from("fantasy_items")
      .insert({ list_id: ouverte.id, texte: t, rang: items.length });
    await chargerItems(ouverte.id);
  }

  async function basculerCoche(item: Item) {
    const e = etats[item.id];
    const coche = e?.ma_coche ?? false;
    setEtats((p) => ({
      ...p,
      [item.id]: { item_id: item.id, ma_coche: !coche, les_deux: p[item.id]?.les_deux ?? false },
    }));
    if (coche) {
      await supabase
        .from("fantasy_checks")
        .delete()
        .eq("item_id", item.id)
        .eq("user_id", userId);
    } else {
      await supabase.from("fantasy_checks").insert({ item_id: item.id, user_id: userId });
    }
    if (ouverte) chargerItems(ouverte.id);
  }

  async function supprimerItem(item: Item) {
    setItems((p) => p.filter((x) => x.id !== item.id));
    await supabase.from("fantasy_items").delete().eq("id", item.id);
  }

  async function supprimerListe(l: Liste) {
    setOuverte(null);
    await supabase.from("fantasy_lists").delete().eq("id", l.id);
    chargerListes();
  }

  /* ============================================================ SCÉNARIOS */
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [edite, setEdite] = useState<Scenario | null>(null);
  const [titre, setTitre] = useState("");
  const [contenu, setContenu] = useState("");
  const [enregistre, setEnregistre] = useState(false);

  const chargerScenarios = useCallback(async () => {
    const { data } = await supabase
      .from("scenarios")
      .select("*")
      .eq("couple_id", coupleId)
      .order("updated_at", { ascending: false });
    setScenarios((data ?? []) as Scenario[]);
  }, [supabase, coupleId]);

  useEffect(() => {
    chargerScenarios();
  }, [chargerScenarios]);

  function ouvrirScenario(s: Scenario | null) {
    setEdite(s);
    setTitre(s?.titre ?? "");
    setContenu(s?.contenu ?? "");
  }

  async function sauverScenario() {
    setEnregistre(false);
    const charge = {
      couple_id: coupleId,
      titre: titre.trim() || "Sans titre",
      contenu,
      auteur: userId,
      updated_at: new Date().toISOString(),
    };
    if (edite?.id) {
      await supabase.from("scenarios").update(charge).eq("id", edite.id);
    } else {
      const { data } = await supabase.from("scenarios").insert(charge).select().single();
      if (data) setEdite(data as Scenario);
    }
    await chargerScenarios();
    setEnregistre(true);
    setTimeout(() => setEnregistre(false), 2000);
  }

  async function basculerFavori(s: Scenario) {
    setScenarios((p) => p.map((x) => (x.id === s.id ? { ...x, favori: !x.favori } : x)));
    await supabase.from("scenarios").update({ favori: !s.favori }).eq("id", s.id);
  }

  async function supprimerScenario(s: Scenario) {
    setScenarios((p) => p.filter((x) => x.id !== s.id));
    if (edite?.id === s.id) setEdite(null);
    await supabase.from("scenarios").delete().eq("id", s.id);
  }

  /* ============================================================ RENDU */
  return (
    <div className="mx-auto max-w-md px-5 py-7">
      <div className="mb-5 flex rounded-xl bg-velours-clair p-1 text-sm">
        {(["fantasmes", "scenarios"] as const).map((o) => (
          <button
            key={o}
            onClick={() => {
              setOnglet(o);
              setOuverte(null);
              setEdite(null);
            }}
            className={`flex-1 rounded-lg py-2 capitalize transition ${
              onglet === o ? "bg-bordeaux text-white" : "text-brume"
            }`}
          >
            {o === "fantasmes" ? "Fantasmes" : "Scénarios"}
          </button>
        ))}
      </div>

      {/* ---------------------------------------------------- FANTASMES */}
      {onglet === "fantasmes" &&
        (ouverte ? (
          <>
            <button
              onClick={() => setOuverte(null)}
              className="mb-3 text-xs text-brume underline"
            >
              ← Toutes les listes
            </button>
            <h1 className="font-display text-2xl">
              {ouverte.emoji} {ouverte.titre}
            </h1>
            <p className="mt-1 text-xs leading-relaxed text-brume">
              Cochez chacun de votre côté. Une case ne se révèle
              <br />
              que si vous l&apos;avez cochée tous les deux.
            </p>

            <div className="mt-5 space-y-2">
              {items.map((item) => {
                const e = etats[item.id];
                return (
                  <div
                    key={item.id}
                    className={`anim-monte flex items-center gap-3 rounded-xl border px-4 py-3 transition ${
                      e?.les_deux
                        ? "border-orrose bg-bordeaux/25"
                        : e?.ma_coche
                          ? "border-bordeaux-vif bg-bordeaux/15"
                          : "border-bord bg-velours-clair"
                    }`}
                  >
                    <button
                      onClick={() => basculerCoche(item)}
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border text-xs transition ${
                        e?.ma_coche ? "border-orrose bg-orrose text-nuit" : "border-bord"
                      }`}
                    >
                      {e?.ma_coche ? "✓" : ""}
                    </button>
                    <span className="min-w-0 flex-1 text-sm">{item.texte}</span>
                    {e?.les_deux && <span title="Vous deux">✨</span>}
                    <button
                      onClick={() => supprimerItem(item)}
                      className="shrink-0 text-xs text-brume"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex gap-2">
              <input
                className="champ"
                placeholder="Ajouter une envie…"
                value={nouvelItem}
                maxLength={160}
                onChange={(e) => setNouvelItem(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && ajouterItem()}
              />
              <button className="btn w-auto shrink-0 px-5" onClick={ajouterItem}>
                +
              </button>
            </div>

            <button
              onClick={() => supprimerListe(ouverte)}
              className="mt-8 block w-full text-center text-xs text-brume underline"
            >
              Supprimer cette liste
            </button>
          </>
        ) : (
          <>
            <header className="mb-5 text-center">
              <h1 className="font-display text-3xl">Fantasmes</h1>
              <p className="mt-1 text-sm text-brume">
                Des listes à cocher, chacun de son côté.
                <br />
                Seules les envies communes se révèlent.
              </p>
            </header>

            <div className="space-y-2">
              {listes.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setOuverte(l)}
                  className="carte anim-monte flex w-full items-center gap-3 p-4 text-left transition hover:border-bordeaux-vif"
                >
                  <span className="text-xl">{l.emoji}</span>
                  <span className="min-w-0 flex-1 truncate font-display text-lg">
                    {l.titre}
                  </span>
                  <span className="text-brume">›</span>
                </button>
              ))}
              {listes.length === 0 && (
                <p className="py-10 text-center text-sm text-brume">
                  Aucune liste. Créez la première.
                </p>
              )}
            </div>

            <div className="mt-5 flex gap-2">
              <input
                className="champ"
                placeholder="Nom de la liste — « Cet été », « Un jour »…"
                value={nouvelleListe}
                maxLength={60}
                onChange={(e) => setNouvelleListe(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && creerListe()}
              />
              <button className="btn w-auto shrink-0 px-5" onClick={creerListe}>
                +
              </button>
            </div>
          </>
        ))}

      {/* ---------------------------------------------------- SCÉNARIOS */}
      {onglet === "scenarios" &&
        (edite !== null || titre || contenu ? (
          <>
            <button
              onClick={() => ouvrirScenario(null)}
              className="mb-3 text-xs text-brume underline"
            >
              ← Tous les scénarios
            </button>

            <input
              className="champ mb-3 font-display text-xl"
              placeholder="Titre"
              value={titre}
              maxLength={80}
              onChange={(e) => setTitre(e.target.value)}
            />
            <textarea
              className="champ min-h-[50dvh] resize-none leading-relaxed"
              placeholder="Écrivez ici. Ce texte ne sortira jamais d'ici."
              value={contenu}
              onChange={(e) => setContenu(e.target.value)}
            />

            <button className="btn mt-3" onClick={sauverScenario}>
              {enregistre ? "✓ Enregistré" : "Enregistrer"}
            </button>
          </>
        ) : (
          <>
            <header className="mb-5 text-center">
              <h1 className="font-display text-3xl">Scénarios</h1>
              <p className="mt-1 text-sm text-brume">
                Vos textes, écrits à deux ou en secret.
              </p>
            </header>

            <button className="btn mb-4" onClick={() => ouvrirScenario({
              id: "", titre: "", contenu: "", favori: false, auteur: null, updated_at: "",
            })}>
              Écrire un scénario
            </button>

            <div className="space-y-2">
              {scenarios.map((s) => (
                <article
                  key={s.id}
                  className="carte anim-monte p-4"
                >
                  <button
                    onClick={() => ouvrirScenario(s)}
                    className="block w-full text-left"
                  >
                    <p className="font-display text-lg">{s.titre}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-brume">
                      {s.contenu.slice(0, 180) || "Vide"}
                    </p>
                  </button>
                  <div className="mt-3 flex items-center gap-2 border-t border-bord pt-2 text-[11px] text-brume">
                    <span>
                      {new Date(s.updated_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                    <span className="flex-1" />
                    <button
                      onClick={() => basculerFavori(s)}
                      className={`rounded-lg border px-2 py-1 ${
                        s.favori ? "border-bordeaux-vif text-orrose" : "border-bord"
                      }`}
                    >
                      🔥
                    </button>
                    <button
                      onClick={() => supprimerScenario(s)}
                      className="rounded-lg border border-bord px-2 py-1"
                    >
                      Retirer
                    </button>
                  </div>
                </article>
              ))}
              {scenarios.length === 0 && (
                <p className="py-10 text-center text-sm text-brume">
                  Rien encore écrit.
                </p>
              )}
            </div>
          </>
        ))}
    </div>
  );
}
