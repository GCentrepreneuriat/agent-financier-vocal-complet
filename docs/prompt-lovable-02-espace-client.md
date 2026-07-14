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
- Questionnaire de tolérance au risque (8 à 10 questions à choix multiples) :
  - Horizon de placement (moins de 3 ans → plus de 15 ans)
  - Réaction à une baisse de 20 % de la valeur du portefeuille
  - Objectif principal (préserver le capital / revenu / croissance)
  - Connaissance des placements
  - Stabilité et source des revenus
  - Capacité à épargner / à absorber une perte
- Chaque réponse donne un score. Le total classe le client dans un profil :
  **Prudent / Conservateur / Modéré / Croissance / Audacieux**.
- Le client peut refaire le questionnaire pour mettre à jour son profil.
- Sauvegarder le profil, le score et les réponses dans Supabase.
- Afficher le profil obtenu avec une description claire de ce qu'il signifie.

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
- Utilise une **fonction d'IA** (intégration OpenAI/Claude via Lovable) qui reçoit en entrée : le profil du client, la liste des fonds disponibles et un résumé du contexte de marché, et qui retourne :
  - Une **allocation** (% par fonds, total 100 %).
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
