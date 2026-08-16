#!/usr/bin/env node
/**
 * =====================================================================
 *  myXapp — Import du catalogue illustre depuis Wikimedia Commons
 * =====================================================================
 *
 *  ETAPE 1 — inventaire (ne touche a rien) :
 *      node scripts/import-positions.mjs --list
 *    Ecrit scripts/commons-liste.json avec les noms de fichiers,
 *    les auteurs et les licences. Envoie-moi ce fichier.
 *
 *  ETAPE 2 — import reel, une fois scripts/commons-mapping.json ecrit :
 *      node scripts/import-positions.mjs --import
 *
 *  Variables necessaires dans .env.local :
 *      NEXT_PUBLIC_SUPABASE_URL=...
 *      SUPABASE_SERVICE_ROLE_KEY=...      <-- Settings > API > service_role
 *
 *  /!\  La cle service_role contourne toutes les policies RLS.
 *       Elle ne doit JAMAIS etre prefixee NEXT_PUBLIC_, ni commitee,
 *       ni utilisee ailleurs que dans ce script en local.
 * =====================================================================
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const CATEGORIE_DEFAUT = "Category:Sex drawings by User:Seedfeeder";
const API = "https://commons.wikimedia.org/w/api.php";
const UA = "myXapp-import/1.0 (projet prive; contact.ideaforma@gmail.com)";
const BUCKET = "positions";

/* ------------------------------------------------------ .env.local */
function chargerEnv() {
  if (!existsSync(".env.local")) return;
  for (const ligne of readFileSync(".env.local", "utf8").split("\n")) {
    const t = ligne.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const [k, ...r] = t.split("=");
    if (!process.env[k.trim()]) process.env[k.trim()] = r.join("=").trim();
  }
}
chargerEnv();

const texte = (v) =>
  (v ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

/* ------------------------------------------------------ Inventaire */
async function lister(categorie) {
  console.log(`\nInventaire de : ${categorie}`);
  const params = new URLSearchParams({
    action: "query",
    generator: "categorymembers",
    gcmtitle: categorie,
    gcmtype: "file",
    gcmlimit: "500",
    prop: "imageinfo",
    iiprop: "url|extmetadata|size|mime",
    iiurlwidth: "900",
    format: "json",
  });

  const rep = await fetch(`${API}?${params}`, { headers: { "User-Agent": UA } });
  if (!rep.ok) throw new Error(`Commons a repondu ${rep.status}`);
  const json = await rep.json();

  const pages = Object.values(json?.query?.pages ?? {});
  if (!pages.length) throw new Error("Aucun fichier trouve dans la categorie.");

  const fichiers = pages
    .map((p) => {
      const ii = p.imageinfo?.[0];
      if (!ii) return null;
      const m = ii.extmetadata ?? {};
      return {
        fichier: p.title,
        url: ii.thumburl || ii.url,
        page: ii.descriptionurl,
        auteur: texte(m.Artist?.value) || "Inconnu",
        licence: texte(m.LicenseShortName?.value) || "voir la page",
        mime: ii.mime,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.fichier.localeCompare(b.fichier));

  const sortie = "scripts/commons-" +
    categorie.replace(/^Category:/, "").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase() +
    ".json";
  writeFileSync(sortie, JSON.stringify(fichiers, null, 2));

  console.log(`\n${fichiers.length} fichiers trouves.\n`);
  fichiers.forEach((f, i) =>
    console.log(`${String(i + 1).padStart(3)}. ${f.fichier}   [${f.licence}]`)
  );
  console.log(`\n→ Ecrit dans ${sortie}`);
  console.log(`→ Envoie ce fichier pour que les correspondances soient ecrites.\n`);
}

/* ------------------------------------------------------ Import */
async function importer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle) {
    console.error(
      "\nIl manque NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY dans .env.local\n"
    );
    process.exit(1);
  }
  if (!existsSync("scripts/commons-mapping.json")) {
    console.error(
      "\nscripts/commons-mapping.json est absent. Lance d'abord --list.\n"
    );
    process.exit(1);
  }

  const supabase = createClient(url, cle, { auth: { persistSession: false } });
  const mapping = JSON.parse(readFileSync("scripts/commons-mapping.json", "utf8"));
  const inventaires = [...new Set(mapping.map((m) => m.inventaire ?? "scripts/commons-liste.json"))];
  const liste = inventaires.flatMap((f) => JSON.parse(readFileSync(f, "utf8")));
  const parNom = Object.fromEntries(liste.map((f) => [f.fichier, f]));

  let ok = 0;
  let rates = 0;

  for (const entree of mapping) {
    const src = parNom[entree.fichier];
    if (!src) {
      console.warn(`  ✗ introuvable dans l'inventaire : ${entree.fichier}`);
      rates++;
      continue;
    }

    try {
      const rep = await fetch(src.url, { headers: { "User-Agent": UA } });
      if (!rep.ok) throw new Error(`telechargement ${rep.status}`);
      const buffer = Buffer.from(await rep.arrayBuffer());

      const ext = (src.mime?.split("/")[1] || "png").replace("jpeg", "jpg");
      const chemin = `${entree.key}.${ext}`;

      const { error: errUp } = await supabase.storage
        .from(BUCKET)
        .upload(chemin, buffer, {
          contentType: src.mime || "image/png",
          upsert: true,
        });
      if (errUp) throw errUp;

      const ligne = {
        key: entree.key,
        nom: entree.nom ?? entree.key,
        sous_titre: entree.sous_titre ?? null,
        description: entree.description ?? null,
        conseil: entree.conseil ?? null,
        difficulte: entree.difficulte ?? 1,
        intensite: entree.intensite ?? 2,
        figure: entree.figure ?? null,
        image_path: chemin,
        image_credit: `${src.auteur} — ${src.licence}`,
        image_source_url: src.page,
        source: "wikimedia",
        a_relire: !entree.description,
        ordre: entree.ordre ?? 500,
        active: true,
      };

      // On n'ecrase pas les textes francais deja rediges si le mapping
      // ne les fournit pas : seules les colonnes image_* sont forcees.
      const { error: errDb } = await supabase
        .from("positions")
        .upsert(ligne, { onConflict: "key" });
      if (errDb) throw errDb;

      console.log(`  ✓ ${entree.key.padEnd(18)} ← ${entree.fichier}`);
      ok++;
    } catch (e) {
      console.warn(`  ✗ ${entree.key} : ${e.message}`);
      rates++;
    }
  }

  console.log(`\n${ok} importées, ${rates} en échec.\n`);
}

/* ------------------------------------------------------ Entree */
const mode = process.argv[2];
if (mode === "--list") await lister(process.argv[3] || CATEGORIE_DEFAUT);
else if (mode === "--import") await importer();
else {
  console.log(`
Usage :
  node scripts/import-positions.mjs --list                    categorie par defaut
  node scripts/import-positions.mjs --list "Category:Kama Sutra"  categorie precise
  node scripts/import-positions.mjs --import    import reel
`);
}
