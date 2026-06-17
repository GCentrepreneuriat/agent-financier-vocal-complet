-- Schéma Supabase pour la base de deal flow agrégée.
-- Aligné sur les colonnes produites par export.py.
--
-- Import : Supabase > Table Editor > Import CSV, ou via le SQL ci-dessous puis
-- copie du CSV. La clé (source, source_id) garantit l'unicité par source.

create table if not exists public.listings_publics (
    id                  bigint generated always as identity primary key,

    -- Provenance
    source              text not null,            -- ex: 'lavitrine'
    source_id           text not null,            -- id unique chez la source
    source_url          text not null,

    -- Contenu
    title               text not null,
    description         text,

    -- Classification
    sector_raw          text,
    sector              text,                      -- secteur normalisé
    region_raw          text,
    region              text,                      -- région administrative normalisée
    city                text,

    -- Données financières (souvent absentes des sources publiques)
    asking_price        bigint,
    revenue             bigint,
    ebitda              bigint,

    -- Suivi temporel
    date_listed         date,
    date_scraped        timestamptz default now(),
    last_seen           date,
    status              text default 'active',     -- active | expired

    -- Déduplication / révision
    dedup_hash          text,
    potential_duplicate_of text,                   -- URLs séparées par ' | '

    created_at          timestamptz default now(),

    unique (source, source_id)
);

create index if not exists idx_listings_sector on public.listings_publics (sector);
create index if not exists idx_listings_region on public.listings_publics (region);
create index if not exists idx_listings_status on public.listings_publics (status);

-- Upsert recommandé lors des re-scrapes (met à jour last_seen / status) :
--   insert ... on conflict (source, source_id) do update set
--     last_seen = excluded.last_seen, status = excluded.status, ...
