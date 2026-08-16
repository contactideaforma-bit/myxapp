import { redirect } from "next/navigation";

// Section mise de cote. La route reste pour ne pas casser un lien existant.
export default function KamasutraPage() {
  redirect("/chat");
}
