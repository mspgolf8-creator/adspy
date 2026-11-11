import { db } from "./supabase";
import { MetaAd, MetaApiError, searchActiveAds } from "./meta";
import { errMsg } from "./errors";

export type CollectResult = {
  terms: { term: string; fetched: number; error?: string }[];
  upserted: number;
  deactivated: number;
};

function toRow(ad: MetaAd, now: string) {
  return {
    id: ad.id,
    page_id: ad.page_id ?? null,
    page_name: ad.page_name ?? null,
    bodies: ad.ad_creative_bodies ?? [],
    link_titles: ad.ad_creative_link_titles ?? [],
    link_descriptions: ad.ad_creative_link_descriptions ?? [],
    link_captions: ad.ad_creative_link_captions ?? [],
    publisher_platforms: ad.publisher_platforms ?? [],
    languages: ad.languages ?? [],
    eu_total_reach: ad.eu_total_reach ?? null,
    ad_creation_time: ad.ad_creation_time ?? null,
    delivery_start: ad.ad_delivery_start_time ?? null,
    delivery_stop: ad.ad_delivery_stop_time ?? null,
    is_active: !ad.ad_delivery_stop_time || new Date(ad.ad_delivery_stop_time) > new Date(now),
    last_seen_at: now,
  };
}

/** Sauvegarde un lot de pubs en gardant les mots-clés déjà associés. */
async function upsertBatch(ads: MetaAd[], term: string, now: string) {
  const ids = ads.map((a) => a.id);
  const { data: existing, error: readErr } = await db()
    .from("ads")
    .select("id, matched_terms")
    .in("id", ids);
  if (readErr) throw readErr;
  const termsById = new Map((existing ?? []).map((e) => [e.id as string, e.matched_terms as string[]]));

  const rows = ads.map((ad) => {
    const prev = termsById.get(ad.id) ?? [];
    return { ...toRow(ad, now), matched_terms: Array.from(new Set([...prev, term])) };
  });
  const { error } = await db().from("ads").upsert(rows, { onConflict: "id" });
  if (error) throw error;
  return rows.length;
}

export async function collect(log: (msg: string) => void = console.log): Promise<CollectResult> {
  const now = new Date().toISOString();
  const { data: run } = await db().from("runs").insert({ kind: "collect" }).select("id").single();

  const { data: keywords, error } = await db()
    .from("keywords")
    .select("id, term")
    .eq("enabled", true)
    .order("id");
  if (error) throw error;

  const result: CollectResult = { terms: [], upserted: 0, deactivated: 0 };

  for (const kw of keywords ?? []) {
    let fetched = 0;
    try {
      for await (const batch of searchActiveAds(kw.term)) {
        fetched += batch.length;
        result.upserted += await upsertBatch(batch, kw.term, now);
      }
      await db().from("keywords").update({ last_collected_at: now }).eq("id", kw.id);
      result.terms.push({ term: kw.term, fetched });
      log(`✓ « ${kw.term} » : ${fetched} pubs`);
    } catch (e) {
      const msg = errMsg(e);
      result.terms.push({ term: kw.term, fetched, error: msg });
      log(`✗ « ${kw.term} » : ${msg}`);
      // Token invalide ou limite atteinte : inutile de continuer avec les autres mots-clés
      if (e instanceof MetaApiError && (e.isAuth || e.isRateLimit)) break;
    }
  }

  // Meta renvoie seulement le top 500 par mot-clé : une pub absente aujourd'hui roule peut-être encore.
  // On la considère arrêtée seulement si on ne l'a pas revue depuis 10 jours
  // (et seulement si la collecte a marché, sinon on désactiverait tout pour rien).
  if (result.terms.some((t) => !t.error)) {
    const cutoff = new Date(Date.now() - 10 * 86400_000).toISOString();
    const { count } = await db()
      .from("ads")
      .update({ is_active: false }, { count: "exact" })
      .eq("is_active", true)
      .lt("last_seen_at", cutoff);
    result.deactivated = count ?? 0;
  }

  if (run) {
    await db()
      .from("runs")
      .update({ finished_at: new Date().toISOString(), ok: !result.terms.some((t) => t.error), detail: result })
      .eq("id", run.id);
  }
  return result;
}
