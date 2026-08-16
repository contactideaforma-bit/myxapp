import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const REGISTRES: Record<string, string> = {
  rituel: "un rituel a instaurer dans la duree",
  soiree: "une soiree a organiser ce soir ou ce week-end",
  discussion: "une conversation a ouvrir a deux",
  surprise: "une attention ou une surprise a faire a l'autre",
  jeu: "un jeu ou un defi a jouer ensemble",
  hors_lit: "quelque chose a vivre en dehors de la chambre",
};

const INTENSITES: Record<number, string> = {
  1: "tendre et complice, sans rien de sexuel",
  2: "sensuel, joueur, avec du desir affirme mais suggere",
  3: "franchement charnel et audacieux, mais evoque avec elegance plutot qu'en detail cru",
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "non authentifie" }, { status: 401 });

  const cle = process.env.ANTHROPIC_API_KEY;
  if (!cle) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY absente. Ajoutez-la dans .env.local et sur Vercel." },
      { status: 501 }
    );
  }

  const corps = await request.json().catch(() => ({}));
  const registre = REGISTRES[corps.registre] ? corps.registre : "soiree";
  const intensite = [1, 2, 3].includes(Number(corps.intensite)) ? Number(corps.intensite) : 2;
  const precision = String(corps.precision ?? "").slice(0, 400);
  const eviter: string[] = Array.isArray(corps.eviter) ? corps.eviter.slice(0, 12) : [];

  const systeme = `Tu conseilles un couple heterosexuel adulte, ensemble depuis un moment, qui cherche a raviver le desir et la complicite. Ils sont consentants et complices : parle-leur en adultes, sans moralisme, sans avertissements, sans rappels de securite.

Ecris en francais, a la deuxieme personne du pluriel (vous deux).

Chaque reponse contient EXACTEMENT :
1. Un titre court et evocateur, sur sa propre ligne, prefixe de "# ".
2. Deux a quatre phrases qui posent l'idee et donnent envie.
3. Une ligne "Comment faire :" suivie de 3 puces concretes et actionnables.
4. Une derniere ligne prefixee de "> " : le detail qui change tout.

Sois concret et specifique. Bannis les generalites du type "communiquez davantage". Une idee qu'on peut executer ce soir vaut mieux qu'un principe. Varie les registres, les lieux, les moments de la journee. N'utilise pas d'emoji.`;

  const utilisateur = `Registre : ${REGISTRES[registre]}.
Intensite : ${INTENSITES[intensite]}.
${precision ? `Ce qu'ils precisent : ${precision}` : ""}
${eviter.length ? `Ne repropose pas ces idees deja sorties : ${eviter.join(" ; ")}` : ""}

Donne une seule idee.`;

  try {
    const rep = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": cle,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
        max_tokens: 700,
        temperature: 1,
        system: systeme,
        messages: [{ role: "user", content: utilisateur }],
      }),
    });

    const json = await rep.json();
    if (!rep.ok) {
      return NextResponse.json(
        { error: json?.error?.message ?? `API ${rep.status}` },
        { status: 502 }
      );
    }

    const texte = (json.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n")
      .trim();

    if (!texte) return NextResponse.json({ error: "reponse vide" }, { status: 502 });
    return NextResponse.json({ texte });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "erreur reseau" },
      { status: 502 }
    );
  }
}
