import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import Kamasutra from "@/components/Kamasutra";

export const dynamic = "force-dynamic";

export default async function KamasutraPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: couple } = await supabase
    .from("couples")
    .select("id, member_a, member_b, illustration_mode")
    .or(`member_a.eq.${user.id},member_b.eq.${user.id}`)
    .maybeSingle<{
      id: string;
      member_a: string;
      member_b: string | null;
      illustration_mode: string;
    }>();

  if (!couple || !couple.member_b) redirect("/pair");

  const partnerId = couple.member_a === user.id ? couple.member_b : couple.member_a;

  const { data: profils } = await supabase
    .from("profiles")
    .select("id, avatar")
    .in("id", [user.id, partnerId]);

  const avatarDe = (id: string) =>
    (profils ?? []).find((p) => p.id === id)?.avatar ?? null;

  return (
    <AppShell>
      <Kamasutra
        coupleId={couple.id}
        userId={user.id}
        modeInitial={couple.illustration_mode ?? "silhouette"}
        avatarA={avatarDe(user.id)}
        avatarB={avatarDe(partnerId)}
      />
    </AppShell>
  );
}
