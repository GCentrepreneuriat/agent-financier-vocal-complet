# Étapes Lovable — pas à pas

⚠ **Ne commence PAS à faire construire des pages dans Lovable avant l'étape 3.**
Lovable doit d'abord être branché à Supabase, sinon il invente des données.

---

## PHASE 0 — Supabase (≈ 5 min, à faire AVANT Lovable)

Lovable ne peut pas créer la base de données correctement lui-même. On la
prépare dans Supabase d'abord.

1. Va sur [supabase.com](https://supabase.com) → **New project**. Choisis un nom
   (ex: « gc-dealflow »), un mot de passe, région **Canada (Central)**.
2. Menu gauche → **SQL Editor** → **New query**.
3. Ouvre le fichier `supabase_schema.sql`, copie TOUT, colle dans l'éditeur,
   clique **Run**. → ça crée les 4 tables.
4. Menu gauche → **Authentication** → **Users** → **Add user** → mets ton
   courriel + un mot de passe. (C'est ton identifiant pour te connecter à l'outil.)
5. Menu gauche → **Project Settings** → **API** → garde cet onglet ouvert,
   tu auras besoin de **Project URL** et **anon public key**.

*(Le chargement des annonces scrapées via Python peut se faire après — l'interface
fonctionne même avec une table vide au début.)*

---

## PHASE 1 — Brancher Lovable à Supabase

Dans ton projet Lovable :

1. En haut à droite, clique le bouton **Supabase** (ou tape dans le chat :
   « Connect this project to Supabase »).
2. Autorise la connexion, puis **sélectionne le projet** « gc-dealflow » créé en
   Phase 0.
3. Attends que Lovable confirme « connected ». À partir de là, Lovable voit tes
   4 tables.

---

## PHASE 2 — Activer la connexion (login)

Dans le chat Lovable, colle :

```
Ajoute l'authentification Supabase à cette application. Toutes les pages doivent
exiger une connexion (courriel + mot de passe). Pas d'inscription publique : les
comptes sont créés manuellement dans Supabase. Crée une page de connexion propre
en français. Redirige vers le tableau de bord après connexion.
```

Teste : tu devrais pouvoir te connecter avec le courriel/mot de passe créés à
l'étape 0.4.

---

## PHASE 3 — Construire les pages (une à la fois)

Colle ces prompts **un par un**, dans l'ordre. Attends que chaque page soit
terminée et testée avant de passer à la suivante.

### Prompt 1 — Annonces du marché (commence par celle-ci)

```
Crée une page « Annonces du marché » qui affiche la table Supabase
listings_publics dans un tableau. Colonnes : title, sector, region, city,
date_listed, source, status. Ajoute une barre de recherche (sur title et
description) et des filtres déroulants pour sector, region et status. Au clic sur
une ligne, ouvre un panneau de détail avec la description complète et un bouton
« Voir l'annonce d'origine » qui ouvre source_url dans un nouvel onglet. Si le
champ potential_duplicate_of n'est pas vide, affiche un badge « doublon possible ».
Cette table est en lecture seule. En français.
```

### Prompt 2 — Acheteurs

```
Crée une page « Acheteurs » reliée à la table profils_acheteurs. Affiche un
tableau (nom, statut, budget_max, secteurs_recherches) et un bouton « Ajouter un
acheteur » qui ouvre un formulaire. Champs du formulaire : nom, courriel,
telephone, secteurs_recherches (multi-sélection), regions_recherchees
(multi-sélection), budget_min, budget_max, revenue_min, revenue_max, ebitda_min,
type_acquisition, financement, horizon, notes, statut (actif/en_pause/transige).
Permets d'éditer et de supprimer une ligne. En français.

Valeurs de secteurs : manufacturier, construction, services-professionnels,
commerce-detail, commerce-gros, distribution, transport, restauration,
technologie, sante, agroalimentaire, automobile, immobilier, autre.

Valeurs de régions : bas-saint-laurent, saguenay-lac-saint-jean,
capitale-nationale, mauricie, estrie, montreal, outaouais, abitibi-temiscamingue,
cote-nord, nord-du-quebec, gaspesie-iles-de-la-madeleine, chaudiere-appalaches,
laval, lanaudiere, laurentides, monteregie, centre-du-quebec.
```

### Prompt 3 — Vendeurs privés

```
Crée une page « Vendeurs privés » reliée à la table listings_prives. Tableau
(nom_entreprise, sector, region, statut) + bouton « Ajouter un vendeur » ouvrant
un formulaire. Champs : nom_entreprise, description, sector, region, city,
revenue, ebitda, asking_price, raison_vente, horizon_vente, financement_vendeur,
transition, contact_nom, contact_courriel, contact_tel, notes, statut
(actif/en_pause/transige/retire). Édition et suppression possibles. Utilise les
mêmes listes de secteurs et régions que la page Acheteurs. En français.
```

### Prompt 4 — Rapprochements (la page la plus importante)

```
Crée une page « Rapprochements ». En haut, une liste déroulante pour choisir un
acheteur (table profils_acheteurs). Une fois choisi, affiche toutes les annonces
des tables listings_publics ET listings_prives qui correspondent à ses critères,
triées par score décroissant.

Règle de correspondance et de score :
- +50 si le sector de l'annonce est dans secteurs_recherches de l'acheteur
  (ignore ce critère si l'acheteur n'a pas précisé de secteurs)
- +30 si la region de l'annonce est dans regions_recherchees
- +20 si l'annonce a un revenue compris entre revenue_min et revenue_max, OU si
  l'annonce n'a pas de revenue (fréquent pour les annonces publiques)
Affiche seulement les annonces avec un score d'au moins 50.

Chaque résultat montre : titre/nom, sector, region, origine (publique ou privée),
score, et un lien vers source_url (si présent). Ajoute un bouton « Enregistrer ce
rapprochement » qui insère une ligne dans la table matches (acheteur_id + l'id de
l'annonce dans listing_public_id ou listing_prive_id selon l'origine + score).
En français.
```

### Prompt 5 — Tableau de bord

```
Crée une page « Tableau de bord » (page d'accueil après connexion). Affiche des
cartes de statistiques : nombre d'annonces dans listings_publics avec
status='active', nombre de listings_prives avec statut='actif', nombre de
profils_acheteurs avec statut='actif'. Ajoute la répartition des annonces
publiques par secteur (liste ou petit graphique) et la liste des 5 derniers
acheteurs ajoutés. En français.
```

---

## En cas de pépin dans Lovable

- **« Aucune donnée »** sur la page Annonces : c'est normal si tu n'as pas encore
  lancé `python upload_supabase.py`. La page est correcte, la table est vide.
- **Lovable invente des fausses données** : c'est qu'il n'est pas vraiment branché
  à Supabase (Phase 1 ratée). Re-vérifie la connexion.
- **Erreur de permissions / « row level security »** : assure-toi d'être connecté
  (Phase 2) — les tables n'autorisent que les utilisateurs authentifiés.
- Pour corriger une page, parle à Lovable en langage normal : « Sur la page
  Acheteurs, ajoute une colonne courriel au tableau. »
