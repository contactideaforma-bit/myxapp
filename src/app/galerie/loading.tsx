import AppShell from "@/components/AppShell";

export default function Chargement() {
  return (
    <AppShell>
      <div className="mx-auto max-w-md space-y-3 px-5 py-8">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 rounded-2xl border border-bord bg-velours-clair"
            style={{ animation: "pulse-doux 1.4s ease-in-out infinite", animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </div>
    </AppShell>
  );
}
