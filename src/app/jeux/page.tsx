import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import JeuxHub from "@/components/JeuxHub";

export const dynamic = "force-dynamic";

export default async function JeuxPage() {
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
    .select("id, member_a, member_b")
    .or(`member_a.eq.${user.id},member_b.eq.${user.id}`)
    .maybeSingle();

  if (!couple || !couple.member_b) redirect("/pair");

  const partnerId = couple.member_a === user.id ? couple.member_b : couple.member_a;
  const [{ data: p }, { data: moi }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", partnerId).maybeSingle(),
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
  ]);

  return (
    <AppShell>
      <JeuxHub
        coupleId={couple.id}
        userId={user.id}
        partenaireId={partnerId}
        partenaire={p?.display_name ?? "Votre moitié"}
        monPrenom={moi?.display_name ?? ""}
      />
    </AppShell>
  );
}
