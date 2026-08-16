import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AppShell>
      <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-3 px-6 py-20 text-center">
        <span className="text-3xl">🕯️</span>
        <h1 className="font-display text-2xl">Jeux</h1>
        <p className="text-sm text-brume">Bientôt. On construit ça juste après.</p>
      </div>
    </AppShell>
  );
}
