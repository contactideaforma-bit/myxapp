"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Couple, Profile } from "@/lib/types";
import { Portrait } from "./Scene";
import {
  assainir,
  CARNATIONS,
  COULEURS_CHEVEUX,
  COIFFURES,
  VISAGES,
  type AvatarParams,
} from "@/lib/avatar-engine";

const EMOJIS = ["🔥", "💋", "🖤", "🌹", "🍒", "😈", "👑", "🌙", "⚡", "🥀", "💫", "🐺"];

export default function ProfileForm({
  coupleId,
  couple,
  moi,
  partenaire,
  pinDejaPose,
}: {
  coupleId: string;
  couple: Couple;
  moi: Profile;
  partenaire: Profile;
  pinDejaPose: boolean;
}) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [prenom, setPrenom] = useState(moi.display_name);
  const [emoji, setEmoji] = useState(moi.emoji || "🔥");
  const [bio, setBio] = useState(moi.bio ?? "");
  const [avatar, setAvatar] = useState<AvatarParams>(() => assainir(moi.avatar));
  const [avatarPath, setAvatarPath] = useState(moi.avatar_path ?? null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [nomCouple, setNomCouple] = useState(couple.nickname ?? "");
  const [depuis, setDepuis] = useState(couple.since_date ?? "");

  const [pin, setPin] = useState("");
  const [pinPose, setPinPose] = useState(pinDejaPose);

  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [occupe, setOccupe] = useState(false);
  const fichierRef = useRef<HTMLInputElement>(null);

  const annoncer = useCallback((ok: boolean, texte: string) => {
    setMessage({ ok, texte });
    setTimeout(() => setMessage(null), 3500);
  }, []);

  /* --------------------------------------------------- Avatar : URL signee */
  useEffect(() => {
    let annule = false;
    (async () => {
      if (!avatarPath) return setAvatarUrl(null);
      const { data } = await supabase.storage
        .from("intimate")
        .createSignedUrl(avatarPath, 3600);
      if (!annule) setAvatarUrl(data?.signedUrl ?? null);
    })();
    return () => {
      annule = true;
    };
  }, [avatarPath, supabase]);

  async function televerserAvatar(fichier: File) {
    if (!fichier.type.startsWith("image/")) return;
    setOccupe(true);
    const ext = fichier.name.split(".").pop()?.toLowerCase() || "jpg";
    const chemin = `${coupleId}/avatars/${moi.id}-${Date.now()}.${ext}`;

    const { error: errUp } = await supabase.storage
      .from("intimate")
      .upload(chemin, fichier, { upsert: true });

    if (errUp) {
      annoncer(false, errUp.message);
    } else {
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_path: chemin })
        .eq("id", moi.id);
      if (error) annoncer(false, error.message);
      else {
        setAvatarPath(chemin);
        annoncer(true, "Photo mise à jour");
      }
    }
    setOccupe(false);
  }

  /* --------------------------------------------------- Enregistrements */
  async function enregistrerAvatar(suivant: AvatarParams) {
    setAvatar(suivant);
    await supabase.from("profiles").update({ avatar: suivant }).eq("id", moi.id);
  }

  async function enregistrerProfil() {
    setOccupe(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: prenom.trim() || "Mon amour",
        emoji,
        bio: bio.trim() || null,
      })
      .eq("id", moi.id);
    setOccupe(false);
    if (error) return annoncer(false, error.message);
    annoncer(true, "Profil enregistré");
    router.refresh();
  }

  async function enregistrerCouple() {
    setOccupe(true);
    const { error } = await supabase.rpc("update_couple_info", {
      p_nickname: nomCouple.trim() || null,
      p_since_date: depuis || null,
    });
    setOccupe(false);
    if (error) return annoncer(false, error.message);
    annoncer(true, "Votre histoire est enregistrée");
    router.refresh();
  }

  async function enregistrerPin() {
    if (!/^[0-9]{4}$/.test(pin)) return annoncer(false, "Le code doit faire 4 chiffres");
    setOccupe(true);
    const { error } = await supabase.rpc("set_gallery_pin", { p_pin: pin });
    setOccupe(false);
    if (error) return annoncer(false, error.message);
    setPin("");
    setPinPose(true);
    annoncer(true, "Code de la galerie enregistré");
  }

  async function deconnexion() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const jours = couple.since_date
    ? Math.floor((Date.now() - new Date(couple.since_date).getTime()) / 86400000)
    : null;

  return (
    <div className="mx-auto max-w-md space-y-6 px-5 py-8">
      <header className="text-center">
        <h1 className="font-display text-3xl">Profil</h1>
        {couple.nickname && (
          <p className="mt-1 font-display text-lg italic text-orrose">{couple.nickname}</p>
        )}
        {jours !== null && jours >= 0 && (
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-brume">
            {jours.toLocaleString("fr-FR")} jours ensemble
          </p>
        )}
      </header>

      {message && (
        <p
          className={`rounded-xl border px-4 py-2.5 text-center text-sm ${
            message.ok
              ? "border-bordeaux-vif bg-bordeaux/20 text-orrose"
              : "border-bordeaux bg-bordeaux/15 text-orrose"
          }`}
        >
          {message.texte}
        </p>
      )}

      {/* ---------------------------------------------------- MOI */}
      <section className="carte space-y-4 p-5">
        <h2 className="font-display text-xl">Moi</h2>

        <div className="flex items-center gap-4">
          <button
            onClick={() => fichierRef.current?.click()}
            disabled={occupe}
            className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border border-bord bg-velours-clair transition hover:border-bordeaux-vif"
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-3xl">{emoji}</span>
            )}
            <span className="absolute inset-x-0 bottom-0 bg-nuit/75 py-0.5 text-[9px] uppercase tracking-wider text-orrose">
              Changer
            </span>
          </button>

          <input
            ref={fichierRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) televerserAvatar(f);
              e.target.value = "";
            }}
          />

          <div className="min-w-0 flex-1">
            <input
              className="champ"
              placeholder="Ton prénom"
              value={prenom}
              maxLength={40}
              onChange={(e) => setPrenom(e.target.value)}
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs uppercase tracking-widest text-brume">Ton symbole</p>
          <div className="flex flex-wrap gap-2">
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={`grid h-10 w-10 place-items-center rounded-xl border text-lg transition ${
                  emoji === e
                    ? "border-bordeaux-vif bg-bordeaux/30"
                    : "border-bord bg-velours-clair hover:border-bordeaux"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <textarea
          className="champ min-h-20 resize-none"
          placeholder="Une phrase pour lui/elle… ce que tu aimes, ce dont tu as envie"
          value={bio}
          maxLength={280}
          onChange={(e) => setBio(e.target.value)}
        />

        <button className="btn" onClick={enregistrerProfil} disabled={occupe}>
          Enregistrer mon profil
        </button>
      </section>


      {/* ---------------------------------------------------- AVATAR */}
      <section className="carte space-y-4 p-5">
        <h2 className="font-display text-xl">Mon avatar</h2>
        <p className="text-xs leading-relaxed text-brume">
          Il vous représente dans les 23 postures du Kâma Sûtra. Chaque réglage est
          enregistré immédiatement.
        </p>

        <div className="flex items-center gap-4">
          <div className="grid h-28 w-24 shrink-0 place-items-center rounded-2xl border border-bord bg-velours-clair">
            <Portrait a={avatar} className="h-24 w-20" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="grid h-28 w-full place-items-center overflow-hidden rounded-2xl border border-bord bg-velours-clair">
              <Portrait a={partenaire.avatar} regardeVers="gauche" className="h-24 w-20" />
            </div>
          </div>
        </div>
        <p className="-mt-2 flex gap-4 text-[10px] uppercase tracking-widest text-brume">
          <span className="w-24 text-center">Vous</span>
          <span className="flex-1 text-center">{partenaire.display_name}</span>
        </p>

        <Palette
          titre="Carnation"
          couleurs={CARNATIONS}
          actif={avatar.carnation}
          onChoix={(c) => enregistrerAvatar({ ...avatar, carnation: c })}
        />
        <Palette
          titre="Cheveux"
          couleurs={COULEURS_CHEVEUX}
          actif={avatar.couleurCheveux}
          onChoix={(c) => enregistrerAvatar({ ...avatar, couleurCheveux: c })}
        />

        <Chips
          titre="Coiffure"
          options={COIFFURES.map((c) => ({
            cle: c,
            label: { rase: "Rasé", court: "Court", carre: "Carré", long: "Long", boucle: "Bouclé", chignon: "Chignon" }[c] ?? c,
          }))}
          actif={avatar.cheveux}
          onChoix={(v) => enregistrerAvatar({ ...avatar, cheveux: v })}
        />
        <Chips
          titre="Expression"
          options={VISAGES.map((v) => ({
            cle: v,
            label: { doux: "Doux", neutre: "Neutre", intense: "Intense" }[v] ?? v,
          }))}
          actif={avatar.visage}
          onChoix={(v) => enregistrerAvatar({ ...avatar, visage: v })}
        />

        <Curseur
          titre="Corpulence"
          min={0.8}
          max={1.3}
          valeur={avatar.corpulence}
          onFin={(v) => enregistrerAvatar({ ...avatar, corpulence: v })}
          onGlisse={(v) => setAvatar({ ...avatar, corpulence: v })}
        />
        <Curseur
          titre="Morphologie"
          gauche="Épaules"
          droite="Hanches"
          min={0}
          max={1}
          valeur={avatar.morpho}
          onFin={(v) => enregistrerAvatar({ ...avatar, morpho: v })}
          onGlisse={(v) => setAvatar({ ...avatar, morpho: v })}
        />

        <button
          onClick={() => enregistrerAvatar({ ...avatar, pilosite: !avatar.pilosite })}
          className={`w-full rounded-xl border px-4 py-2.5 text-sm transition ${
            avatar.pilosite
              ? "border-bordeaux-vif bg-bordeaux/25 text-orrose"
              : "border-bord bg-velours-clair text-brume"
          }`}
        >
          {avatar.pilosite ? "✓ Barbe" : "Barbe"}
        </button>
      </section>

      {/* ---------------------------------------------------- NOUS */}
      <section className="carte space-y-4 p-5">
        <h2 className="font-display text-xl">Nous</h2>

        <div className="flex items-center gap-3 rounded-xl border border-bord bg-velours-clair p-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-bordeaux to-bordeaux-vif text-lg">
            {partenaire.emoji || "🔥"}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{partenaire.display_name}</p>
            <p className="truncate text-xs text-brume">
              {partenaire.bio || "Pas encore de mot doux…"}
            </p>
          </div>
        </div>

        <input
          className="champ"
          placeholder="Le nom de votre histoire"
          value={nomCouple}
          maxLength={60}
          onChange={(e) => setNomCouple(e.target.value)}
        />

        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-widest text-brume">
            Ensemble depuis le
          </span>
          <input
            className="champ"
            type="date"
            value={depuis}
            onChange={(e) => setDepuis(e.target.value)}
          />
        </label>

        <button className="btn" onClick={enregistrerCouple} disabled={occupe}>
          Enregistrer notre histoire
        </button>
      </section>

      {/* ---------------------------------------------------- GALERIE */}
      <section className="carte space-y-3 p-5">
        <h2 className="font-display text-xl">Code de la galerie</h2>
        <p className="text-sm leading-relaxed text-brume">
          Quatre chiffres demandés à chaque ouverture de la galerie. Vous le partagez
          tous les deux — c&apos;est une porte contre les regards de passage, pas
          contre l&apos;autre.
        </p>

        <div className="flex gap-2">
          <input
            className="champ text-center font-display text-2xl tracking-[0.5em]"
            inputMode="numeric"
            placeholder="••••"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          />
          <button
            className="btn w-auto shrink-0 px-5"
            onClick={enregistrerPin}
            disabled={occupe || pin.length !== 4}
          >
            {pinPose ? "Changer" : "Définir"}
          </button>
        </div>

        <p className="text-xs text-brume">
          {pinPose ? "✓ Un code est actuellement défini." : "Aucun code défini pour l'instant."}
        </p>
      </section>

      <button
        onClick={deconnexion}
        className="btn btn-fantome"
      >
        Se déconnecter
      </button>
    </div>
  );
}


function Palette({
  titre,
  couleurs,
  actif,
  onChoix,
}: {
  titre: string;
  couleurs: readonly string[];
  actif: string;
  onChoix: (c: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs uppercase tracking-widest text-brume">{titre}</p>
      <div className="flex flex-wrap gap-2">
        {couleurs.map((c) => (
          <button
            key={c}
            onClick={() => onChoix(c)}
            style={{ background: c }}
            className={`h-8 w-8 rounded-full border-2 transition ${
              actif === c ? "border-orrose" : "border-transparent"
            }`}
            aria-label={c}
          />
        ))}
      </div>
    </div>
  );
}

function Chips({
  titre,
  options,
  actif,
  onChoix,
}: {
  titre: string;
  options: { cle: string; label: string }[];
  actif: string;
  onChoix: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs uppercase tracking-widest text-brume">{titre}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.cle}
            onClick={() => onChoix(o.cle)}
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              actif === o.cle
                ? "border-bordeaux-vif bg-bordeaux/30 text-orrose"
                : "border-bord text-brume"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Curseur({
  titre,
  gauche,
  droite,
  min,
  max,
  valeur,
  onGlisse,
  onFin,
}: {
  titre: string;
  gauche?: string;
  droite?: string;
  min: number;
  max: number;
  valeur: number;
  onGlisse: (v: number) => void;
  onFin: (v: number) => void;
}) {
  return (
    <div>
      <p className="mb-1 flex justify-between text-xs uppercase tracking-widest text-brume">
        <span>{titre}</span>
        {gauche && (
          <span className="normal-case tracking-normal opacity-70">
            {gauche} ↔ {droite}
          </span>
        )}
      </p>
      <input
        type="range"
        min={min}
        max={max}
        step={0.01}
        value={valeur}
        onChange={(e) => onGlisse(Number(e.target.value))}
        onPointerUp={(e) => onFin(Number((e.target as HTMLInputElement).value))}
        onKeyUp={(e) => onFin(Number((e.target as HTMLInputElement).value))}
        className="w-full accent-[#A32E52]"
      />
    </div>
  );
}
