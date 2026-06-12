# Agent financier vocal

Assistant d'aide à la décision **en direct** pour vos rencontres financières en **français québécois**.

Il **écoute** la rencontre (la transcription s'écrit automatiquement), **détecte tout seul les sujets** abordés (ex. « gel successoral », « fiscalité entreprise agricole »), et affiche **un bouton « Générer » à côté de chaque sujet**. Quand vous cliquez, il produit pour ce sujet :

1. **Une réponse vérifiée** avec sources officielles et niveau de certitude
2. **Des questions pertinentes** à poser au client
3. **Des directions optimales** à prendre

Vous ne générez de l'information que **lorsque vous le décidez**, sujet par sujet.

L'agent combine l'intelligence de **Claude (Opus 4.8)** avec une **recherche web** sur des sources officielles (Revenu Québec, ARC, AMF, Retraite Québec, etc.) afin que l'information soit à jour et vérifiable.

---

## ⚠️ À lire avant de commencer

- **Outil d'aide à la décision** — toujours valider l'information à sa source officielle. Sur les sujets fiscaux/juridiques pointus (fiscalité avancée, transfert de parts, structures corporatives), **consultez un fiscaliste, CPA ou notaire** avant de conseiller. Aucune IA ne remplace un avis professionnel.
- L'agent **signale toujours son niveau de certitude** : `Confirmé`, `À vérifier`, ou `Estimation`.
- **Respect de la confidentialité** : la transcription est envoyée à l'API d'Anthropic pour analyse. Assurez-vous d'avoir le consentement du client et de respecter vos obligations professionnelles. Aucune donnée n'est stockée par cette application.

---

## Installation (une seule fois)

### 1. Installer Node.js

Téléchargez et installez **Node.js version 20 ou plus** : https://nodejs.org/ (choisir la version « LTS »).

### 2. Récupérer le projet et installer les dépendances

Ouvrez un terminal dans le dossier du projet, puis :

```bash
npm install
```

### 3. Configurer votre clé Anthropic

1. Obtenez une clé sur https://console.anthropic.com/ (elle commence par `sk-ant-...`)
2. Copiez le fichier `.env.example` en `.env` :
   ```bash
   cp .env.example .env
   ```
3. Ouvrez `.env` et collez votre clé dans `ANTHROPIC_API_KEY`.

---

## Utilisation

### Démarrer l'application

```bash
npm start
```

Puis ouvrez **Google Chrome** ou **Microsoft Edge** (sur ordinateur) à l'adresse :

```
http://localhost:3000
```

### Pendant une rencontre

1. Cliquez sur **« Démarrer l'écoute »** et autorisez le microphone.
2. La transcription s'écrit **automatiquement** en haut (vous pouvez la corriger à la main).
3. Les **sujets détectés** apparaissent tout seuls dans la colonne de gauche (bouton **« Détecter »** pour forcer une détection immédiate).
4. Cliquez sur **« Générer »** à côté d'un sujet → l'information vérifiée s'affiche à droite, en direct, avec ses sources.

---

## 🎙️ Transcription Pro avec Deepgram (recommandé)

Par défaut, l'app utilise le moteur de transcription **gratuit** du navigateur (précision limitée en québécois). Pour une transcription **précise et fluide**, branchez **Deepgram** :

1. Créez un compte sur **https://console.deepgram.com/** (crédit d'essai gratuit).
2. Copiez votre clé d'API (commence par un long code).
3. Dans votre fichier `.env`, ajoutez la ligne :
   ```
   DEEPGRAM_API_KEY=votre-cle-deepgram
   ```
4. Relancez `npm start`. En haut à gauche, l'indicateur passe à **« Transcription Pro »**.

Une case **« Capter aussi l'audio de l'appel »** apparaît alors : cochez-la pour partager l'onglet de l'appel (Zoom/Teams/Meet) et capter **les deux interlocuteurs**, même au casque. *(La clé Deepgram reste sur votre serveur, jamais exposée au navigateur.)*

---

## 📞 Rencontres en visioconférence — comment capter l'audio

La transcription gratuite (intégrée à Chrome/Edge) écoute **le microphone** de votre ordinateur. Pour capter **les deux côtés** d'un appel Zoom/Teams/Meet, le plus simple :

- **Mettez l'audio de l'appel sur vos haut-parleurs** (pas seulement les écouteurs) pour que le micro capte aussi la voix du client. Votre propre voix est captée directement.

Cette approche fonctionne bien pour démarrer. Pour une **précision maximale** (accent québécois, jargon, captation parfaite des deux interlocuteurs même au casque), le code est conçu pour brancher facilement un service de transcription payant (Deepgram, Whisper) plus tard — voir la dernière section.

---

## Réglages (fichier `.env`)

| Variable            | Rôle                                                  | Défaut            |
| ------------------- | ----------------------------------------------------- | ----------------- |
| `ANTHROPIC_API_KEY` | Votre clé Anthropic (obligatoire)                     | —                 |
| `MODELE`            | Modèle de génération. `claude-sonnet-4-6` = plus rapide | `claude-opus-4-8` |
| `MODELE_DETECTION`  | Modèle rapide pour détecter les sujets                | `claude-haiku-4-5` |
| `EFFORT`            | Profondeur de réflexion : `low`, `medium`, `high`     | `medium`          |
| `RECHERCHE_WEB`     | Recherche web (`true`/`false`). Repli auto si indispo. | `true`            |
| `DEEPGRAM_API_KEY`  | Clé Deepgram pour la transcription Pro (optionnel)    | — (gratuit si vide) |
| `DEEPGRAM_MODEL`    | Modèle Deepgram : `nova-2` ou `nova-3`                | `nova-2`          |
| `DEEPGRAM_LANG`     | Langue : `fr-CA` ou `fr`                              | `fr-CA`           |
| `PORT`              | Port du serveur local                                 | `3000`            |

Pour des réponses **plus rapides** en rencontre, vous pouvez mettre `MODELE=claude-sonnet-4-6`.

---

## Structure du projet

```
.
├── server.js          # Serveur (clé API sécurisée, appel à Claude + recherche web)
├── public/
│   ├── index.html     # Interface
│   ├── style.css      # Apparence
│   └── app.js         # Écoute vocale + affichage en direct
├── .env.example       # Modèle de configuration
└── README.md
```

---

## Dépannage

- **« Clé API invalide »** → vérifiez `ANTHROPIC_API_KEY` dans `.env`, sans espace ni guillemets.
- **Le micro ne fonctionne pas** → utilisez Chrome ou Edge sur ordinateur, et autorisez le microphone. `localhost` est considéré comme sécuritaire par le navigateur.
- **« Reconnaissance vocale non supportée »** → Firefox/Safari ne supportent pas bien cette fonction. Utilisez Chrome/Edge, ou tapez/collez la transcription manuellement.
- **« Génération en cours » mais rien ne sort** → l'agent affiche maintenant le vrai message d'erreur. S'il mentionne la recherche web, mettez `RECHERCHE_WEB=false` dans `.env`. Pour plus de vitesse, mettez `MODELE=claude-sonnet-4-6`. Vérifiez aussi votre connexion internet et regardez la fenêtre noire (terminal) : les erreurs détaillées s'y affichent.
- **Aucun sujet n'apparaît** → parlez quelques phrases, ou cliquez sur **« Détecter »**. La détection se fait automatiquement toutes les ~10 secondes pendant l'écoute.

---

## Évolutions possibles (déjà prévues dans l'architecture)

- Brancher un service de **transcription payant** (meilleure précision québécoise, captation des deux côtés d'un appel au casque).
- Sauvegarde de l'historique des rencontres.
- Profils clients pour des directions encore plus personnalisées.
