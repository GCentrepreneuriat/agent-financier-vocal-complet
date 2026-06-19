"""Génère un fichier SQL (création table + RLS + INSERT des annonces) prêt à
coller dans Lovable Cloud > SQL editor.

  python generate_install_sql.py                       # complet (2 sources, nettoyage)
  python generate_install_sql.py --append              # ajout seulement, aucun DELETE
  python generate_install_sql.py --source monentrepriseavendre --append
"""

import argparse

from scrapers.lavitrine import LaVitrineScraper
from scrapers.monentrepriseavendre import MonEntrepriseAVendreScraper
from scrapers.entreprisesavendre import EntreprisesAVendreScraper
from scrapers.occasionsaffaires import OccasionsAffairesScraper
from scrapers.trnsfr import TrnsfrScraper
from scrapers.sunbelt import SunbeltScraper
from scrapers.businessesforsale import BusinessesForSaleScraper
from dedupe import find_duplicates

SCRAPERS = [
    LaVitrineScraper, MonEntrepriseAVendreScraper,
    EntreprisesAVendreScraper, OccasionsAffairesScraper,
    TrnsfrScraper, SunbeltScraper, BusinessesForSaleScraper,
]

DDL = """-- ============================================================
--  GC DEAL FLOW — Installation complete (Lovable Cloud)
--  A coller dans Lovable > Cloud > SQL editor, puis Run.
-- ============================================================

create table if not exists public.listings_publics (
    id              uuid primary key default gen_random_uuid(),
    source          text not null,
    source_id       text not null,
    source_url      text not null,
    title           text not null,
    description     text,
    sector_raw      text,
    sector          text,
    region_raw      text,
    region          text,
    city            text,
    asking_price      bigint,
    asking_price_text text,
    revenue           bigint,
    ebitda            bigint,
    date_listed       date,
    date_scraped      timestamptz default now(),
    last_seen         date default current_date,
    status            text default 'active',
    dedup_hash        text,
    potential_duplicate_of text,
    created_at        timestamptz default now(),
    unique (source, source_id)
);

-- Si la table existait deja sans cette colonne, on l'ajoute.
alter table public.listings_publics add column if not exists asking_price_text text;

alter table public.listings_publics enable row level security;

drop policy if exists "interne_full_access" on public.listings_publics;
create policy "interne_full_access" on public.listings_publics
    for all to authenticated using (true) with check (true);

-- Table des demandes de contact (leads du bouton "Nous contacter")
create table if not exists public.contacts (
    id            uuid primary key default gen_random_uuid(),
    listing_id    uuid references public.listings_publics (id) on delete set null,
    listing_title text,
    prenom        text,
    nom           text,
    telephone     text,
    courriel      text,
    message       text,
    traite        boolean default false,
    created_at    timestamptz default now()
);

alter table public.contacts enable row level security;
drop policy if exists "contacts_insert" on public.contacts;
drop policy if exists "contacts_select" on public.contacts;
-- Un utilisateur connecte peut envoyer une demande...
create policy "contacts_insert" on public.contacts
    for insert to authenticated with check (true);
-- ...et l'equipe peut les consulter.
create policy "contacts_select" on public.contacts
    for select to authenticated using (true);

-- Insertion des annonces (re-executable: met a jour les fiches existantes)
"""

COLS = ("source, source_id, source_url, title, description, sector_raw, sector, "
        "region_raw, region, city, asking_price, asking_price_text, revenue, ebitda, "
        "date_listed, last_seen, status, dedup_hash, potential_duplicate_of")


def q(v):
    if v is None or v == "":
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"


def n(v):
    return "NULL" if v in (None, "") else str(v)


def main():
    parser = argparse.ArgumentParser(description="Génère le SQL d'installation/mise à jour")
    parser.add_argument(
        "--append", action="store_true",
        help="Mode ajout seulement : aucune suppression (ne retire pas les vendues).",
    )
    parser.add_argument(
        "--source", action="append", choices=[s.source_name for s in SCRAPERS],
        help="Limiter à une ou plusieurs sources (répétable). Défaut : toutes.",
    )
    parser.add_argument("--out", default="data/installation_lovable_cloud.sql")
    args = parser.parse_args()

    chosen = [s for s in SCRAPERS if not args.source or s.source_name in args.source]

    listings = []
    for scraper_cls in chosen:
        print(f"→ Scraping {scraper_cls.source_name}…")
        got = scraper_cls().run()
        print(f"  {len(got)} annonces")
        listings.extend(got)

    reviewed = find_duplicates(listings)

    # On ne publie que les annonces actives (on exclut les vendues/retirées).
    active = [r for r in reviewed if r.listing.status == "active"]
    sold = len(reviewed) - len(active)

    out = [DDL]

    if not args.append:
        # Nettoyage par source : retirer de la base les annonces qui ne sont plus
        # actives (vendues/disparues), pour garder la table à jour à chaque run.
        sources = {r.listing.source for r in active}
        for src in sorted(sources):
            ids = ", ".join(q(r.listing.source_id) for r in active if r.listing.source == src)
            out.append(
                f"delete from public.listings_publics where source = {q(src)}"
                + (f" and source_id not in ({ids});" if ids else ";")
            )
        out.append("")

    for r in active:
        l = r.listing
        pdup = " | ".join(r.potential_duplicate_of)
        vals = [
            q(l.source), q(l.source_id), q(l.source_url), q(l.title), q(l.description),
            q(l.sector_raw), q(l.sector), q(l.region_raw), q(l.region), q(l.city),
            n(l.asking_price), q(l.asking_price_text), n(l.revenue), n(l.ebitda),
            q(l.date_listed), q(l.last_seen),
            q(l.status), q(l.dedup_hash), q(pdup),
        ]
        out.append(
            f"insert into public.listings_publics ({COLS}) values "
            f"({', '.join(vals)}) on conflict (source, source_id) do update set "
            "title = excluded.title, description = excluded.description, "
            "sector = excluded.sector, region = excluded.region, city = excluded.city, "
            "asking_price = excluded.asking_price, "
            "asking_price_text = excluded.asking_price_text, "
            "revenue = excluded.revenue, ebitda = excluded.ebitda, "
            "last_seen = excluded.last_seen, status = excluded.status;"
        )

    with open(args.out, "w", encoding="utf-8") as f:
        f.write("\n".join(out) + "\n")
    mode = "AJOUT seulement (aucun DELETE)" if args.append else "complet (avec nettoyage)"
    print(f"OK [{mode}] — {len(active)} entreprises écrites dans {args.out} "
          f"({sold} vendues exclues)")


if __name__ == "__main__":
    main()
