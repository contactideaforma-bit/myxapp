#!/usr/bin/env node
/**
 * =====================================================================
 *  myXapp — Import depuis les banques d'images en acces libre
 * =====================================================================
 *
 *  Sources interrogees :
 *    wellcome  Wellcome Collection  (CC-BY / CC0, API cataloguee)
 *    met       The Metropolitan Museum of Art (CC0, Open Access)
 *    commons   Wikimedia Commons (categories)
 *
 *  Inventaire, sans rien modifier :
 *      node scripts/banques-images.mjs --list
 *      node scripts/banques-images.mjs --list --source=met --q="kama sutra"
 *
 *  Import reel (telecharge, depose, cree les fiches) :
 *      node scripts/banques-images.mjs --import
 *
 *  Necessite dans .env.local :
 *      NEXT_PUBLIC_SUPABASE_URL
 *      SUPABASE_SERVICE_ROLE_KEY
 * =====================================================================
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const UA = "myXapp/1.0 (projet prive)";
const BUCKET = "positions";

const REQUETES = [
  "kama sutra",
  "kamasutra",
  "rajput erotic",
  "mughal erotic painting",
  "indian erotic miniature",
  "shunga",
];

function chargerEnv() {
  if (!existsSync(".env.local")) return;
  for (const l of readFileSync(".env.local", "utf8").split("\n")) {
    const t = l.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const [k, ...r] = t.split("=");
    if (!process.env[k.trim()]) process.env[k.trim()] = r.join("=").trim();
  }
}
chargerEnv();

const propre = (v) => (v ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

/* ------------------------------------------------------ WELLCOME */
async function wellcome(q) {
  const url =
    "https://api.wellcomecollection.org/catalogue/v2/images?" +
    new URLSearchParams({ query: q, pageSize: "50", include: "source" });
  const rep = await fetch(url, { headers: { "User-Agent": UA } });
  if (!rep.ok) throw new Error(`Wellcome ${rep.status}`);
  const j = await rep.json();

  return (j.results ?? []).map((im) => {
    const base = im.thumbnail?.url?.replace(/\/info\.json$/, "") ?? "";
    return {
      source: "wellcome",
      id: im.id,
      titre: propre(im.source?.title) || "Sans titre",
      image: base ? `${base}/full/1000,/0/default.jpg` : im.thumbnail?.url,
      page: `https://wellcomecollection.org/works/${im.source?.id ?? ""}`,
      credit: `Wellcome Collection — ${propre(im.locations?.[0]?.license?.label) || "licence ouverte"}`,
    };
  });
}

/* ------------------------------------------------------ THE MET */
async function met(q) {
  const rech =
    "https://collectionapi.metmuseum.org/public/collection/v1/search?" +
    new URLSearchParams({ q, hasImages: "true" });
  const rep = await fetch(rech, { headers: { "User-Agent": UA } });
  if (!rep.ok) throw new Error(`Met ${rep.status}`);
  const { objectIDs } = await rep.json();
  if (!objectIDs?.length) return [];

  const sortie = [];
  for (const id of objectIDs.slice(0, 40)) {
    try {
      const r = await fetch(
        `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`,
        { headers: { "User-Agent": UA } }
      );
      if (!r.ok) continue;
      const o = await r.json();
      if (!o.isPublicDomain || !o.primaryImage) continue;
      sortie.push({
        source: "met",
        id: `met-${o.objectID}`,
        titre: propre(o.title) || "Sans titre",
        image: o.primaryImage,
        page: o.objectURL,
        credit: `The Met — ${propre(o.artistDisplayName) || propre(o.culture) || "domaine public"} — CC0`,
      });
    } catch {
      /* on passe */
    }
  }
  return sortie;
}

/* ------------------------------------------------------ COMMONS */
async function commons(categorie) {
  const params = new URLSearchParams({
    action: "query",
    generator: "categorymembers",
    gcmtitle: categorie,
    gcmtype: "file",
    gcmlimit: "500",
    prop: "imageinfo",
    iiprop: "url|extmetadata|mime",
    iiurlwidth: "1000",
    format: "json",
  });
  const rep = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
    headers: { "User-Agent": UA },
  });
  if (!rep.ok) throw new Error(`Commons ${rep.status}`);
  const j = await rep.json();

  return Object.values(j?.query?.pages ?? {})
    .map((p) => {
      const ii = p.imageinfo?.[0];
      if (!ii) return null;
      const m = ii.extmetadata ?? {};
      return {
        source: "commons",
        id: p.title.replace(/^File:/, ""),
        titre: p.title.replace(/^File:/, "").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "),
        image: ii.thumburl || ii.url,
        page: ii.descriptionurl,
        credit: `${propre(m.Artist?.value) || "Wikimedia Commons"} — ${propre(m.LicenseShortName?.value) || "voir la page"}`,
      };
    })
    .filter(Boolean);
}

