"""
Scraper de base : comportement éthique commun à toutes les sources.

Principes appliqués partout :
  - User-Agent honnête et identifiable (pas de déguisement)
  - Délai respectueux entre les requêtes (configurable)
  - Respect implicite du robots.txt : chaque scraper concret ne cible que des
    chemins autorisés par la source (documenté dans son module)
  - Lecture seule, usage interne, aucune republication

Chaque source concrète hérite de BaseScraper et implémente fetch_listings().
"""

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from typing import Iterator

import requests

from models import Listing

# User-Agent honnête : on s'identifie clairement plutôt que de se faire passer
# pour un navigateur. Remplacer l'email par un contact réel en production.
USER_AGENT = (
    "GC-Dealflow/1.0 (agrégateur interne de deal flow M&A; "
    "contact: info@gcentrepreneuriat.com)"
)


class BaseScraper(ABC):
    # Identifiant court de la source, ex: "lavitrine". À surcharger.
    source_name: str = ""
    # Délai minimum entre deux requêtes HTTP, en secondes.
    request_delay: float = 1.5

    def __init__(self, delay: float | None = None):
        if delay is not None:
            self.request_delay = delay
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT})
        self._last_request_at = 0.0

    def get(self, url: str, **kwargs) -> requests.Response:
        """GET avec throttling automatique et retries simples."""
        elapsed = time.monotonic() - self._last_request_at
        if elapsed < self.request_delay:
            time.sleep(self.request_delay - elapsed)

        last_exc: Exception | None = None
        for attempt in range(3):
            try:
                resp = self.session.get(url, timeout=30, **kwargs)
                self._last_request_at = time.monotonic()
                resp.raise_for_status()
                # Certains serveurs renvoient 200 + corps vide en cas de
                # surcharge (timeout PHP). On traite ça comme un échec à réessayer.
                if not resp.content:
                    raise requests.RequestException("Réponse vide (corps 0 octet)")
                return resp
            except requests.RequestException as exc:
                last_exc = exc
                time.sleep(2 ** attempt)  # backoff: 1s, 2s, 4s
        raise RuntimeError(f"Échec après 3 tentatives: {url}") from last_exc

    @abstractmethod
    def fetch_listings(self) -> Iterator[Listing]:
        """Génère les annonces normalisées de cette source."""
        raise NotImplementedError

    def run(self) -> list[Listing]:
        """Collecte toutes les annonces et finalise (hash de dédup)."""
        listings: list[Listing] = []
        for listing in self.fetch_listings():
            listings.append(listing.finalize())
        return listings
