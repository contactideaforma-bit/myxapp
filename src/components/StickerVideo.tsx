"use client";

import { useEffect, useRef, useState } from "react";

/* =====================================================================
   STICKER DEPUIS UNE VIDÉO — on fait défiler la vidéo, on choisit
   l'instant, et l'image capturée devient un sticker de la bibliothèque.
   Tout se passe dans le navigateur : la vidéo ne quitte pas l'appareil,
   seule l'image capturée est envoyée.
   ===================================================================== */

export default function StickerVideo({
  fichier,
  onCapture,
  onFermer,
}: {
  fichier: File;
  onCapture: (image: Blob) => void;
  onFermer: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [urlLocale] = useState(() => URL.createObjectURL(fichier));
  const [duree, setDuree] = useState(0);
  const [position, setPosition] = useState(0);
  const [occupe, setOccupe] = useState(false);
  /* Un seul seek à la fois : pendant que la vidéo cherche, on mémorise la
     dernière cible et on l'applique dès que « seeked » tombe. C'est ce qui
     supprime les à-coups quand on frotte le curseur. */
  const seekOccupeRef = useRef(false);
  const cibleRef = useRef<number | null>(null);

  useEffect(() => () => URL.revokeObjectURL(urlLocale), [urlLocale]);

  function poserTemps(v: HTMLVideoElement, t: number) {
    try {
      if (typeof v.fastSeek === "function") v.fastSeek(t);
      else v.currentTime = t;
    } catch {
      v.currentTime = t;
    }
  }

  function chercher(t: number) {
    setPosition(t);
    const v = videoRef.current;
    if (!v) return;
    if (seekOccupeRef.current) {
      cibleRef.current = t;
      return;
    }
    seekOccupeRef.current = true;
    poserTemps(v, t);
  }

  function surSeeked() {
    const v = videoRef.current;
    seekOccupeRef.current = false;
    if (v && cibleRef.current !== null) {
      const t = cibleRef.current;
      cibleRef.current = null;
      seekOccupeRef.current = true;
      poserTemps(v, t);
    }
  }

  function capturer() {
    const v = videoRef.current;
    if (!v || !v.videoWidth || occupe) return;
    setOccupe(true);
    // Carré centré, 512 px max — le format d'un sticker.
    const cote = Math.min(v.videoWidth, v.videoHeight);
    const taille = Math.min(512, cote);
    const canvas = document.createElement("canvas");
    canvas.width = taille;
    canvas.height = taille;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setOccupe(false);
      return;
    }
    ctx.drawImage(
      v,
      (v.videoWidth - cote) / 2,
      (v.videoHeight - cote) / 2,
      cote,
      cote,
      0,
      0,
      taille,
      taille
    );
    canvas.toBlob(
      (blob) => {
        if (blob) {
          setOccupe(false);
          onCapture(blob);
        } else {
          // webp non supporté (vieux Safari) : on retombe sur png.
          canvas.toBlob((png) => {
            setOccupe(false);
            if (png) onCapture(png);
          }, "image/png");
        }
      },
      "image/webp",
      0.85
    );
  }

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={onFermer}>
      <div
        className="w-full max-w-sm rounded-3xl border border-bord bg-velours p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-3 text-center text-sm text-brume">
          Faites défiler, choisissez l&apos;instant — on en fait un sticker.
        </p>
        <video
          ref={videoRef}
          src={urlLocale}
          playsInline
          muted
          preload="auto"
          onLoadedMetadata={(e) => {
            setDuree(e.currentTarget.duration || 0);
            chercher(0.1);
          }}
          onSeeked={surSeeked}
          className="max-h-[45dvh] w-full rounded-2xl border border-bord bg-black object-contain"
        />
        <div className="mt-3 flex items-center gap-3">
          <span
            className="w-10 shrink-0 text-right text-[11px] text-brume"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {fmt(position)}
          </span>
          <input
            type="range"
            min={0}
            max={duree || 0}
            step={0.04}
            value={position}
            onChange={(e) => chercher(Number(e.target.value))}
            className="w-full accent-[#C43563]"
          />
          <span
            className="w-10 shrink-0 text-[11px] text-brume"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {fmt(duree)}
          </span>
        </div>
        <div className="mt-4 flex gap-2">
          <button className="btn btn-fantome flex-1" onClick={onFermer}>
            Annuler
          </button>
          <button className="btn flex-1" disabled={occupe || !duree} onClick={capturer}>
            {occupe ? "…" : "📸 Capturer ce moment"}
          </button>
        </div>
      </div>
    </div>
  );
}
