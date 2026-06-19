"""
Scraper Trnsfr.ca

Méthode : API JSON Shopify publique (/collections/.../products.json). C'est la
source la plus propre : données déjà structurées (titre, prix, description,
tags, type), pagination native. Aucune extraction HTML fragile.

Conformité robots.txt (vérifié) : User-agent: *  Allow: /  (seuls /admin,
/cart, /checkout, /account sont interdits — pas les collections/produits).

Le secteur vient des tags Shopify (service, resto, detail, agro, immo, ...),
qui correspondent déjà presque à notre vocabulaire canonique.
"""

from __future__ import annotations

import re
from typing import Iterator, Optional

from models import Listing
from normalize import normalize_region, normalize_sector
from scrapers.base import BaseScraper

COLLECTION = "https://trnsfr.ca/collections/entreprise-vendre-quebec/products.json"
PRODUCT_URL = "https://trnsfr.ca/products/{handle}"


def _strip_html(t: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", t or "")).strip()


def _price(product: dict) -> Optional[int]:
    variants = product.get("variants") or [{}]
    raw = variants[0].get("price")
    try:
        val = int(float(raw))
        return val if val > 0 else None
    except (TypeError, ValueError):
        return None


class TrnsfrScraper(BaseScraper):
    source_name = "trnsfr"

    def fetch_listings(self) -> Iterator[Listing]:
        page = 1
        while True:
            data = self.get(f"{COLLECTION}?limit=250&page={page}").json()
            products = data.get("products", [])
            if not products:
                break
            for p in products:
                yield self._parse(p)
            page += 1

    def _parse(self, p: dict) -> Listing:
        title = (p.get("title") or "").strip()
        description = _strip_html(p.get("body_html", ""))

        # Secteur : premier tag qui correspond à un secteur connu, sinon le titre.
        sector = "autre"
        tags = p.get("tags") or []
        for tag in tags:
            s = normalize_sector(tag)
            if s not in ("autre", ""):
                sector = s
                break
        if sector == "autre":
            sector = normalize_sector(title)

        region = normalize_region(f"{title} {description}")
        price = _price(p)

        return Listing(
            source=self.source_name,
            source_id=str(p.get("id")),
            source_url=PRODUCT_URL.format(handle=p.get("handle", "")),
            title=title,
            description=description,
            sector_raw=", ".join(tags),
            sector=sector,
            region_raw="",
            region=region,
            city="",
            asking_price=price,
            asking_price_text=(f"{price:,} $".replace(",", " ") if price else "Prix sur demande"),
            revenue=None,
            ebitda=None,
            status="active",
        )
