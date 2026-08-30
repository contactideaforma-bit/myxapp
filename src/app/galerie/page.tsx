import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import Gallery from "@/components/Gallery";
import type { Couple } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function GaleriePage() {
  const supabase = await createClient();

  // Le middleware a déjà validé et rafraîchi le jeton pour cette requête
  // (il appelle auth.getUser) : lire la session locale suffit ici, et
  // évite un aller-retour réseau à chaque changement d'onglet.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) redirect("/login");

  const { data: couple } = await supabase
    .from("couples")
    .select("id, member_a, member_b, invite_code, created_at, paired_at, nickname, since_date")
    .or(`member_a.eq.${user.id},member_b.eq.${user.id}`)
    .maybeSingle<Couple>();

  if (!couple || !couple.member_b) redirect("/pair");

  const { data: pinPose } = await supabase.rpc("has_gallery_pin");

  return (
    <AppShell plein>
      <Gallery coupleId={couple.id} userId={user.id} pinPose={pinPose === true} />
    </AppShell>
  );
}
