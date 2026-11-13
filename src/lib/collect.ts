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
    countries: countriesOf(ad),
    ad_creation_time: ad.ad_creation_time ?? null,
    delivery_start: ad.ad_delivery_start_time ?? null,
    delivery_stop: ad.ad_delivery_stop_time ?? null,
    is_active: !ad.ad_delivery_stop_time || new Date(ad.ad_delivery_stop_time) > new Date(now),
    last_seen_at: now,
  };
}

/** Pays où la pub a été vue, du plus gros au plus petit (codes ISO : FR, DE…). */
function countriesOf(ad: MetaAd): string[] {
  const total = (rows: Record<string, number | string>[] = []) =>
    rows.reduce((sum, r) => sum + Object.values(r).reduce<number>((s, v) => s + (typeof v === "number" ? v : 0), 0), 0);
  return (ad.age_country_gender_reach_breakdown ?? [])
    .map((c) => ({ code: c.country, n: total(c.age_gender_breakdowns) }))
    .filter((c) => c.code && c.n > 0)
    .sort((a, b) => b.n - a.n)
    .map((c) => c.code);
}

/** Sauvegarde un lot de pubs en gardant les mots-clés déjà associés. */
export async function upsertBatch(ads: MetaAd[], term: string | null, now: string, extra?: Map<string, Record<string, unknown>>) {
  const ids = ads.map((a) => a.id);
  const { data: existing, error: readErr } = await withRetry(() =>
    db().from("ads").select("id, matched_terms").in("id", ids),
  );
  if (readErr) throw readErr;
  const termsById = new Map((existing ?? []).map((e) => [e.id as string, e.matched_terms as string[]]));

  const rows = ads.map((ad) => {
    const prev = termsById.get(ad.id) ?? [];
    return { ...toRow(ad, now), matched_terms: term ? Array.from(new Set([...prev, term])) : prev, ...(extra?.get(ad.id) ?? {}) };
  });
  const { error } = await withRetry(() => db().from("ads").upsert(rows, { onConflict: "id" }));
  if (error) throw error;
  return rows.length;
}

/** Supabase (plan gratuit) est parfois lent : on réessaie 2 fois sur un timeout ou une coupure. */
async function withRetry<T extends { error: { message: string } | null }>(run: () => PromiseLike<T>): Promise<T> {
  let res = await run();
  for (let i = 1; i <= 2 && res.error && /timeout|fetch failed|ECONNRESET/i.test(res.error.message); i++) {
    await new Promise((r) => setTimeout(r, 5000 * i));
    res = await run();
  }
  return res;
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
