# Prompt Lovable — Portefeuilles-modèles par profil (fixes + design + admin)

> À coller dans Lovable APRÈS le questionnaire de profil.
> Les 5 portefeuilles sont FIXES (un par profil), stockés en base et modifiables par l'admin.
> Prérequis : exécuter `supabase_import.sql` puis `supabase_portefeuilles.sql` dans Supabase.
> Design de référence : maquette « Mon portefeuille » (mêmes couleurs ci-dessous).

---

## PROMPT

Ajoute la fonctionnalité « Mon portefeuille sur mesure » dans l'espace client. En français (Québec).
Reproduis le design décrit à la section DESIGN (présentation visuelle professionnelle et interactive).

### Principe (IMPORTANT)
- Il existe UN portefeuille-modèle FIXE par profil (Prudent, Modéré, Équilibré, Croissance,
  Audacieux). Pour un même profil, on affiche TOUJOURS le même portefeuille.
- Le portefeuille n'est PAS généré aléatoirement à chaque visite : il est lu depuis la base de
  données. C'est l'administrateur qui le rééquilibre / le met à jour manuellement.

### Données déjà en base (Supabase) — utilise-les
- `portefeuilles_modeles` : profil, titre, resume, cible_revenu, cible_actions, contexte_marche,
  date_rebalancement.
- `lignes_portefeuille` : profil, code_fonds, poids (%), role (explication du fonds), ordre.
- `fonds` : nom, categorie_produit, gestionnaire, rendements_composes (jsonb : 1an/3ans/5ans/10ans)…
  joignable par `code` = `code_fonds`.
- `profils_allocation` : seuils et description de chaque profil, fourchettes Revenu/Actions.

