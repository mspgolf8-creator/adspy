// Teste le classeur de pages : npx tsx scripts/test-pages.ts URL…
import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";

async function main() {
  const { classifyPage, readSignalsForTest } = await import("../src/lib/pages");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  for (const url of process.argv.slice(2)) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
      await page.waitForTimeout(2500);
      const s = await readSignalsForTest(page);
      console.log(classifyPage(s).padEnd(18), url, JSON.stringify({ ...s, h: s.h.length }));
    } catch (e) {
      console.log("ERREUR".padEnd(18), url, (e as Error).message.split("\n")[0]);
    }
  }
  await browser.close();
}
main();
