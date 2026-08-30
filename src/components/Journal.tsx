"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { compresserImage } from "@/lib/compression";

/* =====================================================================
   JOURNAL INTIME — un carnet partagé, gardé par un code distinct.
   Session serveur de 15 min (même mécanique que la galerie).
   ===================================================================== */

export type Entree = {
  id: string;
  couple_id: string;
  auteur: string;
  jour: string;
  titre: string | null;
  contenu: string;
  heureux: string | null;
  triste: string | null;
  humeur: string | null;
  meteo: number | null;
  tags: string[];
  favori: boolean;
  photo_path: string | null;
  created_at: string;
  updated_at: string;
};

type Brouillon = {
  id?: string;
  jour: string;
  titre: string;
  contenu: string;
  heureux: string;
  triste: string;
  humeur: string | null;
  meteo: number | null;
  tags: string[];
  favori: boolean;
  photo_path: string | null;
};

const DUREE_SESSION_MS = 15 * 60 * 1000;
/** En écrivant, on repousse la session serveur au plus toutes les 4 min. */
const INTERVALLE_PROLONGATION_MS = 4 * 60 * 1000;

const estRempli = (b: Brouillon | null | undefined): boolean =>
  !!b && !!(b.contenu.trim() || b.titre.trim() || b.heureux.trim() || b.triste.trim() || b.photo_path);

const HUMEURS = ["😌", "🥰", "🔥", "😊", "🤍", "😔", "😢", "😤", "😴", "🤯"];

const METEO: { n: number; icone: string; nom: string }[] = [
  { n: 1, icone: "☀️", nom: "Radieux" },
  { n: 2, icone: "🌤️", nom: "Éclaircies" },
  { n: 3, icone: "☁️", nom: "Nuageux" },
  { n: 4, icone: "🌧️", nom: "Pluvieux" },
  { n: 5, icone: "⛈️", nom: "Orageux" },
];

const aujourdhui = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const brouillonVide = (): Brouillon => ({
  jour: aujourdhui(),
  titre: "",
  contenu: "",
  heureux: "",
  triste: "",
  humeur: null,
  meteo: null,
  tags: [],
  favori: false,
  photo_path: null,
});

const fmtJour = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });
const fmtMois = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const fmtLong = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const dateLocale = (iso: string) => new Date(iso + "T12:00:00");
const fmtHeure = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const fmtCourt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

