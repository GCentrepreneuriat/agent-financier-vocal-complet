"""
Normalisation des secteurs et régions.

C'est ~60% de la valeur d'un agrégateur multi-sources : chaque site nomme les
choses différemment ("Manufacturier" vs "Fabrication" vs "Production"). On
mappe tout vers un vocabulaire commun pour que le matching fonctionne.

Pour ajouter une source : étendre les dictionnaires _SECTOR_MAP / _REGION_MAP
avec les libellés bruts de cette source.
"""

from __future__ import annotations

import unicodedata


def _key(value: str) -> str:
    """Normalise une chaîne pour la recherche dans les maps (sans accents, minuscule)."""
    if not value:
        return ""
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return value.lower().strip()


# Secteurs canoniques de la plateforme.
SECTORS = [
    "manufacturier",
    "construction",
    "services-professionnels",
    "commerce-detail",
    "commerce-gros",
    "distribution",
    "transport",
    "restauration",
    "technologie",
    "sante",
    "agroalimentaire",
    "automobile",
    "immobilier",
    "autre",
]

# Libellé brut (normalisé sans accents) -> secteur canonique.
_SECTOR_MAP = {
    "manufacturier": "manufacturier",
    "fabrication": "manufacturier",
    "production": "manufacturier",
    "manufacturing": "manufacturier",
    "industriel": "manufacturier",
    "construction": "construction",
    "batiment": "construction",
    "renovation": "construction",
    "services": "services-professionnels",
    "services professionnels": "services-professionnels",
    "service": "services-professionnels",
    "professional services": "services-professionnels",
    "commerce de detail": "commerce-detail",
    "detail": "commerce-detail",
    "vente au detail": "commerce-detail",
    "retail": "commerce-detail",
    "commerce de gros": "commerce-gros",
    "gros": "commerce-gros",
    "wholesale": "commerce-gros",
    "distribution": "distribution",
    "grossiste": "distribution",
    "transport": "transport",
    "transport et logistique": "transport",
    "logistique": "transport",
    "restauration": "restauration",
    "restaurant": "restauration",
    "alimentation": "restauration",
    "cafe": "restauration",
    "bar": "restauration",
    "bistro": "restauration",
    "boulangerie": "restauration",
    "patisserie": "restauration",
    "traiteur": "restauration",
    "epicerie": "commerce-detail",
    "depanneur": "commerce-detail",
    "boutique": "commerce-detail",
    "bijouterie": "commerce-detail",
    "magasin": "commerce-detail",
    "vetements": "commerce-detail",
    "chaussures": "commerce-detail",
    "franchise": "commerce-detail",
    "garage": "automobile",
    "mecanique": "automobile",
    "carrosserie": "automobile",
    "agence web": "technologie",
    "commerce en ligne": "technologie",
    "informatique": "technologie",
    "esthetique": "services-professionnels",
    "beaute": "services-professionnels",
    "salon": "services-professionnels",
    "coiffure": "services-professionnels",
    "hebergement": "services-professionnels",
    "pourvoirie": "services-professionnels",
    "camping": "services-professionnels",
    "residence": "sante",
    "clinique": "sante",
    "technologie": "technologie",
    "techno": "technologie",
    "ti": "technologie",
    "saas": "technologie",
    "logiciel": "technologie",
    "sante": "sante",
    "soins de sante": "sante",
    "medical": "sante",
    "agroalimentaire": "agroalimentaire",
    "agriculture": "agroalimentaire",
    "ferme": "agroalimentaire",
    "automobile": "automobile",
    "garage": "automobile",
    "auto": "automobile",
    "immobilier": "immobilier",
    "real estate": "immobilier",
}

# Régions administratives du Québec (canoniques).
_REGION_MAP = {
    "bas-saint-laurent": "bas-saint-laurent",
    "saguenay-lac-saint-jean": "saguenay-lac-saint-jean",
    "saguenay-lac-st-jean": "saguenay-lac-saint-jean",
    "saguenay": "saguenay-lac-saint-jean",
    "capitale-nationale": "capitale-nationale",
    "quebec": "capitale-nationale",
    "mauricie": "mauricie",
    "estrie": "estrie",
    "sherbrooke": "estrie",
    "montreal": "montreal",
    "outaouais": "outaouais",
    "gatineau": "outaouais",
    "abitibi-temiscamingue": "abitibi-temiscamingue",
    "cote-nord": "cote-nord",
    "nord-du-quebec": "nord-du-quebec",
    "gaspesie-iles-de-la-madeleine": "gaspesie-iles-de-la-madeleine",
    "gaspesie": "gaspesie-iles-de-la-madeleine",
    "chaudiere-appalaches": "chaudiere-appalaches",
    "levis": "chaudiere-appalaches",
    "laval": "laval",
    "lanaudiere": "lanaudiere",
    "laurentides": "laurentides",
    "monteregie": "monteregie",
    "centre-du-quebec": "centre-du-quebec",
    "drummondville": "centre-du-quebec",
}


def normalize_sector(raw: str) -> str:
    """Retourne le secteur canonique, ou 'autre' si inconnu."""
    k = _key(raw)
    if not k:
        return ""
    if k in _SECTOR_MAP:
        return _SECTOR_MAP[k]
    # correspondance partielle : on teste les mots-clés du plus long au plus
    # court pour que le terme le plus spécifique l'emporte (ex: 'epicerie'
    # plutôt que 'service' dans "épicerie avec station service").
    for needle in sorted(_SECTOR_MAP, key=len, reverse=True):
        if needle in k:
            return _SECTOR_MAP[needle]
    return "autre"


def normalize_region(raw: str) -> str:
    """Retourne la région administrative canonique, ou '' si inconnue."""
    k = _key(raw)
    if not k:
        return ""
    if k in _REGION_MAP:
        return _REGION_MAP[k]
    for needle, canonical in _REGION_MAP.items():
        if needle in k:
            return canonical
    return ""
