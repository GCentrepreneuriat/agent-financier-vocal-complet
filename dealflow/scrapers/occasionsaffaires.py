"""
Scraper Occasionsaffaires.ca

Méthode : pages publiques (WordPress, thème PointFinder). La liste est paginée
(/page/N/) ; chaque carte fournit titre, lien de fiche (/annonce/<slug>/),
région et ville. La description vient de la fiche (meta og:description).

Conformité robots.txt : la règle générale (User-agent: *) autorise l'accès
(Allow: /). Le site exprime toutefois des réserves vis-à-vis des robots d'IA
et de l'usage pour entraînement — ce n'est PAS notre cas (agrégation interne,
redirection vers la source, aucune republication, aucun entraînement). Usage
validé par le client. Délais respectueux, empreinte minimale.

Particularité : les PRIX sont masqués publiquement (pf-price en visibility:
hidden) -> non récupérables. On collecte titre, région, ville, description.
"""

from __future__ import annotations

import html as htmlmod
import re
from typing import Iterator, Optional

from models import Listing
from normalize import normalize_region, normalize_sector
from scrapers.base import BaseScraper

LIST_URL = "https://occasionsaffaires.ca/annonces/entreprises-a-vendre"

_CARD_TITLE = re.compile(
    r'pflist-itemtitle"[^>]*>\s*<a[^>]*href="([^"]*?/annonce/[^"]+/)"[^>]*>(.*?)</a>',
    re.S,
)
_CARD_LOC = re.compile(
    r'/region/region-([a-z-]+)/(?:ville-([a-z0-9-]+)/)?"[^>]*>(.*?)</a>', re.S
)


def _clean(x: str) -> str:
    return re.sub(r"\s+", " ", htmlmod.unescape(re.sub(r"<[^>]+>", " ", x or ""))).strip()


def _meta(h: str, prop: str) -> str:
    m = re.search(
        r'<meta[^>]*(?:property|name)="' + re.escape(prop) + r'"[^>]*content="([^"]*)"',
        h,
    )
    return htmlmod.unescape(m.group(1)) if m else ""


class OccasionsAffairesScraper(BaseScraper):
    source_name = "occasionsaffaires"

    def fetch_listings(self) -> Iterator[Listing]:
        for card in self._collect_cards():
            listing = self._parse_fiche(card)
            if listing is not None:
                yield listing

    def _collect_cards(self) -> list[dict]:
        """Parcourt les pages et extrait (url, titre, région, ville) par carte."""
        cards: dict[str, dict] = {}   # clé = url (dédupe les annonces "vedettes")
        first = self.get(LIST_URL + "/").text
        pages = {int(x) for x in re.findall(r"/entreprises-a-vendre/page/(\d+)/", first)}
        max_page = max(pages) if pages else 1

        def parse(h: str) -> None:
            for block in re.split(r"wpfitemlistdata isotope-item", h)[1:]:
                tm = _CARD_TITLE.search(block)
                if not tm:
                    continue
                url, title = tm.group(1), _clean(tm.group(2))
                lm = _CARD_LOC.search(block)
                region_raw = lm.group(1) if lm else ""
                city = _clean(lm.group(3)) if lm else ""
                cards.setdefault(url, {
                    "url": url, "title": title,
                    "region_raw": region_raw, "city": city,
                })

        parse(first)
        for p in range(2, max_page + 1):
            parse(self.get(f"{LIST_URL}/page/{p}/").text)
        return list(cards.values())

    def _parse_fiche(self, card: dict) -> Optional[Listing]:
        h = self.get(card["url"]).text

        # Annonce vendue/retirée ?
        if re.search(r"\bvendue?\b\s*,?\s*!?\s*merci", h, re.IGNORECASE):
            return None

        description = _meta(h, "og:description")
        slug = card["url"].rstrip("/").rsplit("/", 1)[-1]
        region_raw = card["region_raw"]

        return Listing(
            source=self.source_name,
            source_id=slug,
            source_url=card["url"],
            title=card["title"],
            description=description,
            sector_raw="",
            sector=normalize_sector(card["title"]),
            region_raw=region_raw,
            region=normalize_region(region_raw),
            city=card["city"],
            asking_price=None,                 # prix masqué par le site
            asking_price_text="Prix sur demande",
            revenue=None,
            ebitda=None,
            status="active",
        )
