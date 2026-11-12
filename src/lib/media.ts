/**
 * Miniatures des pubs : un navigateur robot (Playwright) ouvre l'aperçu officiel de chaque pub
 * (le lien ad_snapshot_url de l'API), photographie le visuel et le range dans Supabase Storage.
 * Les meilleures pubs passent en premier ; MEDIA_LIMIT par passage pour rester discret.
 */
import { chromium, type Browser, type Page } from "playwright";
import sharp from "sharp";
import { db } from "./supabase";
import { metaConfig } from "./meta";
import { errMsg } from "./errors";
import { PREFILTER } from "./filters";
import { landingFromSnapshot } from "./pages";

const BUCKET = "ad-media";
type Log = (msg: string) => void;

/** Miniature légère : 360 px de large, JPEG ~25 Ko (pour rester dans le 1 Go gratuit de Supabase). */
export async function toThumb(buf: Buffer | Uint8Array) {
  return sharp(buf).rotate().resize({ width: 360, withoutEnlargement: true }).jpeg({ quality: 60, mozjpeg: true }).toBuffer();
}

/** Télécharge une image fbcdn et en fait une miniature (null si impossible). */
export async function downloadThumb(url: string): Promise<Buffer | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    return await toThumb(Buffer.from(await r.arrayBuffer()));
  } catch {
    return null;
  }
}

/** Range une miniature dans Supabase Storage et renvoie son lien public. */
export async function storeThumb(id: string, jpeg: Buffer) {
  const path = `${id}.jpg`;
  const up = await db().storage.from(BUCKET).upload(path, jpeg, { contentType: "image/jpeg", upsert: true });
  if (up.error) throw up.error;
  return db().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function capture(page: Page, adId: string, token: string) {
  const url = `https://www.facebook.com/ads/archive/render_ad/?id=${adId}&access_token=${token}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
  if (/login|checkpoint/.test(page.url())) throw new Error("Meta demande une connexion : arrêt");
  // Attend qu'un visuel apparaisse (au lieu d'attendre la fin de tout le réseau)
  await page.waitForFunction(() => [...document.querySelectorAll("video, img")].some((e) => {
    const r = e.getBoundingClientRect();
    return r.width >= 150 && r.height >= 150;
  }), null, { timeout: 15000 }).catch(() => {});

  // Le visuel principal : la plus grande vidéo ou image de la page
  const target = await page.evaluate(() => {
    const els = [...document.querySelectorAll<HTMLElement>("video, img")]
      .map((el) => ({ el, w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height }))
      .filter((x) => x.w >= 150 && x.h >= 150)
      .sort((a, b) => b.w * b.h - a.w * a.h);
    if (!els.length) return null;
    els[0].el.setAttribute("data-adspy", "1");
    return els[0].el.tagName === "VIDEO" ? "video" : "image";
  });
  const landing = await landingFromSnapshot(page);
  if (!target) return { landing, kind: null, jpeg: null, video: null };
  const video = target === "video" ? await videoOf(page) : null;

  // Rapide : on télécharge directement l'image (ou l'aperçu de la vidéo) ; sinon capture d'écran
  const el = page.locator("[data-adspy='1']");
  const src = await el.evaluate((e) => (e instanceof HTMLVideoElement ? e.poster : (e as HTMLImageElement).currentSrc || (e as HTMLImageElement).src) || null);
  let jpeg = src?.startsWith("http") ? await downloadThumb(src) : null;
  if (!jpeg) {
    if (target === "image") await el.evaluate((img: HTMLImageElement) => img.decode?.().catch(() => {}));
    else await page.waitForTimeout(1500); // laisser l'aperçu de la vidéo s'afficher
    jpeg = await toThumb(await el.screenshot({ type: "jpeg", quality: 80, timeout: 10000 }));
  }
  return { landing, kind: target, jpeg, video };
}

/** Lien direct de la vidéo + sa date d'expiration (paramètre oe= en hexadécimal). */
async function videoOf(page: Page): Promise<{ url: string; expires: string | null } | null> {
  const url = await page.evaluate(() => {
    const v = document.querySelector<HTMLVideoElement>("[data-adspy='1']") ?? document.querySelector("video");
    return v?.currentSrc || v?.src || null;
  });
  if (!url || !url.startsWith("http")) return null;
  const oe = new URL(url).searchParams.get("oe");
  return { url, expires: oe ? new Date(parseInt(oe, 16) * 1000).toISOString() : null };
}

/**
 * Les liens vidéo de Meta expirent après ~4 jours : on rafraîchit ceux des meilleures pubs
 * (et on récupère ceux des vidéos capturées avant cette fonction).
 */
export async function refreshVideos(log: Log = console.log) {
  const limit = Number(process.env.VIDEO_LIMIT || 200);
  const { token } = metaConfig();
  const soon = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const { data, error } = await db()
    .from("ads_scored")
    .select("id")
    .eq("is_active", true)
    .eq("source", "api") // les pubs US/CA ont leur visuel via la bibliothèque
    .eq("media_kind", "video")
    .or(`video_expires_at.is.null,video_expires_at.lt.${soon}`)
    .order("winner_score", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const ids = (data ?? []).map((r) => r.id as string);
  if (!ids.length) return log("✓ vidéos : rien à rafraîchir");

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 420, height: 900 }, locale: "fr-FR" });
  let ok = 0;
  let failed = 0;
  try {
    for (const id of ids) {
      try {
        await page.goto(`https://www.facebook.com/ads/archive/render_ad/?id=${id}&access_token=${token}`, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
        if (/login|checkpoint/.test(page.url())) throw new Error("Meta demande une connexion : arrêt");
        const v = await videoOf(page);
        // Pas trouvé : on note quand même une date pour ne pas réessayer en boucle
        const expires = v?.expires ?? new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString();
        await db().from("ads").update({ video_url: v?.url ?? null, video_expires_at: expires }).eq("id", id);
        if (v) ok++;
      } catch (e) {
        failed++;
        if (/connexion : arrêt/.test(errMsg(e)) || failed >= 15) break;
      }
      await page.waitForTimeout(800 + Math.random() * 1000);
    }
  } finally {
    await browser.close();
  }
  log(`✓ vidéos : ${ok} liens à jour, ${failed} en échec`);
}

