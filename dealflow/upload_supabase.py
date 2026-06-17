"""
Pousse les annonces scrapées dans Supabase (table listings_publics).

C'est ce qui relie le scraper Python à ton interface Lovable : le script
collecte les annonces, puis les UPSERT dans Supabase via l'API REST. Lovable
lit ensuite cette table. À lancer manuellement ou via un cron (ex: chaque nuit).

Pré-requis (variables d'environnement) :
    SUPABASE_URL          ex: https://xxxx.supabase.co
    SUPABASE_SERVICE_KEY  clé "service_role" (Supabase > Settings > API)
                          ⚠ SECRÈTE — ne jamais la committer ni la mettre dans Lovable.

Usage :
    export SUPABASE_URL="https://xxxx.supabase.co"
    export SUPABASE_SERVICE_KEY="eyJ..."
    python upload_supabase.py                 # toutes les sources
    python upload_supabase.py --source lavitrine
    python upload_supabase.py --dry-run       # affiche sans envoyer
"""

from __future__ import annotations

import argparse
import json
import os
import sys

import requests

from dedupe import find_duplicates
from main import SCRAPERS

TABLE = "listings_publics"
BATCH_SIZE = 100

# Colonnes acceptées par la table Supabase (les autres champs sont ignorés).
COLUMNS = {
    "source", "source_id", "source_url", "title", "description",
    "sector_raw", "sector", "region_raw", "region", "city",
    "asking_price", "revenue", "ebitda",
    "date_listed", "last_seen", "status",
    "dedup_hash", "potential_duplicate_of",
}


def collect(sources: list[str]) -> list[dict]:
    """Scrape les sources et retourne des enregistrements prêts pour Supabase."""
    listings = []
    for name in sources:
        print(f"→ Scraping {name}…")
        listings.extend(SCRAPERS[name]().run())
    reviewed = find_duplicates(listings)

    records = []
    for r in reviewed:
        d = r.to_dict()
        d["potential_duplicate_of"] = " | ".join(d.get("potential_duplicate_of", []))
        records.append({k: v for k, v in d.items() if k in COLUMNS})
    return records


def upsert(records: list[dict], url: str, key: str) -> None:
    """UPSERT en lots dans Supabase via PostgREST (conflit sur source,source_id)."""
    endpoint = f"{url.rstrip('/')}/rest/v1/{TABLE}?on_conflict=source,source_id"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        # merge-duplicates = met à jour la ligne existante au lieu d'échouer
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i:i + BATCH_SIZE]
        resp = requests.post(endpoint, headers=headers, data=json.dumps(batch), timeout=30)
        if resp.status_code >= 300:
            print(f"  ⚠ Lot {i // BATCH_SIZE + 1} : HTTP {resp.status_code} — {resp.text[:300]}")
            resp.raise_for_status()
        print(f"  ✓ Lot {i // BATCH_SIZE + 1} : {len(batch)} annonces upsertées")


def main() -> None:
    parser = argparse.ArgumentParser(description="Upload deal flow -> Supabase")
    parser.add_argument("--source", action="append", choices=list(SCRAPERS))
    parser.add_argument("--dry-run", action="store_true", help="N'envoie rien, affiche seulement")
    args = parser.parse_args()

    sources = args.source or list(SCRAPERS)
    records = collect(sources)
    print(f"\n{len(records)} annonces prêtes.")

    if args.dry_run:
        print(json.dumps(records[:2], ensure_ascii=False, indent=2))
        print("\n(dry-run : rien n'a été envoyé)")
        return

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        sys.exit("ERREUR : définir SUPABASE_URL et SUPABASE_SERVICE_KEY (voir en-tête du fichier).")

    print(f"\nEnvoi vers {url} …")
    upsert(records, url, key)
    print("Terminé.")


if __name__ == "__main__":
    main()
