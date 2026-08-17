"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** base64url → Uint8Array, format attendu par PushManager */
function cleVersOctets(base64: string) {
  const rembourrage = "=".repeat((4 - (base64.length % 4)) % 4);
  const propre = (base64 + rembourrage).replace(/-/g, "+").replace(/_/g, "/");
  const brut = atob(propre);
  return Uint8Array.from([...brut].map((c) => c.charCodeAt(0)));
}

export default function Notifications({
  userId,
  coupleId,
  styleInitial,
}: {
  userId: string;
  coupleId: string;
  styleInitial: string;
}) {
  const [supabase] = useState(() => createClient());
  const [supporte, setSupporte] = useState(true);
  const [actif, setActif] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [styleNotif, setStyleNotif] = useState(styleInitial);
  const [message, setMessage] = useState<string | null>(null);
  const [autonome, setAutonome] = useState(true);
  const [diag, setDiag] = useState<{
    battement: string | null;
    partenaire: boolean | null;
    erreur: string | null;
  } | null>(null);

  const cle = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  const etat = useCallback(async () => {
    if (typeof window === "undefined") return;
    const ok =
      "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupporte(ok);
    if (!ok) return;

    // iOS n'autorise le push que depuis une app ajoutée à l'écran d'accueil
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const installee =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    setAutonome(!iOS || installee);

    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    setActif(Boolean(sub) && Notification.permission === "granted");
  }, []);

  useEffect(() => {
    etat();
  }, [etat]);

  async function activer() {
    if (!cle) return setMessage("Clé publique VAPID absente (voir le README).");
    setOccupe(true);
    setMessage(null);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Autorisation refusée par le navigateur.");

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: cleVersOctets(cle),
      });

      const j = sub.toJSON() as { endpoint?: string; keys?: Record<string, string> };
      const { error } = await supabase.from("push_subscriptions").insert({
        user_id: userId,
        couple_id: coupleId,
        endpoint: j.endpoint,
        p256dh: j.keys?.p256dh,
        auth: j.keys?.auth,
        user_agent: navigator.userAgent.slice(0, 200),
      });
      if (error && !error.message.includes("duplicate")) throw error;

      setActif(true);
      setMessage("Cet appareil recevra les notifications.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Échec de l'activation.");
    }
    setOccupe(false);
  }

  async function desactiver() {
    setOccupe(true);
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
    setActif(false);
    setMessage("Notifications coupées sur cet appareil.");
    setOccupe(false);
  }

  /** Diagnostic : le battement de coeur arrive-t-il, et l'autre est-il vu ? */
  async function diagnostiquer() {
    setDiag(null);
    const [{ data: moi, error: e1 }, { data: actif, error: e2 }] = await Promise.all([
      supabase.from("profiles").select("last_active_at").eq("id", userId).maybeSingle(),
      supabase.rpc("partner_is_active"),
    ]);

    const erreur =
      e2?.message?.includes("does not exist") || e2?.message?.includes("PGRST202")
        ? "La fonction partner_is_active est absente : la migration 018 n'a pas été exécutée."
        : e2?.message ?? e1?.message ?? null;

    setDiag({
      battement: (moi as { last_active_at?: string } | null)?.last_active_at ?? null,
      partenaire: typeof actif === "boolean" ? actif : null,
      erreur,
    });
  }

  async function changerStyle(v: string) {
    setStyleNotif(v);
    await supabase.from("profiles").update({ notif_style: v }).eq("id", userId);
  }

  if (!supporte) {
    return (
      <section className="carte p-5">
        <h2 className="font-display text-xl">Notifications</h2>
        <p className="mt-2 text-sm text-brume">
          Ce navigateur ne les prend pas en charge.
        </p>
      </section>
    );
  }

  return (
    <section className="carte space-y-4 p-5">
      <h2 className="font-display text-xl">Notifications</h2>

      {!autonome && (
        <p className="rounded-xl border border-bordeaux bg-bordeaux/15 px-4 py-3 text-sm leading-relaxed text-orrose">
          Sur iPhone, il faut d&apos;abord ajouter l&apos;app à l&apos;écran
          d&apos;accueil : <b>Partager</b> → <b>Sur l&apos;écran d&apos;accueil</b>.
          Rouvrez-la depuis l&apos;icône, puis revenez ici.
        </p>
      )}

      <p className="text-sm leading-relaxed text-brume">
        Vous serez prévenu·e dès qu&apos;un message arrive, même app fermée.
        À activer sur chaque appareil.
      </p>

      <button
        className={`btn ${actif ? "btn-fantome" : ""}`}
        onClick={actif ? desactiver : activer}
        disabled={occupe || (!autonome && !actif)}
      >
        {occupe ? "…" : actif ? "✓ Actives sur cet appareil" : "Activer les notifications"}
      </button>

      <div>
        <p className="mb-2 text-xs uppercase tracking-widest text-brume">
          Ce qui s&apos;affiche sur l&apos;écran verrouillé
        </p>
        <div className="flex gap-2">
          {[
            { cle: "discret", label: "Discret", aide: "« Nouveau message »" },
            { cle: "apercu", label: "Aperçu", aide: "le début du texte" },
          ].map((o) => (
            <button
              key={o.cle}
              onClick={() => changerStyle(o.cle)}
              className={`flex-1 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                styleNotif === o.cle
                  ? "border-bordeaux-vif bg-bordeaux/25 text-orrose"
                  : "border-bord bg-velours-clair text-brume"
              }`}
            >
              <span className="block">{o.label}</span>
              <span className="block text-[10px] opacity-70">{o.aide}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-brume">
          C&apos;est <b>votre</b> réglage : il décide de ce que vous voyez, pas de ce
          que l&apos;autre envoie.
        </p>
      </div>

      {message && <p className="text-sm text-orrose">{message}</p>}

      {/* ---------------------------------------------- Diagnostic */}
      <div className="border-t border-bord pt-4">
        <button
          onClick={diagnostiquer}
          className="text-xs text-brume underline"
        >
          Vérifier pourquoi je reçois des notifications
        </button>

        {diag && (
          <div className="mt-3 space-y-1.5 rounded-xl border border-bord bg-velours-clair p-3 text-[11px] leading-relaxed">
            {diag.erreur ? (
              <p className="text-orrose">⚠ {diag.erreur}</p>
            ) : (
              <>
                <p>
                  <span className="text-brume">Mon battement : </span>
                  {diag.battement ? (
                    <span className="text-champagne">
                      il y a{" "}
                      {Math.round((Date.now() - new Date(diag.battement).getTime()) / 1000)} s
                    </span>
                  ) : (
                    <span className="text-orrose">jamais enregistré</span>
                  )}
                </p>
                <p>
                  <span className="text-brume">Partenaire vu récemment : </span>
                  <span className={diag.partenaire ? "text-champagne" : "text-orrose"}>
                    {diag.partenaire ? "oui — aucune notification ne partira" : "non"}
                  </span>
                </p>
                <p className="pt-1 text-brume">
                  Si « Mon battement » indique « jamais enregistré », la migration 018
                  n&apos;a pas été appliquée. S&apos;il indique plus de 60 s alors que
                  vous êtes sur cette page, le battement ne part pas.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
