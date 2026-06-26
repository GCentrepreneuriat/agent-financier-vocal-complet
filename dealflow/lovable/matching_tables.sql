-- ============================================================
--  MATCHING PRIVÉ — tables (à exécuter dans Supabase SQL editor)
--  profils_acheteurs : la DEMANDE (repreneurs et leurs critères)
--  listings_prives   : l'OFFRE privée (cédants rencontrés, confidentiel)
-- ============================================================

-- 1. Profils acheteurs ---------------------------------------------------------
create table if not exists public.profils_acheteurs (
    id              uuid primary key default gen_random_uuid(),
    nom             text,
    courriel        text,
    telephone       text,
    secteurs_recherches  text[] default '{}',   -- ex: {manufacturier,distribution}
    regions_recherchees  text[] default '{}',
    budget_min      bigint,
    budget_max      bigint,
    revenue_min     bigint,
    revenue_max     bigint,
    ebitda_min      bigint,
    type_acquisition text,        -- majoritaire | 100% | partenariat | investisseur
    financement     text,         -- capacité / sources
    horizon         text,         -- urgence d'acquisition
    notes           text,
    statut          text default 'actif',   -- actif | en_pause | transige
    created_at      timestamptz default now()
);
create index if not exists idx_ach_statut on public.profils_acheteurs (statut);

alter table public.profils_acheteurs enable row level security;
drop policy if exists "ach_insert" on public.profils_acheteurs;
drop policy if exists "ach_select" on public.profils_acheteurs;
-- Un visiteur peut créer son profil ; seule l'équipe (connectée) les consulte.
create policy "ach_insert" on public.profils_acheteurs for insert to anon, authenticated with check (true);
create policy "ach_select" on public.profils_acheteurs for select to authenticated using (true);
create policy "ach_update" on public.profils_acheteurs for update to authenticated using (true) with check (true);


-- 2. Vendeurs privés (confidentiel) -------------------------------------------
create table if not exists public.listings_prives (
    id              uuid primary key default gen_random_uuid(),
    nom_entreprise  text not null,
    description     text,
    sector          text,
    region          text,
    city            text,
    revenue         bigint,
    ebitda          bigint,
    asking_price    bigint,
    asking_price_text text,
    raison_vente        text,
    horizon_vente       text,
    financement_vendeur text,
    transition          text,
    contact_nom     text,
    contact_courriel text,
    contact_tel     text,
    notes           text,
    statut          text default 'actif',   -- actif | en_pause | transige | retire
    confidentiel    boolean default true,
    created_at      timestamptz default now()
);
create index if not exists idx_priv_sector on public.listings_prives (sector);
create index if not exists idx_priv_region on public.listings_prives (region);

alter table public.listings_prives enable row level security;
drop policy if exists "priv_all" on public.listings_prives;
-- Strictement interne : seule l'équipe connectée y a accès.
create policy "priv_all" on public.listings_prives for all to authenticated using (true) with check (true);


-- 3. Journal des correspondances enregistrées (optionnel, pour le suivi) -------
create table if not exists public.matches (
    id              uuid primary key default gen_random_uuid(),
    acheteur_id     uuid references public.profils_acheteurs (id) on delete cascade,
    listing_public_id uuid,
    listing_prive_id  uuid references public.listings_prives (id) on delete cascade,
    score           int,
    statut          text default 'suggere',  -- suggere | presente | rejete | conclu
    created_at      timestamptz default now()
);
alter table public.matches enable row level security;
drop policy if exists "match_all" on public.matches;
create policy "match_all" on public.matches for all to authenticated using (true) with check (true);
