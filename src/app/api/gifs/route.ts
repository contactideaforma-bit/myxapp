import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Proxy Giphy — la cle reste sur le serveur, jamais dans le bundle.
 * Classification R : le maximum que la plateforme autorise.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "non authentifie" }, { status: 401 });

  const cle = process.env.GIPHY_API_KEY;
  if (!cle) {
    return NextResponse.json(
      { error: "GIPHY_API_KEY absente. Ajoutez-la dans .env.local et sur Vercel." },
      { status: 501 }
    );
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const offset = Number(searchParams.get("offset") ?? 0);

  const base = q
    ? "https://api.giphy.com/v1/gifs/search"
    : "https://api.giphy.com/v1/gifs/trending";

  const params = new URLSearchParams({
    api_key: cle,
    limit: "24",
    offset: String(Math.max(0, Math.min(offset, 200))),
    rating: "r",
    bundle: "messaging_non_clips",
  });
  if (q) params.set("q", q);

  try {
    const rep = await fetch(`${base}?${params}`, { cache: "no-store" });
    if (!rep.ok) throw new Error(`Giphy ${rep.status}`);
    const json = await rep.json();

    const gifs = (json.data ?? []).map((g: Record<string, any>) => ({
      id: g.id,
      apercu: g.images?.fixed_width_downsampled?.url ?? g.images?.fixed_width?.url,
      complet: g.images?.downsized_medium?.url ?? g.images?.original?.url,
      titre: g.title ?? "",
    }));

    return NextResponse.json({ gifs });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "erreur Giphy" },
      { status: 502 }
    );
  }
}
