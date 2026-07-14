# Données des fonds iA — extraites des fiches PDF

Source : fiches de fonds iA Groupe financier (3 PDF fusionnés fournis par l'utilisateur).
Rendements **datés au 30 juin 2025** (à rafraîchir plus tard depuis ia.ca/rendement-fonds).

## Fichiers
- `fonds_ia.json` — 68 fonds, données complètes (description, style, rendements composés + annuels, composition d'actif quand disponible).
- `fonds_ia.csv` — vue tabulaire résumée (pour Excel / import rapide).

## Champs (JSON)
| Champ | Description |
|---|---|
| `id`, `seq` | identifiants internes |
| `code` | code du fonds iA (ex. 010) |
| `nom` | nom du fonds |
| `categorie_produit` | regroupement iA (Actions canadiennes, Revenu, Diversifiés, Focus, Indexia…) |
| `categorie_cifsc` | catégorie CIFSC (classification officielle) |
| `gestionnaire` | firme de gestion du portefeuille |
| `pourquoi` | « Pourquoi choisir ce Fonds » |
| `style` | style d'investissement et caractéristiques |
| `couverture_devises` | stratégie de couverture |
| `actif_net`, `date_creation` | infos générales |
| `rendements_composes` | { DDA, 3mois, 6mois, 1an, 3ans, 5ans, 10ans, depuis_lancement } (%) |
| `rendements_annuels` | { 2024…2015 } (%) |
| `composition_actif` | répartition par classe d'actif (si présente) |

## Note importante — gammes alignées sur les profils
Deux familles de fonds « clés en main » correspondent **directement aux 5 profils d'investisseur** :
- **Focus** : prudent / modéré / équilibré / croissance / audacieux (codes 816-820)
- **Indexia** : prudent / modéré / équilibré / croissance / audacieux (codes 913-917)

Ces gammes sont idéales comme **portefeuille de base par profil**, que l'IA peut ensuite compléter/ajuster avec des fonds spécialisés selon le contexte de marché.

## Rendements à jour
Les rendements ici datent de juin 2025. Le site `ia.ca/rendement-fonds` publie les rendements courants
mais via une API dynamique difficile à extraire de façon fiable. Prévoir dans l'admin un moyen de
mettre à jour les rendements (import CSV périodique ou champ modifiable).
