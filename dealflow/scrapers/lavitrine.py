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

import html
import re
from typing import Iterator, Optional

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


def _normalize_content(content: str) -> str:
    """Décode les entités HTML et les guillemets typographiques de WPBakery."""
    c = html.unescape(content or "")
    for ch in ("»", "«", "″", "′", "“", "”"):
        c = c.replace(ch, '"')
    return c


def _parse_pricing(content: str) -> dict[str, str]:
    """Extrait les 'Faits saillants' (Revenus, BAIIA, Prix demandé, ...).

    Sur LaVitrine, ces données sont encodées en shortcodes WPBakery
    [qode_pricing_list_item title="..." price="..."] dans le contenu.
    """
    pricing: dict[str, str] = {}
    for block in re.findall(r"qode_pricing_list_item([^\]]*)\]", content):
        t = re.search(r'title="([^"]*)"', block)
        p = re.search(r'price="([^"]*)"', block)
        if t and p:
            pricing[t.group(1).strip()] = p.group(1).strip()
    return pricing


def _money_to_int(text: str) -> Optional[int]:
    """'660,000$' -> 660000 ; 'À discuter' -> None."""
    digits = re.sub(r"[^\d]", "", text or "")
    return int(digits) if digits else None


def _full_description(content: str) -> str:
    """Texte descriptif complet : retire shortcodes, balises, entête et boilerplate.

    Coupe le texte répété en pied de chaque annonce (section "Comment acheter?",
    avis LaVitrine, formulaire de contact et script JS) qui n'est pas du contenu.
    """
    txt = re.sub(r"\[[^\]]*\]", " ", content)          # shortcodes WPBakery
    txt = re.sub(r"<[^>]+>", " ", txt)                  # balises HTML
    txt = re.sub(r"\s+", " ", txt).strip()
    txt = re.sub(r"^Faits saillants\s*", "", txt, flags=re.IGNORECASE)

    # Tronquer au premier marqueur de boilerplate / formulaire.
    for marker in ("Comment acheter", "(ID #", "LaVitrine.biz ne donne"):
        idx = txt.find(marker)
        if idx != -1:
            txt = txt[:idx].strip()
    return txt


def _pick(pricing: dict[str, str], *keywords: str) -> str:
    """Retourne la valeur dont le libellé contient un des mots-clés."""
    for label, value in pricing.items():
        low = label.lower()
        if any(k in low for k in keywords):
            return value
    return ""


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
        city = _parse_location(meta.get("_job_location", ""))

        # Contenu riche : description complète + faits saillants financiers.
        content = _normalize_content(item.get("content", {}).get("rendered", ""))
        pricing = _parse_pricing(content)
        full_desc = _full_description(content)

        # Détection des annonces VENDUES : tampon "*** entreprise vendue, merci ***".
        # On exige "merci" juste après "vendue" pour éviter les faux positifs
        # ("produits vendus en épiceries", "vendue avec tous les outils", etc.).
        is_sold = bool(re.search(r"vendue?\s*,?\s*!?\s*merci", content, re.IGNORECASE))
        # Repli sur le résumé court si le contenu n'a pas de texte.
        description = full_desc or meta.get("_company_tagline") or ""

        prix_text = _pick(pricing, "prix")              # "Prix demandé"
        revenue_text = _pick(pricing, "revenu", "ventes", "chiffre")
        ebitda_text = _pick(pricing, "baiia", "ebitda", "bnr")

        prix_num = _money_to_int(prix_text)
        # Affichage propre : "660 000 $" si numérique, sinon le texte ("À discuter").
        prix_display = f"{prix_num:,} $".replace(",", " ") if prix_num else prix_text.strip()

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
            asking_price=prix_num,
            asking_price_text=prix_display,
            revenue=_money_to_int(revenue_text),
            ebitda=_money_to_int(ebitda_text),
            date_listed=(item.get("date") or "")[:10] or None,
            status="vendu" if is_sold else "active",
        )
