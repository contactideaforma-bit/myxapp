"use client";

import { useEffect, useRef, useState } from "react";

/* =====================================================================
   STICKER DEPUIS UNE VIDÉO — on fait défiler, on choisit l'instant :
   · « GIF 5 s » capture 2,5 s AVANT et 2,5 s APRÈS l'instant choisi,
     en réenregistrant les images sur un canvas carré (captureStream +
     MediaRecorder) — le sticker animé se jouera en boucle, sans son.
   · « Photo » capture l'image seule (carré 512, webp, repli png).
   Tout se passe dans le navigateur : la vidéo source ne quitte jamais
   l'appareil, seule la capture est envoyée.
   ===================================================================== */

const CLIP_S = 5;

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
  const [enregistre, setEnregistre] = useState(false);
  const [progres, setProgres] = useState(0);

  /* Un seul seek à la fois : pendant que la vidéo cherche, on mémorise
     la dernière cible et on l'applique dès que « seeked » tombe. */
  const seekOccupeRef = useRef(false);
  const cibleRef = useRef<number | null>(null);
  const rafRef = useRef(0);
  const recRef = useRef<MediaRecorder | null>(null);

  const clipPossible =
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function";

  useEffect(
    () => () => {
      URL.revokeObjectURL(urlLocale);
      cancelAnimationFrame(rafRef.current);
      try {
        if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
      } catch {
        /* rien */
      }
    },
    [urlLocale]
  );

  function poserTemps(v: HTMLVideoElement, t: number) {
    try {
      if (typeof v.fastSeek === "function") v.fastSeek(t);
      else v.currentTime = t;
    } catch {
      v.currentTime = t;
    }
  }

  function chercher(t: number) {
    if (enregistre) return;
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
    if (v && cibleRef.current !== null && !enregistre) {
      const t = cibleRef.current;
      cibleRef.current = null;
      seekOccupeRef.current = true;
      poserTemps(v, t);
    }
  }

  /* ------------------------------------------------ Canvas carré */
  function preparerCanvas(v: HTMLVideoElement, taille: number) {
    const cote = Math.min(v.videoWidth, v.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = taille;
    canvas.height = taille;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const dessiner = () =>
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
    return { canvas, dessiner };
  }

  /* ------------------------------------------------ Photo */
  function capturerPhoto() {
    const v = videoRef.current;
    if (!v || !v.videoWidth || occupe || enregistre) return;
    setOccupe(true);
    const prep = preparerCanvas(v, Math.min(512, Math.min(v.videoWidth, v.videoHeight)));
    if (!prep) {
      setOccupe(false);
      return;
    }
    prep.dessiner();
    prep.canvas.toBlob(
      (blob) => {
        if (blob) {
          setOccupe(false);
          onCapture(blob);
        } else {
          // webp non supporté (vieux Safari) : on retombe sur png.
          prep.canvas.toBlob((png) => {
            setOccupe(false);
            if (png) onCapture(png);
          }, "image/png");
        }
      },
      "image/webp",
      0.85
    );
  }

  /* ------------------------------------------------ GIF 5 s */
  function capturerClip() {
    const v = videoRef.current;
    if (!v || !v.videoWidth || occupe || enregistre || !duree) return;

    // 2,5 s avant, 2,5 s après — recalé aux bords de la vidéo.
    const finVoulue = Math.min(duree, position + CLIP_S / 2);
    const debut = Math.max(0, finVoulue - CLIP_S);
    const fin = Math.min(duree, debut + CLIP_S);

    const prep = preparerCanvas(v, Math.min(480, Math.min(v.videoWidth, v.videoHeight)));
    if (!prep) return;

    const flux = prep.canvas.captureStream(30);
    const type = ["video/webm;codecs=vp9", "video/webm", "video/mp4"].find((t) =>
      MediaRecorder.isTypeSupported(t)
    );
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(flux, { mimeType: type, videoBitsPerSecond: 1_200_000 });
    } catch {
      capturerPhoto(); // impossible d'enregistrer : au moins l'image
      return;
    }

    const morceaux: BlobPart[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) morceaux.push(e.data);
    };
    rec.onstop = () => {
      cancelAnimationFrame(rafRef.current);
      v.pause();
      setEnregistre(false);
      setProgres(0);
      const blob = new Blob(morceaux, { type: rec.mimeType || "video/webm" });
      if (blob.size) onCapture(blob);
    };
    recRef.current = rec;
    setEnregistre(true);
    setProgres(0);

    const boucle = () => {
      prep.dessiner();
      setProgres(Math.min(1, (v.currentTime - debut) / Math.max(0.2, fin - debut)));
      if (v.currentTime >= fin - 0.05 || v.ended) {
        if (rec.state !== "inactive") rec.stop();
      } else {
        rafRef.current = requestAnimationFrame(boucle);
      }
    };

    const demarrer = () => {
      v.removeEventListener("seeked", demarrer);
      v.play()
        .then(() => {
          rec.start();
          rafRef.current = requestAnimationFrame(boucle);
        })
        .catch(() => setEnregistre(false));
    };
    v.addEventListener("seeked", demarrer);
    v.currentTime = debut;
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
          {enregistre
            ? "Capture en cours — on garde 2,5 s avant et après…"
            : "Choisissez l'instant : le sticker gardera 5 secondes autour."}
        </p>
        <div className="relative">
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
          {enregistre && (
            <div className="absolute inset-x-3 bottom-3 h-1.5 overflow-hidden rounded-full bg-black/50">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.round(progres * 100)}%`, background: "var(--color-bordeaux-vif)" }}
              />
            </div>
          )}
        </div>
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
            disabled={enregistre}
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
          <button className="btn btn-fantome" disabled={enregistre} onClick={onFermer}>
            Annuler
          </button>
          <button
            className="btn btn-fantome flex-1"
            disabled={occupe || enregistre || !duree}
            onClick={capturerPhoto}
          >
            📷 Photo
          </button>
          {clipPossible && (
            <button
              className="btn flex-1"
              disabled={occupe || enregistre || !duree}
              onClick={capturerClip}
            >
              {enregistre ? "●" : "🎬 GIF 5 s"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
