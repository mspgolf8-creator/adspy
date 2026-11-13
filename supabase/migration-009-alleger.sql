-- Migration 009 : alléger la base (plan gratuit de Supabase)
-- Les grosses marques (100+ pubs) : on garde seulement leurs pubs qui peuvent passer le pré-filtre
-- (3 étoiles et +, 7 jours et +). Leur rang réel dans la marque (calculé sur TOUTES leurs pubs)
-- va dans une petite table à part, ad_ext. Le ménage lui-même est fait par le robot GitHub
-- (tâche « alleger »), par petits paquets, pour ne jamais remplir le disque.
-- Tes dossiers et ton Swipe File ne sont jamais touchés.
--
-- À coller dans un NOUVEL onglet du SQL Editor, puis Run (quelques secondes).

set session characteristics as transaction read write;

create table if not exists ad_ext (id text primary key, ext_pct real not null);
alter table ad_ext enable row level security;

drop function if exists alleger_marques(int);

create or replace function refresh_ad_stats() returns int
language plpgsql set statement_timeout = '300s' as $$
declare n int;
begin
  with base as (
    select ads.id, page_id, is_active, creative_key, collation_count, e.ext_pct, eu_total_reach is null as no_reach,
      coalesce(eu_total_reach, 0) as reach,
      greatest(1, extract(day from (coalesce(delivery_stop, now()) - coalesce(delivery_start, first_seen_at))))::int as days
    from ads left join ad_ext e on e.id = ads.id
  ), c as (
    select *,
      greatest(coalesce(collation_count, 1),
        case when creative_key is null then 1
             else count(*) over (partition by creative_key, is_active) end) as cc
    from base
  ), s as (
    select id, page_id, cc, days, ext_pct,
      count(*) filter (where is_active) over (partition by page_id) as own,
      row_number() over (partition by page_id, is_active, no_reach order by reach desc, days desc, cc desc, id) as rnk,
      percent_rank() over (partition by page_id, is_active, no_reach order by reach desc, days desc, cc desc) as pct
    from c
  ), st as (
    select s.id, greatest(s.own, coalesce(b.total_active, 0)) as paa, s.cc, s.rnk, coalesce(s.ext_pct, s.pct) as pct,
      case
        when coalesce(s.ext_pct, s.pct) <= 0.10 and s.days >= 14 then 5
        when coalesce(s.ext_pct, s.pct) <= 0.25 and s.days >= 7 then 4
        when s.days >= 14 or (coalesce(s.ext_pct, s.pct) <= 0.5 and s.days >= 7) then 3
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

-- Plus tard, quand le robot a fini le ménage (je te le dirai) : seule dans un onglet
-- vacuum full ads;
