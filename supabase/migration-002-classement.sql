-- Migration 002 · classement par règles + correction manuelle
-- À coller une fois dans Supabase > SQL Editor > New query > Run.

alter table ads add column if not exists classified_by text;  -- 'rules' | 'ai' | 'manual'

-- La vue doit être recréée pour inclure la nouvelle colonne
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
