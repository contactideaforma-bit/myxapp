/* =====================================================================
   CHARGEUR — un cœur noir, à l'envers, qui bat.
   L'animation vit dans globals.css (.coeur-chargeur / @keyframes coeur-bat).
   ===================================================================== */

export default function Chargeur({ plein = false }: { plein?: boolean }) {
  return (
    <div className={plein ? "grid min-h-[72dvh] flex-1 place-items-center" : "grid place-items-center py-20"}>
      <span className="coeur-halo">
        <span className="coeur-chargeur" role="status" aria-label="Chargement">
          🖤
        </span>
      </span>
    </div>
  );
}
