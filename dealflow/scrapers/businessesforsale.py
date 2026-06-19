"""
Scraper BusinessesForSale.com — annonces du QUÉBEC (canada.businessesforsale.com).

Méthode : pages de recherche rendues serveur. La liste (déjà filtrée Québec par
l'URL) expose un JSON-LD ItemList avec les URLs propres des fiches ; chaque fiche
.aspx contient prix, revenus, cash flow, localisation et description.

Conformité robots.txt (vérifié) :
  - La recherche PAR CHEMIN (/canadian/search/businesses-for-sale-in-quebec[-N])
    est autorisée. La pagination interdite (?nPageNum=) n'est PAS utilisée :
    on emploie la pagination par chemin (-2, -3, ...) indiquée par rel="next".
  - Les fiches /canadian/<slug>.aspx ne sont pas interdites.

Données : titre, prix demandé, revenus, cash flow, localisation, description.
"""

from __future__ import annotations

import html as H
import re
from typing import Iterator, Optional

from models import Listing
from normalize import normalize_region, normalize_sector
from scrapers.base import BaseScraper

SEARCH = "https://canada.businessesforsale.com/canadian/search/businesses-for-sale-in-quebec"
MAX_PAGES = 12


def _meta(h: str, prop: str) -> str:
    m = re.search(
        r'<meta[^>]*(?:property|name)="' + re.escape(prop) + r'"[^>]*content="([^"]*)"', h
    )
    return H.unescape(m.group(1)) if m else ""


def _money(text: str, label: str) -> Optional[int]:
    m = re.search(label + r"\s*:?\s*\$?\s*([\d,]+)", text)
    if not m:
        return None
    digits = re.sub(r"[^\d]", "", m.group(1))
    return int(digits) if digits else None


class BusinessesForSaleScraper(BaseScraper):
    source_name = "businessesforsale"

    def fetch_listings(self) -> Iterator[Listing]:
        for url in sorted(self._collect_urls()):
            listing = self._parse_fiche(url)
            if listing is not None:
                yield listing

    def _collect_urls(self) -> set[str]:
        """URLs de fiches via le JSON-LD ItemList, pagination par chemin (-N)."""
        urls: set[str] = set()
        for page in range(1, MAX_PAGES + 1):
            page_url = SEARCH if page == 1 else f"{SEARCH}-{page}"
            try:
                h = self.get(page_url).text
            except RuntimeError:
                break
            found = set(re.findall(
                r'"url":\s*"(https://canada\.businessesforsale\.com/canadian/[a-z0-9-]+\.aspx)"', h
            ))
            new = found - urls
            if not new:                      # plus de nouvelles annonces -> fin
                break
            urls |= found
        return urls

    def _parse_fiche(self, url: str) -> Optional[Listing]:
        h = self.get(url).text
        title = _meta(h, "og:title")

        # Page disparue.
        if not title or "Page Not Found" in title:
            return None
        # Annonce non disponible (vendue / sous offre acceptée).
        if re.search(r"\b(SOLD|ACCEPTED OFFER|UNDER CONTRACT)\b", title, re.IGNORECASE):
            return None
        # Nettoyer ("Buy an Established ..." -> "Established ...")
        title = re.sub(r"^\s*Buy an?\s+", "", title, flags=re.IGNORECASE).strip()

        txt = re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]+>", " ", h)))
        description = _meta(h, "og:description")
        price = _money(txt, "Asking Price")

        # L'URL de recherche garantit déjà le Québec ; la région précise (quand
        # elle existe) est déduite du titre + description.
        region = normalize_region(f"{title} {description}")

        return Listing(
            source=self.source_name,
            source_id=url.rstrip("/").rsplit("/", 1)[-1].replace(".aspx", ""),
            source_url=url,
            title=title,
            description=description,
            sector_raw="",
            sector=normalize_sector(title),
            region_raw="quebec",
            region=region,
            city="",
            asking_price=price,
            asking_price_text=(f"{price:,} $".replace(",", " ") if price else "Prix sur demande"),
            revenue=_money(txt, "Sales Revenue"),
            ebitda=_money(txt, "Cash Flow"),
            status="active",
        )
