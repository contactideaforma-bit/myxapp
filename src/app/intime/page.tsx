import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import Intime from "@/components/Intime";

export const dynamic = "force-dynamic";

export default async function IntimePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: couple } = await supabase
    .from("couples")
    .select("id, member_a, member_b")
    .or(`member_a.eq.${user.id},member_b.eq.${user.id}`)
    .maybeSingle();

  if (!couple || !couple.member_b) redirect("/pair");

  const partnerId = couple.member_a === user.id ? couple.member_b : couple.member_a;
  const { data: p } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("id", partnerId)
    .maybeSingle();

  return (
    <AppShell>
      <Intime
        coupleId={couple.id}
        userId={user.id}
        partenaire={{ id: partnerId, nom: p?.display_name ?? "Votre moitié" }}
      />
    </AppShell>
  );
}