export async function fetchMedia(log: Log = console.log) {
  const limit = Number(process.env.MEDIA_LIMIT || 4000);
  const workers = Number(process.env.MEDIA_CONCURRENCY || 6);
  const { token } = metaConfig();

  // Par paquets de 1 000 (limite de Supabase par requête)
  const ids: string[] = [];
  while (ids.length < limit) {
    const { data, error } = await db()
      .from("ads_scored")
      .select("id")
      .eq("is_active", true)
      .eq("source", "api") // les pubs US/CA ont leur visuel via la bibliothèque
      .is("media_tried_at", null)
      // Seulement les pubs qui passent le pré-filtre (les autres n'apparaissent jamais dans l'adspy)
      .gte("stars", PREFILTER.stars)
      .gte("days_running", PREFILTER.days)
      .gte("page_active_ads", PREFILTER.brandAds)
      .order("winner_score", { ascending: false })
      .order("id")
      .range(ids.length, Math.min(limit, ids.length + 1000) - 1);
    if (error) throw error;
    ids.push(...(data ?? []).map((r) => r.id as string));
    if ((data ?? []).length < 1000) break;
  }
  if (!ids.length) return log("✓ visuels : rien de nouveau");

  const browser: Browser = await chromium.launch();
  let ok = 0;
  let none = 0;
  let failed = 0;
  let stop = false;
  const queue = [...ids];

  async function worker() {
    const page = await browser.newPage({ viewport: { width: 420, height: 900 }, locale: "fr-FR" });
    while (!stop && queue.length) {
      const id = queue.shift()!;
      try {
        const shot = await capture(page, id, token);
        const now = new Date().toISOString();
        if (!shot.jpeg) {
          none++;
          await db().from("ads").update({ media_tried_at: now, landing_url: shot.landing }).eq("id", id);
        } else {
          const media_url = await storeThumb(id, shot.jpeg);
          await db().from("ads").update({
            media_url, media_kind: shot.kind, media_tried_at: now, landing_url: shot.landing,
            video_url: shot.video?.url ?? null, video_expires_at: shot.video?.expires ?? null,
          }).eq("id", id);
          ok++;
        }
      } catch (e) {
        failed++;
        const msg = errMsg(e);
        if (failed <= 5) log(`✗ visuel ${id} : ${msg}`);
        if (/connexion : arrêt/.test(msg) || failed >= 60) {
          log("✗ trop d'échecs, on arrête les visuels pour cette fois");
          stop = true;
        }
      }
    }
    await page.close().catch(() => {});
  }

  try {
    await Promise.all(Array.from({ length: workers }, worker));
  } finally {
    await browser.close();
  }
  log(`✓ visuels : ${ok} capturés, ${none} sans visuel, ${failed} en échec (${queue.length} restants)`);
}
