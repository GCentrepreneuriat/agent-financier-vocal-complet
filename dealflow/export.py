"""
Export des annonces vers CSV et JSON, prêts à importer dans Supabase.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

from dedupe import ReviewedListing

# Colonnes exportées, dans l'ordre. Aligné sur le schéma Supabase prévu.
COLUMNS = [
    "dedup_hash", "source", "source_id", "source_url",
    "title", "description",
    "sector_raw", "sector", "region_raw", "region", "city",
    "asking_price", "revenue", "ebitda",
    "date_listed", "date_scraped", "last_seen", "status",
    "potential_duplicate_of",
]


def export_csv(listings: list[ReviewedListing], path: str | Path) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS, extrasaction="ignore")
        writer.writeheader()
        for item in listings:
            row = item.to_dict()
            row["potential_duplicate_of"] = " | ".join(row.get("potential_duplicate_of", []))
            writer.writerow(row)
    return path


def export_json(listings: list[ReviewedListing], path: str | Path) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    data = [item.to_dict() for item in listings]
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return path
