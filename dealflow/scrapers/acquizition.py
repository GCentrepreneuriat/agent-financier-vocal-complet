"""
Scraper Acquizition.biz

Méthode : API JSON interne de l'app React (POST /listing/search). Pas de
navigateur requis malgré le SPA : l'endpoint renvoie directement les données
structurées (titre, prix, revenus, BAIIA, description, codes région/industrie).

Conformité robots.txt (vérifié) : User-agent: *  Allow: /  (aucune restriction).

Les codes région/industrie ne sont pas mappés publiquement ; la région est donc
déduite du texte (titre + description), qui mentionne presque toujours la région
ou la ville. Acquizition est un marché 100% québécois.
"""

from __future__ import annotations

import json
import re
from typing import Iterator, Optional

from models import Listing
from normalize import normalize_region, normalize_sector
from scrapers.base import BaseScraper

API = "https://acquizition.biz/listing/search"
LISTING_URL = "https://www.acquizition.biz/fl/{id}"
PER_PAGE = 50
MAX_PAGES = 40


def _strip(x: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", x or "")).strip()


def _first(lst, default=""):
    return lst[0] if isinstance(lst, list) and lst else default


class AcquizitionScraper(BaseScraper):
    source_name = "acquizition"

    def fetch_listings(self) -> Iterator[Listing]:
        seen_ids: set[str] = set()
        for page in range(1, MAX_PAGES + 1):
            tiles = self.post(page)
            if tiles is None:                 # 204 / vide -> fin de pagination
                break
            for tile in tiles:
                _id = str(tile.get("_id"))
                if _id in seen_ids:           # dédup (l'API peut répéter)
                    continue
                seen_ids.add(_id)
                listing = self._parse(tile)
                if listing is not None:
                    yield listing

    def post(self, page: int) -> Optional[list]:
        """POST JSON (corps de filtres vide = tout). Retourne None à la fin
        (HTTP 204 / corps vide), sinon la liste des tuiles."""
        import time
        elapsed = time.monotonic() - self._last_request_at
        if elapsed < self.request_delay:
            time.sleep(self.request_delay - elapsed)
        last_exc = None
        for attempt in range(3):
            try:
                r = self.session.post(
                    API, params={"number_of_listing": PER_PAGE, "page": page}, data="{}",
                    headers={"Content-Type": "application/json",
                             "Origin": "https://www.acquizition.biz"},
                    timeout=30,
                )
                self._last_request_at = time.monotonic()
                if r.status_code == 204 or not r.content:
                    return None
                r.raise_for_status()
                return r.json().get("tile_list", [])
            except Exception as exc:          # erreur transitoire -> retry
                last_exc = exc
                time.sleep(2 ** attempt)
        raise RuntimeError(f"Échec POST page {page}: {last_exc}")

    def _parse(self, tile: dict) -> Optional[Listing]:
        if tile.get("to_be_deleted") or not tile.get("is_published", True):
            return None

        bi = tile.get("basic_info", {}) or {}
        fd = tile.get("financial_details", {}) or {}

        title = _strip(_first(bi.get("listing_title")))
        description = _strip(_first(bi.get("about_company")))
        if not title:
            return None
        # Annonces vendues : préfixe "VENDU" / "SOLD" dans le titre.
        if re.search(r"\b(VENDU|VENDUE|SOLD)\b", title, re.IGNORECASE):
            return None

        price = bi.get("asking_price")
        price = int(price) if isinstance(price, (int, float)) and price else None

        text = f"{title} {description}"
        return Listing(
            source=self.source_name,
            source_id=str(tile.get("_id")),
            source_url=LISTING_URL.format(id=tile.get("_id")),
            title=title,
            description=description,
            sector_raw="",
            sector=normalize_sector(text[:400]),
            region_raw="quebec",
            region=normalize_region(text),
            city="",
            asking_price=price,
            asking_price_text=(f"{price:,} $".replace(",", " ") if price else "Prix sur demande"),
            revenue=int(fd["revenue"]) if isinstance(fd.get("revenue"), (int, float)) and fd.get("revenue") else None,
            ebitda=int(fd["ebitda"]) if isinstance(fd.get("ebitda"), (int, float)) and fd.get("ebitda") else None,
            status="active",
        )
