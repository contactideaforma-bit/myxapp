"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useClavier } from "@/lib/useClavier";
import { createClient } from "@/lib/supabase/client";

/* Les onglets marqués `masque` restent codés et joignables par leur URL,
   mais n'apparaissent pas dans la barre — en attendant d'être vraiment
   développés. Pour les rendre visibles : retirer `masque: true`. */
const ONGLETS = [
  { href: "/chat", label: "Nous", icone: "bulle", accent: "var(--color-bordeaux-vif)", halo: "rgba(196,53,99,0.28)" },
  { href: "/galerie", label: "Galerie", icone: "image", accent: "var(--color-amethyste)", halo: "rgba(168,107,216,0.26)" },
  { href: "/intime", label: "Intime", icone: "flamme", accent: "var(--color-fuchsia)", halo: "rgba(255,77,141,0.26)" },
  { href: "/jeux", label: "Jeux", icone: "de", accent: "var(--color-ambre)", halo: "rgba(245,166,91,0.22)", masque: true },
  { href: "/idees", label: "Idées", icone: "etincelle", accent: "var(--color-cyan)", halo: "rgba(91,214,232,0.20)", masque: true },
  { href: "/journal", label: "Journal", icone: "plume", accent: "var(--color-menthe)", halo: "rgba(61,214,160,0.20)" },
  { href: "/profil", label: "Profil", icone: "profil", accent: "var(--color-orrose)", halo: "rgba(240,188,168,0.18)" },
] as const;

type Onglet = (typeof ONGLETS)[number];
const VISIBLES = ONGLETS.filter((o) => !("masque" in o && o.masque)) as readonly Onglet[];

