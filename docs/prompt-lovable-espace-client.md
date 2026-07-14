# Prompt de base — Espace client (Lovable)

> À coller dans Lovable. Remplace les `[[À REMPLIR]]`.
> Version 1 : données fictives, français, aucune vraie donnée client.

---

## PROMPT

Crée une application web **« Espace client »** pour une firme de placement nommée **[[NOM DE LA FIRME]]**. L'application permet aux clients qui détiennent des placements de consulter des insights de marché, de mettre à jour leur profil d'investisseur, et de recevoir un portefeuille-modèle personnalisé avec des explications.

**Langue : tout en français (Québec).**
**Important : utilise uniquement des données fictives pour l'instant. Aucune vraie donnée client.**

### Stack et fondations
- React + Tailwind, design épuré et professionnel (secteur financier, inspirer confiance).
- Palette : primaire **[[COULEUR #HEX]]**, secondaire **[[COULEUR #HEX]]**, fond clair, beaucoup d'espace blanc. Typo sobre et lisible.
- Active **Supabase** pour : authentification (courriel + mot de passe), base de données, et stockage.
- Design responsive (mobile et bureau).

### Authentification
- Page de connexion / inscription.
- Après connexion, rediriger vers le **tableau de bord**.
- Chaque utilisateur ne voit QUE ses propres données (Row Level Security dans Supabase).

### Pages / fonctionnalités

**1. Tableau de bord (accueil)**
- Salutation avec le prénom du client.
- Résumé de son profil d'investisseur actuel (ex. « Modéré ») et de son portefeuille-modèle.
- Raccourcis vers : Insights marché, Mon profil, Mon portefeuille.

**2. Insights marché**
- Liste d'articles / cartes (titre, date, catégorie, extrait, contenu).
- Données fictives au départ (4-5 articles ex. : inflation, taux d'intérêt, marchés boursiers, obligations).
- Vue détaillée d'un article.

**3. Mon profil d'investisseur**
- Questionnaire de tolérance au risque (8 à 10 questions à choix multiples), ex. :
  - Horizon de placement (moins de 3 ans → plus de 15 ans)
  - Réaction à une baisse de 20 % du portefeuille
  - Objectif principal (préserver / revenu / croissance)
  - Connaissance des placements
  - Stabilité des revenus
  - Capacité à épargner
- Chaque réponse donne un score. Le total classe le client dans un profil :
  - **Prudent / Conservateur / Modéré / Croissance / Audacieux** (5 profils).
- Le client peut refaire le questionnaire et mettre à jour son profil ; sauvegarder dans Supabase.
- Afficher le profil obtenu avec une courte description.

**4. Mon portefeuille**
- Selon le profil de l'investisseur, afficher un **portefeuille-modèle** composé de plusieurs fonds de la firme.
- Pour chaque profil, une allocation différente (% actions / obligations / liquidités) et une liste de fonds avec leur pondération.
- Utilise cette liste de fonds fictifs (à remplacer plus tard par les vrais) :
  - **[[FONDS 1 — nom, type ex. actions canadiennes]]**
  - **[[FONDS 2 — obligations]]**
  - **[[FONDS 3 — actions mondiales]]**
  - **[[FONDS 4 — équilibré]]**
  - **[[FONDS 5 — marché monétaire]]**
- Afficher l'allocation sous forme de **graphique en pignon (donut)** + tableau des fonds avec pondération %.
- Sous chaque fonds, une **explication** en langage clair : pourquoi ce fonds convient à ce profil, son rôle dans le portefeuille, son niveau de risque. (Texte généré / éditorial pour le v1.)

### Modèle de données (Supabase)
- `profiles` : id, user_id, prénom, nom, courriel, profil_investisseur, score, date_maj.
- `questionnaire_reponses` : id, user_id, réponses (json), score, date.
- `insights` : id, titre, catégorie, date, extrait, contenu.
- `fonds` : id, nom, type, niveau_risque, description.
- `portefeuilles_modeles` : id, profil, allocation (json), liste_fonds (json).

### Éléments obligatoires
- **Avis légal** en pied de page sur chaque page : « Ce portefeuille est un modèle fourni à titre indicatif et ne constitue pas un conseil en placement personnalisé. Communiquez avec votre conseiller avant toute décision. »
- Bouton de déconnexion.
- Message clair quand le client n'a pas encore rempli son profil (l'inviter à le faire avant de voir un portefeuille).

Commence par générer l'authentification, le tableau de bord et le questionnaire de profil. On ajoutera les insights et les portefeuilles ensuite.
