import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import ProfileForm from "@/components/ProfileForm";
import type { Couple, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProfilPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: couple } = await supabase
    .from("couples")
    .select("id, member_a, member_b, invite_code, created_at, paired_at, nickname, since_date")
    .or(`member_a.eq.${user.id},member_b.eq.${user.id}`)
    .maybeSingle<Couple>();

  if (!couple || !couple.member_b) redirect("/pair");

  const partnerId = couple.member_a === user.id ? couple.member_b : couple.member_a;

  const [{ data: moi }, { data: partenaire }, { data: pinPose }, { data: pinJournalPose }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle<Profile>(),
    supabase.from("profiles").select("*").eq("id", partnerId).maybeSingle<Profile>(),
    supabase.rpc("has_gallery_pin"),
    supabase.rpc("has_journal_pin"),
  ]);

  return (
    <AppShell>
      <ProfileForm
        coupleId={couple.id}
        couple={couple}
        moi={moi ?? { id: user.id, display_name: "Moi", emoji: "🔥" }}
        partenaire={partenaire ?? { id: partnerId, display_name: "Mon amour", emoji: "🔥" }}
        pinDejaPose={pinPose === true}
        pinJournalDejaPose={pinJournalPose === true}
      />
    </AppShell>
  );
}
