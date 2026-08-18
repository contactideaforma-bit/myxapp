/**
 * Compression d'image dans le navigateur, avant l'envoi.
 *
 * Une photo d'iPhone pèse 3 à 8 Mo pour une définition très supérieure
 * à ce qu'un écran affiche. On la ramène à 1920 px de côté et à une
 * qualité de 82 % : l'œil ne voit pas la différence, le transfert est
 * cinq à dix fois plus rapide.
 */
export async function compresserImage(
  fichier: File,
  cote = 1920,
  qualite = 0.82
): Promise<File> {
  if (!fichier.type.startsWith("image/") || fichier.type === "image/gif") {
    return fichier; // on ne touche ni aux GIF animés ni au reste
  }

  try {
    const bitmap = await createImageBitmap(fichier);
    const ratio = Math.min(1, cote / Math.max(bitmap.width, bitmap.height));
    if (ratio === 1 && fichier.size < 900_000) return fichier;

    const l = Math.round(bitmap.width * ratio);
    const h = Math.round(bitmap.height * ratio);
    const canvas = document.createElement("canvas");
    canvas.width = l;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    if (!ctx) return fichier;
    ctx.drawImage(bitmap, 0, 0, l, h);
    bitmap.close();

    const blob = await new Promise<Blob | null>((r) =>
      canvas.toBlob(r, "image/jpeg", qualite)
    );
    if (!blob || blob.size >= fichier.size) return fichier;

    return new File([blob], fichier.name.replace(/\.[^.]+$/, "") + ".jpg", {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return fichier; // en cas de doute, on envoie l'original
  }
}

export function poidsLisible(octets: number) {
  return octets > 1_048_576
    ? `${(octets / 1_048_576).toFixed(1)} Mo`
    : `${Math.round(octets / 1024)} Ko`;
}
