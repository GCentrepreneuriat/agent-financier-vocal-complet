"""
Détection de doublons inter-sources — approche CONSERVATRICE.

Contexte : les sites publics cachent presque toujours les données financières
(prix, revenus, BAIIA). Il ne reste donc que secteur + région + ville pour
rapprocher deux annonces. C'est insuffisant pour fusionner sans risque : deux
entreprises distinctes du même secteur dans la même ville auraient la même
empreinte et l'une serait perdue.

Règles appliquées :
  1. On ne FUSIONNE JAMAIS automatiquement. Chaque annonce est conservée.
     Une source attribue un ID unique par entreprise : deux annonces d'une même
     source sont donc forcément deux entreprises différentes.
  2. On SIGNALE les doublons potentiels entre sources DIFFÉRENTES qui partagent
     la même empreinte ET un titre suffisamment similaire. Ces cas sont marqués
     pour révision humaine (champ `potential_duplicate_of`), pas écrasés.

Quand les données financières seront disponibles (saisie privée, ou sources
qui les exposent), l'empreinte deviendra fiable et une vraie fusion pourra
être envisagée.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field

from models import Listing

# Mots vides à ignorer dans la comparaison de titres.
_STOP = {
    "a", "vendre", "de", "des", "du", "la", "le", "les", "et", "en", "un",
    "une", "pour", "dans", "sur", "avec", "qc", "quebec",
}


def _title_tokens(title: str) -> set[str]:
    title = unicodedata.normalize("NFKD", title or "").encode("ascii", "ignore").decode()
    words = re.findall(r"[a-z0-9]+", title.lower())
    return {w for w in words if w not in _STOP and len(w) > 2}


def _title_similarity(a: str, b: str) -> float:
    """Jaccard sur les tokens de titre, entre 0 et 1."""
    ta, tb = _title_tokens(a), _title_tokens(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


# Seuil de similarité de titre au-delà duquel deux annonces cross-source sont
# considérées comme un doublon potentiel.
TITLE_SIMILARITY_THRESHOLD = 0.5


@dataclass
class ReviewedListing:
    """Une annonce conservée telle quelle, enrichie d'éventuels doublons à valider."""
    listing: Listing
    # source_url des annonces d'AUTRES sources susceptibles d'être la même entreprise
    potential_duplicate_of: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        d = self.listing.to_dict()
        d["potential_duplicate_of"] = self.potential_duplicate_of
        return d


def find_duplicates(listings: list[Listing]) -> list[ReviewedListing]:
    """
    Conserve toutes les annonces et signale les doublons potentiels cross-source.
    Aucune donnée n'est supprimée.
    """
    reviewed = [ReviewedListing(listing=l) for l in listings]

    # Regrouper par empreinte grossière pour limiter les comparaisons.
    by_hash: dict[str, list[ReviewedListing]] = {}
    for r in reviewed:
        by_hash.setdefault(r.listing.dedup_hash, []).append(r)

    for group in by_hash.values():
        if len(group) < 2:
            continue
        for i, a in enumerate(group):
            for b in group[i + 1:]:
                # Jamais entre deux annonces de la même source.
                if a.listing.source == b.listing.source:
                    continue
                if _title_similarity(a.listing.title, b.listing.title) >= TITLE_SIMILARITY_THRESHOLD:
                    a.potential_duplicate_of.append(b.listing.source_url)
                    b.potential_duplicate_of.append(a.listing.source_url)

    return reviewed
