"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Message, Profile } from "@/lib/types";
import ImageMessage from "./ImageMessage";
import PanicOverlay from "./PanicOverlay";
import GifPicker from "./GifPicker";

const DUREES = [
  { label: "∞", valeur: 0 },
  { label: "1 min", valeur: 60 },
  { label: "10 min", valeur: 600 },
  { label: "1 h", valeur: 3600 },
];

export default function ChatRoom({
  coupleId,
  userId,
  partner,
  monPrenom,
  messagesInitiaux,
}: {
  coupleId: string;
  userId: string;
  partner: Profile;
  monPrenom: string;
  messagesInitiaux: Message[];
}) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [messages, setMessages] = useState<Message[]>(messagesInitiaux);
  const [texte, setTexte] = useState("");
  const [duree, setDuree] = useState(0);
  const [vueUnique, setVueUnique] = useState(false);
  const [partenaireEcrit, setPartenaireEcrit] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [discret, setDiscret] = useState(false);
  const [maintenant, setMaintenant] = useState(() => Date.now());

  const [actionSur, setActionSur] = useState<Message | null>(null);
  const [confirmerVidage, setConfirmerVidage] = useState(false);
  const [pickerOuvert, setPickerOuvert] = useState(false);

  const finRef = useRef<HTMLDivElement>(null);
  const fichierRef = useRef<HTMLInputElement>(null);
  const canalRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const dernierTypingRef = useRef(0);
  const zoneRef = useRef<HTMLTextAreaElement>(null);

  /* ------------------------------------------------ Horloge (éphémères)
     Elle ne tourne QUE s'il existe au moins un message a duree limitee.
     Sinon on re-rendait toute la conversation chaque seconde pour rien. */
  const aDesEphemeres = useMemo(
    () => messages.some((m) => m.expires_at),
    [messages]
  );

  useEffect(() => {
    if (!aDesEphemeres) return;
    const t = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(t);
  }, [aDesEphemeres]);

  const visibles = useMemo(
    () =>
      messages.filter(
        (m) => !m.expires_at || new Date(m.expires_at).getTime() > maintenant
      ),
    [messages, maintenant]
  );

  /* ------------------------------------------------ Temps réel */
  useEffect(() => {
    const canal = supabase
      .channel(`chat-${coupleId}`, { config: { broadcast: { self: false } } })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `couple_id=eq.${coupleId}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.sender_id !== userId) {
            setPartenaireEcrit(false);
            supabase.rpc("mark_read");
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `couple_id=eq.${coupleId}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages" },
        (payload) => {
          const ancien = payload.old as Partial<Message>;
          if (!ancien?.id) return;
          setMessages((prev) => prev.filter((x) => x.id !== ancien.id));
        }
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload?.from === userId) return;
        setPartenaireEcrit(true);
        setTimeout(() => setPartenaireEcrit(false), 2500);
      })
      .subscribe();

    canalRef.current = canal;
    supabase.rpc("mark_read");

    return () => {
      supabase.removeChannel(canal);
      canalRef.current = null;
    };
  }, [supabase, coupleId, userId]);

  /* ------------------------------------------------ Purge des expirés */
  useEffect(() => {
    supabase.rpc("purge_expired");
    const t = setInterval(() => supabase.rpc("purge_expired"), 300_000);
    return () => clearInterval(t);
  }, [supabase]);

  /* ------------------------------------------------ Défilement auto */
  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibles.length, partenaireEcrit]);

  /* ------------------------------------------------ Mode discret */
  useEffect(() => {
    function surTouche(e: KeyboardEvent) {
      if (e.key === "Escape") setDiscret(true);
    }
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, []);

  /* ------------------------------------------------ Actions */
  /** Le champ grandit avec le texte, jusqu'a 6 lignes. */
  function ajusterHauteur() {
    const el = zoneRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
  }

  useEffect(() => {
    ajusterHauteur();
  }, [texte]);

  const signalerFrappe = useCallback(() => {
    const now = Date.now();
    if (now - dernierTypingRef.current < 1500) return;
    dernierTypingRef.current = now;
    canalRef.current?.send({ type: "broadcast", event: "typing", payload: { from: userId } });
  }, [userId]);

  /** Previens l'autre. Sans bloquer l'envoi si le push echoue. */
  function prevenir(genre: string, apercu = "") {
    fetch("/api/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ genre, apercu, prenom: monPrenom }),
    }).catch(() => {});
  }

  function calculerExpiration() {
    return duree > 0 ? new Date(Date.now() + duree * 1000).toISOString() : null;
  }

  async function envoyerTexte(e: React.FormEvent) {
    e.preventDefault();
    const corps = texte.trim();
    if (!corps || envoi) return;
    setEnvoi(true);
    setTexte("");

    const { data, error } = await supabase
      .from("messages")
      .insert({
        couple_id: coupleId,
        sender_id: userId,
        kind: "text",
        body: corps,
        expires_at: calculerExpiration(),
      })
      .select()
      .single();

    if (!error && data) {
      setMessages((prev) =>
        prev.some((x) => x.id === data.id) ? prev : [...prev, data as Message]
      );
      prevenir("message", corps);
    }
    setEnvoi(false);
  }

  async function envoyerImage(fichier: File) {
    if (!fichier.type.startsWith("image/")) return;
    setEnvoi(true);

    const ext = fichier.name.split(".").pop()?.toLowerCase() || "jpg";
    const chemin = `${coupleId}/${userId}-${Date.now()}.${ext}`;

    const { error: errUp } = await supabase.storage
      .from("intimate")
      .upload(chemin, fichier, { cacheControl: "0", upsert: false });

    if (!errUp) {
      const { data } = await supabase
        .from("messages")
        .insert({
          couple_id: coupleId,
          sender_id: userId,
          kind: "image",
          storage_path: chemin,
          view_once: vueUnique,
          expires_at: calculerExpiration(),
        })
        .select()
        .single();

      if (data) {
        setMessages((prev) =>
          prev.some((x) => x.id === data.id) ? prev : [...prev, data as Message]
        );
        prevenir("photo");
      }
    }
    setEnvoi(false);
  }

  async function envoyerGiphy(url: string) {
    setPickerOuvert(false);
    const { data } = await supabase
      .from("messages")
      .insert({
        couple_id: coupleId,
        sender_id: userId,
        kind: "gif",
        body: url,
        expires_at: calculerExpiration(),
      })
      .select()
      .single();
    if (data) {
      setMessages((prev) =>
        prev.some((x) => x.id === data.id) ? prev : [...prev, data as Message]
      );
      prevenir("gif");
    }
  }

  async function envoyerSticker(chemin: string) {
    setPickerOuvert(false);
    const { data } = await supabase
      .from("messages")
      .insert({
        couple_id: coupleId,
        sender_id: userId,
        kind: "image",
        storage_path: chemin,
        expires_at: calculerExpiration(),
      })
      .select()
      .single();
    if (data) {
      setMessages((prev) =>
        prev.some((x) => x.id === data.id) ? prev : [...prev, data as Message]
      );
      prevenir("photo");
    }
  }

  async function marquerOuverte(id: string) {
    await supabase.rpc("open_view_once", { p_message_id: id });
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, opened_at: new Date().toISOString() } : m))
    );
  }

  async function supprimer(m: Message) {
    setActionSur(null);
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
    if (m.kind === "image" && m.storage_path) {
      await supabase.storage.from("intimate").remove([m.storage_path]);
    }
    await supabase.from("messages").delete().eq("id", m.id);
  }

  async function viderConversation() {
    setConfirmerVidage(false);
    const chemins = messages
      .filter((m) => m.kind === "image" && m.storage_path)
      .map((m) => m.storage_path as string);
    setMessages([]);
    if (chemins.length) await supabase.storage.from("intimate").remove(chemins);
    await supabase.rpc("clear_conversation");
  }

  async function deconnexion() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  /* ------------------------------------------------ Rendu */
  if (discret) return <PanicOverlay onExit={() => setDiscret(false)} />;

  return (
    <div className="flex h-full flex-col">
      {/* EN-TÊTE */}
      <header className="flex shrink-0 items-center gap-3 border-b border-bord bg-velours/80 px-4 py-3 backdrop-blur">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-bordeaux to-bordeaux-vif text-lg">
          {partner.emoji || "🔥"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg leading-tight">{partner.display_name}</p>
          <p className="text-xs text-brume">
            {partenaireEcrit ? <span className="text-orrose">écrit…</span> : "Lié·e·s"}
          </p>
        </div>
        <button
          onClick={() => setConfirmerVidage(true)}
          title="Vider la conversation"
          className="rounded-lg border border-bord px-2.5 py-1.5 text-xs text-brume transition hover:border-bordeaux-vif"
        >
          🗑
        </button>
        <button
          onClick={() => setDiscret(true)}
          title="Mode discret (Échap)"
          className="rounded-lg border border-bord px-3 py-1.5 text-xs text-brume transition hover:border-bordeaux-vif hover:text-orrose"
        >
          👁️
        </button>
        <button
          onClick={deconnexion}
          title="Se déconnecter"
          className="rounded-lg border border-bord px-2.5 py-1.5 text-xs text-brume"
        >
          ⏻
        </button>
      </header>

      {/* FIL */}
      <main className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-6">
        {visibles.length === 0 && (
          <div className="mx-auto mt-16 max-w-xs text-center">
            <p className="font-display text-2xl text-orrose">Le silence…</p>
            <p className="mt-2 text-sm text-brume">
              Brisez-le. Le premier mot vous appartient.
            </p>
          </div>
        )}

        {visibles.map((m) => {
          const estMoi = m.sender_id === userId;
          const restant = m.expires_at
            ? Math.max(0, Math.ceil((new Date(m.expires_at).getTime() - maintenant) / 1000))
            : null;

          return (
            <div
              key={m.id}
              className={`anim-monte flex w-full flex-col ${
                estMoi ? "items-end" : "items-start"
              }`}
            >
              <div
                onClick={() => estMoi && setActionSur(m)}
                className={`max-w-[85%] ${estMoi ? "cursor-pointer" : ""}`}
              >
                {m.kind === "gif" && m.body ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.body}
                    alt=""
                    draggable={false}
                    className="max-h-64 w-56 rounded-bulle border border-bord object-cover"
                  />
                ) : m.kind === "image" ? (
                  <ImageMessage message={m} estMoi={estMoi} onOuvrir={marquerOuverte} />
                ) : (
                  <div
                    className={`w-fit whitespace-pre-wrap rounded-bulle px-4 py-2.5 text-[15px] leading-relaxed [overflow-wrap:anywhere] ${
                      estMoi
                        ? "bg-gradient-to-br from-bordeaux to-bordeaux-vif text-white"
                        : "border border-bord bg-velours-clair text-champagne"
                    }`}
                  >
                    {m.body}
                  </div>
                )}
              </div>

              <div className="mt-1 flex items-center gap-1.5 px-1 text-[10px] text-brume">
                <span>
                  {new Date(m.created_at).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {restant !== null && <span>· ⏳ {formaterDuree(restant)}</span>}
                {m.view_once && <span>· 🔥</span>}
                {estMoi && (
                  <span
                    className={m.read_at ? "text-orrose" : "text-brume"}
                    title={m.read_at ? "Vu" : "Envoyé"}
                  >
                    · {m.read_at ? "✓✓ Vu" : "✓ Envoyé"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        <div ref={finRef} />
      </main>

      {/* COMPOSITEUR */}
      <footer className="shrink-0 border-t border-bord bg-velours/90 px-3 py-3 backdrop-blur">
        <div className="mb-2 flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="shrink-0 text-brume">Durée</span>
          {DUREES.map((d) => (
            <button
              key={d.valeur}
              onClick={() => setDuree(d.valeur)}
              className={`shrink-0 rounded-full border px-3 py-1 transition ${
                duree === d.valeur
                  ? "border-bordeaux-vif bg-bordeaux/30 text-orrose"
                  : "border-bord text-brume"
              }`}
            >
              {d.label}
            </button>
          ))}
          <span className="ml-2 h-4 w-px shrink-0 bg-bord" />
          <button
            onClick={() => setVueUnique((v) => !v)}
            className={`shrink-0 rounded-full border px-3 py-1 transition ${
              vueUnique
                ? "border-bordeaux-vif bg-bordeaux/30 text-orrose"
                : "border-bord text-brume"
            }`}
          >
            🔥 Photo vue unique
          </button>
        </div>

        <form onSubmit={envoyerTexte} className="flex items-end gap-2">
          <input
            ref={fichierRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) envoyerImage(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fichierRef.current?.click()}
            disabled={envoi}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-bord text-lg text-orrose transition hover:border-bordeaux-vif"
            title="Envoyer une photo"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setPickerOuvert(true)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-bord text-[10px] font-semibold tracking-wider text-orrose transition hover:border-bordeaux-vif"
            title="GIF et bibliothèque"
          >
            GIF
          </button>

          <textarea
            ref={zoneRef}
            className="champ min-h-[44px] flex-1 resize-none overflow-y-auto py-3 leading-relaxed"
            rows={1}
            placeholder="Dis-lui…"
            value={texte}
            onChange={(e) => {
              setTexte(e.target.value);
              signalerFrappe();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                envoyerTexte(e);
              }
            }}
          />

          <button
            type="submit"
            disabled={!texte.trim() || envoi}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-bordeaux to-bordeaux-vif text-white disabled:opacity-40"
            title="Envoyer"
          >
            ↑
          </button>
        </form>
      </footer>

      {pickerOuvert && (
        <GifPicker
          coupleId={coupleId}
          userId={userId}
          onGiphy={envoyerGiphy}
          onSticker={envoyerSticker}
          onFermer={() => setPickerOuvert(false)}
        />
      )}

      {/* ---------------------------------------- Actions sur un message */}
      {actionSur && (
        <div
          className="fixed inset-0 z-40 flex items-end bg-nuit/80 backdrop-blur"
          onClick={() => setActionSur(null)}
        >
          <div
            className="w-full rounded-t-3xl border-t border-bord bg-velours p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-bord" />
            <p className="mb-4 truncate text-center text-sm text-brume">
              {actionSur.kind === "image" ? "Photo" : actionSur.body}
            </p>
            <button className="btn" onClick={() => supprimer(actionSur)}>
              Supprimer pour nous deux
            </button>
            <button className="btn btn-fantome mt-2" onClick={() => setActionSur(null)}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------- Vider la conversation */}
      {confirmerVidage && (
        <div
          className="fixed inset-0 z-40 grid place-items-center bg-nuit/85 px-6 backdrop-blur"
          onClick={() => setConfirmerVidage(false)}
        >
          <div
            className="carte w-full max-w-sm p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-display text-xl">Tout effacer ?</p>
            <p className="mt-2 text-sm leading-relaxed text-brume">
              Chaque message et chaque photo de cette conversation disparaîtront des
              deux côtés. C&apos;est irréversible.
            </p>
            <button className="btn mt-5" onClick={viderConversation}>
              Oui, tout effacer
            </button>
            <button
              className="btn btn-fantome mt-2"
              onClick={() => setConfirmerVidage(false)}
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formaterDuree(secondes: number) {
  if (secondes >= 3600) return `${Math.ceil(secondes / 3600)} h`;
  if (secondes >= 60) return `${Math.ceil(secondes / 60)} min`;
  return `${secondes} s`;
}
