import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function isConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Client serveur seulement (clé service_role). Jamais envoyé au navigateur. */
export function db(): SupabaseClient {
  if (!client) {
    // Accepte aussi l'URL copiée avec /rest/v1/ à la fin
    const url = process.env.SUPABASE_URL?.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans .env.local");
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

export type AdRow = {
  id: string;
  page_id: string | null;
  page_name: string | null;
  bodies: string[];
  link_titles: string[];
  link_descriptions: string[];
  link_captions: string[];
  publisher_platforms: string[];
  languages: string[];
  eu_total_reach: number | null;
  ad_creation_time: string | null;
  delivery_start: string | null;
  delivery_stop: string | null;
  is_active: boolean;
  matched_terms: string[];
  first_seen_at: string;
  last_seen_at: string;
  category: string | null;
  product: string | null;
  angle: string | null;
  hook: string | null;
  offer: string | null;
  classified_at: string | null;
  saved: boolean;
  classified_by: "rules" | "ai" | "manual" | null;
  media_url: string | null;
  media_kind: "image" | "video" | null;
  media_tried_at: string | null;
  countries: string[];
  landing_url: string | null;
  page_type: string | null;
  page_active_ads: number;
  creative_count: number;
  brand_rank: number | null;
  stars: number | null;
  technologies?: string[];
  page_type_tried_at?: string | null;
  video_url?: string | null;
  video_expires_at?: string | null;
  source?: "api" | "library";
  cta_text?: string | null;
  lib_rank?: number | null;
  collation_count?: number | null;
  brand_pct?: number | null;
  tags?: string[];
};

export type ScoredAd = AdRow & {
  days_running: number;
  winner_score: number;
};
