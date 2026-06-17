-- ============================================================================
--  GC DEAL FLOW — Schéma Supabase (outil INTERNE)
-- ============================================================================
--  À exécuter dans Supabase > SQL Editor.
--
--  4 tables :
--    listings_publics    annonces scrapées des plateformes publiques
--    listings_prives     vendeurs rencontrés en personne (confidentiel)
--    profils_acheteurs   acheteurs qualifiés rencontrés
--    matches             rapprochements suggérés (rempli plus tard)
--
--  Outil interne : RLS activé, accès réservé aux utilisateurs AUTHENTIFIÉS
--  (ton équipe via Supabase Auth). Aucun accès public anonyme.
--
--  ⚠ Loi 25 : listings_prives et profils_acheteurs contiennent des données
--  personnelles. Accès strictement interne, jamais exposé publiquement.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. LISTINGS PUBLICS (scrapés)
-- ----------------------------------------------------------------------------
create table if not exists public.listings_publics (
    id              uuid primary key default gen_random_uuid(),

    source          text not null,            -- ex: 'lavitrine'
    source_id       text not null,            -- id unique chez la source
    source_url      text not null,

    title           text not null,
    description     text,

    sector_raw      text,
    sector          text,                     -- secteur normalisé
    region_raw      text,
    region          text,                     -- région administrative normalisée
    city            text,

    asking_price    bigint,                   -- souvent null (caché par la source)
    revenue         bigint,
    ebitda          bigint,

    date_listed     date,
    date_scraped    timestamptz default now(),
    last_seen       date default current_date,
    status          text default 'active',    -- active | expired

    dedup_hash              text,
    potential_duplicate_of  text,             -- URLs séparées par ' | '

    created_at      timestamptz default now(),

    unique (source, source_id)                -- clé d'upsert pour les re-scrapes
);

create index if not exists idx_lp_sector on public.listings_publics (sector);
create index if not exists idx_lp_region on public.listings_publics (region);
create index if not exists idx_lp_status on public.listings_publics (status);


-- ----------------------------------------------------------------------------
-- 2. LISTINGS PRIVÉS (vendeurs rencontrés — confidentiel)
-- ----------------------------------------------------------------------------
create table if not exists public.listings_prives (
    id              uuid primary key default gen_random_uuid(),

    nom_entreprise  text not null,
    description     text,

    sector          text,
    region          text,
    city            text,

    revenue         bigint,                   -- chiffre d'affaires
    ebitda          bigint,                   -- BAIIA
    asking_price    bigint,                   -- prix demandé / attente

    raison_vente        text,
    horizon_vente       text,                 -- ex: '0-12 mois', '1-3 ans'
    financement_vendeur text,                 -- balance de prix possible ?
    transition          text,                 -- période d'accompagnement

    contact_nom     text,
    contact_courriel text,
    contact_tel     text,

    notes           text,
    statut          text default 'actif',     -- actif | en_pause | transige | retire
    confidentiel    boolean default true,

    cree_par        uuid references auth.users (id),
    created_at      timestamptz default now(),
    updated_at      timestamptz default now()
);

create index if not exists idx_priv_sector on public.listings_prives (sector);
create index if not exists idx_priv_region on public.listings_prives (region);


-- ----------------------------------------------------------------------------
-- 3. PROFILS ACHETEURS (acquéreurs qualifiés)
-- ----------------------------------------------------------------------------
create table if not exists public.profils_acheteurs (
    id              uuid primary key default gen_random_uuid(),

    nom             text not null,
    courriel        text,
    telephone       text,

    secteurs_recherches  text[],              -- ex: '{manufacturier,distribution}'
    regions_recherchees  text[],
    budget_min      bigint,
    budget_max      bigint,
    revenue_min     bigint,                   -- taille cible (CA)
    revenue_max     bigint,
    ebitda_min      bigint,

    type_acquisition text,                    -- ex: 'majoritaire', '100%', 'partenariat'
    financement      text,                    -- capacité / sources de financement
    horizon          text,                    -- urgence d'acquisition

    notes           text,
    statut          text default 'actif',     -- actif | en_pause | transige

    cree_par        uuid references auth.users (id),
    created_at      timestamptz default now(),
    updated_at      timestamptz default now()
);

create index if not exists idx_ach_statut on public.profils_acheteurs (statut);


-- ----------------------------------------------------------------------------
-- 4. MATCHES (rapprochements — rempli par le moteur de matching, phase 2)
-- ----------------------------------------------------------------------------
create table if not exists public.matches (
    id              uuid primary key default gen_random_uuid(),

    acheteur_id     uuid references public.profils_acheteurs (id) on delete cascade,

    -- une annonce publique OU une annonce privée (un seul des deux)
    listing_public_id uuid references public.listings_publics (id) on delete cascade,
    listing_prive_id  uuid references public.listings_prives  (id) on delete cascade,

    score           int,                      -- 0-100
    raisons         text,                     -- explication du score
    statut          text default 'suggere',   -- suggere | presente | rejete | en_discussion | conclu

    cree_par        uuid references auth.users (id),
    created_at      timestamptz default now()
);

create index if not exists idx_match_acheteur on public.matches (acheteur_id);


-- ============================================================================
--  SÉCURITÉ — RLS (Row Level Security)
--  Outil interne : seuls les utilisateurs authentifiés (l'équipe) ont accès.
-- ============================================================================
alter table public.listings_publics  enable row level security;
alter table public.listings_prives   enable row level security;
alter table public.profils_acheteurs enable row level security;
alter table public.matches           enable row level security;

-- Politique unique par table : tout utilisateur authentifié peut lire/écrire.
-- (Affiner plus tard si tu veux des rôles distincts.)
create policy "interne_full_access" on public.listings_publics
    for all to authenticated using (true) with check (true);

create policy "interne_full_access" on public.listings_prives
    for all to authenticated using (true) with check (true);

create policy "interne_full_access" on public.profils_acheteurs
    for all to authenticated using (true) with check (true);

create policy "interne_full_access" on public.matches
    for all to authenticated using (true) with check (true);

-- Note : le script Python utilise la clé service_role, qui contourne le RLS
-- pour insérer les listings scrapés. Garde cette clé SECRÈTE (jamais dans
-- Lovable ni dans le code versionné).
