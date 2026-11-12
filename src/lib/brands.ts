/**
 * Vrai nombre de pubs actives par marque.
 * La collecte par mots-clés ne voit que quelques pubs par marque : on demande donc à Meta
 * combien de pubs actives chaque marque a vraiment, et pour les grosses marques (100+)
 * on va chercher TOUTES leurs pubs (Europe, par l'API officielle).
 * US/Canada : le compte vient de la bibliothèque publique (page de la marque).
 */
import { chromium, type Browser, type BrowserContext } from "playwright";
import { db } from "./supabase";
import { FIELDS, MetaApiError, fetchWithRetry, maxUsagePct, metaConfig, type MetaAd, type MetaPage } from "./meta";
import { upsertBatch } from "./collect";
import { newContext } from "./library";
import { errMsg } from "./errors";

type Log = (msg: string) => void;
type Candidate = { page_id: string; page_name: string | null; api: boolean; own: number };

const BIG = 100; // seuil « grosse marque »
const API_LIMIT = Number(process.env.BRAND_LIMIT || 800); // marques vérifiées par jour (Europe)
const LIB_LIMIT = Number(process.env.LIB_BRAND_LIMIT || 300); // marques vérifiées par jour (US/CA)
const MAX_ADS = Number(process.env.BRAND_MAX_ADS || 2000); // pubs max récupérées par marque

export async function checkBrands(log: Log = console.log) {
  const todo = await candidates();
  const api = todo.filter((c) => c.api).slice(0, API_LIMIT);
  const lib = todo.filter((c) => !c.api).slice(0, LIB_LIMIT);
  log(`Marques à vérifier : ${todo.length} (aujourd'hui ${api.length} Europe + ${lib.length} US/CA)`);
  await checkApi(api, log).catch((e) => log(`✗ marques Europe : ${errMsg(e)}`));
  await checkLibrary(lib, log).catch((e) => log(`✗ marques US/CA : ${errMsg(e)}`));
}

/** Marques des pubs actives, jamais vérifiées ou à revérifier (grosse : 7 j, petite : 30 j), les plus présentes d'abord. */
async function candidates(): Promise<Candidate[]> {
  const pages = new Map<string, Candidate>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().from("ads").select("page_id, page_name, source")
      .eq("is_active", true).not("page_id", "is", null).order("id").range(from, from + 999);
    if (error) throw error;
    for (const r of data ?? []) {
      const c = pages.get(r.page_id) ?? { page_id: r.page_id, page_name: r.page_name, api: false, own: 0 };
      c.own++;
      if (r.source !== "library") c.api = true;
      pages.set(r.page_id, c);
    }
    if (!data || data.length < 1000) break;
  }
  const checked = new Map<string, { total: number; at: number }>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().from("brands").select("page_id, total_active, checked_at").range(from, from + 999);
    if (error) throw error;
    for (const b of data ?? []) checked.set(b.page_id, { total: b.total_active ?? 0, at: Date.parse(b.checked_at ?? "1970") });
    if (!data || data.length < 1000) break;
  }
  const now = Date.now();
  return [...pages.values()]
    .filter((c) => {
      const b = checked.get(c.page_id);
      if (!b) return true;
      return now - b.at > (b.total >= BIG ? 7 : 30) * 86400_000;
    })
    .sort((a, b) => b.own - a.own);
}

async function saveBrand(c: Candidate, total: number) {
  const { error } = await db().from("brands").upsert(
    { page_id: c.page_id, page_name: c.page_name, total_active: total, checked_at: new Date().toISOString() },
    { onConflict: "page_id" },
  );
  if (error) throw error;
}

/* ---------- Europe : API officielle ---------- */

