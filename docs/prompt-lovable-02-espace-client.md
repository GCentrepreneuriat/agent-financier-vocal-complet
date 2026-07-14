# Prompt Lovable — Étape 2 : Espace client (connexion)

> À coller dans Lovable, APRÈS avoir généré l'étape 1 (plateforme publique).
> Cette étape ajoute la zone membre derrière connexion.
> Remplace les `[[À REMPLIR]]`. Données fictives pour l'instant.

---

## PROMPT

Ajoute maintenant l'**espace client sécurisé** (zone membre) à la plateforme existante. On y accède par le bouton « Connexion / Espace client ». Toute cette zone est **derrière une authentification** : seuls les clients connectés y ont accès.

**Langue : français (Québec). Données fictives pour l'instant.**

### Authentification — IMPORTANT
- **Aucune inscription publique possible.** Il n'y a PAS de bouton « Créer un compte ». Les comptes clients sont créés uniquement par l'administrateur (nous) dans Supabase.
- La page de connexion contient seulement : courriel, mot de passe, bouton « Se connecter », et un lien « Mot de passe oublié ».
- Un texte sous le formulaire : « L'accès à l'espace client est réservé. Contactez votre conseiller pour obtenir vos identifiants. »
- Chaque client ne voit QUE ses propres données (Row Level Security dans Supabase).
- Après connexion → rediriger vers le tableau de bord client.

### Pages de l'espace client

**1. Tableau de bord client**
- Salutation avec le prénom du client.
- État du profil d'investisseur : « Complété » (avec le profil obtenu) ou « À compléter » (avec un bouton pour le remplir).
- Raccourcis vers : Mon profil d'investisseur, Fonds de placement, Mon portefeuille.
- Rappel : si le profil n'est pas complété, le portefeuille sur mesure n'est pas encore disponible.

**2. Mon profil d'investisseur**
- Reproduis EXACTEMENT le questionnaire officiel iA (fourni dans `data/questionnaire_profil.json`) : **8 questions**, réparties en 4 sections (Horizon d'investissement, Situation financière, Tolérance au risque, Connaissance des placements). Chaque réponse vaut **1, 2, 5, 10 ou 20 points**.
- Additionne les points. Le total (de 8 à 160) détermine le profil selon ces seuils EXACTS :
  - **8 à 26 → Prudent**
  - **27 à 55 → Modéré**
  - **56 à 89 → Équilibré**
  - **90 à 119 → Croissance**
  - **120 à 160 → Audacieux**
- Affiche à la fin le profil obtenu, le pointage total, et la description du profil (fournie dans `data/profils_allocations.json`).
- Le client peut refaire le questionnaire pour mettre à jour son profil.
- Sauvegarder le profil, le pointage et les réponses dans Supabase.
- Utilise le contenu des fichiers de données fournis plutôt que d'inventer des questions.

**3. Fonds de placement**
- Liste des fonds offerts par la firme (fictifs pour l'instant) avec, pour chaque fonds :
  - Nom, catégorie (actions / obligations / équilibré / marché monétaire / mondial), niveau de risque.
  - **Performance des dernières années** (ex. rendements annuels sur 1, 3, 5 ans) présentée en tableau ET en graphique linéaire.
  - Courte description du fonds.
- Vue détaillée par fonds.
- Fonds fictifs de départ :
  - **[[FONDS 1]]**, **[[FONDS 2]]**, **[[FONDS 3]]**, **[[FONDS 4]]**, **[[FONDS 5]]**

**4. Mon portefeuille sur mesure**
- Accessible SEULEMENT si le profil d'investisseur est complété (sinon, message invitant à le compléter d'abord).
- Un **portefeuille personnalisé généré par l'IA** selon : le profil de l'investisseur, le contexte de marché actuel et les données économiques.
- **Contrainte obligatoire — respecter la répartition Revenu/Actions officielle du profil** (fournie dans `data/profils_allocations.json`). L'IA doit rester dans la fourchette du profil :
  - Prudent : Revenu 65-100 % / Actions 0-35 % (cible 75/25)
  - Modéré : Revenu 50-70 % / Actions 30-50 % (cible 60/40)
  - Équilibré : Revenu 35-55 % / Actions 45-65 % (cible 55/45)
  - Croissance : Revenu 20-40 % / Actions 60-80 % (cible 30/70)
  - Audacieux : Revenu 0-25 % / Actions 75-100 % (cible 15/85)
- L'IA choisit UNIQUEMENT parmi les fonds réels de la firme (fournis dans `data/fonds_ia.json`), jamais de fonds inventés.
- La **fonction d'IA** (intégration Claude via Lovable) reçoit : le profil + pointage du client, la liste des fonds disponibles (avec catégorie et rendements), et un résumé du contexte de marché ; elle retourne :
  - Une **allocation** (% par fonds, total 100 %) respectant la fourchette Revenu/Actions du profil.
  - Une **explication globale du portefeuille** (stratégie, pourquoi elle convient au profil et au marché actuel).
  - Une **explication par fonds choisi** (rôle dans le portefeuille, raison du choix, niveau de risque).
- Afficher l'allocation en **graphique en donut** + tableau des fonds pondérés.
- Bouton « Régénérer / mettre à jour mon portefeuille ».
- Sauvegarder le dernier portefeuille généré dans Supabase (avec sa date).

### Modèle de données (Supabase)
- `profiles` : id, user_id, prénom, nom, courriel, profil_investisseur, score, date_maj.
- `questionnaire_reponses` : id, user_id, reponses (json), score, date.
- `fonds` : id, nom, categorie, niveau_risque, description, rendements (json : {annee: rendement}).
- `portefeuilles_generes` : id, user_id, allocation (json), explication_globale, explications_fonds (json), date.

### Éléments obligatoires
- **Avis légal** en pied de page de la zone client : « Le portefeuille présenté est un modèle généré à titre indicatif et ne constitue pas un conseil en placement personnalisé. Les rendements passés ne garantissent pas les rendements futurs. Communiquez avec votre conseiller avant toute décision. »
- Bouton de déconnexion.
- Message clair quand le profil n'est pas encore complété.

Ne touche pas à la partie publique déjà construite ; ajoute cette zone membre par-dessus.
