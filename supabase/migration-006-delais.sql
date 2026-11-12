-- Migration 006 · laisser plus de temps aux gros calculs (le plan gratuit coupe à ~8 s par défaut)
-- À coller une fois dans Supabase > SQL Editor > New snippet > Run.

-- La clé serveur (collecte GitHub, site) a droit à 2 minutes par requête
alter role service_role set statement_timeout = '120s';
alter function refresh_ad_stats() set statement_timeout = '120s';
notify pgrst, 'reload config';

-- Trouver vite les pubs pas encore classées
create index if not exists ads_unclassified_idx on ads (id) where classified_at is null;
create index if not exists ads_last_seen_idx on ads (is_active, last_seen_at);
