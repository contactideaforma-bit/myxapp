import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import Idees from "@/components/Idees";

export const dynamic = "force-dynamic";

export default async function IdeesPage() {
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
    .select("id, member_b")
    .or(`member_a.eq.${user.id},member_b.eq.${user.id}`)
    .maybeSingle();

  if (!couple || !couple.member_b) redirect("/pair");

  return (
    <AppShell>
      <Idees coupleId={couple.id} userId={user.id} />
    </AppShell>
  );
}
