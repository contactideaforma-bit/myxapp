"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Message, Profile, Reaction } from "@/lib/types";
import ImageMessage from "./ImageMessage";
import PanicOverlay from "./PanicOverlay";
import GifPicker from "./GifPicker";

const EMOJIS_REACTION = ["❤️", "🔥", "😍", "😂", "😮", "👍"];

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
  const [enDirect, setEnDirect] = useState(false);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [repondA, setRepondA] = useState<Message | null>(null);
  const [enLigne, setEnLigne] = useState(false);
  const [optionsOuvertes, setOptionsOuvertes] = useState(false);

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

  /* ------------------------------------------------ Rechargement de secours */
  const rafraichir = useCallback(async () => {
    const [{ data }, { data: r }] = await Promise.all([
      supabase
        .from("messages")
        .select("*")
        .eq("couple_id", coupleId)
        .or(
          `created_at.gte.${new Date(Date.now() - 24 * 3600_000).toISOString()},is_saved.eq.true`
        )
        .order("created_at", { ascending: false })
        .limit(400),
      supabase.from("reactions").select("message_id, user_id, emoji"),
    ]);
    if (data) {
      // On conserve les messages encore en cours d'envoi.
      setMessages((prev) => {
        const enVol = prev.filter((m) => m.enAttente);
        return [...[...(data as Message[])].reverse(), ...enVol];
      });
    }
    if (r) setReactions(r as Reaction[]);
  }, [supabase, coupleId]);

  const rafraichirReactions = useCallback(async () => {
    const { data } = await supabase.from("reactions").select("message_id, user_id, emoji");
    if (data) setReactions(data as Reaction[]);
  }, [supabase]);

  /* ------------------------------------------------ Temps réel */
  useEffect(() => {
    let canal: ReturnType<typeof supabase.channel> | null = null;
    let annule = false;
    let secours: ReturnType<typeof setInterval> | null = null;

    const surVisibilite = () => {
      canal?.track({ id: userId, visible: document.visibilityState === "visible" });
      // Au retour au premier plan, on rattrape ce qu'on aurait manqué.
      if (document.visibilityState === "visible") {
        void supabase.rpc("mark_read").then(() => {});
        rafraichir();
      }
    };

    (async () => {
      // IMPORTANT : le socket temps réel doit porter le jeton de
      // l'utilisateur, sinon la RLS filtre tout et aucun événement
      // n'arrive. Avec une session en cookies, il faut le poser à la main.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (annule) return;
      try {
        supabase.realtime.setAuth(session?.access_token ?? null);
      } catch {
        /* versions plus anciennes : le jeton est deja pose */
      }

      canal = supabase
        .channel(`chat-${coupleId}`, { config: { broadcast: { self: false } } })
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `couple_id=eq.${coupleId}` },
          (payload) => {
            const m = payload.new as Message;
            setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
            if (m.sender_id !== userId) {
              setPartenaireEcrit(false);
              void supabase.rpc("mark_read").then(() => {});
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
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "reactions" },
          () => rafraichirReactions()
        )
        .on("broadcast", { event: "typing" }, ({ payload }) => {
          if (payload?.from === userId) return;
          setPartenaireEcrit(true);
          setTimeout(() => setPartenaireEcrit(false), 2500);
        })
        .subscribe(async (statut) => {
          setEnDirect(statut === "SUBSCRIBED");
          if (statut === "SUBSCRIBED") {
            await canal?.track({
              id: userId,
              visible: document.visibilityState === "visible",
            });
            await supabase.rpc("mark_read");
            rafraichir(); // on rattrape ce qui est arrive pendant la connexion
          }
        });

      canalRef.current = canal;
      void supabase.rpc("mark_read").then(() => {});

      // Filet : si le canal ne s'etablit pas, on interroge la base.
      secours = setInterval(() => {
        if (canal?.state !== "joined") rafraichir();
      }, 15_000);
    })();

    document.addEventListener("visibilitychange", surVisibilite);

    // Le jeton change toutes les heures : il faut le repousser au socket.
    const { data: ecoute } = supabase.auth.onAuthStateChange((_e, session) => {
      try {
        supabase.realtime.setAuth(session?.access_token ?? null);
      } catch {
        /* ignore */
      }
    });

    return () => {
      annule = true;
      document.removeEventListener("visibilitychange", surVisibilite);
      if (secours) clearInterval(secours);
      ecoute.subscription.unsubscribe();
      if (canal) supabase.removeChannel(canal);
      canalRef.current = null;
    };
  }, [supabase, coupleId, userId, rafraichir, rafraichirReactions]);

  /* ------------------------------------------------ Partenaire en ligne */
  useEffect(() => {
    let vivant = true;
    const verifier = async () => {
      const { data } = await supabase.rpc("partner_status");
      if (vivant && data) setEnLigne((data as { en_ligne?: boolean }).en_ligne === true);
    };
    verifier();
    const t = setInterval(verifier, 20_000);
    return () => {
      vivant = false;
      clearInterval(t);
    };
  }, [supabase]);

  /* ------------------------------------------------ Purge des expirés */
  useEffect(() => {
    void supabase.rpc("purge_expired").then(() => {});
    const t = setInterval(() => {
      void supabase.rpc("purge_expired").then(() => {});
    }, 300_000);
    return () => clearInterval(t);
  }, [supabase]);

  /* ------------------------------------------------ Défilement auto
     On ne ramène en bas que si l'on y était déjà : sinon, remonter dans
     l'historique devient impossible dès qu'un message arrive. */
  const filRef = useRef<HTMLElement>(null);
  const enBasRef = useRef(true);

  useEffect(() => {
    const el = filRef.current;
    if (!el) return;
    const surDefilement = () => {
      enBasRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    };
    el.addEventListener("scroll", surDefilement, { passive: true });
    return () => el.removeEventListener("scroll", surDefilement);
  }, []);

  useEffect(() => {
    if (enBasRef.current) finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibles.length, partenaireEcrit, reactions.length]);

  /* ------------------------------------------------ Mode discret */
  useEffect(() => {
    function surTouche(e: KeyboardEvent) {
      if (e.key === "Escape") setDiscret(true);
    }
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, []);

  const parId = useMemo(
    () => Object.fromEntries(messages.map((m) => [m.id, m])) as Record<string, Message>,
    [messages]
  );

  const apercuDe = (m?: Message | null) =>
    !m ? "" : m.kind === "image" ? "📷 Photo" : m.kind === "gif" ? "GIF" : m.body ?? "";

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

  /** Le/la partenaire a-t-il l'app ouverte et au premier plan ? */
  function partenaireDevantLEcran() {
    const etat = canalRef.current?.presenceState() as
      | Record<string, { id?: string; visible?: boolean }[]>
      | undefined;
    if (!etat) return false;
    return Object.values(etat)
      .flat()
      .some((p) => p?.id && p.id !== userId && p.visible === true);
  }

  /** Previens l'autre — sauf s'il/elle lit deja. Sans bloquer l'envoi. */
  function prevenir(genre: string, apercu = "") {
    if (partenaireDevantLEcran()) return;
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

    const cible = repondA;
    const provisoire = `local-${Date.now()}`;
    const expiration = calculerExpiration();

    // La bulle apparait tout de suite : plus aucune latence ressentie.
    setMessages((prev) => [
      ...prev,
      {
        id: provisoire,
        couple_id: coupleId,
        sender_id: userId,
        kind: "text",
        body: corps,
        storage_path: null,
        view_once: false,
        opened_at: null,
        expires_at: expiration,
        read_at: null,
        reply_to: cible?.id ?? null,
        created_at: new Date().toISOString(),
        enAttente: true,
      },
    ]);
    setTexte("");
    setRepondA(null);

    const { data, error } = await supabase
      .from("messages")
      .insert({
        couple_id: coupleId,
        sender_id: userId,
        kind: "text",
        body: corps,
        expires_at: expiration,
        reply_to: cible?.id ?? null,
      })
      .select()
      .single();

    if (!error && data) {
      // On remplace la bulle provisoire par la vraie.
      setMessages((prev) =>
        prev
          .filter((m) => m.id !== provisoire)
          .concat(prev.some((x) => x.id === data.id) ? [] : [data as Message])
      );
      prevenir("message", corps);
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== provisoire));
      setTexte(corps);
    }
    zoneRef.current?.focus();
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

  /** Une réaction par personne : le même emoji retire, un autre remplace. */
  async function reagir(m: Message, emoji: string) {
    setActionSur(null);
    if (m.enAttente) return;
    const actuelle = reactions.find(
      (r) => r.message_id === m.id && r.user_id === userId
    );

    if (actuelle?.emoji === emoji) {
      setReactions((p) => p.filter((r) => !(r.message_id === m.id && r.user_id === userId)));
      await supabase.from("reactions").delete().eq("message_id", m.id).eq("user_id", userId);
      return;
    }

    setReactions((p) => [
      ...p.filter((r) => !(r.message_id === m.id && r.user_id === userId)),
      { message_id: m.id, user_id: userId, emoji },
    ]);
    await supabase
      .from("reactions")
      .upsert({ message_id: m.id, user_id: userId, emoji }, { onConflict: "message_id,user_id" });
  }

  async function basculerGarde(m: Message) {
    setActionSur(null);
    if (m.enAttente) return;
    const suivant = !m.is_saved;
    setMessages((p) => p.map((x) => (x.id === m.id ? { ...x, is_saved: suivant } : x)));
    await supabase.rpc("toggle_saved", { p_id: m.id });
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
        <div className="relative">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-bordeaux to-bordeaux-vif text-lg">
            {partner.emoji || "🔥"}
          </div>
          {enLigne && (
            <span
              className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-velours bg-emerald-400"
              title="En ligne"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg leading-tight">{partner.display_name}</p>
          <p className="text-xs text-brume">
            {partenaireEcrit ? (
              <span className="text-orrose">écrit…</span>
            ) : enLigne ? (
              <span className="text-emerald-400">En ligne</span>
            ) : enDirect ? (
              "Hors ligne"
            ) : (
              <span className="opacity-60">Reconnexion…</span>
            )}
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
      <main ref={filRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-6">
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
                onClick={() => setActionSur(m)}
                className="max-w-[85%] cursor-pointer"
              >
                {m.reply_to && (
                  <div
                    className={`mb-1 rounded-xl border-l-2 border-bordeaux-vif px-3 py-1.5 text-[11px] leading-snug ${
                      estMoi ? "bg-bordeaux/20 text-champagne/80" : "bg-velours-clair text-brume"
                    }`}
                  >
                    <span className="block text-[9px] uppercase tracking-widest text-orrose">
                      {parId[m.reply_to]?.sender_id === userId ? "Vous" : partner.display_name}
                    </span>
                    <span className="line-clamp-2 block">
                      {apercuDe(parId[m.reply_to]) || "Message supprimé"}
                    </span>
                  </div>
                )}
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

              {(() => {
                const mes = reactions.filter((r) => r.message_id === m.id);
                if (!mes.length) return null;
                return (
                  <div className={`-mt-1.5 flex gap-1 px-1 ${estMoi ? "justify-end" : ""}`}>
                    {mes.map((r) => (
                      <span
                        key={r.user_id}
                        className="rounded-full border border-bord bg-velours px-1.5 py-0.5 text-xs shadow"
                        title={r.user_id === userId ? "Vous" : partner.display_name}
                      >
                        {r.emoji}
                      </span>
                    ))}
                  </div>
                );
              })()}

              <div className="mt-1 flex items-center gap-1.5 px-1 text-[10px] text-brume">
                <span>
                  {new Date(m.created_at).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {restant !== null && <span>· ⏳ {formaterDuree(restant)}</span>}
                {m.view_once && <span>· 🔥</span>}
                {m.is_saved && <span title="Conservé">· 📌</span>}
                {estMoi && (
                  <span
                    className={m.read_at ? "text-orrose" : "text-brume"}
                    title={m.read_at ? "Vu" : "Envoyé"}
                  >
                    · {m.enAttente ? "envoi…" : m.read_at ? "✓✓ Vu" : "✓ Envoyé"}
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
        {(duree > 0 || vueUnique) && (
          <p className="mb-1.5 px-1 text-[10px] text-orrose">
            {duree > 0 && `⏳ disparaît après ${DUREES.find((d) => d.valeur === duree)?.label}`}
            {duree > 0 && vueUnique && " · "}
            {vueUnique && "🔥 photo vue unique"}
          </p>
        )}

        {repondA && (
          <div className="anim-monte mb-2 flex items-start gap-2 rounded-xl border-l-2 border-bordeaux-vif bg-velours-clair px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-widest text-orrose">
                Réponse à {repondA.sender_id === userId ? "vous-même" : partner.display_name}
              </p>
              <p className="truncate text-xs text-brume">{apercuDe(repondA)}</p>
            </div>
            <button
              type="button"
              onClick={() => setRepondA(null)}
              className="shrink-0 text-lg leading-none text-brume"
            >
              ×
            </button>
          </div>
        )}

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
            onClick={() => setOptionsOuvertes(true)}
            disabled={envoi}
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border border-bord text-xl leading-none text-orrose transition ${
              duree > 0 || vueUnique ? "border-bordeaux-vif bg-bordeaux/25" : ""
            }`}
            title="Options d'envoi"
          >
            +
          </button>

          <textarea
            ref={zoneRef}
            className="champ min-h-[42px] flex-1 resize-none overflow-y-auto py-2.5 leading-relaxed"
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
            // On empeche le bouton de prendre le focus : sinon le champ
            // le perd et iOS referme le clavier a chaque envoi.
            onMouseDown={(e) => e.preventDefault()}
            onTouchEnd={(e) => {
              e.preventDefault();
              if (texte.trim() && !envoi) envoyerTexte(e);
            }}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-bordeaux to-bordeaux-vif text-white transition disabled:opacity-40"
            title="Envoyer"
          >
            ↑
          </button>
        </form>
      </footer>

      {optionsOuvertes && (
        <div
          className="fixed inset-0 z-40 flex items-end bg-nuit/80 backdrop-blur"
          onClick={() => setOptionsOuvertes(false)}
        >
          <div
            className="w-full rounded-t-3xl border-t border-bord bg-velours p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-bord" />

            <div className="mb-5 grid grid-cols-2 gap-2">
              <button
                className="carte flex items-center gap-3 p-4 text-left"
                onClick={() => {
                  setOptionsOuvertes(false);
                  fichierRef.current?.click();
                }}
              >
                <span className="text-xl">🖼️</span>
                <span className="text-sm">Photo</span>
              </button>
              <button
                className="carte flex items-center gap-3 p-4 text-left"
                onClick={() => {
                  setOptionsOuvertes(false);
                  setPickerOuvert(true);
                }}
              >
                <span className="text-xl">🎞️</span>
                <span className="text-sm">GIF</span>
              </button>
            </div>

            <p className="mb-2 text-xs uppercase tracking-widest text-brume">
              Durée de vie du message
            </p>
            <div className="mb-5 flex gap-2">
              {DUREES.map((d) => (
                <button
                  key={d.valeur}
                  onClick={() => setDuree(d.valeur)}
                  className={`flex-1 rounded-xl border py-2.5 text-sm transition ${
                    duree === d.valeur
                      ? "border-bordeaux-vif bg-bordeaux/30 text-orrose"
                      : "border-bord bg-velours-clair text-brume"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setVueUnique((v) => !v)}
              className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
                vueUnique
                  ? "border-bordeaux-vif bg-bordeaux/25 text-orrose"
                  : "border-bord bg-velours-clair text-brume"
              }`}
            >
              🔥 Photo à vue unique
              <span className="block text-[11px] opacity-70">
                Elle se consume dès qu&apos;elle est ouverte
              </span>
            </button>

            <button
              className="btn btn-fantome mt-4"
              onClick={() => setOptionsOuvertes(false)}
            >
              Fermer
            </button>
          </div>
        </div>
      )}

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

            <div className="mb-4 flex gap-1.5">
              {EMOJIS_REACTION.map((emoji) => {
                const mienne = reactions.some(
                  (r) =>
                    r.message_id === actionSur.id &&
                    r.user_id === userId &&
                    r.emoji === emoji
                );
                return (
                  <button
                    key={emoji}
                    onClick={() => reagir(actionSur, emoji)}
                    className={`grid h-12 flex-1 place-items-center rounded-2xl border text-2xl transition active:scale-90 ${
                      mienne
                        ? "border-orrose bg-bordeaux/30"
                        : "border-bord bg-velours-clair"
                    }`}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>

            <p className="mb-4 truncate text-center text-sm text-brume">
              {apercuDe(actionSur)}
            </p>

            <button
              className="btn"
              onClick={() => {
                setRepondA(actionSur);
                setActionSur(null);
                setTimeout(() => zoneRef.current?.focus(), 50);
              }}
            >
              Répondre
            </button>

            {!actionSur.enAttente && (
              <button
                className="btn btn-fantome mt-2"
                onClick={() => basculerGarde(actionSur)}
              >
                {actionSur.is_saved
                  ? "📌 Ne plus conserver"
                  : "📌 Conserver ce message"}
              </button>
            )}

            {actionSur.sender_id === userId && !actionSur.enAttente && (
              <button
                className="btn btn-fantome mt-2"
                onClick={() => supprimer(actionSur)}
              >
                Supprimer pour nous deux
              </button>
            )}

            <button
              className="btn btn-fantome mt-2"
              onClick={() => setActionSur(null)}
            >
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
