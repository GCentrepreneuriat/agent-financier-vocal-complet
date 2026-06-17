"""
Scraper LaVitrine.biz

Méthode : API REST WordPress (et non scraping HTML). LaVitrine expose ses
annonces via le type de contenu `job_listing` sous l'endpoint REST standard.
C'est beaucoup plus stable que parser le HTML : insensible aux changements de
thème, données déjà structurées, pagination native.

Conformité robots.txt (vérifié) :
  User-agent: *  ->  Disallow: /wp-admin/  (le reste autorisé)
  L'endpoint /wp-json/ n'est pas interdit.

Données disponibles : titre, description, secteur, région, ville.
Données NON disponibles : prix, revenus, BAIIA (non publiés sur le site).
"""

from __future__ import annotations

import re
from typing import Iterator

from models import Listing
from normalize import normalize_region, normalize_sector
from scrapers.base import BaseScraper

API_URL = "https://lavitrine.biz/wp-json/wp/v2/job-listings"
# Note : avec _embed actif (qui embarque les noms de secteur/région), demander
# trop d'annonces d'un coup fait planter la génération côté serveur (timeout
# PHP -> corps vide). 5 par page est la limite sûre et reste rapide.
PER_PAGE = 5


def _strip_html(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text or "")
    return re.sub(r"\s+", " ", text).strip()


def _parse_location(raw: str) -> str:
    """'Chicoutimi, G7H, QC' -> 'Chicoutimi'."""
    if not raw:
        return ""
    return raw.split(",")[0].strip()


class LaVitrineScraper(BaseScraper):
    source_name = "lavitrine"

    def fetch_listings(self) -> Iterator[Listing]:
        page = 1
        while True:
            resp = self.get(
                API_URL,
                params={"per_page": PER_PAGE, "page": page, "_embed": "wp:term"},
            )
            items = resp.json()
            if not items:
                break

            for item in items:
                yield self._parse_item(item)

            total_pages = int(resp.headers.get("X-WP-TotalPages", 1))
            if page >= total_pages:
                break
            page += 1

    def _parse_item(self, item: dict) -> Listing:
        meta = item.get("meta", {}) or {}

        # Taxonomies embarquées (région + type/secteur)
        sector_raw = ""
        region_raw = ""
        for group in item.get("_embedded", {}).get("wp:term", []):
            for term in group:
                tax = term.get("taxonomy")
                if tax == "job_listing_type" and not sector_raw:
                    sector_raw = term.get("name", "")
                elif tax == "job_listing_region" and not region_raw:
                    region_raw = term.get("name", "")

        title = _strip_html(item.get("title", {}).get("rendered", ""))
        description = (
            meta.get("_company_tagline")
            or _strip_html(item.get("content", {}).get("rendered", ""))
        )
        city = _parse_location(meta.get("_job_location", ""))

        return Listing(
            source=self.source_name,
            source_id=str(item.get("id")),
            source_url=item.get("link", ""),
            title=title,
            description=description,
            sector_raw=sector_raw,
            sector=normalize_sector(sector_raw),
            region_raw=region_raw,
            region=normalize_region(region_raw or city),
            city=city,
            date_listed=(item.get("date") or "")[:10] or None,
        )
