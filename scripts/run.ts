// Usage : npm run collect | us | brands | alleger | classify | media | pages | stats | daily (= tout)
import { config } from "dotenv";
config({ path: ".env.local" });

import { errMsg } from "../src/lib/errors";

const task = process.argv[2];

async function main() {
  const { collect } = await import("../src/lib/collect");
  const { classifyPending } = await import("../src/lib/classify");

  if (task === "collect" || task === "daily") {
    console.log("Collecte des pubs Meta…");
    const r = await collect();
    console.log(`→ ${r.upserted} pubs sauvegardées, ${r.deactivated} marquées inactives`);
  }
  if (task === "us" || task === "daily") {
    console.log("Collecte US / Canada (bibliothèque publique)…");
    const { collectLibrary } = await import("../src/lib/library");
    await collectLibrary().catch((e) => console.log("✗ US/CA :", errMsg(e)));
  }
  if (task === "brands" || task === "daily") {
    console.log("Vrai nombre de pubs par marque…");
    const { checkBrands } = await import("../src/lib/brands");
    await checkBrands().catch((e) => console.log("✗ marques :", errMsg(e)));
  }
  if (task === "cleanup" || task === "daily") {
    const { cleanup } = await import("../src/lib/cleanup");
    await cleanup().catch((e) => console.log("✗ ménage :", errMsg(e)));
  }
  if (task === "alleger") await alleger();
  if (["collect", "us", "brands", "stats", "alleger", "daily"].includes(task)) await refreshStats();
  if (task === "classify" || task === "daily") {
    console.log("Classement des pubs…");
    // Un échec ici ne doit pas empêcher les visuels et les pages de passer
    await classifyPending()
      .then((r) => console.log(`→ ${r.classified} classées, ${r.failed} en échec`))
      .catch((e) => console.log("✗ classement :", errMsg(e)));
  }
  if (task === "media" || task === "daily") {
    console.log("Visuels des pubs…");
    // Importé seulement ici : Playwright n'est pas nécessaire pour le reste
    const { fetchMedia, refreshVideos } = await import("../src/lib/media");
    await fetchMedia().catch((e) => console.log("✗ visuels :", errMsg(e)));
    await refreshVideos().catch((e) => console.log("✗ vidéos :", errMsg(e)));
  }
  if (task === "pages" || task === "daily") {
    console.log("Types de page de destination…");
    const { fetchPageTypes } = await import("../src/lib/pages");
    await fetchPageTypes().catch((e) => console.log("✗ types de page :", errMsg(e)));
  }
  if (!["collect", "us", "brands", "classify", "media", "pages", "stats", "cleanup", "alleger", "daily"].includes(task)) {
    console.log("Usage : npm run collect | us | brands | classify | media | pages | stats | cleanup | daily");
    process.exitCode = 1;
  }
}

/** Ménage des grosses marques, quelques marques à la fois (fonction SQL alleger_marques, migration 009). */
async function alleger() {
  const { db } = await import("../src/lib/supabase");
  let total = 0, fails = 0;
  for (;;) {
    const { data, error } = await db().rpc("alleger_marques", { n: 15 });
    if (error) {
      console.log("✗ ménage :", error.message);
      if (++fails >= 5) return;
      await new Promise((r) => setTimeout(r, 30000));
      continue;
    }
    fails = 0;
    if (!data) break;
    total += data;
    if (total % 75 === 0 || data < 15) console.log(`  … ${total} marques allégées`);
  }
  console.log(`✓ ménage : ${total} marques allégées`);
}

/** Étoiles, rang dans la marque, usage des créas (fonction SQL refresh_ad_stats). */
async function refreshStats() {
  const { db } = await import("../src/lib/supabase");
  const { data, error } = await db().rpc("refresh_ad_stats");
  if (error) console.log("✗ statistiques :", error.message);
  else console.log(`✓ statistiques : ${data} pubs mises à jour`);
}

main().catch((e) => {
  console.error("Erreur :", errMsg(e));
  process.exit(1);
});
