/* =====================================================================
   CHARGEUR — un cœur noir, à l'envers, qui bat.
   L'animation vit dans globals.css (.coeur-chargeur / @keyframes coeur-bat).
   ===================================================================== */

export default function Chargeur({ plein = false }: { plein?: boolean }) {
  return (
    <div className={plein ? "grid min-h-[55dvh] place-items-center" : "grid place-items-center py-20"}>
      <span className="coeur-chargeur" role="status" aria-label="Chargement">
        🖤
      </span>
    </div>
  );
}
