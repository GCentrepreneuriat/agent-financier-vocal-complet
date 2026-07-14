# Prompt Lovable — Étape 1 : Plateforme publique (sans connexion)

> À coller dans Lovable. Remplace les `[[À REMPLIR]]`.
> Cette étape ne construit QUE la partie publique. La zone membre (connexion) viendra à l'étape 2.

---

## PROMPT

Crée une plateforme web publique pour une firme de placement nommée **[[NOM DE LA FIRME]]**, centrée sur les **insights des marchés financiers et l'actualité économique**. Cette partie est **accessible à tous, sans connexion**. Prévois plus tard une zone membre (connexion) pour les clients, mais ne la construis pas encore — laisse seulement un bouton « Connexion / Espace client » dans l'en-tête qui mènera à une page à venir.

**Langue : tout en français (Québec).**
**Utilise des données fictives (articles, nouvelles) pour l'instant.**

### Stack et design
- React + Tailwind. Design moderne, épuré et professionnel, qui inspire confiance (secteur financier).
- Palette : primaire **[[COULEUR #HEX]]**, secondaire **[[COULEUR #HEX]]**, fond clair, beaucoup d'espace blanc, typo sobre et lisible.
- Responsive (mobile et bureau).
- Prépare Supabase pour la suite (articles/nouvelles stockés en base), mais aucune authentification à cette étape.

### Structure du site (pages publiques)

**1. Page d'accueil**
- En-tête (header) avec le logo/nom de la firme, un menu de navigation (Accueil, Insights marchés, Actualité économique, À propos) et un bouton **« Connexion / Espace client »** à droite.
- Section héro : titre accrocheur, sous-titre expliquant la valeur (« Suivez les marchés et l'économie, et accédez à votre espace client »), et un bouton d'appel à l'action.
- Section « Derniers insights » : 3-4 cartes d'articles récents.
- Section « Actualité économique importante » : liste des nouvelles marquantes (titre, source fictive, date).
- Pied de page (footer) avec avis légal, coordonnées fictives, liens.

**2. Insights marchés**
- Page listant des analyses de marché sous forme de cartes (titre, catégorie, date, extrait, image).
- Catégories fictives : Bourse, Taux d'intérêt, Obligations, Devises, Immobilier.
- Filtre par catégorie.
- Vue détaillée d'un article (titre, date, contenu complet, catégorie).
- 5-6 articles fictifs au départ.

**3. Actualité économique**
- Fil de nouvelles économiques importantes (inflation, décisions de banques centrales, emploi, PIB, etc.).
- Format liste : titre, court résumé, date, catégorie/source fictive.
- 6-8 nouvelles fictives.

**4. À propos**
- Présentation de la firme et de sa mission (texte fictif à remplacer).
- Invitation à devenir client / se connecter à l'espace client.

### Modèle de données (Supabase, pour le contenu public)
- `insights` : id, titre, catégorie, date, extrait, contenu, image_url.
- `actualites` : id, titre, resume, categorie, source, date.

### Éléments obligatoires
- **Avis légal** dans le pied de page : « Le contenu de ce site est fourni à titre informatif seulement et ne constitue pas un conseil en placement. »
- Le bouton « Connexion / Espace client » est visible mais mène à une page temporaire « Espace client — bientôt disponible ».
- Navigation fluide entre les pages.

Concentre-toi uniquement sur cette partie publique. On ajoutera la connexion et l'espace membre à la prochaine étape.
