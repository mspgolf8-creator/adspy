// Rafraîchit les liens vidéo : npx tsx scripts/videos.ts
import { config } from "dotenv";
config({ path: ".env.local" });
import("../src/lib/media").then((m) => m.refreshVideos());
