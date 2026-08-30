import AppShell from "@/components/AppShell";

export default function Chargement() {
  return (
    <AppShell plein>
      <div className="journal grid place-items-center" style={{ minHeight: "100%" }}>
        <span className="coeur-chargeur" role="status" aria-label="Chargement">🖤</span>
      </div>
    </AppShell>
  );
}
