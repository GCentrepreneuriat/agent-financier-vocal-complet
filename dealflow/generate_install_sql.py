"""Génère un fichier SQL complet (création table + RLS + INSERT des annonces)
prêt à coller dans Lovable Cloud > SQL editor."""

from scrapers.lavitrine import LaVitrineScraper
from dedupe import find_duplicates

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
    asking_price    bigint,
    revenue         bigint,
    ebitda          bigint,
    date_listed     date,
    date_scraped    timestamptz default now(),
    last_seen       date default current_date,
    status          text default 'active',
    dedup_hash      text,
    potential_duplicate_of text,
    created_at      timestamptz default now(),
    unique (source, source_id)
);

alter table public.listings_publics enable row level security;

drop policy if exists "interne_full_access" on public.listings_publics;
create policy "interne_full_access" on public.listings_publics
    for all to authenticated using (true) with check (true);

-- Insertion des annonces (re-executable grace a 'on conflict do nothing')
"""

COLS = ("source, source_id, source_url, title, description, sector_raw, sector, "
        "region_raw, region, city, asking_price, revenue, ebitda, date_listed, "
        "last_seen, status, dedup_hash, potential_duplicate_of")


def q(v):
    if v is None or v == "":
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"


def n(v):
    return "NULL" if v in (None, "") else str(v)


def main():
    listings = LaVitrineScraper().run()
    reviewed = find_duplicates(listings)

    out = [DDL]
    for r in reviewed:
        l = r.listing
        pdup = " | ".join(r.potential_duplicate_of)
        vals = [
            q(l.source), q(l.source_id), q(l.source_url), q(l.title), q(l.description),
            q(l.sector_raw), q(l.sector), q(l.region_raw), q(l.region), q(l.city),
            n(l.asking_price), n(l.revenue), n(l.ebitda), q(l.date_listed), q(l.last_seen),
            q(l.status), q(l.dedup_hash), q(pdup),
        ]
        out.append(
            f"insert into public.listings_publics ({COLS}) values "
            f"({', '.join(vals)}) on conflict (source, source_id) do nothing;"
        )

    path = "data/installation_lovable_cloud.sql"
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(out) + "\n")
    print(f"OK — {len(reviewed)} entreprises écrites dans {path}")


if __name__ == "__main__":
    main()
