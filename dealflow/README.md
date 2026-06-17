# GC Deal Flow — Agrégateur d'annonces M&A (usage interne)

Agrège les annonces d'entreprises à vendre publiées sur les plateformes
québécoises, les normalise vers un schéma commun, et exporte un CSV/JSON prêt
à importer dans Supabase. **Usage strictement interne** : aucune republication
des annonces, on redirige toujours vers la source d'origine.

## Statut

| Source | Méthode | État |
|--------|---------|------|
| LaVitrine.biz | API REST WordPress | ✅ Fonctionnel (~37 annonces) |
| EntreprisesAVendre.quebec | à faire (site Nuxt/JS) | ⬜ Planifié |
| Occasionsaffaires.ca | à faire | ⏸️ **À valider juridiquement d'abord** (voir ci-dessous) |
| Acquizition.biz | nécessite Playwright (listings en JS) | ⬜ Phase 2 |

## Installation

```bash
pip install -r requirements.txt
```

## Utilisation

```bash
python main.py                      # toutes les sources activées
python main.py --source lavitrine   # une source précise
python main.py --out ./data         # dossier de sortie (défaut: ./data)
```

Sortie : `data/dealflow_AAAA-MM-JJ.csv` et `.json`.

## Mettre sur Lovable (Supabase + interface)

Le scraper Python alimente Supabase ; Lovable construit l'interface qui lit
Supabase. Lovable ne fait PAS tourner le scraper.

```
Scraper Python ──upsert──► Supabase (BD + Auth) ◄──lit/écrit── Lovable (interface)
```

1. Créer le projet Supabase et exécuter `supabase_schema.sql` (4 tables + RLS).
2. Pousser les annonces : `python upload_supabase.py` (voir variables d'env dans
   l'en-tête du fichier).
3. Connecter Lovable à Supabase, puis coller le prompt de `LOVABLE_BRIEF.md`.

👉 Étapes détaillées et prompt prêt à coller : **`LOVABLE_BRIEF.md`**.

## Architecture

```
models.py            Modèle de données unifié (Listing) + hash de dédup
normalize.py         Mapping secteurs / régions -> vocabulaire canonique
dedupe.py            Détection conservatrice de doublons (ne supprime rien)
export.py            Export CSV / JSON
main.py              Orchestrateur + statistiques (export fichiers)
upload_supabase.py   Pousse les annonces dans Supabase (upsert)
scrapers/
  base.py            Comportement éthique commun (délais, User-Agent, retries)
  lavitrine.py       Scraper LaVitrine (API REST)
supabase_schema.sql  Les 4 tables Supabase + RLS (outil interne)
LOVABLE_BRIEF.md     Guide de mise en place + prompt à coller dans Lovable
```

**Ajouter une source** : créer `scrapers/<source>.py` (hériter de `BaseScraper`,
implémenter `fetch_listings()`), puis l'enregistrer dans `SCRAPERS` (main.py).
Étendre au besoin les maps de `normalize.py` avec les libellés bruts de la source.

## Choix de conception notables

- **API plutôt que HTML.** LaVitrine expose ses annonces via l'API REST
  WordPress. C'est insensible aux changements de thème et bien plus stable que
  parser du HTML. À privilégier pour chaque nouvelle source quand c'est possible.
- **Déduplication conservatrice.** Les sources publiques cachent presque
  toujours les données financières. Il ne reste que secteur + région + ville,
  trop grossier pour fusionner sans risque (deux entreprises distinctes du même
  secteur/ville collisionnent). On ne fusionne donc **jamais** automatiquement :
  on signale les doublons potentiels cross-source pour révision humaine.
- **Comportement éthique par défaut.** User-Agent honnête et identifiable,
  délai entre requêtes, lecture seule, retries avec backoff.

## ⚠️ Conformité

`robots.txt` vérifié pour chaque source avant intégration :

- **LaVitrine** : `User-agent: *` autorise tout sauf `/wp-admin/`. ✅
- **EntreprisesAVendre.quebec** : `Disallow:` vide (tout autorisé). ✅
- **Acquizition** : `Allow: /`. ✅ (mais listings rendus en JS → Playwright)
- **Occasionsaffaires** : la règle `*` autorise `/`, **mais** le site bloque
  nommément les robots d'IA (ClaudeBot, GPTBot, CCBot) et pose
  `Content-Signal: ai-train=no` avec réservation de droits. 🟡 **Zone grise —
  à faire valider par un avocat M&A / techno-droit avant intégration.**

Principes appliqués : données publiques uniquement, usage interne, aucune
republication, redirection vers la source. Recommandé : 2h de validation
juridique (Loi 25 + scraping) avant d'élargir au-delà des sources clairement
autorisées.

Avant la mise en production : remplacer l'email de contact dans
`scrapers/base.py` (`USER_AGENT`) par une adresse réelle et surveillée.