### Rendement moyen du portefeuille (à CALCULER)
Pour chaque portefeuille, calcule et affiche le rendement moyen pondéré sur 1, 3, 5 et 10 ans :
- Pour chaque horizon, fais la moyenne des rendements des fonds pondérée par leur poids.
- Si un fonds n'a pas de donnée pour un horizon (ex. fonds récent, valeur nulle), EXCLUS-le de ce
  calcul et renormalise les poids sur les fonds qui ont la donnée (n'utilise jamais 0 comme valeur).
- Affiche le résultat en pourcentage à 2 décimales.

### Page client — « Mon portefeuille sur mesure »
- Accessible seulement si le profil est complété. Sinon : « Complétez d'abord votre profil
  d'investisseur pour voir votre portefeuille » + bouton vers le questionnaire.
- Charge le profil du client puis le portefeuille correspondant (portefeuilles_modeles +
  lignes_portefeuille jointes à fonds).
- Structure de la page (de haut en bas) :
  1. **En-tête (hero)** : petit sur-titre « Profil <nom> », grand titre du portefeuille (titre),
     résumé (resume), et 3 badges : Revenu (cible_revenu %), Actions (cible_actions %), Objectif de
     rendement (voir table ci-dessous).
  2. **Rendement moyen du portefeuille** : 4 tuiles (1 an, 3 ans, 5 ans, 10 ans) affichant les
     moyennes calculées, en vert si positif / rouge si négatif, avec la mention « annualisé, moy.
     pondérée ».
  3. **Composition** : un graphique en DONUT de la répartition par fonds, avec au centre la
     répartition Revenu / Actions. À droite, une légende groupée en deux blocs (Revenu, Actions)
     listant chaque fonds, sa pastille de couleur et son poids %. Survoler un fonds (dans le donut,
     la légende OU le tableau) le met en évidence dans les trois endroits simultanément.
  4. **Fonds sélectionnés** : tableau avec, par fonds — nom, rôle (colonne `role`), une étiquette
     Revenu/Actions + catégorie, le poids %, et les rendements 1/3/5/10 ans. Chaque ligne est
     cliquable vers la fiche détaillée du fonds.
  5. **Pourquoi ce portefeuille** : encadré affichant `contexte_marche` (l'analyse de conjoncture).
  6. **Pied** : date du dernier rééquilibrage (date_rebalancement) + avis légal (voir plus bas).

Objectif de rendement par profil (à afficher dans le badge « Objectif ») :
Prudent 3-4 % · Modéré 4-6 % · Équilibré 5-6 % · Croissance 6-8 % · Audacieux 8-10 %.

### DESIGN (à reproduire fidèlement — mêmes couleurs que la maquette)
**Palette (mode clair)**
- Fond de page : `#F6F4EF` (papier) ; cartes : `#FFFFFF` ; texte : `#12232F` ; texte doux : `#4C5B64` ;
  lignes/bordures : `#E2DCD0`.
- Barre supérieure : fond encre marine `#0F2334`, texte clair `#EAF0F4`.
- Accent principal (laiton) : `#C99A4B` (foncé `#A87C33`). Accent secondaire (sarcelle) : `#2C7A6B`.
- Rendement positif : `#2E7D53` ; négatif : `#B4472F`.

**Palette (mode sombre)** — l'app doit gérer les deux thèmes
- Fond : `#0C1B29` ; cartes : `#132738` ; texte : `#EAECEE` ; texte doux : `#9FB0BC` ; lignes : `#243A4C`.
- Les accents (laiton, sarcelle, vert/rouge) restent les mêmes.

**Couleurs du donut / légende** (la structure Revenu/Actions doit se lire par la couleur)
- Fonds de la classe **Revenu** → teintes FROIDES, dans l'ordre :
  `#1E5A7A`, `#2C7A6B`, `#3E8EA6`, `#6BB0BE`, `#93C7CC`.
- Fonds de la classe **Actions** → teintes CHAUDES, dans l'ordre :
  `#A87C33`, `#C99A4B`, `#8FA83E`, `#C77B3C`, `#9E5E2E`, `#B7503F`, `#6E8B3D`, `#D8B570`.
- (Classe = « Revenu » si categorie_produit du fonds est « Fonds de revenu », sinon « Actions ».)

**Typographie**
- Titres et grands chiffres : police à empattements (serif, ex. Georgia) — évoque la confiance.
- Corps de texte et données : sans-serif système. Chiffres alignés en tabular-nums.

**Style**
- Barre supérieure foncée collante (sticky) avec le nom du produit à gauche et le sélecteur de
  profils à droite (5 pastilles cliquables ; la pastille active est en laiton).
- Cartes à coins arrondis (~14 px), ombres douces, filet de 3 px en accent laiton à gauche des tuiles
  de rendement, filet sarcelle à gauche de l'encadré « Pourquoi ce portefeuille ».
- Beaucoup d'espace blanc, hiérarchie claire, rendu sobre et haut de gamme (secteur financier).
- Responsive : sur mobile, le donut passe au-dessus de la légende et les tuiles en 2 colonnes.

### Section admin — « Gérer les portefeuilles » (réservée à l'administrateur)
Réserve cette section à un utilisateur admin (rôle `admin` dans la table profiles, ou liste d'emails
autorisés). Elle permet de rééquilibrer sans code :
- Choisir un profil, puis modifier : titre, résumé, contexte de marché, répartition cible, date de
  rééquilibrage ; ajouter/retirer des fonds (choisis dans `fonds`), ajuster poids % et rôle.
- VALIDATION : la somme des poids doit égaler 100 % (afficher le total en direct, bloquer sinon).
- Avertissement (non bloquant) si la répartition Revenu/Actions sort de la fourchette du profil
  (`profils_allocation` : fourchette_revenu_min/max, fourchette_actions_min/max).
- Enregistrer met à jour `portefeuilles_modeles` et `lignes_portefeuille`. Les rendements moyens et le
  donut se recalculent automatiquement à partir des fonds.

### Obligatoire
- Avis légal sous le portefeuille : « Ce portefeuille est un modèle fourni à titre indicatif et ne
  constitue pas un conseil en placement personnalisé. Les rendements passés ne garantissent pas les
  rendements futurs. Communiquez avec votre conseiller avant toute décision. »

Ne modifie pas la partie publique ni le questionnaire déjà construits ; ajoute cette fonctionnalité.
