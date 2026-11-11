-- Migration 004 · filtres façon GetHookd (performance, créa, marque, pays, type de page)
-- À coller une fois dans Supabase > SQL Editor > New snippet > Run.

-- 1. Nouvelles colonnes
alter table ads add column if not exists countries text[] not null default '{}';  -- pays où la pub a été vue (UE)
alter table ads add column if not exists landing_url text;                       -- page de destination
alter table ads add column if not exists page_type text;                         -- Page produit, Advertorial…
alter table ads add column if not exists page_type_tried_at timestamptz;
-- Statistiques recalculées après chaque collecte (refresh_ad_stats)
alter table ads add column if not exists page_active_ads int not null default 0;  -- pubs actives de la marque
alter table ads add column if not exists creative_count int not null default 1;   -- fois que la même créa roule
alter table ads add column if not exists brand_rank int;                          -- 1 = meilleure pub de la marque
alter table ads add column if not exists brand_pct real;                          -- 0 = top de la marque, 1 = dernière
alter table ads add column if not exists stars smallint;                          -- 1 à 5

-- Empreinte de la créa : même texte + même titre = même pub réutilisée
create or replace function ads_creative_key(bodies text[], titles text[])
returns text language sql immutable as $$
  select case
    when coalesce(bodies[1], '') = '' and coalesce(titles[1], '') = '' then null
    else md5(lower(coalesce(bodies[1], '')) || '|' || lower(coalesce(titles[1], '')))
  end
$$;
alter table ads add column if not exists creative_key text
  generated always as (ads_creative_key(bodies, link_titles)) stored;

create index if not exists ads_creative_key_idx on ads (creative_key);
create index if not exists ads_page_idx on ads (page_id);
create index if not exists ads_stars_idx on ads (is_active, stars);
create index if not exists ads_countries_idx on ads using gin (countries);
create index if not exists ads_languages_idx on ads using gin (languages);

-- 2. Calcul des étoiles, du rang dans la marque et de l'usage des créas
create or replace function refresh_ad_stats() returns int
language plpgsql as $$
declare n int;
begin
  with base as (
    select id, page_id, is_active, creative_key, coalesce(eu_total_reach, 0) as reach,
      greatest(1, extract(day from (coalesce(delivery_stop, now()) - coalesce(delivery_start, first_seen_at))))::int as days
    from ads
  ), s as (
    select id,
      count(*) filter (where is_active) over (partition by page_id) as paa,
      case when creative_key is null then 1
           else count(*) over (partition by creative_key, is_active) end as cc,
      row_number() over (partition by page_id, is_active order by reach desc, days desc, id) as rnk,
      percent_rank() over (partition by page_id, is_active order by reach desc) as pct,
      days
    from base
  ), st as (
    select id, paa, cc, rnk, pct,
      case
        when pct <= 0.10 and days >= 14 then 5   -- top 10 % de la marque, 14 j +
        when pct <= 0.25 and days >= 7 then 4    -- top 25 % de la marque, 7 j +
        when days >= 14 or (pct <= 0.5 and days >= 7) then 3  -- performe régulièrement
        when days >= 4 then 2                    -- prometteuse
        else 1                                   -- début
      end as stars
    from s
  )
  update ads a set
    page_active_ads = st.paa, creative_count = st.cc, brand_rank = st.rnk,
    brand_pct = st.pct, stars = st.stars
  from st
  where a.id = st.id
    and (a.page_active_ads, a.creative_count, a.brand_rank, a.brand_pct, a.stars)
        is distinct from (st.paa::int, st.cc::int, st.rnk::int, st.pct::real, st.stars::smallint);
  get diagnostics n = row_count;
  return n;
end $$;

-- 3. Vue (page_active_ads vient maintenant de la colonne, beaucoup plus rapide)
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

-- 4. Listes pour les menus de filtres
create or replace view facet_countries with (security_invoker = true) as
select c as code, count(*)::int as n from ads, unnest(countries) c where is_active group by 1 order by 2 desc;

create or replace view facet_languages with (security_invoker = true) as
select l as code, count(*)::int as n from ads, unnest(languages) l where is_active group by 1 order by 2 desc;

create or replace view facet_page_types with (security_invoker = true) as
select page_type, count(*)::int as n from ads where is_active and page_type is not null group by 1 order by 2 desc;

-- Marques (page « Marques »)
create or replace view brand_stats with (security_invoker = true) as
select page_id, max(page_name) as page_name,
  count(*) filter (where is_active)::int as active_ads,
  count(*) filter (where is_active and stars >= 4)::int as winners,
  max(eu_total_reach) as best_reach,
  mode() within group (order by category) as category,
  min(delivery_start) as first_ad
from ads where page_id is not null group by page_id;

-- 5. Premier calcul
select refresh_ad_stats();
