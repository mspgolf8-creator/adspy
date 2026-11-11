-- Adspy · schéma Supabase
-- À coller une seule fois dans Supabase > SQL Editor > New query > Run.

-- Mots-clés à surveiller dans l'Ad Library
create table if not exists keywords (
  id bigint generated always as identity primary key,
  term text not null unique,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  last_collected_at timestamptz
);

-- Une ligne par pub Meta (id = ad_archive_id de Meta)
create table if not exists ads (
  id text primary key,
  page_id text,
  page_name text,
  bodies text[] not null default '{}',
  link_titles text[] not null default '{}',
  link_descriptions text[] not null default '{}',
  link_captions text[] not null default '{}',
  publisher_platforms text[] not null default '{}',
  languages text[] not null default '{}',
  eu_total_reach bigint,
  ad_creation_time timestamptz,
  delivery_start timestamptz,
  delivery_stop timestamptz,
  is_active boolean not null default true,
  matched_terms text[] not null default '{}',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),

  -- Rempli par la classification IA
  category text,
  product text,
  angle text,
  hook text,
  offer text,
  classified_at timestamptz,
  classified_by text,             -- 'rules' | 'ai' | 'manual'

  -- Swipe file
  saved boolean not null default false
);

create index if not exists ads_category_idx on ads (category);
create index if not exists ads_page_idx on ads (page_id);
create index if not exists ads_start_idx on ads (delivery_start);
create index if not exists ads_unclassified_idx on ads (classified_at) where classified_at is null;

-- Recherche plein texte (texte de la pub + page + produit + hook)
-- array_to_string n'est pas « immutable » pour Postgres, d'où cette petite fonction
create or replace function ads_search_text(page_name text, bodies text[], link_titles text[], product text, hook text)
returns tsvector language sql immutable as $$
  select to_tsvector('simple'::regconfig,
    coalesce(page_name, '') || ' ' ||
    coalesce(array_to_string(bodies, ' '), '') || ' ' ||
    coalesce(array_to_string(link_titles, ' '), '') || ' ' ||
    coalesce(product, '') || ' ' || coalesce(hook, ''))
$$;

alter table ads add column if not exists search tsvector
  generated always as (ads_search_text(page_name, bodies, link_titles, product, hook)) stored;
create index if not exists ads_search_idx on ads using gin (search);

-- Vue avec les signaux de « gagnante »
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

-- Nombre de pubs actives par catégorie (pour les filtres)
create or replace view category_counts with (security_invoker = true) as
select coalesce(category, 'Non classée') as category, count(*)::int as n
from ads where is_active
group by 1 order by 2 desc;

-- Journal des collectes
create table if not exists runs (
  id bigint generated always as identity primary key,
  kind text not null,             -- 'collect' | 'classify'
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  detail jsonb
);

-- Sécurité : seule la clé service_role (côté serveur) peut lire/écrire.
alter table keywords enable row level security;
alter table ads enable row level security;
alter table runs enable row level security;

-- Quelques mots-clés de départ (drop)
insert into keywords (term) values
  ('free shipping'), ('50% off'), ('limited stock'), ('order now'),
  ('livraison gratuite'), ('kostenloser versand')
on conflict (term) do nothing;
