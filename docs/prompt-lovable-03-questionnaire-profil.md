# Prompt Lovable — Questionnaire de profil d'investisseur (avec pointage)

> Prompt autonome pour la fonctionnalité « Mon profil d'investisseur ».
> Barème officiel iA (formulaire F51-122). À coller dans Lovable.

---

## PROMPT

Construis la fonctionnalité « Mon profil d'investisseur » : un questionnaire à choix multiples qui
calcule un pointage et attribue au client l'un des 5 profils d'investisseur. En français (Québec).

### Fonctionnement du pointage
- Le questionnaire contient 8 questions. Chaque réponse vaut un nombre de points : 1, 2, 5, 10 ou 20.
- À la fin, additionne les points de toutes les réponses (total possible : de 8 à 160).
- Le total détermine le profil selon ces seuils EXACTS :
  - 8 à 26 points → **Prudent**
  - 27 à 55 points → **Modéré**
  - 56 à 89 points → **Équilibré**
  - 90 à 119 points → **Croissance**
  - 120 à 160 points → **Audacieux**

### Présentation
- Affiche les questions regroupées en 4 sections, avec une barre de progression :
  1. Horizon d'investissement (questions 1 à 3)
  2. Situation financière (questions 4 et 5)
  3. Tolérance au risque (questions 6 et 7)
  4. Connaissance des placements (question 8)
- Une réponse obligatoire par question (boutons radio). Bouton « Voir mon profil » à la fin.
- N'affiche PAS les points au client pendant qu'il répond (calcul en arrière-plan).

### Les 8 questions et le pointage

**Section 1 — Horizon d'investissement**

Q1. Quel âge avez-vous?
- Plus de 71 ans → 1
- Entre 65 et 70 ans → 2
- Entre 55 et 64 ans → 5
- Entre 41 et 54 ans → 10
- Entre 18 et 40 ans → 20

Q2. Quand prévoyez-vous commencer à faire des sorties de fonds d'au moins 25 % de votre épargne?
- Dans moins de 1 an → 1
- Entre 1 et 3 ans → 2
- Entre 4 et 5 ans → 5
- Entre 6 et 9 ans → 10
- Dans plus de 10 ans → 20

Q3. Au cours des 5 prochaines années, prévoyez-vous :
- Faire des retraits de votre capital sur une base régulière (RAP, retraite, etc.)? → 1
- Retirer la totalité de votre rendement et une partie de votre capital? → 2
- Retirer tout votre rendement sans toucher à votre capital? → 5
- Retirer une partie de votre rendement seulement? → 10
- Accumuler des épargnes avec votre rendement (aucun retrait)? → 20

**Section 2 — Situation financière**

Q4. Quel est votre revenu annuel brut (avant impôts)?
- 25 000 $ et moins → 1
- 25 001 $ à 35 000 $ → 2
- 35 001 $ à 50 000 $ → 5
- 50 001 $ à 100 000 $ → 10
- 100 001 $ et plus → 20

Q5. Quelle est votre valeur nette (actif moins passif)?
- 25 000 $ et moins → 1
- 25 001 $ à 50 000 $ → 2
- 50 001 $ à 100 000 $ → 5
- 100 001 $ à 200 000 $ → 10
- 200 001 $ et plus → 20

**Section 3 — Tolérance au risque**

Q6. Indiquez votre niveau de tolérance au risque lorsque vous investissez votre argent.
- Très faible — Je n'aime pas l'idée de risquer mon argent. Mon seul objectif est de conserver les sommes investies en toute sécurité. → 1
- Faible — Je suis prêt à tolérer une baisse occasionnelle de 5 % maximum, sachant qu'à long terme le rendement sera plus élevé. → 2
- Modéré — Je suis prêt à tolérer une baisse à court terme de 5 % à 10 % pour un rendement à long terme plus élevé. → 5
- Élevé — Je suis à l'aise avec une baisse à court terme de 10 % à 20 %, sachant qu'à long terme je rattraperai cette baisse. → 10
- Très élevé — Une baisse à court terme (moins d'un an) de 20 % de la valeur de mes placements ne m'inquiète pas. → 20

Q7. Vous avez la possibilité de faire un placement de 10 000 $ pendant un an. Après un an, dans quelle fourchette accepteriez-vous que la valeur finale se situe?
- Gains uniquement : entre 10 000 $ et 10 300 $ → 1
- Entre 9 500 $ et 11 000 $ → 2
- Entre 9 000 $ et 11 500 $ → 5
- Entre 8 500 $ et 12 000 $ → 10
- Entre 8 000 $ et 12 500 $ → 20

**Section 4 — Connaissance des placements**

Q8. Quel est votre niveau de connaissance des placements?
- Très faible — Je commence à me familiariser avec les placements. → 1
- Faible — Je sais que certains placements sont plus risqués que d'autres. → 2
- Modéré — Je connais les différents types de placements et les risques qui s'y rattachent. → 5
- Avancé — Je comprends les niveaux de risque et de rendement de chaque type de placement. → 10
- Très avancé — Je surveille assidûment les marchés et j'en ai une connaissance approfondie. → 20

### Page de résultat
Affiche :
- Le profil obtenu (Prudent / Modéré / Équilibré / Croissance / Audacieux) bien mis en évidence.
- Le pointage total obtenu (ex. « 78 / 160 »).
- La description du profil :
  - **Prudent** : Il est important pour vous d'assurer la sécurité de votre capital et votre tolérance à la volatilité est faible. Vous recherchez des placements offrant un revenu régulier et la préservation du capital.
  - **Modéré** : Vous recherchez une certaine croissance de votre capital et votre tolérance à la volatilité est modérée. Vous privilégiez les placements dont les revenus sont relativement stables.
  - **Équilibré** : Vous recherchez un équilibre entre le revenu et la croissance de votre capital. Votre tolérance au risque est moyenne. Vous misez sur une appréciation à moyen et long terme.
  - **Croissance** : Vous recherchez une croissance supérieure à la moyenne et êtes prêt à tolérer un risque élevé. Investisseur patient, vous ne vous laissez pas influencer par les fluctuations.
  - **Audacieux** : Vous possédez une forte tolérance au risque et les fluctuations des marchés ne vous tracassent pas. Vous recherchez une croissance élevée et acceptez des variations substantielles d'une année à l'autre.
- La répartition Revenu/Actions cible du profil :
  - Prudent : 75 % revenu / 25 % actions
  - Modéré : 60 % / 40 %
  - Équilibré : 55 % / 45 %
  - Croissance : 30 % / 70 %
  - Audacieux : 15 % / 85 %
- Un bouton « Refaire le questionnaire » et un bouton « Voir mon portefeuille sur mesure ».

### Sauvegarde (Supabase)
Enregistre pour le client connecté : le profil obtenu, le pointage total, la date, et les réponses
choisies (json). Permets de refaire le questionnaire pour mettre à jour le profil (garde l'historique
si possible).

### Avis
Ajoute une mise en garde sous le résultat : « Ce questionnaire est fourni pour vous guider dans
l'élaboration de votre stratégie de placement et ne constitue pas un conseil personnalisé.
Communiquez avec votre conseiller. »