function Icone({ nom, actif }: { nom: string; actif: boolean }) {
  const commun = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: actif ? 2 : 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (nom) {
    case "bulle":
      return (
        <svg {...commun}>
          <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.9 9.9 0 0 1-3.2-.5L3 21l1.7-4.6A8.2 8.2 0 0 1 3.6 11.5 8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4Z" />
        </svg>
      );
    case "image":
      return (
        <svg {...commun}>
          <rect x="3" y="4" width="18" height="16" rx="3" />
          <circle cx="8.5" cy="9.5" r="1.5" />
          <path d="m3 16 4.5-4.5a2 2 0 0 1 2.8 0L21 20" />
        </svg>
      );
    case "flamme":
      return (
        <svg {...commun}>
          <path d="M12 3c3 3.5 1 5 2.5 7 1.3 1.7 4.5 2.5 4.5 6.5a7 7 0 0 1-14 0c0-4 3.2-4.8 4.5-6.5C11 8 9 6.5 12 3Z" />
        </svg>
      );
    case "de":
      return (
        <svg {...commun}>
          <rect x="3" y="3" width="18" height="18" rx="4" />
          <circle cx="8.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="15.5" cy="15.5" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "etincelle":
      return (
        <svg {...commun}>
          <path d="M12 3v4M12 17v4M4.5 12h-1.5M21 12h-1.5M6.5 6.5 5.4 5.4M18.6 18.6l-1.1-1.1M6.5 17.5 5.4 18.6M18.6 5.4l-1.1 1.1" />
          <circle cx="12" cy="12" r="3.6" />
        </svg>
      );
    case "plume":
      return (
        <svg {...commun}>
          <path d="M20 4c-6 0-11 3-13 9l-3 7 7-3c6-2 9-7 9-13Z" />
          <path d="M4 20 13 11" />
        </svg>
      );
    default:
      return (
        <svg {...commun}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
        </svg>
      );
  }
}

export default function AppShell({
  children,
  plein = false,
}: {
  children: React.ReactNode;
  plein?: boolean;
}) {
  const chemin = usePathname();
  const clavier = useClavier();
  const [saisie, setSaisie] = useState(false);

  /* Second signal, plus fiable qu'un calcul de viewport sur iOS :
     des qu'un champ texte a le focus, on considere que le clavier est la. */
  useEffect(() => {
    const estChampTexte = (c: EventTarget | null) => {
      const el = c as HTMLElement | null;
      if (!el) return false;
      const t = el.tagName;
      return t === "TEXTAREA" || (t === "INPUT" && !["checkbox", "radio", "range", "file", "button", "submit"].includes((el as HTMLInputElement).type));
    };
    const entree = (e: FocusEvent) => estChampTexte(e.target) && setSaisie(true);
    const sortie = () => setTimeout(() => {
      const a = document.activeElement;
      setSaisie(estChampTexte(a));
    }, 60);

    document.addEventListener("focusin", entree);
    document.addEventListener("focusout", sortie);
    return () => {
      document.removeEventListener("focusin", entree);
      document.removeEventListener("focusout", sortie);
    };
  }, []);

  /* Battement de coeur : tant qu'une page de l'app est visible, on le dit
     au serveur. C'est ce qui empeche les notifications inutiles. */
  useEffect(() => {
    const supabase = createClient();
    let vivant = true;

    const battre = () => {
      if (!vivant || document.visibilityState !== "visible") return;
      void supabase.rpc("ping_presence").then(() => {});
    };

    battre();
    const t = setInterval(battre, 25_000);
    document.addEventListener("visibilitychange", battre);

    return () => {
      vivant = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", battre);
    };
  }, []);

  const clavierOuvert = clavier > 0 || saisie;
  const actuel = ONGLETS.find((o) => chemin === o.href) ?? ONGLETS[0];
  const [nouveautes, setNouveautes] = useState<Record<string, number>>({});

  /* Pastilles : ce que l'autre a produit depuis ma dernière visite. */
  useEffect(() => {
    const supabase = createClient();
    let vivant = true;

    const relever = async () => {
      const { data } = await supabase.rpc("nouveautes");
      if (vivant && data) setNouveautes(data as Record<string, number>);
    };

    // Entrer dans une rubrique la marque comme vue.
    const rubrique = chemin.replace("/", "");
    if (["galerie", "intime", "jeux", "idees", "journal"].includes(rubrique)) {
      supabase
        .rpc("marquer_vu", { p_rubrique: rubrique })
        .then(() => relever());
    } else {
      relever();
    }

    const t = setInterval(relever, 30_000);
    return () => {
      vivant = false;
      clearInterval(t);
    };
  }, [chemin]);

  /* La teinte du halo suit la section : l'app change d'ambiance d'un
     onglet à l'autre sans jamais sortir de la charte. */
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty("--accent", actuel.accent);
    r.style.setProperty("--halo-1", actuel.halo);
  }, [actuel]);

  return (
    <div
      className="flex flex-col"
      style={{
        // Quand le clavier est ouvert, la vue se limite a ce qui reste
        // visible : plus rien ne se cache derriere.
        height: clavier ? `calc(100dvh - ${clavier}px)` : "100dvh",
        transition: "height 0.18s ease-out",
      }}
    >
      <main
        key={chemin}
        className={`anim-monte min-h-0 flex-1 ${plein ? "" : "overflow-y-auto"}`}
      >
        {children}
      </main>

      {!clavierOuvert && (
      <nav className="shrink-0 border-t border-bord bg-velours/95 backdrop-blur">
        <ul className="mx-auto flex max-w-md">
          {VISIBLES.map((o) => {
            const actif = chemin === o.href;
            return (
              <li key={o.href} className="flex-1">
                <Link
                  href={o.href}
                  className="relative flex flex-col items-center gap-1 py-2.5 transition"
                  style={{ color: actif ? o.accent : undefined }}
                >
                  <span className={`relative ${actif ? "" : "text-brume"}`}>
                    <Icone nom={o.icone} actif={actif} />
                    {(() => {
                      const n = nouveautes[o.href.replace("/", "")] ?? 0;
                      if (!n || actif) return null;
                      return <span className="pastille">{n > 9 ? "9+" : n}</span>;
                    })()}
                  </span>
                  <span
                    className={`text-[10px] tracking-wide ${actif ? "" : "text-brume"}`}
                  >
                    {o.label}
                  </span>
                  <span
                    className="h-0.5 w-6 rounded-full transition"
                    style={{ background: actif ? o.accent : "transparent" }}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
      )}
    </div>
  );
}
