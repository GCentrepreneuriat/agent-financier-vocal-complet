"""
Modèle de données unifié pour les annonces d'entreprises à vendre.

Toutes les sources (LaVitrine, EntreprisesAVendre, etc.) sont normalisées
vers cette structure commune. C'est ce schéma qui sera importé dans Supabase
et utilisé par le moteur de matching.
"""

from __future__ import annotations

import hashlib
import re
import unicodedata
from dataclasses import dataclass, field, asdict
from datetime import date, datetime
from typing import Optional


def _slugify(value: str) -> str:
    """Minuscule, sans accents, alphanumérique — pour les clés de déduplication."""
    if not value:
        return ""
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value


@dataclass
class Listing:
    """Une annonce d'entreprise à vendre, normalisée."""

    # --- Provenance ---
    source: str                          # ex: "lavitrine"
    source_id: str                       # identifiant unique chez la source
    source_url: str                      # lien vers l'annonce d'origine

    # --- Contenu ---
    title: str
    description: str = ""

    # --- Classification (valeurs brutes + normalisées) ---
    sector_raw: str = ""                 # ce que la source affiche
    sector: str = ""                     # secteur normalisé (voir normalize.py)
    region_raw: str = ""
    region: str = ""                     # région administrative normalisée
    city: str = ""

    # --- Données financières (souvent partielles / cachées derrière login) ---
    asking_price: Optional[int] = None   # prix demandé en $CAD
    revenue: Optional[int] = None        # chiffre d'affaires
    ebitda: Optional[int] = None         # BAIIA

    # --- Suivi temporel ---
    date_listed: Optional[str] = None    # date de mise en ligne (ISO)
    date_scraped: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    last_seen: str = field(default_factory=lambda: date.today().isoformat())
    status: str = "active"               # active | expired

    # --- Déduplication ---
    dedup_hash: str = ""

    def compute_dedup_hash(self) -> str:
        """
        Hash stable pour détecter la même entreprise listée sur plusieurs sites.

        On se base sur des attributs intrinsèques (secteur + région + ville +
        tranche de revenus) plutôt que sur le titre, car le titre varie d'un
        site à l'autre pour la même entreprise.
        """
        revenue_bucket = ""
        if self.revenue:
            # tranche par paliers de 250k$ pour absorber les petites variations
            revenue_bucket = str(self.revenue // 250_000)

        key = "|".join([
            _slugify(self.sector or self.sector_raw),
            _slugify(self.region or self.region_raw),
            _slugify(self.city),
            revenue_bucket,
        ])
        return hashlib.sha1(key.encode()).hexdigest()[:16]

    def finalize(self) -> "Listing":
        """À appeler une fois tous les champs remplis."""
        self.dedup_hash = self.compute_dedup_hash()
        return self

    def to_dict(self) -> dict:
        return asdict(self)
