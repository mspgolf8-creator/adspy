/**
 * Pubs US / Canada : l'API officielle de Meta ne les donne pas (seulement Europe + UK),
 * donc un navigateur robot ouvre la bibliothèque publique (facebook.com/ads/library),
 * comme un visiteur, et lit les résultats que la page reçoit (triés par impressions).
 *
 * Pour ne pas casser :
 *  - on lit les données brutes (JSON) que reçoit la page, pas l'affichage ;
 *  - chaque recherche est réessayée avec un nouveau navigateur si Facebook bloque ;
 *  - après LIB_MAX_BLOCKS blocages d'affilée on arrête proprement (on garde ce qui est pris) ;
 *  - pauses aléatoires entre les recherches, comme un humain.
 */
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { db } from "./supabase";
import { errMsg } from "./errors";

type Log = (msg: string) => void;
const BUCKET = "ad-media";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/* ---------- Format des données de la bibliothèque ---------- */

type Card = {
  body?: string | null; title?: string | null; link_url?: string | null; link_description?: string | null;
  caption?: string | null; cta_text?: string | null;
  resized_image_url?: string | null; original_image_url?: string | null;
  video_sd_url?: string | null; video_hd_url?: string | null; video_preview_image_url?: string | null;
};
type LibAd = {
  ad_archive_id: string;
  page_id?: string | null;
  page_name?: string | null;
  is_active?: boolean;
  collation_count?: number | null;
  start_date?: number | null;
  end_date?: number | null;
  publisher_platform?: string[] | null;
  snapshot?: Card & {
    page_name?: string | null;
    body?: { text?: string | null } | null;
    display_format?: string | null;
    cards?: Card[] | null;
    images?: { resized_image_url?: string | null; original_image_url?: string | null }[] | null;
    videos?: { video_sd_url?: string | null; video_hd_url?: string | null; video_preview_image_url?: string | null }[] | null;
  } | null;
};

/** Cherche récursivement la liste de résultats dans n'importe quel JSON de Facebook. */
function findResults(node: unknown, out: LibAd[] = [], depth = 0): LibAd[] {
  if (!node || typeof node !== "object" || depth > 40) return out;
  if (Array.isArray(node)) {
    for (const x of node) findResults(x, out, depth + 1);
    return out;
  }
  const o = node as Record<string, unknown>;
  if (typeof o.ad_archive_id === "string" && o.snapshot) {
    out.push(o as unknown as LibAd);
    return out;
  }
  for (const v of Object.values(o)) findResults(v, out, depth + 1);
  return out;
}

function findKey(node: unknown, key: string, depth = 0): unknown {
  if (!node || typeof node !== "object" || depth > 40) return null;
  const o = node as Record<string, unknown>;
  if (key in o) return o[key];
  for (const v of Object.values(o)) {
    const r = findKey(v, key, depth + 1);
    if (r) return r;
  }
  return null;
}

/** Les réponses GraphQL de Facebook sont parfois plusieurs JSON collés (une par ligne). */
function parseLines(text: string): unknown[] {
  const clean = text.replace(/^for \(;;\);/, "");
  const out: unknown[] = [];
  for (const line of clean.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("{")) continue;
    try { out.push(JSON.parse(t)); } catch {}
  }
  return out;
}

const isTemplate = (s?: string | null) => !s || /\{\{.*\}\}/.test(s);
const first = <T>(...xs: (T | null | undefined)[]) => xs.find((x) => x != null && x !== "") ?? null;

