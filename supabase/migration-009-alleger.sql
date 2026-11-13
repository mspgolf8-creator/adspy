-- Migration 009 : alléger la base (rester sous 500 Mo, plan gratuit)
-- Les grosses marques (100+ pubs) : on garde seulement leurs pubs qui peuvent passer le pré-filtre
-- (3 étoiles et +, 7 jours et +). Leur rang dans la marque est calculé sur TOUTES leurs pubs (ext_pct).
-- Tes dossiers ne sont jamais touchés.
-- ÉTAPE A : coller tout ce bloc dans Supabase > SQL Editor > Run.

set statement_timeout = '20min';

alter table ads add column if not exists ext_pct real;

-- 1. Rang réel dans la marque (grosses marques d'Europe, dont on a toutes les pubs)
with r as (
  select a.id,
    percent_rank() over (partition by a.page_id order by coalesce(a.eu_total_reach, 0) desc,
      coalesce(a.delivery_start, a.first_seen_at) asc) as pct
  from ads a
  join brands b on b.page_id = a.page_id and b.total_active >= 100
  where a.is_active and a.source = 'api'
)
update ads set ext_pct = r.pct from r where ads.id = r.id;

-- 2. On efface les pubs de ces marques qui ne pourront jamais passer le pré-filtre
delete from ads a
where a.ext_pct is not null
  and not a.saved
  and not exists (select 1 from folder_ads f where f.ad_id = a.id)
  and not (
    greatest(1, extract(day from (now() - coalesce(a.delivery_start, a.first_seen_at)))) >= 14
    or (greatest(1, extract(day from (now() - coalesce(a.delivery_start, a.first_seen_at)))) >= 7 and a.ext_pct <= 0.5)
  );

-- 3. Statistiques : on utilise le rang réel quand on l'a
create or replace function refresh_ad_stats() returns int
language plpgsql set statement_timeout = '300s' as $$
declare n int;
begin
  with base as (
    select id, page_id, is_active, creative_key, collation_count, ext_pct, eu_total_reach is null as no_reach,
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

-- ÉTAPE B : ensuite, dans un NOUVEL onglet du SQL Editor, lancer seule cette ligne
-- (elle redonne l'espace libéré ; ça peut prendre quelques minutes) :
-- vacuum full ads;
