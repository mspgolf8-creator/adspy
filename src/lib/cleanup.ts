/**
 * Ménage automatique : efface les pubs arrêtées depuis plus de CLEANUP_DAYS jours (30 par défaut)
 * et leurs images, pour rester dans le plan gratuit de Supabase.
 * Les pubs sauvegardées (Swipe File) ne sont jamais effacées.
 */
import { db } from "./supabase";

const BUCKET = "ad-media";
type Log = (msg: string) => void;

export async function cleanup(log: Log = console.log) {
  const days = Number(process.env.CLEANUP_DAYS || 30);
  const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
  let ads = 0;
  let images = 0;

  for (;;) {
    const { data, error } = await db()
      .from("ads")
      .select("id, media_url")
      .eq("is_active", false)
      .eq("saved", false)
      .lt("last_seen_at", cutoff)
      .limit(200);
    if (error) throw error;
    if (!data?.length) break;

    const files = data.filter((a) => a.media_url).map((a) => `${a.id}.jpg`);
    if (files.length) {
      const { error: e } = await db().storage.from(BUCKET).remove(files);
      if (e) throw e;
      images += files.length;
    }
    const { error: e2 } = await db().from("ads").delete().in("id", data.map((a) => a.id));
    if (e2) throw e2;
    ads += data.length;
  }
  log(`✓ ménage : ${ads} pubs arrêtées depuis ${days} j + effacées (${images} images)`);
}
