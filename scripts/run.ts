// Usage : npm run collect | classify | media | pages | stats | daily (= tout)
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
  if (task === "collect" || task === "stats" || task === "daily") await refreshStats();
  if (task === "classify" || task === "daily") {
    console.log("Classement des pubs…");
    const r = await classifyPending();
    console.log(`→ ${r.classified} classées, ${r.failed} en échec`);
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
  if (!["collect", "classify", "media", "pages", "stats", "daily"].includes(task)) {
    console.log("Usage : npm run collect | classify | media | pages | stats | daily");
    process.exitCode = 1;
  }
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
