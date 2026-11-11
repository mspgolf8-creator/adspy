// Usage : npm run collect | classify | media | daily (= les trois)
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
  if (task === "classify" || task === "daily") {
    console.log("Classement des pubs…");
    const r = await classifyPending();
    console.log(`→ ${r.classified} classées, ${r.failed} en échec`);
  }
  if (task === "media" || task === "daily") {
    console.log("Visuels des pubs…");
    // Importé seulement ici : Playwright n'est pas nécessaire pour le reste
    const { fetchMedia } = await import("../src/lib/media");
    await fetchMedia().catch((e) => console.log("✗ visuels :", errMsg(e)));
  }
  if (!["collect", "classify", "media", "daily"].includes(task)) {
    console.log("Usage : npm run collect | classify | media | daily");
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("Erreur :", errMsg(e));
  process.exit(1);
});
