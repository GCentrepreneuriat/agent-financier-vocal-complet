# Prompt Lovable — Portefeuilles-modèles par profil (fixes + admin)

> À coller dans Lovable APRÈS le questionnaire de profil.
> Les 5 portefeuilles sont FIXES (un par profil), stockés en base et modifiables par l'admin.
> Prérequis : exécuter `supabase_import.sql` puis `supabase_portefeuilles.sql` dans Supabase.

---

## PROMPT

Ajoute la fonctionnalité « Mon portefeuille sur mesure » dans l'espace client. En français (Québec).

### Principe (IMPORTANT)
- Il existe **un portefeuille-modèle FIXE par profil d'investisseur** (Prudent, Modéré, Équilibré,
  Croissance, Audacieux). Pour un même profil, on affiche TOUJOURS le même portefeuille.
- Le portefeuille n'est PAS généré aléatoirement par une IA à chaque visite : il est lu depuis la
  base de données. C'est l'administrateur qui le rééquilibre / le met à jour manuellement.

### Données déjà en base (Supabase)
Ces tables existent et sont remplies — utilise-les :
- `portefeuilles_modeles` : profil, titre, resume, cible_revenu, cible_actions, contexte_marche,
  date_rebalancement.
- `lignes_portefeuille` : profil, code_fonds, poids (%), role (explication du fonds), ordre.
- `fonds` : détails de chaque fonds (nom, catégorie, gestionnaire, rendements…), joignable par `code`.
- `profils_allocation` : seuils et description de chaque profil.

### Page client — « Mon portefeuille sur mesure »
- Accessible seulement si le client a complété son profil. Sinon, message : « Complétez d'abord votre
  profil d'investisseur pour voir votre portefeuille » + bouton vers le questionnaire.
- Récupère le profil du client, puis charge le portefeuille-modèle correspondant depuis
  `portefeuilles_modeles` + `lignes_portefeuille` (jointes à `fonds` pour les noms et rendements).
- Affiche :
  1. Le **titre** du portefeuille et son **résumé**.
  2. La **répartition Revenu / Actions** cible (cible_revenu / cible_actions) sous forme de badges.
  3. Un **graphique en donut** de la composition par fonds (poids %).
  4. Un **tableau des fonds** : nom, catégorie, poids %, et le rôle du fonds (colonne `role`),
     avec le rendement 1 an et 5 ans tiré de `fonds`.
  5. Une section **« Pourquoi ce portefeuille »** affichant `contexte_marche` (l'explication qui
     tient compte des données économiques du marché au moment du rééquilibrage).
  6. La **date du dernier rééquilibrage** (date_rebalancement).
- Chaque fonds est cliquable vers sa fiche détaillée.

### Section admin — « Gérer les portefeuilles » (réservée à l'administrateur)
Réserve cette section à un utilisateur admin (ex. un rôle `admin` dans la table profiles, ou une
liste d'emails autorisés). Elle permet de rééquilibrer les portefeuilles sans code :
- Choisir un profil, puis :
  - Modifier le titre, le résumé, le contexte de marché, la répartition cible et la date de
    rééquilibrage.
  - Ajouter / retirer des fonds (choisis dans la table `fonds`), ajuster leur poids % et leur rôle.
  - **Validation** : la somme des poids doit égaler 100 % (afficher le total en direct et bloquer
    l'enregistrement sinon).
  - Avertissement (non bloquant) si la répartition Revenu/Actions sort de la fourchette du profil
    (fournie dans `profils_allocation` : fourchette_revenu_min/max, fourchette_actions_min/max).
  - Enregistrer met à jour `portefeuilles_modeles` et `lignes_portefeuille`.

### Obligatoire
- Avis légal sous le portefeuille : « Ce portefeuille est un modèle fourni à titre indicatif et ne
  constitue pas un conseil en placement personnalisé. Les rendements passés ne garantissent pas les
  rendements futurs. Communiquez avec votre conseiller avant toute décision. »

Ne modifie pas la partie publique ni le questionnaire déjà construits ; ajoute cette fonctionnalité.