/* ------------------------------------------------------ INVENTAIRE */
async function inventorier(source, requete) {
  const tout = [];
  const essayer = async (nom, fn, etiquette) => {
    try {
      const r = await fn();
      console.log(`  ${nom.padEnd(9)} « ${etiquette} » → ${r.length}`);
      tout.push(...r);
    } catch (e) {
      console.warn(`  ${nom.padEnd(9)} « ${etiquette} » → échec : ${e.message}`);
    }
  };

  const requetes = requete ? [requete] : REQUETES;
  console.log("\nInterrogation des banques…\n");

  for (const q of requetes) {
    if (!source || source === "wellcome") await essayer("wellcome", () => wellcome(q), q);
    if (!source || source === "met") await essayer("met", () => met(q), q);
  }
  if (!source || source === "commons") {
    for (const c of ["Category:Kama Sutra", "Category:Erotic art of India", "Category:Shunga"]) {
      await essayer("commons", () => commons(c), c);
    }
  }

  // dedoublonnage
  const vu = new Set();
  const uniques = tout.filter((x) => {
    if (!x.image || vu.has(x.id)) return false;
    vu.add(x.id);
    return true;
  });

  writeFileSync("scripts/banques-liste.json", JSON.stringify(uniques, null, 2));
  console.log(`\n${uniques.length} images uniques retenues.\n`);
  uniques.slice(0, 60).forEach((x, i) =>
    console.log(`${String(i + 1).padStart(3)}. [${x.source}] ${x.titre.slice(0, 70)}`)
  );
  if (uniques.length > 60) console.log(`   … et ${uniques.length - 60} autres`);
  console.log(`\n→ Ecrit dans scripts/banques-liste.json`);
  console.log(`→ Pour importer : node scripts/banques-images.mjs --import\n`);
  return uniques;
}

/* ------------------------------------------------------ IMPORT */
async function importer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle) {
    console.error("\nIl manque NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY dans .env.local\n");
    process.exit(1);
  }
  if (!existsSync("scripts/banques-liste.json")) {
    console.error("\nLance d'abord : node scripts/banques-images.mjs --list\n");
    process.exit(1);
  }

  const supabase = createClient(url, cle, { auth: { persistSession: false } });
  const liste = JSON.parse(readFileSync("scripts/banques-liste.json", "utf8"));

  console.log(`\nImport de ${liste.length} images…\n`);
  let ok = 0, rates = 0, ordre = 10;

  for (const x of liste) {
    const key = `art_${x.source}_${x.id}`
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase().slice(0, 60);

    try {
      const rep = await fetch(x.image, { headers: { "User-Agent": UA } });
      if (!rep.ok) throw new Error(`telechargement ${rep.status}`);
      const buffer = Buffer.from(await rep.arrayBuffer());
      if (buffer.length < 2000) throw new Error("image vide");

      const type = rep.headers.get("content-type") || "image/jpeg";
      const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
      const chemin = `${key}.${ext}`;

      const { error: e1 } = await supabase.storage
        .from(BUCKET)
        .upload(chemin, buffer, { contentType: type, upsert: true });
      if (e1) throw e1;

      const { error: e2 } = await supabase.from("positions").upsert(
        {
          key,
          nom: x.titre.slice(0, 120),
          sous_titre: null,
          description: null,
          conseil: null,
          difficulte: 1,
          intensite: 2,
          figure: null,
          image_path: chemin,
          image_credit: x.credit,
          image_source_url: x.page,
          source: x.source,
          a_relire: true,
          ordre: ordre++,
          active: true,
        },
        { onConflict: "key" }
      );
      if (e2) throw e2;

      console.log(`  ✓ [${x.source}] ${x.titre.slice(0, 60)}`);
      ok++;
    } catch (e) {
      console.warn(`  ✗ ${x.titre.slice(0, 50)} : ${e.message}`);
      rates++;
    }
  }

  console.log(`\n${ok} images importées, ${rates} en échec.`);
  console.log(`Ouvre l'onglet Positions.\n`);
}

const args = process.argv.slice(2);
const source = args.find((a) => a.startsWith("--source="))?.split("=")[1];
const q = args.find((a) => a.startsWith("--q="))?.split("=")[1];

if (args.includes("--list")) await inventorier(source, q);
else if (args.includes("--import")) await importer();
else
  console.log(`
Usage :
  node scripts/banques-images.mjs --list                     toutes les banques
  node scripts/banques-images.mjs --list --source=met        une seule
  node scripts/banques-images.mjs --list --q="kama sutra"    une requete precise
  node scripts/banques-images.mjs --import                   import reel
`);
