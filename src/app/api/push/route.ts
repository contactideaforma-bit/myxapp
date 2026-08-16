import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function configurer() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:contact@example.com",
    pub,
    priv
  );
  return true;
}

type Cible = { endpoint: string; p256dh: string; cle_auth: string; style: string };

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "non authentifie" }, { status: 401 });

  if (!configurer()) {
    return NextResponse.json(
      { error: "Clés VAPID absentes. Voir le README." },
      { status: 501 }
    );
  }

  const corps = await request.json().catch(() => ({}));
  const genre: string = corps.genre ?? "message";
  const apercu: string = String(corps.apercu ?? "").slice(0, 90);
  const prenom: string = String(corps.prenom ?? "").slice(0, 40);

  const { data, error } = await supabase.rpc("partner_push_targets");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const cibles = (data ?? []) as Cible[];
  if (!cibles.length) return NextResponse.json({ envoyes: 0 });

  const libelle: Record<string, string> = {
    message: "Nouveau message",
    photo: "Une photo vous attend",
    gif: "Nouveau message",
    idee: "Une nouvelle idée",
    defi: "Un défi vous attend",
  };

  let envoyes = 0;
  const morts: string[] = [];

  await Promise.all(
    cibles.map(async (c) => {
      // La discrétion est un choix du DESTINATAIRE, pas de l'expéditeur.
      const discret = c.style !== "apercu";
      const charge = JSON.stringify({
        titre: "Agenda",
        corps: discret
          ? libelle[genre] ?? "Nouvelle activité"
          : `${prenom || "Votre moitié"} — ${apercu || libelle[genre]}`,
        tag: genre,
        url: genre === "idee" ? "/idees" : genre === "defi" ? "/jeux" : "/chat",
      });

      try {
        await webpush.sendNotification(
          { endpoint: c.endpoint, keys: { p256dh: c.p256dh, auth: c.cle_auth } },
          charge,
          { TTL: 3600, urgency: "high" }
        );
        envoyes++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) morts.push(c.endpoint);
      }
    })
  );

  await Promise.all(
    morts.map((e) => supabase.rpc("remove_push_endpoint", { p_endpoint: e }))
  );

  return NextResponse.json({ envoyes, nettoyes: morts.length });
}
