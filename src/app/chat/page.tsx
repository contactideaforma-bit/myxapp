import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import ChatRoom from "@/components/ChatRoom";
import type { Couple, Message, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
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

  const [{ data: partner }, { data: moi }, { data: messages }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", partnerId).maybeSingle<Profile>(),
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("messages")
      .select("*")
      .eq("couple_id", couple.id)
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  return (
    <AppShell plein>
      <ChatRoom
        coupleId={couple.id}
        userId={user.id}
        partner={partner ?? { id: partnerId, display_name: "Mon amour", emoji: "🔥" }}
        monPrenom={moi?.display_name ?? ""}
        messagesInitiaux={[...((messages ?? []) as Message[])].reverse()}
      />
    </AppShell>
  );
}
