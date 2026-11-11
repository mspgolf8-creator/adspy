/**
 * Miniatures des pubs : un navigateur robot (Playwright) ouvre l'aperçu officiel de chaque pub
 * (le lien ad_snapshot_url de l'API), photographie le visuel et le range dans Supabase Storage.
 * Les meilleures pubs passent en premier ; MEDIA_LIMIT par passage pour rester discret.
 */
import { chromium, type Page } from "playwright";
import { db } from "./supabase";
import { metaConfig } from "./meta";
import { errMsg } from "./errors";
import { landingFromSnapshot } from "./pages";

const BUCKET = "ad-media";
type Log = (msg: string) => void;

async function capture(page: Page, adId: string, token: string) {
  const url = `https://www.facebook.com/ads/archive/render_ad/?id=${adId}&access_token=${token}`;
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
  if (/login|checkpoint/.test(page.url())) throw new Error("Meta demande une connexion : arrêt");

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

  const el = page.locator("[data-adspy='1']");
  if (target === "image") await el.evaluate((img: HTMLImageElement) => img.decode?.().catch(() => {}));
  else await page.waitForTimeout(1500); // laisser l'aperçu de la vidéo s'afficher
  const jpeg = await el.screenshot({ type: "jpeg", quality: 70, timeout: 10000 });
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
  const limit = Number(process.env.MEDIA_LIMIT || 250);
  const { token } = metaConfig();

  const { data, error } = await db()
    .from("ads_scored")
    .select("id")
    .eq("is_active", true)
    .is("media_tried_at", null)
    .order("winner_score", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const ids = (data ?? []).map((r) => r.id as string);
  if (!ids.length) return log("✓ visuels : rien de nouveau");

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 420, height: 900 }, locale: "fr-FR" });
  let ok = 0;
  let none = 0;
  let failed = 0;
  try {
    for (const id of ids) {
      try {
        const shot = await capture(page, id, token);
        const now = new Date().toISOString();
        if (!shot.jpeg) {
          none++;
          await db().from("ads").update({ media_tried_at: now, landing_url: shot.landing }).eq("id", id);
        } else {
          const path = `${id}.jpg`;
          const up = await db().storage.from(BUCKET).upload(path, shot.jpeg, { contentType: "image/jpeg", upsert: true });
          if (up.error) throw up.error;
          const media_url = db().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
          await db().from("ads").update({
            media_url, media_kind: shot.kind, media_tried_at: now, landing_url: shot.landing,
            video_url: shot.video?.url ?? null, video_expires_at: shot.video?.expires ?? null,
          }).eq("id", id);
          ok++;
        }
      } catch (e) {
        failed++;
        const msg = errMsg(e);
        log(`✗ visuel ${id} : ${msg}`);
        if (/connexion : arrêt/.test(msg) || failed >= 15) {
          log("✗ trop d'échecs, on arrête les visuels pour cette fois");
          break;
        }
      }
      await page.waitForTimeout(1200 + Math.random() * 1500);
    }
  } finally {
    await browser.close();
  }
  log(`✓ visuels : ${ok} capturés, ${none} sans visuel, ${failed} en échec`);
}
