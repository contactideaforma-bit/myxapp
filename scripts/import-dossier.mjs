#!/usr/bin/env node
/**
 * =====================================================================
 *  myXapp — Import par lot des illustrations de positions
 * =====================================================================
 *
 *  Depose tes images dans un dossier, nommees comme les cles du
 *  catalogue :
 *      grande_ouverte.png   baillement.jpg   indrani.webp   ...
 *
 *  Puis :
 *      node scripts/import-dossier.mjs ./mes-illustrations
 *
 *  Pour connaitre les cles attendues :
 *      node scripts/import-dossier.mjs --cles
 *
 *  Variables necessaires dans .env.local :
 *      NEXT_PUBLIC_SUPABASE_URL
 *      SUPABASE_SERVICE_ROLE_KEY
 * =====================================================================
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { extname, basename, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "intimate";
const TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

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

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle) {
    console.error("\nIl manque NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY dans .env.local\n");
    process.exit(1);
  }
  return createClient(url, cle, { auth: { persistSession: false } });
}

async function afficherCles() {
  const supabase = client();
  const { data, error } = await supabase
    .from("positions")
    .select("key, nom")
    .eq("active", true)
    .order("ordre");
  if (error) throw error;
  console.log(`\n${data.length} positions au catalogue :\n`);
  data.forEach((p) => console.log(`  ${p.key.padEnd(18)} ${p.nom}`));
  console.log(`\nNomme tes fichiers d'apres la colonne de gauche.\n`);
}

async function importer(dossier) {
  if (!existsSync(dossier)) {
    console.error(`\nDossier introuvable : ${dossier}\n`);
    process.exit(1);
  }
  const supabase = client();

  const { data: couples, error: errC } = await supabase
    .from("couples")
    .select("id")
    .not("member_b", "is", null);
  if (errC) throw errC;

  const argCouple = process.argv.find((a) => a.startsWith("--couple="));
  const coupleId = argCouple ? argCouple.split("=")[1] : couples?.[0]?.id;

  if (!coupleId) {
    console.error("\nAucun couple forme trouve. Liez d'abord les deux comptes.\n");
    process.exit(1);
  }
  if (!argCouple && couples.length > 1) {
    console.error(`\nPlusieurs couples en base. Precise --couple=<id> parmi :`);
    couples.forEach((c) => console.error(`  ${c.id}`));
    process.exit(1);
  }

  const { data: positions } = await supabase.from("positions").select("key");
  const cles = new Set((positions ?? []).map((p) => p.key));

  const fichiers = readdirSync(dossier).filter((f) => TYPES[extname(f).toLowerCase()]);
  if (!fichiers.length) {
    console.error(`\nAucune image exploitable dans ${dossier}\n`);
    process.exit(1);
  }

  console.log(`\nCouple : ${coupleId}`);
  console.log(`${fichiers.length} fichiers a traiter.\n`);

  let ok = 0;
  let ignores = 0;

  for (const f of fichiers) {
    const cle = basename(f, extname(f)).toLowerCase();
    if (!cles.has(cle)) {
      console.warn(`  · ignore : ${f} (aucune position nommee « ${cle} »)`);
      ignores++;
      continue;
    }

    const ext = extname(f).toLowerCase();
    const chemin = `${coupleId}/positions/${cle}${ext}`;

    const { error: errUp } = await supabase.storage
      .from(BUCKET)
      .upload(chemin, readFileSync(join(dossier, f)), {
        contentType: TYPES[ext],
        upsert: true,
      });
    if (errUp) {
      console.warn(`  ✗ ${cle} : ${errUp.message}`);
      continue;
    }

    const { error: errDb } = await supabase
      .from("position_images")
      .upsert(
        { couple_id: coupleId, position_key: cle, storage_path: chemin, updated_at: new Date().toISOString() },
        { onConflict: "couple_id,position_key" }
      );
    if (errDb) {
      console.warn(`  ✗ ${cle} : ${errDb.message}`);
      continue;
    }

    console.log(`  ✓ ${cle}`);
    ok++;
  }

  console.log(`\n${ok} illustrations importees, ${ignores} ignorees.\n`);
}

const arg = process.argv[2];
if (arg === "--cles") await afficherCles();
else if (arg && !arg.startsWith("--")) await importer(arg);
else {
  console.log(`
Usage :
  node scripts/import-dossier.mjs --cles            liste les cles attendues
  node scripts/import-dossier.mjs ./mon-dossier     import par lot
`);
}
