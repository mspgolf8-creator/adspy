-- Migration 009 : alléger la base (plan gratuit de Supabase)
-- Les grosses marques (100+ pubs) : on garde seulement leurs pubs qui peuvent passer le pré-filtre
-- (3 étoiles et +, 7 jours et +). Leur rang dans la marque est calculé sur TOUTES leurs pubs (ext_pct).
-- Tes dossiers et ton Swipe File ne sont jamais touchés.
--
-- La base est en lecture seule (disque plein) : on fait le ménage en 3 étapes,
-- CHACUNE DANS SON PROPRE ONGLET du SQL Editor (bouton + New), une après l'autre.

-- ================= ÉTAPE 1 (seule dans un onglet) =================
-- Récupère l'espace laissé par la tentative ratée (vacuum simple : pas besoin d'espace libre).
vacuum ads;

-- ================= ÉTAPE 2 (tout ce bloc, dans un nouvel onglet) =================
set session characteristics as transaction read write;
set statement_timeout = '20min';

alter table ads add column if not exists ext_pct real;

-- Rang réel de chaque pub dans sa marque (calculé AVANT d'effacer, sur toutes ses pubs)
create temp table r as
select a.id,
  percent_rank() over (partition by a.page_id order by coalesce(a.eu_total_reach, 0) desc,
    coalesce(a.delivery_start, a.first_seen_at) asc) as pct,
  greatest(1, extract(day from (now() - coalesce(a.delivery_start, a.first_seen_at)))) as days
from ads a
join brands b on b.page_id = a.page_id and b.total_active >= 100
where a.is_active and a.source = 'api';

-- On efface celles qui ne pourront jamais passer le pré-filtre
delete from ads a using r
where a.id = r.id
  and not a.saved
  and not exists (select 1 from folder_ads f where f.ad_id = a.id)
  and not (r.days >= 14 or (r.days >= 7 and r.pct <= 0.5));

-- On garde le rang réel des pubs qui restent
update ads a set ext_pct = r.pct from r where a.id = r.id;

-- Outil pour le robot (même ménage, quelques marques à la fois)
create or replace function alleger_marques(n int default 15) returns int
language plpgsql set statement_timeout = '120s' as $$
declare k int;
begin
  drop table if exists _r;
  create temp table _r on commit drop as
  select a.id, a.page_id,
    percent_rank() over (partition by a.page_id order by coalesce(a.eu_total_reach, 0) desc,
      coalesce(a.delivery_start, a.first_seen_at) asc) as pct,
    greatest(1, extract(day from (now() - coalesce(a.delivery_start, a.first_seen_at)))) as days
  from ads a
  where a.is_active and a.source = 'api' and a.page_id in (
    select b.page_id from brands b
    where b.total_active >= 100
      and exists (select 1 from ads x where x.page_id = b.page_id and x.is_active and x.source = 'api' and x.ext_pct is null)
    limit n);
  select count(distinct page_id) into k from _r;

  delete from ads a using _r r
  where a.id = r.id
    and not a.saved
    and not exists (select 1 from folder_ads f where f.ad_id = a.id)
    and not (r.days >= 14 or (r.days >= 7 and r.pct <= 0.5));

  update ads a set ext_pct = r.pct from _r r where a.id = r.id;
  return k;
end $$;

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

-- ================= ÉTAPE 3 (seule dans un nouvel onglet) =================
-- Redonne l'espace des pubs effacées.
-- vacuum full ads;
