-- Migration 009 : alléger la base (rester sous 500 Mo, plan gratuit)
-- Les grosses marques (100+ pubs) : on garde seulement leurs pubs qui peuvent passer le pré-filtre
-- (3 étoiles et +, 7 jours et +). Leur rang dans la marque est calculé sur TOUTES leurs pubs (ext_pct).
-- Tes dossiers ne sont jamais touchés.
-- ÉTAPE A : coller tout ce bloc dans Supabase > SQL Editor > Run (rapide : ça crée seulement les outils).
-- Le ménage lui-même est fait ensuite par le robot GitHub (tâche « alleger »), marque par marque.

alter table ads add column if not exists ext_pct real;

-- 1 et 2, par petits paquets de marques (le robot l'appelle en boucle, dans le cloud) :
-- rang réel dans la marque, puis on efface les pubs qui ne pourront jamais passer le pré-filtre.
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

-- ÉTAPE B : une fois le ménage du robot terminé, dans un NOUVEL onglet du SQL Editor, lancer seule cette ligne
-- (elle redonne l'espace libéré ; ça peut prendre quelques minutes) :
-- vacuum full ads;