async function checkApi(list: Candidate[], log: Log) {
  if (!list.length) return;
  const cfg = metaConfig();
  const now = new Date().toISOString();
  let big = 0, saved = 0, done = 0;
  for (const c of list) {
    const ads: MetaAd[] = [];
    let url: string | undefined = `https://graph.facebook.com/${cfg.version}/ads_archive?` + new URLSearchParams({
      search_page_ids: JSON.stringify([c.page_id]),
      ad_type: "ALL",
      ad_active_status: "ACTIVE",
      ad_reached_countries: JSON.stringify(cfg.countries),
      fields: FIELDS,
      limit: "250",
      access_token: cfg.token,
    });
    while (url && ads.length < MAX_ADS) {
      const res = await fetchWithRetry(url);
      const json = (await res.json()) as MetaPage;
      if (json.error) {
        const code = /blocked/i.test(json.error.message) ? 4 : json.error.code;
        throw new MetaApiError(`${json.error.message} (après ${done} marques)`, code);
      }
      ads.push(...(json.data ?? []));
      url = json.paging?.next;
      const usage = maxUsagePct(res.headers.get("x-business-use-case-usage"));
      if (usage >= 75) throw new MetaApiError(`Quota Meta à ${usage} %, on reprend demain (après ${done} marques)`, 4);
      await new Promise((r) => setTimeout(r, usage >= 40 ? 5000 : 1200));
    }
    // Grosse marque : on garde toutes ses pubs (les étoiles se calculent alors sur la marque entière)
    if (ads.length >= BIG) {
      big++;
      for (let i = 0; i < ads.length; i += 200) saved += await upsertBatch(ads.slice(i, i + 200), null, now);
    }
    await saveBrand(c, ads.length);
    done++;
    if (done % 100 === 0) log(`  … ${done}/${list.length} marques Europe vérifiées`);
  }
  log(`✓ marques Europe : ${done} vérifiées, ${big} avec ${BIG}+ pubs actives → ${saved} pubs ajoutées/mises à jour`);
}

/* ---------- US / Canada : bibliothèque publique ---------- */

async function checkLibrary(list: Candidate[], log: Log) {
  if (!list.length) return;
  let browser: Browser = await chromium.launch();
  let ctx: BrowserContext = await newContext(browser);
  let big = 0, done = 0, fails = 0;
  try {
    for (const c of list) {
      try {
        let total = await libraryCount(ctx, c.page_id, "US");
        if (total === 0) total = await libraryCount(ctx, c.page_id, "CA");
        await saveBrand(c, total);
        if (total >= BIG) big++;
        done++;
        fails = 0;
      } catch (e) {
        fails++;
        if (fails >= 5) { log(`✗ marques US/CA : arrêt après 5 échecs de suite (${errMsg(e)})`); break; }
        // Nouveau navigateur après une erreur (souvent un blocage passager)
        await browser.close().catch(() => {});
        await new Promise((r) => setTimeout(r, 20000 * fails));
        browser = await chromium.launch();
        ctx = await newContext(browser);
      }
      await new Promise((r) => setTimeout(r, 2000 + Math.random() * 3000));
    }
  } finally {
    await browser.close().catch(() => {});
  }
  log(`✓ marques US/CA : ${done} vérifiées, ${big} avec ${BIG}+ pubs actives`);
}

/** Nombre de pubs actives d'une marque dans un pays (le « ~93 results » de la page de la marque). */
async function libraryCount(ctx: BrowserContext, pageId: string, country: string): Promise<number> {
  const page = await ctx.newPage();
  try {
    await page.goto(
      `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${country}`
        + `&view_all_page_id=${pageId}&search_type=page&media_type=all`,
      { waitUntil: "domcontentloaded", timeout: 60000 },
    );
    if (/login|checkpoint/.test(page.url())) throw new Error("mur de connexion");
    for (let i = 0; i < 15; i++) {
      const html = await page.content();
      const m = html.match(/"search_results_connection":\{"count":(\d+)/) ?? html.match(/"count":(\d+),"edges"/);
      if (m) return Number(m[1]);
      const body = (await page.textContent("body").catch(() => "")) ?? "";
      const t = body.match(/~?\s?([\d,.]+)\s+results?/i);
      if (t) return Number(t[1].replace(/[,.]/g, ""));
      if (/no ads match|aucune publicité ne correspond/i.test(body)) return 0;
      await page.waitForTimeout(1000);
    }
    throw new Error("compte introuvable sur la page");
  } finally {
    await page.close().catch(() => {});
  }
}
