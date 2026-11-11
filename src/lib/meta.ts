/**
 * Client pour l'API officielle Meta Ad Library (endpoint ads_archive).
 * Pubs commerciales : seulement celles diffusées dans l'UE (règle DSA).
 */

const FIELDS = [
  "id",
  "page_id",
  "page_name",
  "ad_creation_time",
  "ad_delivery_start_time",
  "ad_delivery_stop_time",
  "ad_creative_bodies",
  "ad_creative_link_titles",
  "ad_creative_link_descriptions",
  "ad_creative_link_captions",
  "publisher_platforms",
  "languages",
  "eu_total_reach",
  "age_country_gender_reach_breakdown",
].join(",");

export type MetaAd = {
  id: string;
  page_id?: string;
  page_name?: string;
  ad_creation_time?: string;
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  ad_creative_link_descriptions?: string[];
  ad_creative_link_captions?: string[];
  publisher_platforms?: string[];
  languages?: string[];
  eu_total_reach?: number;
  age_country_gender_reach_breakdown?: { country: string; age_gender_breakdowns?: Record<string, number | string>[] }[];
};

type MetaPage = {
  data?: MetaAd[];
  paging?: { next?: string };
  error?: { message: string; code: number; error_subcode?: number };
};

export class MetaApiError extends Error {
  constructor(message: string, public code: number) {
    super(message);
  }
  get isRateLimit() {
    return [4, 17, 32, 613, 80004].includes(this.code);
  }
  get isAuth() {
    return this.code === 190 || this.code === 10 || this.code === 200;
  }
}

export function metaConfig() {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error("META_ACCESS_TOKEN manquant dans .env.local");
  return {
    token,
    version: process.env.META_API_VERSION || "v27.0",
    countries: (process.env.META_COUNTRIES || "FR,DE,NL,BE,ES,IT,SE,DK,IE,AT")
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean),
    maxPerTerm: Number(process.env.META_MAX_PER_TERM || 500),
  };
}

/** Itère sur toutes les pubs actives qui matchent un mot-clé, page par page. */
export async function* searchActiveAds(term: string): AsyncGenerator<MetaAd[]> {
  const cfg = metaConfig();
  const params = new URLSearchParams({
    search_terms: term,
    ad_type: "ALL",
    ad_active_status: "ACTIVE",
    ad_reached_countries: JSON.stringify(cfg.countries),
    fields: FIELDS,
    limit: "100",
    access_token: cfg.token,
  });
  let url: string | undefined = `https://graph.facebook.com/${cfg.version}/ads_archive?${params}`;
  let fetched = 0;

  while (url && fetched < cfg.maxPerTerm) {
    const res = await fetchWithRetry(url);
    const json = (await res.json()) as MetaPage;
    if (json.error) {
      // « API access blocked » = blocage temporaire pour trop d'appels
      const code = /blocked/i.test(json.error.message) ? 4 : json.error.code;
      throw new MetaApiError(json.error.message, code);
    }
    const batch = json.data ?? [];
    fetched += batch.length;
    if (batch.length) yield batch;
    url = json.paging?.next;

    // Meta indique dans ce header le % du quota utilisé : on arrête avant de se faire bloquer
    const usage = maxUsagePct(res.headers.get("x-business-use-case-usage"));
    if (usage >= 75) {
      throw new MetaApiError(`Quota Meta à ${usage} %, on arrête pour éviter un blocage (reprend au prochain passage)`, 4);
    }
    // On reste poli avec l'API (plus lent si le quota monte)
    await new Promise((r) => setTimeout(r, usage >= 40 ? 5000 : 1500));
  }
}

/** Plus haut % d'utilisation du quota (call_count, total_time, total_cputime) dans le header de Meta. */
function maxUsagePct(header: string | null): number {
  if (!header) return 0;
  try {
    const parsed = JSON.parse(header) as Record<string, { call_count?: number; total_time?: number; total_cputime?: number }[]>;
    let max = 0;
    for (const entries of Object.values(parsed))
      for (const e of entries) max = Math.max(max, e.call_count ?? 0, e.total_time ?? 0, e.total_cputime ?? 0);
    return max;
  } catch {
    return 0;
  }
}

/** Réessaie jusqu'à 3 fois si le réseau coupe (Wi-Fi, réveil du Mac…). */
async function fetchWithRetry(url: string, tries = 3): Promise<Response> {
  for (let i = 1; ; i++) {
    try {
      return await fetch(url);
    } catch (e) {
      if (i >= tries) throw e;
      await new Promise((r) => setTimeout(r, 15000 * i));
    }
  }
}
