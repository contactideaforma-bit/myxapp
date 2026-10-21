"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Rend ses enfants directement dans <body>.
 * Indispensable pour un panneau `position: fixed` déclenché depuis un parent
 * qui porte `backdrop-filter` / `transform` (en-tête, pied de page) : ces
 * propriétés font du parent le repère du `fixed`, et le panneau s'ouvre hors
 * champ. Rendu côté client uniquement (rien au SSR).
 */
export default function Portail({ children }: { children: ReactNode }) {
  const [monte, setMonte] = useState(false);
  useEffect(() => setMonte(true), []);
  if (!monte) return null;
  return createPortal(children, document.body);
}
