"""
Orchestrateur du scraper de deal flow.

Usage :
    python main.py                  # toutes les sources activées
    python main.py --source lavitrine
    python main.py --out ./data     # dossier de sortie

Ajoute une source : créer scrapers/<source>.py (hériter de BaseScraper),
puis l'enregistrer dans SCRAPERS ci-dessous.
"""

from __future__ import annotations

import argparse
from collections import Counter
from datetime import date
from pathlib import Path

from dedupe import find_duplicates
from export import export_csv, export_json
from scrapers.base import BaseScraper
from scrapers.lavitrine import LaVitrineScraper

# Registre des sources. Activer/désactiver ici.
SCRAPERS: dict[str, type[BaseScraper]] = {
    "lavitrine": LaVitrineScraper,
    # "entreprisesavendre": EntreprisesAVendreScraper,   # à venir
    # "occasionsaffaires": ...                            # après validation juridique
    # "acquizition": ...                                  # nécessite Playwright
}


def run(sources: list[str], out_dir: Path) -> None:
    all_listings = []
    print("=" * 60)
    print("  GC DEAL FLOW — Agrégateur d'annonces (usage interne)")
    print("=" * 60)

    for name in sources:
        scraper_cls = SCRAPERS[name]
        print(f"\n→ Source : {name}")
        try:
            listings = scraper_cls().run()
            print(f"  {len(listings)} annonces récupérées")
            all_listings.extend(listings)
        except Exception as exc:  # une source en panne ne bloque pas les autres
            print(f"  ⚠ ERREUR sur {name} : {exc}")

    if not all_listings:
        print("\nAucune annonce récupérée. Arrêt.")
        return

    reviewed = find_duplicates(all_listings)
    flagged = sum(1 for r in reviewed if r.potential_duplicate_of)

    # Statistiques
    print("\n" + "-" * 60)
    print(f"  Total annonces conservées : {len(reviewed)}")
    print(f"  Doublons potentiels signalés (à valider) : {flagged}")
    by_sector = Counter(r.listing.sector or "?" for r in reviewed)
    print("  Par secteur :")
    for sector, count in by_sector.most_common():
        print(f"    {sector:28} {count}")

    # Export
    stamp = date.today().isoformat()
    csv_path = export_csv(reviewed, out_dir / f"dealflow_{stamp}.csv")
    json_path = export_json(reviewed, out_dir / f"dealflow_{stamp}.json")
    print("\n  Exports :")
    print(f"    {csv_path}")
    print(f"    {json_path}")
    print("=" * 60)


def main() -> None:
    parser = argparse.ArgumentParser(description="Agrégateur de deal flow M&A")
    parser.add_argument(
        "--source", action="append", choices=list(SCRAPERS),
        help="Source à scraper (répétable). Défaut : toutes.",
    )
    parser.add_argument("--out", default="./data", help="Dossier de sortie")
    args = parser.parse_args()

    sources = args.source or list(SCRAPERS)
    run(sources, Path(args.out))


if __name__ == "__main__":
    main()
