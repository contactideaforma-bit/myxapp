"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useClavier } from "@/lib/useClavier";

const ONGLETS = [
  { href: "/chat", label: "Nous", icone: "bulle" },
  { href: "/galerie", label: "Galerie", icone: "image" },
  { href: "/jeux", label: "Jeux", icone: "de" },
  { href: "/idees", label: "Idées", icone: "etincelle" },
  { href: "/profil", label: "Profil", icone: "profil" },
] as const;

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

  const clavierOuvert = clavier > 0 || saisie;

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
      <main className={`min-h-0 flex-1 ${plein ? "" : "overflow-y-auto"}`}>
        {children}
      </main>

      {!clavierOuvert && (
      <nav className="shrink-0 border-t border-bord bg-velours/95 backdrop-blur">
        <ul className="mx-auto flex max-w-md">
          {ONGLETS.map((o) => {
            const actif = chemin === o.href;
            return (
              <li key={o.href} className="flex-1">
                <Link
                  href={o.href}
                  className={`flex flex-col items-center gap-1 py-2.5 transition ${
                    actif ? "text-orrose" : "text-brume hover:text-champagne"
                  }`}
                >
                  <Icone nom={o.icone} actif={actif} />
                  <span className="text-[10px] tracking-wide">{o.label}</span>
                  <span
                    className={`h-0.5 w-6 rounded-full transition ${
                      actif ? "bg-bordeaux-vif" : "bg-transparent"
                    }`}
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
