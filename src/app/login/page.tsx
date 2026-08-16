import LoginForm from "@/components/LoginForm";

// Pas de prérendu statique : la page a besoin des variables Supabase au runtime,
// pas au moment du build.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginForm />;
}
