"use client";

import { useEffect, useState } from "react";

/**
 * Hauteur du clavier logiciel, en pixels.
 *
 * Sur iOS, l'ouverture du clavier ne change PAS window.innerHeight :
 * seule la « visual viewport » retrecit. C'est donc elle qu'il faut
 * ecouter pour savoir de combien la vue est amputee.
 */
export function useClavier() {
  const [hauteur, setHauteur] = useState(0);

  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;

    const majorer = () => {
      const cache = window.innerHeight - vv.height - vv.offsetTop;
      // En dessous de 80 px, c'est une barre d'outils, pas un clavier.
      setHauteur(cache > 80 ? Math.round(cache) : 0);
    };

    vv.addEventListener("resize", majorer);
    vv.addEventListener("scroll", majorer);
    majorer();

    return () => {
      vv.removeEventListener("resize", majorer);
      vv.removeEventListener("scroll", majorer);
    };
  }, []);

  return hauteur;
}
