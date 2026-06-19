"""
Scraper Sunbeltcanada.com — annonces du QUÉBEC uniquement.

Méthode : WordPress (type de contenu `posting`), pages rendues serveur. Le site
est organisé par bureaux régionaux (sous-sites). On cible les bureaux du Québec
et on confirme la province via le champ "Location" de chaque fiche.

Conformité robots.txt (vérifié) : aucune restriction (pas de Disallow, pas de
blocage de bots).

Données : titre, prix demandé, revenus, EBITDA, localisation (province/ville),
description. Les annonces vendues sont marquées "SOLD" dans le titre -> exclues.
"""

from __future__ import annotations

import html as H
import re
from typing import Iterator, Optional

from models import Listing
from normalize import normalize_region, normalize_sector
from scrapers.base import BaseScraper

ORIGIN = "https://www.sunbeltcanada.com"
# Bureaux du Québec (sous-sites WordPress). Les bureaux vides sont sans effet.
QC_OFFICES = [
    "montreal-central", "laval", "gatineau", "monteregie",
    "dorval", "laurentians-laurentides", "gaspe",
]

_FIELD_END = (
    r"Year Established|Business Details|Inventory|Down payment|EBITDA|Gross|"
    r"Reason|Employees|Real Estate|Financing|Support|Occupancy|Listing|Asking"
)


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


class SunbeltScraper(BaseScraper):
    source_name = "sunbelt"

    def fetch_listings(self) -> Iterator[Listing]:
        for url in sorted(self._collect_urls()):
            listing = self._parse(url)
            if listing is not None:
                yield listing

    def _collect_urls(self) -> set[str]:
        """URLs de fiches des bureaux QC (version anglaise pour éviter les
        doublons en/fr ; le contenu est le même)."""
        urls: set[str] = set()
        for office in QC_OFFICES:
            try:
                sm = self.get(f"{ORIGIN}/{office}/posting-sitemap.xml").text
            except RuntimeError:
                continue
            for loc in re.findall(r"<loc>([^<]+/posting/[^<]+)</loc>", sm):
                if "/fr/posting/" not in loc:        # garder une seule langue
                    urls.add(loc)
        return urls

    def _parse(self, url: str) -> Optional[Listing]:
        h = self.get(url).text
        title = _meta(h, "og:title")

        # Exclure les annonces non disponibles (vendues / sous offre acceptée).
        if re.search(r"\b(SOLD|ACCEPTED OFFER|UNDER CONTRACT|CONDITIONALLY SOLD)\b",
                     title, re.IGNORECASE):
            return None

        # Nettoyer le titre ("... - Sunbelt Canada Montreal Centre")
        title = re.sub(r"\s*-\s*Sunbelt Canada.*$", "", title, flags=re.IGNORECASE).strip()

        txt = re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]+>", " ", h)))

        # Localisation : "Quebec, Montreal, Montreal"
        province, city = "", ""
        lm = re.search(r"Location\s*:?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ,.'-]{2,60}?)\s*(?:" + _FIELD_END + ")", txt)
        if lm:
            parts = [p.strip() for p in lm.group(1).split(",") if p.strip()]
            province = parts[0] if parts else ""
            city = parts[1] if len(parts) > 1 else ""

        # Filtre QUÉBEC : exclure si la province est explicitement hors Québec.
        if province and not re.match(r"qu[eé]bec", province, re.IGNORECASE):
            return None

        description = _meta(h, "og:description")
        slug = url.rstrip("/").rsplit("/", 1)[-1]
        office = re.search(r"sunbeltcanada\.com/([a-z-]+)/", url)
        source_id = f"{office.group(1)}-{slug}" if office else slug

        return Listing(
            source=self.source_name,
            source_id=source_id,
            source_url=url,
            title=title,
            description=description,
            sector_raw="",
            sector=normalize_sector(title),
            region_raw=province,
            region=normalize_region(city or province),
            city=city,
            asking_price=_money(txt, "Asking Price"),
            asking_price_text=(
                f"{_money(txt, 'Asking Price'):,} $".replace(",", " ")
                if _money(txt, "Asking Price") else "Prix sur demande"
            ),
            revenue=_money(txt, "Revenue"),
            ebitda=_money(txt, "EBITDA"),
            status="active",
        )
