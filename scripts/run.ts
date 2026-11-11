// Usage : npm run collect | npm run classify | npm run daily
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
  if (!["collect", "classify", "daily"].includes(task)) {
    console.log("Usage : npm run collect | classify | daily");
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("Erreur :", errMsg(e));
  process.exit(1);
});
