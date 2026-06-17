# Mettre le Deal Flow sur Lovable — guide + brief

Ce document contient **(A)** les étapes de mise en place et **(B)** le prompt
prêt à coller dans Lovable.

---

## A. Mise en place (à faire AVANT de prompter Lovable)

### 1. Créer le projet Supabase
1. [supabase.com](https://supabase.com) → New project. Note ton mot de passe BD.
2. SQL Editor → colle tout `supabase_schema.sql` → Run. (Crée les 4 tables + sécurité.)
3. Settings → API → récupère :
   - **Project URL** (`https://xxxx.supabase.co`)
   - **anon public key** → pour Lovable (sans danger, protégée par RLS)
   - **service_role key** → pour le script Python UNIQUEMENT. ⚠ SECRÈTE.

### 2. Charger les annonces scrapées
```bash
cd dealflow
pip install -r requirements.txt
export SUPABASE_URL="https://xxxx.supabase.co"
export SUPABASE_SERVICE_KEY="eyJ...service_role..."
python upload_supabase.py            # pousse les annonces dans Supabase
```
Vérifie dans Supabase > Table Editor > `listings_publics` que les lignes sont là.
(Re-lance cette commande quand tu veux rafraîchir — c'est un upsert.)

### 3. Connecter Lovable à Supabase
Dans Lovable : intégration **Supabase native** (bouton Supabase en haut à droite) →
connecte ton projet. Lovable lira/écrira via l'**anon key** + l'authentification.

### 4. Créer ton compte équipe
Supabase > Authentication > Users > Add user (ton courriel + mot de passe).
C'est ce compte qui te connectera à l'outil (il est privé, pas d'inscription publique).

---

## B. Prompt à coller dans Lovable

> Copie tout le bloc ci-dessous dans Lovable une fois Supabase connecté.

---

Construis un **outil interne de gestion de deal flow M&A** pour un cabinet de
conseil financier québécois. C'est un outil PRIVÉ pour mon équipe — pas un site
public. Toutes les pages exigent une connexion (Supabase Auth, courriel + mot de
passe). Aucune inscription publique : les comptes sont créés manuellement dans
Supabase. Interface en français, vouvoiement.

**Données : utilise mon projet Supabase connecté.** Les tables existent déjà :
`listings_publics`, `listings_prives`, `profils_acheteurs`, `matches`.

### Direction visuelle
Professionnel, sobre, dense et lisible (c'est un outil de travail quotidien, pas
une page marketing). Fond clair, typographie nette, tableaux confortables,
filtres rapides. Pas d'animations superflues. Privilégie la clarté et la vitesse.

### Navigation (barre latérale)
1. Tableau de bord
2. Annonces du marché (listings publics)
3. Vendeurs privés
4. Acheteurs
5. Rapprochements (matching)

### Page 1 — Tableau de bord
Cartes de statistiques : nombre d'annonces publiques actives, nombre de vendeurs
privés, nombre d'acheteurs actifs. Répartition des annonces par secteur (liste ou
petit graphique). Liste des 5 derniers acheteurs ajoutés.

### Page 2 — Annonces du marché (`listings_publics`)
Tableau de toutes les annonces avec colonnes : titre, secteur, région, ville,
date d'ajout (`date_listed`), source, statut. 
- Barre de recherche texte (titre + description).
- Filtres : secteur, région, statut (active/expired).
- Clic sur une ligne → panneau de détail : description complète + bouton
  « Voir l'annonce d'origine » (ouvre `source_url` dans un nouvel onglet).
- Si `potential_duplicate_of` n'est pas vide, afficher un badge « doublon possible ».
- Ces annonces sont en LECTURE SEULE (alimentées par un script externe).

### Page 3 — Vendeurs privés (`listings_prives`)
Tableau + bouton « Ajouter un vendeur ». Formulaire de création/édition avec
les champs : nom_entreprise, description, sector, region, city, revenue, ebitda,
asking_price, raison_vente, horizon_vente, financement_vendeur, transition,
contact_nom, contact_courriel, contact_tel, notes, statut (actif / en_pause /
transige / retire). Possibilité d'éditer et de supprimer.

### Page 4 — Acheteurs (`profils_acheteurs`)
Tableau + bouton « Ajouter un acheteur ». Formulaire avec : nom, courriel,
telephone, secteurs_recherches (multi-sélection), regions_recherchees
(multi-sélection), budget_min, budget_max, revenue_min, revenue_max, ebitda_min,
type_acquisition, financement, horizon, notes, statut (actif / en_pause /
transige). Éditer et supprimer possible.

**Valeurs pour les secteurs** (multi-sélection) : manufacturier, construction,
services-professionnels, commerce-detail, commerce-gros, distribution, transport,
restauration, technologie, sante, agroalimentaire, automobile, immobilier, autre.

**Valeurs pour les régions** : bas-saint-laurent, saguenay-lac-saint-jean,
capitale-nationale, mauricie, estrie, montreal, outaouais, abitibi-temiscamingue,
cote-nord, nord-du-quebec, gaspesie-iles-de-la-madeleine, chaudiere-appalaches,
laval, lanaudiere, laurentides, monteregie, centre-du-quebec.

### Page 5 — Rapprochements (matching)
L'écran le plus important. Sélectionner un acheteur dans une liste déroulante,
puis afficher toutes les annonces (publiques ET privées) qui correspondent à ses
critères, triées par pertinence. Une annonce correspond si :
- son `sector` est dans les `secteurs_recherches` de l'acheteur (si l'acheteur
  en a précisé), ET
- sa `region` est dans les `regions_recherchees` (si précisées), ET
- si l'annonce a un `revenue`, il est entre `revenue_min` et `revenue_max`
  (ignorer ce critère quand l'annonce n'a pas de revenue, ce qui est fréquent).
Afficher un score simple : +50 si secteur correspond, +30 si région correspond,
+20 si la taille correspond (ou si inconnue). Trier par score décroissant.
Chaque résultat montre : titre, secteur, région, source (publique/privée), score,
et un lien vers la source. Bouton « Enregistrer ce rapprochement » qui insère une
ligne dans `matches`.

### Comportements généraux
- Écran de connexion propre avant tout accès.
- Messages de chargement et d'erreur clairs.
- Tout en français.

---

## Ordre de construction suggéré

Si Lovable peine à tout générer d'un coup, construis dans cet ordre :
1. Auth + page « Annonces du marché » (lecture seule) — valide que les données
   Supabase s'affichent.
2. Pages Acheteurs et Vendeurs privés (formulaires de saisie).
3. Page Rapprochements (matching).
4. Tableau de bord.
