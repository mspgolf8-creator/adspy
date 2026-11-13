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
  let big = 0, saved = 0, done = 0, skipped = 0, errorsInRow = 0;
  for (const c of list) {
    let ads: MetaAd[];
    try {
      ads = await fetchBrandAds(c.page_id, cfg);
      errorsInRow = 0;
    } catch (e) {
      // Token invalide ou quota : inutile de continuer. Autre erreur de Meta : on saute cette marque.
      if (e instanceof MetaApiError && (e.isAuth || e.isRateLimit)) throw new MetaApiError(`${e.message} (après ${done} marques)`, e.code);
      skipped++;
      if (++errorsInRow >= 10) throw new Error(`10 erreurs de suite (${errMsg(e)}) après ${done} marques`);
      continue;
    }
    // Grosse marque : on calcule le rang de chaque pub sur TOUTE la marque, puis on garde seulement
    // celles qui peuvent passer le pré-filtre (base légère, plan gratuit de Supabase)
    if (ads.length >= BIG) {
      big++;
      const best = keepBest(ads);
      const keep = ads.filter((a) => best.has(a.id));
      for (let i = 0; i < keep.length; i += 200) saved += await upsertBatch(keep.slice(i, i + 200), null, now, best);
    }
    await saveBrand(c, ads.length);
    done++;
    if (done % 100 === 0) log(`  … ${done}/${list.length} marques Europe vérifiées`);
  }
  log(`✓ marques Europe : ${done} vérifiées (${skipped} sautées), ${big} avec ${BIG}+ pubs actives → ${saved} pubs gardées (3★+ possibles, 7 j+)`);
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

/**
 * Toutes les pubs actives d'une marque (Europe). Meta renvoie parfois « An unknown error occurred »
 * sur les grosses pages : on réessaie avec des pages plus petites avant d'abandonner.
 */
async function fetchBrandAds(pageId: string, cfg: ReturnType<typeof metaConfig>): Promise<MetaAd[]> {
  let lastErr: unknown;
  for (const limit of [250, 100, 25]) {
    const ads: MetaAd[] = [];
    let url: string | undefined = `https://graph.facebook.com/${cfg.version}/ads_archive?` + new URLSearchParams({
      search_page_ids: JSON.stringify([pageId]),
      ad_type: "ALL",
      ad_active_status: "ACTIVE",
      ad_reached_countries: JSON.stringify(cfg.countries),
      fields: FIELDS,
      limit: String(limit),
      access_token: cfg.token,
    });
    try {
      while (url && ads.length < MAX_ADS) {
        const res = await fetchWithRetry(url);
        const json = (await res.json()) as MetaPage;
        if (json.error) {
          const code = /blocked/i.test(json.error.message) ? 4 : json.error.code;
          throw new MetaApiError(json.error.message, code);
        }
        ads.push(...(json.data ?? []));
        url = json.paging?.next;
        const usage = maxUsagePct(res.headers.get("x-business-use-case-usage"));
        if (usage >= 75) throw new MetaApiError(`Quota Meta à ${usage} %, on reprend demain`, 4);
        await new Promise((r) => setTimeout(r, usage >= 40 ? 5000 : 1200));
      }
      return ads;
    } catch (e) {
      if (e instanceof MetaApiError && (e.isAuth || e.isRateLimit)) throw e;
      lastErr = e;
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  throw lastErr;
}

/**
 * Rang de chaque pub dans sa marque (0 = la plus vue), comme refresh_ad_stats :
 * portée décroissante, puis la plus ancienne d'abord. Garde les pubs qui auront 3 étoiles et +
 * et 7 jours et + (14 j+, ou 7 j+ dans la meilleure moitié de la marque).
 */
function keepBest(ads: MetaAd[]): Map<string, { ext_pct: number }> {
  const now = Date.now();
  const days = (a: MetaAd) => Math.max(1, Math.floor((now - Date.parse(a.ad_delivery_start_time ?? new Date().toISOString())) / 86400_000));
  const sorted = [...ads].sort((a, b) => (b.eu_total_reach ?? 0) - (a.eu_total_reach ?? 0) || days(b) - days(a));
  const out = new Map<string, { ext_pct: number }>();
  const n = sorted.length;
  sorted.forEach((a, i) => {
    const pct = n > 1 ? i / (n - 1) : 0;
    const d = days(a);
    if (d >= 14 || (d >= 7 && pct <= 0.5)) out.set(a.id, { ext_pct: pct });
  });
  return out;
}
