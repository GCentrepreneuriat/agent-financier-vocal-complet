"""
Scraper MonEntrepriseAVendre.com

Méthode : HTML (site Joomla/YOOtheme, rendu serveur). La liste est paginée
(/commerces-et-entreprises-a-vendre/N.html) ; chaque annonce a une fiche
individuelle sous /item/ contenant des champs structurés.

Conformité robots.txt (vérifié) :
  User-agent: *  ->  seuls les dossiers système (administrator, modules, ...)
  sont interdits. Les pages publiques de listings sont autorisées.

Données disponibles : titre, prix de vente, région, ville, chiffre d'affaires
(par tranche), raison de vente, description complète.
"""

from __future__ import annotations

import html
import re
from typing import Iterator, Optional

from models import Listing
from normalize import normalize_region, normalize_sector
from scrapers.base import BaseScraper

BASE = "https://monentrepriseavendre.com/commerces-et-entreprises-a-vendre"

# Libellés de champs et titres de sections : servent de frontières d'extraction.
FIELD_LABELS = [
    "Prix de vente", "Chiffre d'affaires", "Année d'ouverture", "Rénovation",
    "Raison de la vente", "Superficie total bâtiment", "Superficie total terrain",
    "Région", "Ville", "Pays",
]
SECTION_HEADERS = [
    "Caractéristiques", "Voisinages", "Description", "Équipement", "Inventaire",
    "Implication", "Contact",
]
# Blocs de la barre latérale (suggestions d'annonces) à ne jamais inclure.
SIDEBAR_JUNK = [
    "Commandité par", "Suggestion d'annonces", "Entreprises vedettes",
    "Annonces similaires",
]
_BOUNDARIES = FIELD_LABELS + SECTION_HEADERS + SIDEBAR_JUNK


def _flatten(fragment: str) -> str:
    txt = html.unescape(re.sub(r"<[^>]+>", " ", fragment or ""))
    return re.sub(r"\s+", " ", txt).strip()


def _field(text: str, label: str) -> str:
    """Valeur d'un champ 'Label : valeur', coupée au prochain label/section."""
    others = "|".join(re.escape(b) for b in _BOUNDARIES if b != label)
    m = re.search(re.escape(label) + r"\s*:\s*(.*?)\s*(?:" + others + r")\s*:?", text)
    return m.group(1).strip() if m else ""


def _section(text: str, header: str) -> str:
    """Texte d'une section (entre son titre et la prochaine frontière)."""
    others = "|".join(re.escape(b) for b in _BOUNDARIES if b != header)
    m = re.search(re.escape(header) + r"\s+(.*?)\s*(?:" + others + r")\b", text)
    return m.group(1).strip() if m else ""


def _first_money(text: str) -> Optional[int]:
    """Premier montant d'un texte : '260 000$+ INV(100 000$)' -> 260000."""
    m = re.search(r"\d[\d\s.,]*", text or "")
    if not m:
        return None
    digits = re.sub(r"[^\d]", "", m.group(0))
    return int(digits) if digits else None


class MonEntrepriseAVendreScraper(BaseScraper):
    source_name = "monentrepriseavendre"

    def fetch_listings(self) -> Iterator[Listing]:
        item_urls = self._collect_item_urls()
        for url in sorted(item_urls):
            listing = self._parse_fiche(url)
            if listing is not None:
                yield listing

    def _collect_item_urls(self) -> set[str]:
        """Parcourt les pages paginées et récupère toutes les URLs de fiches."""
        first = self.get(BASE + ".html").text
        # Les liens de pagination sont relatifs : /commerces-...-a-vendre/N.html
        pages = {int(x) for x in re.findall(r"/commerces-et-entreprises-a-vendre/(\d+)\.html", first)}
        max_page = max(pages) if pages else 1

        def items(h: str) -> set[str]:
            return set(re.findall(r'href="(/commerces-et-entreprises-a-vendre/item/[^"]+\.html)"', h))

        urls = items(first)
        for p in range(2, max_page + 1):
            urls |= items(self.get(f"{BASE}/{p}.html").text)
        return urls

    def _parse_fiche(self, path: str) -> Optional[Listing]:
        url = "https://monentrepriseavendre.com" + path
        h = self.get(url).text

        h1 = re.search(r"<h1[^>]*>(.*?)</h1>", h, re.S)
        title = _flatten(h1.group(1)) if h1 else ""
        # REF# = identifiant stable de la source
        ref = re.search(r"REF#?\s*(\d+)", title) or re.search(r"REF#?\s*(\d+)", h)
        source_id = ref.group(1) if ref else path.rsplit("/", 1)[-1].replace(".html", "")
        title = re.sub(r"\s*REF#?\s*\d+\s*$", "", title).strip(" -–|·").strip()

        # Annonce vendue ?
        if re.search(r"\bvendue?\b\s*,?\s*!?\s*merci", h, re.IGNORECASE) or \
           re.search(r">\s*VENDU\b", h):
            return None

        # Zone de contenu principale (pour limiter le bruit de la navigation)
        art = re.search(r"<article.*?</article>", h, re.S)
        text = _flatten(art.group(0) if art else h)

        region_raw = _field(text, "Région")
        city = _field(text, "Ville")
        price_text = _field(text, "Prix de vente")
        ca_text = _field(text, "Chiffre d'affaires")
        raison = _field(text, "Raison de la vente")
        description = _section(text, "Description") or _section(text, "Caractéristiques")
        if raison:
            description = (description + f" — Raison de la vente : {raison}").strip(" —")

        price_num = _first_money(price_text)
        if price_num and not re.search(r"[A-Za-z]", price_text):
            # prix purement numérique -> affichage uniforme "260 000 $"
            price_display = f"{price_num:,} $".replace(",", " ")
        else:
            # prix avec mention ("+ inventaire", "À discuter") -> texte d'origine
            price_display = price_text.strip()

        sector = normalize_sector(title)

        return Listing(
            source=self.source_name,
            source_id=str(source_id),
            source_url=url,
            title=title,
            description=description,
            sector_raw="",
            sector=sector,
            region_raw=region_raw,
            region=normalize_region(region_raw or city),
            city=city,
            asking_price=price_num,
            asking_price_text=price_display,
            revenue=None,            # le CA n'est donné que par tranche ("+ de 1M $")
            ebitda=None,
            status="active",
        )
