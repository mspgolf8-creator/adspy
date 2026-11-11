-- Migration 005 · technologies du site de destination (Shopify, WooCommerce, Klaviyo…) + vidéos jouables
-- À coller une fois dans Supabase > SQL Editor > New snippet > Run.

alter table ads add column if not exists technologies text[] not null default '{}';
alter table ads add column if not exists video_url text;               -- lien direct de la vidéo (fbcdn)
alter table ads add column if not exists video_expires_at timestamptz; -- Meta change le lien tous les ~4 jours

-- La vue doit être recréée pour inclure la nouvelle colonne
drop view if exists ads_scored;
create view ads_scored with (security_invoker = true) as
select
  a.*,
  greatest(1, extract(day from (coalesce(a.delivery_stop, now()) - coalesce(a.delivery_start, a.first_seen_at))))::int as days_running,
  round(
    (greatest(1, extract(day from (coalesce(a.delivery_stop, now()) - coalesce(a.delivery_start, a.first_seen_at))))
      * ln(10 + coalesce(a.eu_total_reach, 0)))::numeric, 1
  ) as winner_score
from ads a;

-- Les pages déjà visitées seront revisitées pour détecter leurs technologies
update ads set page_type_tried_at = null where page_type is not null;