/** « à l'instant », « il y a 12 min », « hier à 21:14 », « 3 août à 09:02 » */
function depuis(iso: string | null | undefined, maintenant = Date.now()): string {
  if (!iso) return "jamais";
  const d = new Date(iso);
  const s = Math.max(0, (maintenant - d.getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 6 * 3600) return `il y a ${Math.floor(s / 3600)} h`;
  const j = new Date(maintenant); j.setHours(0, 0, 0, 0);
  if (d.getTime() >= j.getTime()) return `aujourd'hui à ${fmtHeure.format(d)}`;
  if (d.getTime() >= j.getTime() - 86400000) return `hier à ${fmtHeure.format(d)}`;
  return `le ${fmtCourt.format(d)} à ${fmtHeure.format(d)}`;
}
const cleMois = (iso: string) => iso.slice(0, 7);
const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* =====================================================================
   Zone de texte qui grandit sans faire sauter la page.
   Le ::after de .j-pousse réplique le texte et donne sa hauteur à la
   grille ; le textarea la remplit. Plus aucune hauteur recalculée en JS
   (l'ancien height = "auto" → scrollHeight faisait bondir la page à
   chaque frappe).
   ===================================================================== */
function AutoTexte({
  valeur,
  onValeur,
  className = "",
  style,
  placeholder,
}: {
  valeur: string;
  onValeur: (v: string) => void;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
}) {
  return (
    <div className={`j-pousse ${className}`} data-valeur={valeur} style={style}>
      <textarea
        rows={1}
        value={valeur}
        placeholder={placeholder}
        onChange={(e) => onValeur(e.target.value)}
      />
    </div>
  );
}

export default function Journal({
  coupleId,
  userId,
  partenaire,
  pinPose,
}: {
  coupleId: string;
  userId: string;
  partenaire: { id: string; nom: string };
  pinPose: boolean;
}) {
  const [supabase] = useState(() => createClient());

  /* ------------------------------------------------ Verrou */
  const [ouvert, setOuvert] = useState<boolean | null>(null);
  const [saisie, setSaisie] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [bloqueJusqua, setBloqueJusqua] = useState<number | null>(null);
  const [occupe, setOccupe] = useState(false);
  const minuterieRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ------------------------------------------------ Contenu */
  const [entrees, setEntrees] = useState<Entree[]>([]);
  /** entry_id → date de lecture par l'AUTRE (pour mes pages) ou par moi (pour les siennes). */
  const [lectures, setLectures] = useState<Record<string, string>>({});
  const [partenaireActif, setPartenaireActif] = useState<string | null>(null);
  const [tic, setTic] = useState(Date.now());
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [chargement, setChargement] = useState(false);

  /* ------------------------------------------------ Vue */
  const [recherche, setRecherche] = useState("");
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const [filtreFavoris, setFiltreFavoris] = useState(false);
  const [filtreTag, setFiltreTag] = useState<string | null>(null);
  const [filtreMois, setFiltreMois] = useState<string | null>(null);
  const [lecture, setLecture] = useState<Entree | null>(null);
  /** Page en cours d'écriture (valeur initiale de l'éditeur). */
  const [edition, setEdition] = useState<Brouillon | null>(null);
  /** Le brouillon survit aux rechargements et au reverrouillage. */
  const cleStockage = `journal-brouillon:${coupleId}:${userId}`;

  const Signature = ({ auteur, clair = true }: { auteur: string; clair?: boolean }) => {
    const deMoi = auteur === userId;
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest" style={{ color: clair ? "var(--encre-3)" : undefined }}>
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: deMoi ? "var(--sceau-vif)" : "var(--sauge)" }}
        />
        {deMoi ? "Vous" : partenaire.nom}
      </span>
    );
  };

  /* ================================================ Chargement */
  const signer = useCallback(
    (chemins: string[]) => {
      setUrls((deja) => {
        const manquants = chemins.filter((c) => c && !deja[c]);
        if (manquants.length) {
          supabase.storage
            .from("intimate")
            .createSignedUrls(manquants, 3600)
            .then(({ data }) => {
              if (!data) return;
              setUrls((p) => {
                const suite = { ...p };
                data.forEach((x) => {
                  if (x.signedUrl && x.path) suite[x.path] = x.signedUrl;
                });
                return suite;
              });
            });
        }
        return deja;
      });
    },
    [supabase]
  );

  const charger = useCallback(async () => {
    setChargement(true);
    const { data } = await supabase
      .from("journal_entries")
      .select("*")
      .eq("couple_id", coupleId)
      .order("jour", { ascending: false })
      .order("created_at", { ascending: false });
    const liste = (data ?? []) as Entree[];
    setEntrees(liste);
    signer(liste.map((e) => e.photo_path).filter(Boolean) as string[]);

    // Qui a lu quoi : une ligne par (page, lecteur). Ce qui m'intéresse,
    // c'est la lecture de l'autre sur mes pages, et la mienne sur les siennes.
    const { data: lus } = await supabase.from("journal_reads").select("entry_id, user_id, vu_le");
    const carte: Record<string, string> = {};
    (lus ?? []).forEach((r: { entry_id: string; user_id: string; vu_le: string }) => {
      carte[`${r.entry_id}:${r.user_id}`] = r.vu_le;
    });
    setLectures(carte);
    setChargement(false);
  }, [supabase, coupleId, signer]);

  /* Dernière connexion du/de la partenaire : le battement de cœur de
     l'app (ping_presence) tient profiles.last_active_at à jour. */
  const releverPresence = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("last_active_at")
      .eq("id", partenaire.id)
      .maybeSingle();
    setPartenaireActif((data as { last_active_at: string | null } | null)?.last_active_at ?? null);
    // Et les « vu » de l'autre, pour qu'ils apparaissent sans recharger.
    const { data: lus } = await supabase.from("journal_reads").select("entry_id, user_id, vu_le");
    if (lus) {
      const carte: Record<string, string> = {};
      lus.forEach((r: { entry_id: string; user_id: string; vu_le: string }) => {
        carte[`${r.entry_id}:${r.user_id}`] = r.vu_le;
      });
      setLectures(carte);
    }
    setTic(Date.now());
  }, [supabase, partenaire.id]);

  useEffect(() => {
    if (!ouvert) return;
    releverPresence();
    const t = setInterval(releverPresence, 30_000);
    return () => clearInterval(t);
  }, [ouvert, releverPresence]);

  /** Marquer « vu » quand j'ouvre une page de l'autre. */
  const marquerLu = useCallback(
    async (e: Entree) => {
      if (e.auteur === userId) return;
      const cle = `${e.id}:${userId}`;
      if (!lectures[cle]) setLectures((p) => ({ ...p, [cle]: new Date().toISOString() }));
      await supabase.rpc("journal_marquer_lu", { p_entry: e.id });
    },
    [supabase, userId, lectures]
  );

  const vuParAutre = (e: Entree) => lectures[`${e.id}:${partenaire.id}`] ?? null;
  const luParMoi = (e: Entree) => !!lectures[`${e.id}:${userId}`];
  const enLigne = !!partenaireActif && Date.now() - new Date(partenaireActif).getTime() < 60_000;

  const fermerTout = useCallback(() => {
    setEntrees([]);
    setUrls({});
    setLecture(null);
    // On ferme l'éditeur mais le brouillon reste en stockage local :
    // il sera rouvert au prochain déverrouillage.
    setEdition(null);
  }, []);

  const verifierSession = useCallback(async () => {
    const { data } = await supabase.rpc("journal_is_unlocked");
    const ok = data === true;
    setOuvert((avant) => {
      if (avant === true && !ok) fermerTout();
      return ok;
    });
    return ok;
  }, [supabase, fermerTout]);

  useEffect(() => {
    let vivant = true;
    (async () => {
      const ok = await verifierSession();
      if (ok && vivant) charger();
    })();
    const t = setInterval(verifierSession, 60_000);
    return () => {
      vivant = false;
      clearInterval(t);
    };
  }, [verifierSession, charger]);

  function armerMinuterie() {
    if (minuterieRef.current) clearTimeout(minuterieRef.current);
    minuterieRef.current = setTimeout(() => {
      setOuvert(false);
      fermerTout();
    }, DUREE_SESSION_MS);
  }
  useEffect(() => () => {
    if (minuterieRef.current) clearTimeout(minuterieRef.current);
  }, []);

  /* Tant que l'on écrit, la session ne doit pas expirer sous les doigts :
     chaque frappe réarme la minuterie locale, et on repousse la session
     serveur au plus toutes les 4 minutes (⚠ rpc sans .then ne part jamais). */
  const derniereProlongationRef = useRef(0);
  const signalerActivite = useCallback(() => {
    armerMinuterie();
    const t = Date.now();
    if (t - derniereProlongationRef.current > INTERVALLE_PROLONGATION_MS) {
      derniereProlongationRef.current = t;
      supabase.rpc("journal_prolonger").then(
        () => {},
        () => {}
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  /* Un brouillon conservé (rechargement, session expirée…) est rouvert
     dès que le journal est déverrouillé. */
  useEffect(() => {
    if (!ouvert) return;
    try {
      const brut = localStorage.getItem(cleStockage);
      if (!brut) return;
      const b = { ...brouillonVide(), ...(JSON.parse(brut) as Partial<Brouillon>) };
      if (estRempli(b)) setEdition((deja) => deja ?? b);
    } catch {
      /* stockage indisponible : tant pis */
    }
  }, [ouvert, cleStockage]);

  /* ================================================ Déverrouillage */
  const tenter = useCallback(
    async (code: string) => {
      setOccupe(true);
      setErreur(null);
      const { data, error } = await supabase.rpc("unlock_journal", { p_pin: code });
      setOccupe(false);
      setSaisie("");

      if (error) {
        setErreur(
          error.message.includes("NO_PIN")
            ? "Aucun code n'est défini. Rendez-vous dans Profil."
            : error.message
        );
        return;
      }
      const r = data as { ok: boolean; restant?: number; bloque_jusqua?: string };
      if (r.ok) {
        setBloqueJusqua(null);
        setOuvert(true);
        derniereProlongationRef.current = Date.now();
        armerMinuterie();
        charger();
      } else if (r.bloque_jusqua) {
        setBloqueJusqua(new Date(r.bloque_jusqua).getTime());
        setErreur("Trop d'essais. Réessayez dans 5 minutes.");
      } else {
        setErreur(`Code incorrect — ${r.restant} essai${(r.restant ?? 0) > 1 ? "s" : ""} avant blocage.`);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [supabase, charger]
  );

  useEffect(() => {
    if (saisie.length === 4 && !occupe) tenter(saisie);
  }, [saisie, occupe, tenter]);

  async function verrouiller() {
    await supabase.rpc("lock_journal");
    if (minuterieRef.current) clearTimeout(minuterieRef.current);
    setOuvert(false);
    fermerTout();
  }

  /* ================================================ Écriture */
  function nouvelleEntree() {
    setLecture(null);
    setEdition(brouillonVide());
  }

  function modifier(e: Entree) {
    setLecture(null);
    setEdition({
      id: e.id,
      jour: e.jour,
      titre: e.titre ?? "",
      contenu: e.contenu,
      heureux: e.heureux ?? "",
      triste: e.triste ?? "",
      humeur: e.humeur,
      meteo: e.meteo,
      tags: e.tags ?? [],
      favori: e.favori,
      photo_path: e.photo_path,
    });
  }

  const viderBrouillonStocke = useCallback(() => {
    try {
      localStorage.removeItem(cleStockage);
    } catch {
      /* rien */
    }
  }, [cleStockage]);

  const fermerEditeur = useCallback(() => {
    viderBrouillonStocke();
    setEdition(null);
  }, [viderBrouillonStocke]);

  /** Écrit la page en base. Retourne un message d'erreur, ou null si tout va bien. */
  const enregistrerEntree = useCallback(
    async (b: Brouillon): Promise<string | null> => {
      const ligne = {
        couple_id: coupleId,
        auteur: userId,
        jour: b.jour,
        titre: b.titre.trim() || null,
        contenu: b.contenu.trim(),
        heureux: b.heureux.trim() || null,
        triste: b.triste.trim() || null,
        humeur: b.humeur,
        meteo: b.meteo,
        tags: b.tags,
        favori: b.favori,
        photo_path: b.photo_path,
      };
      const { error } = b.id
        ? await supabase.from("journal_entries").update(ligne).eq("id", b.id)
        : await supabase.from("journal_entries").insert(ligne);
      if (error) return error.message;
      viderBrouillonStocke();
      setEdition(null);
      armerMinuterie();
      await charger();
      return null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [supabase, coupleId, userId, charger, viderBrouillonStocke]
  );

  const supprimerEntree = useCallback(
    async (id: string) => {
      const e = entrees.find((x) => x.id === id);
      if (e?.photo_path) await supabase.storage.from("intimate").remove([e.photo_path]);
      await supabase.from("journal_entries").delete().eq("id", id);
      setEntrees((p) => p.filter((x) => x.id !== id));
      setLecture(null);
      viderBrouillonStocke();
      setEdition(null);
    },
    [entrees, supabase, viderBrouillonStocke]
  );

  async function basculerFavori(e: Entree) {
    const v = !e.favori;
    setEntrees((p) => p.map((x) => (x.id === e.id ? { ...x, favori: v } : x)));
    setLecture((l) => (l && l.id === e.id ? { ...l, favori: v } : l));
    await supabase.from("journal_entries").update({ favori: v }).eq("id", e.id);
  }

  /* ================================================ Filtres */
  const tagsPopulaires = useMemo(() => {
    const compte = new Map<string, number>();
    entrees.forEach((e) => (e.tags ?? []).forEach((t) => compte.set(t, (compte.get(t) ?? 0) + 1)));
    return [...compte.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t]) => t);
  }, [entrees]);

  const moisDisponibles = useMemo(() => [...new Set(entrees.map((e) => cleMois(e.jour)))], [entrees]);

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return entrees.filter((e) => {
      if (filtreFavoris && !e.favori) return false;
      if (filtreTag && !(e.tags ?? []).includes(filtreTag)) return false;
      if (filtreMois && cleMois(e.jour) !== filtreMois) return false;
      if (q) {
        const meule = [e.titre, e.contenu, e.heureux, e.triste, ...(e.tags ?? [])].join(" ").toLowerCase();
        if (!meule.includes(q)) return false;
      }
      return true;
    });
  }, [entrees, recherche, filtreFavoris, filtreTag, filtreMois]);

  const groupes = useMemo(() => {
    const g: { mois: string; liste: Entree[] }[] = [];
    visibles.forEach((e) => {
      const m = cleMois(e.jour);
      const dernier = g[g.length - 1];
      if (dernier && dernier.mois === m) dernier.liste.push(e);
      else g.push({ mois: m, liste: [e] });
    });
    return g;
  }, [visibles]);

  const filtreActif = filtreFavoris || filtreTag || filtreMois || recherche.trim();

  /* ================================================ RENDU */

  if (ouvert === null) {
    return (
      <div className="journal grid place-items-center">
        <span className="coeur-chargeur" role="status" aria-label="Chargement">🖤</span>
      </div>
    );
  }

  /* ---------------------------------------------- Aucun code */
  if (!pinPose) {
    return (
      <div className="journal grid place-items-center px-8 text-center">
        <div className="mx-auto max-w-xs space-y-3">
          <span className="text-4xl">📔</span>
          <h1 className="font-display text-2xl">Le journal est fermé à clé</h1>
          <p className="text-sm leading-relaxed" style={{ color: "var(--encre-2)" }}>
            Choisissez d&apos;abord un code à 4 chiffres — différent de celui de la galerie.
            Il gardera vos confidences.
          </p>
          <Link href="/profil" className="j-btn mt-2">Définir le code</Link>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------- Écran de code */
  if (!ouvert) {
    const bloque = bloqueJusqua !== null && bloqueJusqua > Date.now();
    return (
      <div className="journal grid place-items-center px-6">
        <div className="w-full max-w-xs text-center">
          <span className="text-4xl">📔</span>
          <h1 className="mt-2 font-display text-2xl">Journal intime</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--encre-2)" }}>Entrez le code du journal</p>

          <div className="my-7 flex justify-center gap-4">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="h-3.5 w-3.5 rounded-full border transition"
                style={{
                  borderColor: i < saisie.length ? "var(--sceau-vif)" : "var(--encre-3)",
                  background: i < saisie.length ? "var(--sceau-vif)" : "transparent",
                }}
              />
            ))}
          </div>

          {erreur && <p className="mb-4 text-sm" style={{ color: "var(--sceau)" }}>{erreur}</p>}

          <div className="grid grid-cols-3 gap-3">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "←"].map((t, i) =>
              t === "" ? (
                <span key={i} />
              ) : (
                <button
                  key={i}
                  disabled={occupe || bloque}
                  onClick={() => setSaisie((s) => (t === "←" ? s.slice(0, -1) : s.length < 4 ? s + t : s))}
                  className="j-touche"
                >
                  {t}
                </button>
              )
            )}
          </div>

          <p className="mt-6 text-[11px] leading-relaxed" style={{ color: "var(--encre-3)" }}>
            Ce code n&apos;est pas celui de la galerie. Après 5 essais manqués, l&apos;accès se bloque 5 minutes.
          </p>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------- Journal ouvert */
  return (
    <div className="journal flex flex-col">
      {/* ---------------------------------------------- En-tête */}
      <header className="shrink-0 px-4 pt-3" style={{ borderBottom: "1px solid var(--ligne)" }}>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl leading-tight">Journal intime</h1>
            <p className="flex items-center gap-1.5 text-xs" style={{ color: "var(--encre-3)" }}>
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: enLigne ? "var(--sauge)" : "var(--encre-3)", boxShadow: enLigne ? "0 0 0 3px rgba(46,158,126,0.2)" : "none" }}
              />
              <span className="truncate">
                {partenaire.nom} · {enLigne ? "en ligne" : `vu·e ${depuis(partenaireActif, tic)}`}
              </span>
            </p>
          </div>
          <button
            onClick={() => {
              setRechercheOuverte((v) => !v);
              if (rechercheOuverte) setRecherche("");
            }}
            className="j-btn j-btn-doux h-10 w-10 !p-0"
            aria-label="Rechercher"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
            </svg>
          </button>
          <button onClick={verrouiller} className="j-btn j-btn-doux h-10 w-10 !p-0" aria-label="Verrouiller">🔒</button>
          <button onClick={nouvelleEntree} className="j-btn h-10 !px-4 text-sm">
            <span className="text-base leading-none">＋</span> Écrire
          </button>
        </div>

        {rechercheOuverte && (
          <div className="anim-monte mt-3">
            <input
              autoFocus
              className="j-champ"
              placeholder="Chercher un mot, un souvenir…"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
          </div>
        )}

        {/* Filtres */}
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-3" style={{ scrollbarWidth: "none" }}>
          <button className={`j-chip ${!filtreActif ? "j-chip-on" : ""}`} onClick={() => { setFiltreFavoris(false); setFiltreTag(null); setFiltreMois(null); setRecherche(""); }}>
            Tout
          </button>
          <button className={`j-chip ${filtreFavoris ? "j-chip-on" : ""}`} onClick={() => setFiltreFavoris((v) => !v)}>
            ★ Favoris
          </button>
          {moisDisponibles.length > 1 && (
            <select
              className="j-chip appearance-none"
              value={filtreMois ?? ""}
              onChange={(e) => setFiltreMois(e.target.value || null)}
            >
              <option value="">Tous les mois</option>
              {moisDisponibles.map((m) => (
                <option key={m} value={m}>{majuscule(fmtMois.format(dateLocale(m + "-01")))}</option>
              ))}
            </select>
          )}
          {tagsPopulaires.map((t) => (
            <button key={t} className={`j-chip ${filtreTag === t ? "j-chip-on" : ""}`} onClick={() => setFiltreTag((a) => (a === t ? null : t))}>
              #{t}
            </button>
          ))}
        </div>
      </header>

      {/* ---------------------------------------------- Pages */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
        {chargement && entrees.length === 0 && (
          <div className="vide">
            <span className="vide-emoji" style={{ animation: "pulse-doux 1.4s infinite" }}>📖</span>
            <p className="text-sm" style={{ color: "var(--encre-3)" }}>On tourne les pages…</p>
          </div>
        )}

        {!chargement && entrees.length === 0 && (
          <div className="vide anim-monte">
            <span className="vide-emoji">🪶</span>
            <p className="font-display text-2xl">Première page</p>
            <p className="max-w-[17rem] text-sm leading-relaxed" style={{ color: "var(--encre-2)" }}>
              Un endroit pour dire ce qui vous traverse — le beau, le lourd, le tendre.
              Rien ne quitte ce carnet.
            </p>
            <button onClick={nouvelleEntree} className="j-btn mt-2">Écrire aujourd&apos;hui</button>
          </div>
        )}

        {entrees.length > 0 && visibles.length === 0 && (
          <div className="vide anim-monte">
            <span className="vide-emoji">🔍</span>
            <p className="text-sm" style={{ color: "var(--encre-2)" }}>Rien ne correspond.</p>
          </div>
        )}

        {groupes.map((g) => (
          <section key={g.mois} className="mt-5">
            <h2 className="j-etiquette mb-2 px-1">{majuscule(fmtMois.format(dateLocale(g.mois + "-01")))}</h2>
            <div className="space-y-2.5">
              {g.liste.map((e) => {
                const d = dateLocale(e.jour);
                const meteo = METEO.find((m) => m.n === e.meteo);
                const extrait = (e.contenu || e.heureux || e.triste || "").replace(/\s+/g, " ").slice(0, 140);
                return (
                  <article key={e.id} className="j-carte rangee flex cursor-pointer gap-3 p-3" onClick={() => { setLecture(e); marquerLu(e); }}>
                    <div className="j-date shrink-0">
                      <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--encre-3)" }}>
                        {fmtJour.format(d).replace(".", "")}
                      </span>
                      <span className="font-display text-xl">{d.getDate()}</span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <h3 className="min-w-0 flex-1 truncate font-display text-lg leading-snug">
                          {e.titre || <span style={{ color: "var(--encre-2)" }}>Sans titre</span>}
                        </h3>
                        <span className="shrink-0 text-lg leading-none">
                          {e.humeur}{meteo ? meteo.icone : ""}
                        </span>
                      </div>
                      {extrait && (
                        <p className="mt-0.5 line-clamp-2 text-sm leading-relaxed" style={{ color: "var(--encre-2)" }}>
                          {extrait}
                        </p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Signature auteur={e.auteur} />
                        {e.auteur === userId ? (
                          vuParAutre(e) ? (
                            <span className="text-[10px]" style={{ color: "var(--sauge)" }} title={`Vu ${depuis(vuParAutre(e), tic)}`}>✓✓ vu</span>
                          ) : (
                            <span className="text-[10px]" style={{ color: "var(--encre-3)" }}>✓ pas encore lu</span>
                          )
                        ) : (
                          !luParMoi(e) && (
                            <span className="rounded-full px-1.5 text-[10px] font-semibold" style={{ background: "var(--sceau-vif)", color: "#fff" }}>nouveau</span>
                          )
                        )}
                        {e.favori && <span className="text-xs" style={{ color: "var(--sceau-vif)" }}>★</span>}
                        {e.photo_path && <span className="text-xs" style={{ color: "var(--encre-3)" }}>📷</span>}
                        {(e.tags ?? []).slice(0, 3).map((t) => (
                          <span key={t} className="text-[11px]" style={{ color: "var(--sauge)" }}>#{t}</span>
                        ))}
                      </div>
                    </div>

                    {e.photo_path && urls[e.photo_path] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={urls[e.photo_path]} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* ---------------------------------------------- Lecture */}
      {lecture && (
        <div className="j-voile journal">
          <header className="flex shrink-0 items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--ligne)" }}>
            <button onClick={() => setLecture(null)} className="j-btn j-btn-doux h-10 w-10 !p-0" aria-label="Retour">←</button>
            <div className="min-w-0 flex-1">
              <p className="j-etiquette truncate">{majuscule(fmtLong.format(dateLocale(lecture.jour)))}</p>
            </div>
            <button onClick={() => basculerFavori(lecture)} className="j-btn j-btn-doux h-10 w-10 !p-0" aria-label="Favori">
              <span style={{ color: lecture.favori ? "var(--sceau-vif)" : "var(--encre-3)" }}>{lecture.favori ? "★" : "☆"}</span>
            </button>
            {lecture.auteur === userId && (
              <button onClick={() => modifier(lecture)} className="j-btn j-btn-doux h-10 !px-3 text-sm">Modifier</button>
            )}
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-10 pt-5">
            <div className="mx-auto max-w-md">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h1 className="font-display text-3xl leading-tight">{lecture.titre || "Sans titre"}</h1>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Signature auteur={lecture.auteur} />
                    {lecture.auteur === userId && (
                      <span className="text-[11px]" style={{ color: vuParAutre(lecture) ? "var(--sauge)" : "var(--encre-3)" }}>
                        {vuParAutre(lecture)
                          ? `✓✓ Vu par ${partenaire.nom} ${depuis(vuParAutre(lecture), tic)}`
                          : `✓ ${partenaire.nom} n'a pas encore lu cette page`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                  {lecture.humeur && <span className="text-3xl leading-none">{lecture.humeur}</span>}
                  {lecture.meteo && (
                    <span className="text-xs" style={{ color: "var(--encre-2)" }}>
                      {METEO.find((m) => m.n === lecture.meteo)?.icone} {METEO.find((m) => m.n === lecture.meteo)?.nom}
                    </span>
                  )}
                </div>
              </div>

              {lecture.photo_path && urls[lecture.photo_path] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={urls[lecture.photo_path]} alt="" className="mt-5 w-full rounded-2xl object-cover" style={{ maxHeight: "22rem", border: "1px solid var(--ligne)" }} />
              )}

              {lecture.contenu && (
                <p className="mt-5 whitespace-pre-wrap text-[15px] leading-7">{lecture.contenu}</p>
              )}

              {(lecture.heureux || lecture.triste) && (
                <div className="mt-6 grid gap-3">
                  {lecture.heureux && (
                    <div className="rounded-2xl p-4" style={{ background: "rgba(46,158,126,0.10)", border: "1px solid rgba(46,158,126,0.25)" }}>
                      <p className="j-etiquette mb-1" style={{ color: "var(--sauge)" }}>☀️ Ce qui m&apos;a rendu·e heureux·se</p>
                      <p className="whitespace-pre-wrap text-sm leading-6">{lecture.heureux}</p>
                    </div>
                  )}
                  {lecture.triste && (
                    <div className="rounded-2xl p-4" style={{ background: "rgba(138,34,70,0.07)", border: "1px solid rgba(138,34,70,0.2)" }}>
                      <p className="j-etiquette mb-1" style={{ color: "var(--sceau)" }}>🌧️ Ce qui m&apos;a rendu·e triste</p>
                      <p className="whitespace-pre-wrap text-sm leading-6">{lecture.triste}</p>
                    </div>
                  )}
                </div>
              )}

              {(lecture.tags ?? []).length > 0 && (
                <div className="mt-6 flex flex-wrap gap-1.5">
                  {lecture.tags.map((t) => (
                    <button key={t} className="j-chip" onClick={() => { setFiltreTag(t); setLecture(null); }}>#{t}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------- Éditeur */}
      {edition && (
        <Editeur
          key={edition.id ?? "nouvelle-page"}
          initial={edition}
          coupleId={coupleId}
          userId={userId}
          supabase={supabase}
          urls={urls}
          signer={signer}
          cleStockage={cleStockage}
          onActivite={signalerActivite}
          onFermer={fermerEditeur}
          onEnregistrer={enregistrerEntree}
          onSupprimer={supprimerEntree}
        />
      )}
    </div>
  );
}

/* =====================================================================
   ÉDITEUR — composant séparé et mémoïsé : taper une lettre ne re-rend
   plus tout le journal (liste, filtres, en-tête), seulement cette page.
   Le brouillon est auto-sauvegardé en stockage local à chaque pause de
   frappe, puis restauré si la page se recharge ou si la session expire.
   ===================================================================== */
const Editeur = memo(function Editeur({
  initial,
  coupleId,
  userId,
  supabase,
  urls,
  signer,
  cleStockage,
  onActivite,
  onFermer,
  onEnregistrer,
  onSupprimer,
}: {
  initial: Brouillon;
  coupleId: string;
  userId: string;
  supabase: ReturnType<typeof createClient>;
  urls: Record<string, string>;
  signer: (chemins: string[]) => void;
  cleStockage: string;
  onActivite: () => void;
  onFermer: () => void;
  onEnregistrer: (b: Brouillon) => Promise<string | null>;
  onSupprimer: (id: string) => Promise<void>;
}) {
  const [brouillon, setBrouillon] = useState<Brouillon>(initial);
  const [tagSaisie, setTagSaisie] = useState("");
  const [confirmeSuppr, setConfirmeSuppr] = useState(false);
  const [confirmeAbandon, setConfirmeAbandon] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const fichierRef = useRef<HTMLInputElement>(null);
  const sauvegardeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rempli = estRempli(brouillon);

  /** Toute modification passe par ici : état local + signal d'activité. */
  const poser = (maj: Partial<Brouillon>) => {
    setBrouillon((b) => ({ ...b, ...maj }));
    onActivite();
  };

  /* Auto-sauvegarde du brouillon, 400 ms après la dernière frappe. */
  useEffect(() => {
    if (sauvegardeRef.current) clearTimeout(sauvegardeRef.current);
    sauvegardeRef.current = setTimeout(() => {
      try {
        if (estRempli(brouillon)) localStorage.setItem(cleStockage, JSON.stringify(brouillon));
        else localStorage.removeItem(cleStockage);
      } catch {
        /* stockage indisponible : tant pis */
      }
    }, 400);
    return () => {
      if (sauvegardeRef.current) clearTimeout(sauvegardeRef.current);
    };
  }, [brouillon, cleStockage]);

  const normaliserTag = (brut: string) => brut.trim().replace(/^#/, "").toLowerCase();

  function ajouterTag(brut: string) {
    const t = normaliserTag(brut);
    setTagSaisie("");
    if (!t) return;
    setBrouillon((b) => (b.tags.includes(t) ? b : { ...b, tags: [...b.tags, t] }));
    onActivite();
  }

  async function joindrePhoto(brut: File) {
    if (!brut.type.startsWith("image/")) return;
    setOccupe(true);
    const fichier = await compresserImage(brut, 1600, 0.8);
    const ext = fichier.name.split(".").pop()?.toLowerCase() || "jpg";
    const chemin = `${coupleId}/journal/${userId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("intimate").upload(chemin, fichier, { upsert: false });
    if (error) setErreur(error.message);
    else {
      const ancien = brouillon.photo_path;
      if (ancien) supabase.storage.from("intimate").remove([ancien]);
      poser({ photo_path: chemin });
      signer([chemin]);
    }
    setOccupe(false);
  }

  async function retirerPhoto() {
    if (!brouillon.photo_path) return;
    await supabase.storage.from("intimate").remove([brouillon.photo_path]);
    poser({ photo_path: null });
  }

  async function enregistrer() {
    if (!rempli || occupe) return;
    setOccupe(true);
    setErreur(null);
    let b = brouillon;
    const t = normaliserTag(tagSaisie);
    if (t && !b.tags.includes(t)) b = { ...b, tags: [...b.tags, t] };
    const message = await onEnregistrer(b);
    setOccupe(false);
    if (message) setErreur(message);
  }

  function abandonner() {
    if (rempli && !confirmeAbandon) {
      setConfirmeAbandon(true);
      return;
    }
    onFermer();
  }

  return (
    <div className="j-voile journal">
      <header className="flex shrink-0 items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--ligne)" }}>
        {confirmeAbandon ? (
          <div className="flex min-w-0 items-center gap-2">
            <button onClick={abandonner} className="j-btn j-btn-doux h-10 !px-3 text-sm" style={{ color: "var(--sceau)" }}>
              Abandonner la page
            </button>
            <button onClick={() => setConfirmeAbandon(false)} className="j-btn h-10 !px-3 text-sm">
              Continuer d&apos;écrire
            </button>
          </div>
        ) : (
          <button onClick={abandonner} className="j-btn j-btn-doux h-10 !px-3 text-sm">
            Annuler
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={() => poser({ favori: !brouillon.favori })}
          className="j-btn j-btn-doux h-10 w-10 !p-0"
          aria-label="Favori"
        >
          <span style={{ color: brouillon.favori ? "var(--sceau-vif)" : "var(--encre-3)" }}>{brouillon.favori ? "★" : "☆"}</span>
        </button>
        <button onClick={enregistrer} disabled={occupe || !rempli} className="j-btn h-10 !px-4 text-sm">
          {occupe ? "…" : "Enregistrer"}
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-16 pt-4">
        <div className="mx-auto max-w-md space-y-6">
          {/* Date */}
          <div className="flex items-center gap-3">
            <input
              type="date"
              className="j-champ w-auto text-sm"
              value={brouillon.jour}
              max={aujourdhui()}
              onChange={(e) => poser({ jour: e.target.value || aujourdhui() })}
            />
            <span className="text-xs" style={{ color: "var(--encre-3)" }}>
              {majuscule(fmtLong.format(dateLocale(brouillon.jour)))}
            </span>
          </div>

          {/* Humeur */}
          <div>
            <p className="j-etiquette mb-2">Humeur du moment</p>
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1" style={{ scrollbarWidth: "none" }}>
              {HUMEURS.map((h) => (
                <button
                  key={h}
                  onClick={() => poser({ humeur: brouillon.humeur === h ? null : h })}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-2xl transition"
                  style={{
                    background: brouillon.humeur === h ? "#fff" : "transparent",
                    border: `1px solid ${brouillon.humeur === h ? "var(--sceau-vif)" : "var(--ligne)"}`,
                    boxShadow: brouillon.humeur === h ? "0 0 0 3px rgba(196,53,99,0.16)" : "none",
                  }}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>

          {/* Météo intérieure */}
          <div>
            <p className="j-etiquette mb-2">Météo intérieure</p>
            <div className="grid grid-cols-5 gap-1.5">
              {METEO.map((m) => {
                const on = brouillon.meteo === m.n;
                return (
                  <button
                    key={m.n}
                    onClick={() => poser({ meteo: on ? null : m.n })}
                    className="flex flex-col items-center gap-1 rounded-xl py-2 transition"
                    style={{
                      background: on ? "var(--encre)" : "rgba(255,255,255,0.55)",
                      color: on ? "var(--papier)" : "var(--encre-2)",
                      border: `1px solid ${on ? "var(--encre)" : "var(--ligne)"}`,
                    }}
                  >
                    <span className="text-xl leading-none">{m.icone}</span>
                    <span className="text-[10px]">{m.nom}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Titre + texte */}
          <div>
            <input
              className="w-full bg-transparent font-display text-2xl outline-none"
              style={{ color: "var(--encre)" }}
              placeholder="Un titre, si le cœur vous en dit"
              value={brouillon.titre}
              onChange={(e) => poser({ titre: e.target.value })}
            />
            <AutoTexte
              className="j-champ j-cahier mt-3 w-full text-[15px]"
              placeholder="Cher journal…"
              valeur={brouillon.contenu}
              onValeur={(v) => poser({ contenu: v })}
            />
          </div>

          {/* Heureux / triste */}
          <div className="grid gap-3">
            <label className="block rounded-2xl p-3" style={{ background: "rgba(46,158,126,0.10)", border: "1px solid rgba(46,158,126,0.25)" }}>
              <span className="j-etiquette" style={{ color: "var(--sauge)" }}>☀️ Ce qui m&apos;a rendu·e heureux·se</span>
              <AutoTexte
                className="mt-1.5 w-full text-sm leading-6"
                style={{ minHeight: "3rem" }}
                placeholder="Un geste, une phrase, un moment…"
                valeur={brouillon.heureux}
                onValeur={(v) => poser({ heureux: v })}
              />
            </label>
            <label className="block rounded-2xl p-3" style={{ background: "rgba(138,34,70,0.07)", border: "1px solid rgba(138,34,70,0.2)" }}>
              <span className="j-etiquette" style={{ color: "var(--sceau)" }}>🌧️ Ce qui m&apos;a rendu·e triste</span>
              <AutoTexte
                className="mt-1.5 w-full text-sm leading-6"
                style={{ minHeight: "3rem" }}
                placeholder="Ce qui pèse, ce qui manque…"
                valeur={brouillon.triste}
                onValeur={(v) => poser({ triste: v })}
              />
            </label>
          </div>

          {/* Tags */}
          <div>
            <p className="j-etiquette mb-2">Étiquettes</p>
            <div className="flex flex-wrap gap-1.5">
              {brouillon.tags.map((t) => (
                <button key={t} className="j-chip" onClick={() => poser({ tags: brouillon.tags.filter((x) => x !== t) })}>
                  #{t} <span style={{ color: "var(--encre-3)" }}>×</span>
                </button>
              ))}
              <input
                className="j-chip min-w-[8rem] flex-1 outline-none"
                placeholder="#désir, #nous, #doute…"
                value={tagSaisie}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v.endsWith(",") || v.endsWith(" ")) ajouterTag(v.slice(0, -1));
                  else {
                    setTagSaisie(v);
                    onActivite();
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); ajouterTag(tagSaisie); }
                  if (e.key === "Backspace" && !tagSaisie && brouillon.tags.length)
                    poser({ tags: brouillon.tags.slice(0, -1) });
                }}
                onBlur={() => tagSaisie && ajouterTag(tagSaisie)}
              />
            </div>
          </div>

          {/* Photo */}
          <div>
            <p className="j-etiquette mb-2">Photo</p>
            {brouillon.photo_path ? (
              <div className="relative">
                {urls[brouillon.photo_path] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={urls[brouillon.photo_path]} alt="" className="w-full rounded-2xl object-cover" style={{ maxHeight: "18rem", border: "1px solid var(--ligne)" }} />
                ) : (
                  <div className="h-32 rounded-2xl" style={{ background: "var(--papier-3)" }} />
                )}
                <button onClick={retirerPhoto} className="j-btn j-btn-doux absolute right-2 top-2 h-9 !px-3 text-xs">Retirer</button>
              </div>
            ) : (
              <button
                onClick={() => fichierRef.current?.click()}
                disabled={occupe}
                className="j-btn j-btn-doux w-full py-4"
                style={{ borderStyle: "dashed" }}
              >
                📷 Joindre une image
              </button>
            )}
            <input
              ref={fichierRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) joindrePhoto(f);
                e.target.value = "";
              }}
            />
          </div>

          {erreur && <p className="text-sm" style={{ color: "var(--sceau)" }}>{erreur}</p>}

          {/* Suppression */}
          {brouillon.id && (
            <div className="pt-2 text-center">
              {confirmeSuppr ? (
                <div className="flex items-center justify-center gap-2">
                  <span className="text-sm" style={{ color: "var(--encre-2)" }}>Déchirer cette page ?</span>
                  <button
                    className="j-btn h-9 !px-3 text-xs"
                    disabled={occupe}
                    onClick={async () => {
                      setOccupe(true);
                      await onSupprimer(brouillon.id!);
                    }}
                  >
                    Oui, supprimer
                  </button>
                  <button className="j-btn j-btn-doux h-9 !px-3 text-xs" onClick={() => setConfirmeSuppr(false)}>Non</button>
                </div>
              ) : (
                <button className="text-xs underline-offset-2 hover:underline" style={{ color: "var(--encre-3)" }} onClick={() => setConfirmeSuppr(true)}>
                  Supprimer cette page
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
