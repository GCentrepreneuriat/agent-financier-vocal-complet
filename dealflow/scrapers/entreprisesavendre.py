"""
Scraper EntreprisesAVendre.quebec

Méthode : pages publiques (site Nuxt). La liste est paginée (?page=N) ; chaque
fiche /entreprises/<slug> expose ses données dans les meta Open Graph et dans le
payload __NUXT_DATA__ (rendu serveur).

Conformité robots.txt (vérifié) : Disallow vide -> tout est autorisé.

Stratégie d'extraction par fiche :
  - titre + prix : meta og:title  ("Titre - 225 000 $ - Entreprise à Vendre")
  - prix : champ "Prix demandé" (repli sur og:title)
  - région : lien /entreprises/regions/<slug>
  - description complète : on prend le début de og:description comme ancre et on
    retrouve la chaîne complète correspondante dans __NUXT_DATA__ (le payload
    contient aussi les annonces "similaires", d'où l'ancrage pour isoler la bonne).
"""

from __future__ import annotations

import html as htmlmod
import re
from typing import Iterator, Optional

from models import Listing
from normalize import normalize_region, normalize_sector
from scrapers.base import BaseScraper

ORIGIN = "https://entreprisesavendre.quebec"
LIST_URL = ORIGIN + "/entreprises"
# Segments de /entreprises/<x> qui ne sont PAS des fiches (navigation/filtres).
NON_LISTING = {"regions", "categories", "secteurs", "page"}


def _meta(h: str, prop: str) -> str:
    m = re.search(
        r'<meta[^>]*(?:property|name)="' + re.escape(prop) + r'"[^>]*content="([^"]*)"',
        h,
    )
    return htmlmod.unescape(m.group(1)) if m else ""


def _money(text: str) -> Optional[int]:
    digits = re.sub(r"[^\d]", "", text or "")
    return int(digits) if digits else None


class EntreprisesAVendreScraper(BaseScraper):
    source_name = "entreprisesavendre"

    def fetch_listings(self) -> Iterator[Listing]:
        for slug in sorted(self._collect_slugs()):
            listing = self._parse_fiche(slug)
            if listing is not None:
                yield listing

    def _collect_slugs(self) -> set[str]:
        """Parcourt les pages ?page=N et récupère les slugs de fiches."""
        slugs: set[str] = set()
        previous: Optional[set[str]] = None
        for page in range(1, 60):
            h = self.get(f"{LIST_URL}?page={page}").text
            found = {
                s for s in re.findall(r"/entreprises/([a-z0-9-]{6,})", h)
                if s not in NON_LISTING
            }
            # Fin : page sans fiche, ou strictement identique à la précédente.
            if not found or found == previous:
                break
            slugs |= found
            previous = found
        return slugs

    def _parse_fiche(self, slug: str) -> Optional[Listing]:
        url = f"{ORIGIN}/entreprises/{slug}"
        h = self.get(url).text

        og_title = _meta(h, "og:title")
        # "Titre - 225 000 $ - Entreprise à Vendre"
        title = re.sub(r"\s*-\s*Entreprise à Vendre\s*$", "", og_title)
        title = re.sub(r"\s*-\s*[\d\s .,]+\$\s*$", "", title).strip()

        # Prix : champ "Prix demandé", repli sur le montant du og:title.
        m = re.search(r"Prix demandé.*?([\d][\d\s .,]*\$)", h, re.S)
        price_raw = m.group(1) if m else ""
        if not price_raw:
            m2 = re.search(r"-\s*([\d][\d\s .,]*\$)\s*-\s*Entreprise à Vendre", og_title)
            price_raw = m2.group(1) if m2 else ""
        price_num = _money(price_raw)
        price_display = f"{price_num:,} $".replace(",", " ") if price_num else (price_raw.strip() or "Prix sur demande")

        # Région via le lien /entreprises/regions/<slug> (slug = clé directe)
        rgn = re.search(r"/entreprises/regions/([a-z0-9-]+)", h)
        region_raw = rgn.group(1) if rgn else ""

        description = self._full_description(h)

        sector = normalize_sector(title)

        return Listing(
            source=self.source_name,
            source_id=slug,
            source_url=url,
            title=title,
            description=description,
            sector_raw="",
            sector=sector,
            region_raw=region_raw,
            region=normalize_region(region_raw),
            city="",
            asking_price=price_num,
            asking_price_text=price_display,
            revenue=None,
            ebitda=None,
            status="active",
        )

    def _full_description(self, h: str) -> str:
        """Description complète : ancre sur og:description, retrouve la chaîne
        complète dans __NUXT_DATA__ (sinon repli sur og:description)."""
        ogd = _meta(h, "og:description")
        nd = re.search(r'id="__NUXT_DATA__"[^>]*>(.*?)</script>', h, re.S)
        if ogd and nd:
            anchor = ogd.strip()[:30]
            for raw in re.findall(r'"((?:[^"\\]|\\.){120,})"', nd.group(1)):
                s = htmlmod.unescape(raw).replace("\\n", "\n").replace('\\"', '"').strip()
                if s.startswith(anchor):
                    return re.sub(r"\s*\n\s*", " ", s).strip()
        return ogd
