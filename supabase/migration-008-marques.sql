-- Migration 008 : vrai nombre de pubs actives par marque (demandé à Meta) + pré-filtre de l'adspy
-- À coller dans Supabase > SQL Editor > Run (une seule fois).

-- 1. Une ligne par marque : combien de pubs actives elle a VRAIMENT chez Meta
create table if not exists brands (
  page_id text primary key,
  page_name text,
  total_active int,
  checked_at timestamptz
);
alter table brands enable row level security;

-- 2. Index pour le pré-filtre (3 étoiles et +, marque 100 pubs et +)
create index if not exists ads_prefilter_idx on ads (stars, page_active_ads) where is_active;

-- 3. Statistiques : « pubs actives de la marque » = le plus grand entre notre compte et le vrai compte Meta
create or replace function refresh_ad_stats() returns int
language plpgsql set statement_timeout = '180s' as $$
declare n int;
begin
  with base as (
    select id, page_id, is_active, creative_key, collation_count, eu_total_reach is null as no_reach,
      coalesce(eu_total_reach, 0) as reach,
      greatest(1, extract(day from (coalesce(delivery_stop, now()) - coalesce(delivery_start, first_seen_at))))::int as days
    from ads
  ), c as (
    select *,
      greatest(coalesce(collation_count, 1),
        case when creative_key is null then 1
             else count(*) over (partition by creative_key, is_active) end) as cc
    from base
  ), s as (
    select id, page_id, cc, days,
      count(*) filter (where is_active) over (partition by page_id) as own,
      row_number() over (partition by page_id, is_active, no_reach order by reach desc, days desc, cc desc, id) as rnk,
      percent_rank() over (partition by page_id, is_active, no_reach order by reach desc, days desc, cc desc) as pct
    from c
  ), st as (
    select s.id, greatest(s.own, coalesce(b.total_active, 0)) as paa, s.cc, s.rnk, s.pct,
      case
        when s.pct <= 0.10 and s.days >= 14 then 5
        when s.pct <= 0.25 and s.days >= 7 then 4
        when s.days >= 14 or (s.pct <= 0.5 and s.days >= 7) then 3
        when s.days >= 4 then 2
        else 1
      end as stars
    from s left join brands b on b.page_id = s.page_id
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

notify pgrst, 'reload schema';