/** Langue du texte : simple comptage de petits mots (suffit pour en / fr / es). */
export function guessLang(text: string): string[] {
  const words = text.toLowerCase().match(/[a-zàâçéèêëîïôûùüÿñ']+/g) ?? [];
  const score = (list: string[]) => words.filter((w) => list.includes(w)).length;
  const s = {
    en: score(["the", "and", "you", "your", "for", "with", "this", "our", "is", "to", "of"]),
    fr: score(["le", "la", "les", "et", "vous", "votre", "pour", "avec", "des", "est", "une", "du"]),
    es: score(["el", "los", "las", "y", "tu", "para", "con", "es", "una", "del", "por"]),
  };
  const best = (Object.entries(s) as [string, number][]).sort((a, b) => b[1] - a[1])[0];
  return best[1] >= 2 ? [best[0]] : [];
}

type Parsed = ReturnType<typeof toParsed>;
function toParsed(ad: LibAd, country: string, rank: number) {
  const s = ad.snapshot ?? {};
  const card = s.cards?.find((c) => !isTemplate(c.body) || c.title) ?? s.cards?.[0] ?? {};
  const body = first(isTemplate(s.body?.text) ? null : s.body?.text, isTemplate(card.body) ? null : card.body);
  const title = first(isTemplate(s.title) ? null : s.title, isTemplate(card.title) ? null : card.title);
  const video = s.videos?.[0] ?? (card.video_sd_url || card.video_hd_url ? card : null);
  const image = first(
    s.images?.[0]?.resized_image_url, s.images?.[0]?.original_image_url,
    video?.video_preview_image_url, card.resized_image_url, card.original_image_url,
  );
  const videoUrl = first(video?.video_sd_url, video?.video_hd_url);
  const oe = videoUrl ? new URL(videoUrl).searchParams.get("oe") : null;
  return {
    id: ad.ad_archive_id,
    country,
    rank,
    image,
    row: {
      id: ad.ad_archive_id,
      page_id: ad.page_id ?? null,
      page_name: first(ad.page_name, s.page_name),
      bodies: body ? [body] : [],
      link_titles: title ? [title] : [],
      link_descriptions: [first(s.link_description, card.link_description)].filter(Boolean) as string[],
      link_captions: [first(s.caption, card.caption)].filter(Boolean) as string[],
      publisher_platforms: (ad.publisher_platform ?? []).map((p) => p.toLowerCase()),
      delivery_start: ad.start_date ? new Date(ad.start_date * 1000).toISOString() : null,
      delivery_stop: ad.is_active === false && ad.end_date ? new Date(ad.end_date * 1000).toISOString() : null,
      is_active: ad.is_active !== false,
      collation_count: ad.collation_count ?? 1,
      cta_text: first(s.cta_text, card.cta_text),
      landing_url: first(s.link_url, card.link_url),
      media_kind: videoUrl ? "video" : image ? "image" : null,
      video_url: videoUrl,
      video_expires_at: oe ? new Date(parseInt(oe, 16) * 1000).toISOString() : null,
    },
  };
}

/* ---------- Navigation ---------- */

class Blocked extends Error {}

async function newContext(browser: Browser) {
  return browser.newContext({ locale: "en-US", userAgent: UA, viewport: { width: 1280, height: 900 }, timezoneId: "America/New_York" });
}

/** Une recherche (mot-clé × pays) : renvoie jusqu'à `max` pubs dans l'ordre de Meta (impressions). */
async function searchOne(ctx: BrowserContext, term: string, country: string, media: string, max: number): Promise<LibAd[]> {
  const page: Page = await ctx.newPage();
  const seen = new Map<string, LibAd>();
  const add = (ads: LibAd[]) => { for (const a of ads) if (!seen.has(a.ad_archive_id)) seen.set(a.ad_archive_id, a); };
  let lastHasNext = true;
  let limited = false; // Facebook refuse la page suivante (serveurs de centre de données)
  page.on("response", async (r) => {
    if (!r.url().includes("/api/graphql")) return;
    const text = await r.text().catch(() => "");
    if (process.env.LIB_DEBUG_DIR) {
      const name = new URLSearchParams(r.request().postData() ?? "").get("fb_api_req_friendly_name");
      console.log(`  gql ${name} ${r.status()} ${text.length}o ${text.includes("ad_archive_id") ? "" : text.slice(0, 160).replace(/\s+/g, " ")}`);
    }
    if (/Rate limit exceeded/.test(text)) limited = true;
    if (!text.includes("ad_archive_id")) return;
    for (const j of parseLines(text)) {
      const found = findResults(j);
      if (!found.length) continue;
      add(found);
      const conn = findKey(j, "search_results_connection") as { page_info?: { has_next_page?: boolean } } | null;
      if (typeof conn?.page_info?.has_next_page === "boolean") lastHasNext = conn.page_info.has_next_page;
    }
  });
  try {
    const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${country}`
      + `&q=${encodeURIComponent(term)}&search_type=keyword_unordered&media_type=${media}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    if (/login|checkpoint/.test(page.url())) throw new Blocked("mur de connexion");

    // Première page : intégrée au HTML
    const embedded = await page.evaluate(() =>
      [...document.querySelectorAll('script[type="application/json"]')]
        .map((s) => s.textContent ?? "").filter((t) => t.includes("ad_archive_id")));
    for (const t of embedded) { try { add(findResults(JSON.parse(t))); } catch {} }
    // Sinon la première page arrive par le réseau : on l'attend jusqu'à 20 s
    for (let i = 0; i < 20 && !seen.size; i++) await page.waitForTimeout(1000);
    if (!seen.size) {
      const body = (await page.textContent("body").catch(() => "")) ?? "";
      if (/no ads match|aucune publicité ne correspond|^\s*0 results/im.test(body)) return [];
      await debugDump(page, `${country}-${term}`);
      throw new Blocked(`aucun résultat lisible (page : ${body.replace(/\s+/g, " ").slice(0, 160)})`);
    }

    // Pages suivantes : défilement (Facebook charge ~30 pubs à la fois)
    let still = 0;
    while (seen.size < max && lastHasNext && !limited && still < 5) {
      const before = seen.size;
      await page.mouse.move(640, 450);
      await page.mouse.wheel(0, 6000);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      // Selon la version de la page, Facebook charge la suite au défilement ou avec un bouton « See more »
      const more = page.locator('[role="button"]', { hasText: /^\s*(See more|Voir plus|Afficher plus)\s*$/ }).last();
      if (await more.isVisible().catch(() => false)) {
        await more.click({ timeout: 5000 }).catch((e) => process.env.LIB_DEBUG_DIR && console.log(`  clic raté : ${errMsg(e)}`));
        if (process.env.LIB_DEBUG_DIR) console.log("  clic See more");
      }
      await page.waitForTimeout(2000 + Math.random() * 1500);
      still = seen.size === before ? still + 1 : 0;
    }
    if (process.env.LIB_DEBUG_DIR && seen.size < max) {
      console.log(`  (arrêt à ${seen.size} : suite=${lastHasNext}, limité=${limited}, sans nouveauté=${still})`);
      if (still >= 5 && !limited) await debugDump(page, `scroll-${country}-${term}`);
    }
    return [...seen.values()].slice(0, max);
  } finally {
    await page.close().catch(() => {});
  }
}

/** Capture d'écran + HTML quand la page n'a pas la forme attendue (dossier LIB_DEBUG_DIR). */
async function debugDump(page: Page, name: string) {
  const dir = process.env.LIB_DEBUG_DIR;
  if (!dir) return;
  const { mkdirSync, writeFileSync } = await import("fs");
  mkdirSync(dir, { recursive: true });
  const safe = name.replace(/[^a-z0-9-]+/gi, "_");
  await page.screenshot({ path: `${dir}/${safe}.png`, fullPage: false }).catch(() => {});
  writeFileSync(`${dir}/${safe}.html`, await page.content().catch(() => ""));
}

/* ---------- Sauvegarde ---------- */

async function saveBatch(items: Parsed[], terms: Map<string, Set<string>>, countries: Map<string, Set<string>>, now: string) {
  const ids = items.map((i) => i.id);
  const { data: existing, error } = await db()
    .from("ads").select("id, matched_terms, countries, languages, source, media_url").in("id", ids);
  if (error) throw error;
  const prev = new Map((existing ?? []).map((e) => [e.id as string, e]));
  const rows = items.map((it) => {
    const p = prev.get(it.id);
    const text = [...it.row.bodies, ...it.row.link_titles].join(" ");
    const row: Record<string, unknown> = {
      ...it.row,
      matched_terms: [...new Set([...(p?.matched_terms ?? []), ...(terms.get(it.id) ?? [])])],
      countries: [...new Set([...(p?.countries ?? []), ...(countries.get(it.id) ?? [])])],
      languages: p?.languages?.length ? p.languages : guessLang(text),
      source: p?.source ?? "library",
      lib_rank: it.rank,
      last_seen_at: now,
    };
    return row;
  });
  const { error: e2 } = await db().from("ads").upsert(rows, { onConflict: "id" });
  if (e2) throw e2;
}

/** Télécharge les visuels (les liens fbcdn expirent) : photo réduite en JPEG dans Supabase Storage. */
async function storeImages(browser: Browser, items: Parsed[], limit: number, log: Log) {
  const ids = items.map((i) => i.id);
  const have = new Set<string>();
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await db().from("ads").select("id").in("id", ids.slice(i, i + 300)).not("media_url", "is", null);
    for (const r of data ?? []) have.add(r.id as string);
  }
  const todo = items.filter((i) => i.image && !have.has(i.id)).sort((a, b) => a.rank - b.rank).slice(0, limit);
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  let ok = 0;
  let failed = 0;
  for (const it of todo) {
    try {
      await page.setContent(`<body style="margin:0;background:#000"><img id="i" src="${it.image!.replace(/"/g, "&quot;")}" style="display:block;width:420px;height:auto"></body>`);
      const img = page.locator("#i");
      await img.evaluate((el: HTMLImageElement) => el.decode());
      const jpeg = await img.screenshot({ type: "jpeg", quality: 70, timeout: 10000 });
      const path = `${it.id}.jpg`;
      const { error } = await db().storage.from(BUCKET).upload(path, jpeg, { contentType: "image/jpeg", upsert: true });
      if (error) throw error;
      const { data } = db().storage.from(BUCKET).getPublicUrl(path);
      await db().from("ads").update({ media_url: data.publicUrl, media_tried_at: new Date().toISOString() }).eq("id", it.id);
      ok++;
    } catch {
      failed++;
    }
  }
  await page.close();
  log(`✓ visuels US/CA : ${ok} enregistrés${failed ? `, ${failed} en échec` : ""}`);
}

/* ---------- Collecte ---------- */

export async function collectLibrary(log: Log = console.log) {
  const countries = (process.env.LIB_COUNTRIES || "US,CA").split(",").map((c) => c.trim()).filter(Boolean);
  // Chaque format (toutes, vidéo, image) donne un autre « top 30 » : plus de pubs même si Facebook bloque la page 2
  const medias = (process.env.LIB_MEDIA_TYPES || "all,video,image").split(",").map((m) => m.trim()).filter(Boolean);
  const max = Number(process.env.LIB_MAX_PER_TERM || 200);
  const maxBlocks = Number(process.env.LIB_MAX_BLOCKS || 3);
  const now = new Date().toISOString();

  // LIB_TERMS="a,b" pour tester sur quelques mots-clés ; LIB_DRY=1 pour ne rien sauvegarder
  const keywords = process.env.LIB_TERMS
    ? process.env.LIB_TERMS.split(",").map((term) => ({ term: term.trim() }))
    : (await db().from("keywords").select("term").eq("enabled", true).order("id")).data;

  const best = new Map<string, Parsed>();
  const terms = new Map<string, Set<string>>();
  const seenIn = new Map<string, Set<string>>();
  let blocks = 0;
  let browser = await chromium.launch();
  let ctx = await newContext(browser);

  try {
    outer: for (const country of countries) {
      for (const { term } of keywords ?? []) for (const media of medias) {
        let ads: LibAd[] | null = null;
        for (let attempt = 1; attempt <= 2 && !ads; attempt++) {
          try {
            ads = await searchOne(ctx, term, country, media, max);
            blocks = 0;
          } catch (e) {
            blocks++;
            log(`✗ ${country} « ${term} » ${media} (essai ${attempt}) : ${errMsg(e)}`);
            if (blocks >= maxBlocks) {
              log(`✗ Facebook bloque (${blocks} fois de suite) : arrêt, on garde ce qui est pris`);
              break outer;
            }
            // Nouveau navigateur « propre » + pause avant de réessayer
            await ctx.close().catch(() => {});
            await browser.close().catch(() => {});
            await new Promise((r) => setTimeout(r, 20000 * attempt));
            browser = await chromium.launch();
            ctx = await newContext(browser);
          }
        }
        if (!ads) continue;
        ads.forEach((a, i) => {
          const p = toParsed(a, country, i + 1);
          const old = best.get(p.id);
          if (!old || p.rank < old.rank) best.set(p.id, p);
          (terms.get(p.id) ?? terms.set(p.id, new Set()).get(p.id)!).add(term);
          (seenIn.get(p.id) ?? seenIn.set(p.id, new Set()).get(p.id)!).add(country);
        });
        log(`✓ ${country} « ${term} » ${media} : ${ads.length} pubs`);
        await new Promise((r) => setTimeout(r, 3000 + Math.random() * 4000));
      }
    }

    const items = [...best.values()];
    if (process.env.LIB_DRY) {
      for (const it of items.slice(0, 5)) log(JSON.stringify({ rank: it.rank, image: !!it.image, ...it.row, video_url: !!it.row.video_url }));
      log(`→ (test) ${items.length} pubs lues, rien sauvegardé`);
      return items.length;
    }
    for (let i = 0; i < items.length; i += 200) await saveBatch(items.slice(i, i + 200), terms, seenIn, now);
    log(`→ US/CA : ${items.length} pubs sauvegardées`);
    await storeImages(browser, items, Number(process.env.LIB_MEDIA_LIMIT || 400), log).catch((e) => log(`✗ visuels US/CA : ${errMsg(e)}`));
    return items.length;
  } finally {
    await browser.close().catch(() => {});
  }
}
