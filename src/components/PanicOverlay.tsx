"use client";

/**
 * MODE DISCRET
 * Recouvre instantanément l'écran par une fausse liste de courses.
 * Pour revenir : double-clic sur le titre « Liste de courses ».
 */
export default function PanicOverlay({ onExit }: { onExit: () => void }) {
  const items = [
    "Pain de mie",
    "Tomates cerises",
    "Café en grains",
    "Lessive",
    "Yaourts nature",
    "Papier essuie-tout",
    "Pommes",
  ];

  return (
    <div className="fixed inset-0 z-50 bg-white text-neutral-800">
      <div className="mx-auto max-w-md px-6 py-10">
        <h1
          onDoubleClick={onExit}
          className="cursor-default select-none text-2xl font-semibold"
          title=""
        >
          Liste de courses
        </h1>
        <p className="mt-1 text-sm text-neutral-400">Mise à jour aujourd&apos;hui</p>

        <ul className="mt-8 space-y-4">
          {items.map((item, i) => (
            <li key={item} className="flex items-center gap-3 border-b border-neutral-100 pb-3">
              <span
                className={`grid h-5 w-5 place-items-center rounded border ${
                  i < 2 ? "border-neutral-800 bg-neutral-800 text-white" : "border-neutral-300"
                }`}
              >
                {i < 2 ? "✓" : ""}
              </span>
              <span className={i < 2 ? "text-neutral-400 line-through" : ""}>{item}</span>
            </li>
          ))}
        </ul>

        <p className="mt-16 text-center text-[11px] text-neutral-300">
          Double-cliquez sur le titre pour revenir
        </p>
      </div>
    </div>
  );
}
