-- Migration 007 · pubs US / Canada (bibliothèque publique) + dossiers + tags
-- À coller une fois dans Supabase > SQL Editor > New snippet > Run.

-- 1. Pubs venant de la bibliothèque publique (US / Canada)
alter table ads add column if not exists source text not null default 'api'; -- 'api' (Europe/UK) | 'library' (US/CA)
alter table ads add column if not exists cta_text text;   -- « Shop now », « Learn more »…
alter table ads add column if not exists lib_rank int;    -- position dans la recherche Meta triée par impressions (1 = la plus vue)
alter table ads add column if not exists collation_count int; -- copies identiques regroupées par Meta (US/CA)
alter table ads add column if not exists tags text[] not null default '{}';
create index if not exists ads_tags_idx on ads using gin (tags);
create index if not exists ads_source_idx on ads (source);
create index if not exists ads_lib_rank_idx on ads (lib_rank) where lib_rank is not null;

-- 2. Dossiers (une pub peut être dans plusieurs dossiers)
create table if not exists folders (
  id bigserial primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists folder_ads (
  folder_id bigint not null references folders(id) on delete cascade,
  ad_id text not null references ads(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (folder_id, ad_id)
);
create index if not exists folder_ads_ad_idx on folder_ads (ad_id);
alter table folders enable row level security;
alter table folder_ads enable row level security;

insert into folders (name) values ('Dossier par défaut') on conflict (name) do nothing;
-- Les pubs déjà sauvegardées vont dans le dossier par défaut
insert into folder_ads (folder_id, ad_id)
select (select id from folders where name = 'Dossier par défaut'), id from ads where saved
on conflict do nothing;

create or replace view folder_counts with (security_invoker = true) as
select f.id, f.name, f.created_at, count(fa.ad_id)::int as n
from folders f left join folder_ads fa on fa.folder_id = f.id
group by f.id order by f.created_at;

create or replace view tag_counts with (security_invoker = true) as
select t as tag, count(*)::int as n from ads, unnest(tags) t group by t order by t;

-- 3. Vue recréée pour les nouvelles colonnes
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

-- 4. Étoiles : Europe = portée dans la marque ; US/CA (pas de portée) = durée + doublons dans la marque
create or replace function refresh_ad_stats() returns int
language plpgsql set statement_timeout = '120s' as $$
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
    select id, cc, days,
      count(*) filter (where is_active) over (partition by page_id) as paa,
      row_number() over (partition by page_id, is_active, no_reach order by reach desc, days desc, cc desc, id) as rnk,
      percent_rank() over (partition by page_id, is_active, no_reach order by reach desc, days desc, cc desc) as pct
    from c
  ), st as (
    select id, paa, cc, rnk, pct,
      case
        when pct <= 0.10 and days >= 14 then 5
        when pct <= 0.25 and days >= 7 then 4
        when days >= 14 or (pct <= 0.5 and days >= 7) then 3
        when days >= 4 then 2
        else 1
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

notify pgrst, 'reload schema';
