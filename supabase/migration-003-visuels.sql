-- Migration 003 · visuels des pubs (miniatures dans Supabase Storage, bucket « ad-media »)
-- À coller une fois dans Supabase > SQL Editor > New snippet > Run.

alter table ads add column if not exists media_url text;          -- miniature publique
alter table ads add column if not exists media_kind text;         -- 'image' | 'video'
alter table ads add column if not exists media_tried_at timestamptz;

-- La vue doit être recréée pour inclure les nouvelles colonnes
drop view if exists ads_scored;
create view ads_scored with (security_invoker = true) as
select
  a.*,
  greatest(1, extract(day from (coalesce(a.delivery_stop, now()) - coalesce(a.delivery_start, a.first_seen_at))))::int as days_running,
  (select count(*) from ads b where b.page_id = a.page_id and b.is_active) as page_active_ads,
  round(
    (greatest(1, extract(day from (coalesce(a.delivery_stop, now()) - coalesce(a.delivery_start, a.first_seen_at))))
      * ln(10 + coalesce(a.eu_total_reach, 0)))::numeric, 1
  ) as winner_score
from ads a;
