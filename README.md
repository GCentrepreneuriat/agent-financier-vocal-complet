# Agent financier — temps réel

Application web temps réel qui assiste un conseiller en sécurité financière québécois pendant ses rencontres clients. Architecture **monorepo** :

```
/backend     Node.js + Express + WebSocket + Deepgram (transcription temps réel)
/frontend    React (Vite) + TypeScript — interface conseiller
```

> 🚧 **Construction par phases.** Voir la roadmap dans le cahier de charges.
> **Phase actuelle : Phase 2 — suggestions temps réel (détection Haiku → fiche d'expert Sonnet, avec mode silence).**

---

## Prérequis (une seule fois)

- **Node.js 20+** : https://nodejs.org/ (version LTS)
- Une **clé Deepgram** : https://console.deepgram.com/ (crédit d'essai gratuit)
- *(Phase 2+)* une **clé Anthropic** : https://console.anthropic.com/

## Installation

À la racine du projet :

```bash
npm install
```

Cette commande installe automatiquement les dépendances du **backend** et du **frontend**.

## Configuration

Crée le fichier de clés du backend :

```bash
cp backend/.env.example backend/.env
```

Puis ouvre `backend/.env` et remplis :

```
DEEPGRAM_API_KEY=ta-cle-deepgram
ANTHROPIC_API_KEY=ta-cle-anthropic
```

*(Sans `ANTHROPIC_API_KEY`, la transcription fonctionne mais les suggestions sont désactivées.)*

## Lancer (développement)

```bash
npm run dev
```

- **Backend** : http://localhost:3001
- **Frontend** : http://localhost:5173 ← **ouvre cette adresse dans Chrome/Edge**

*(Tu peux aussi lancer séparément : `npm run dev:backend` et `npm run dev:frontend` dans deux terminaux.)*

---

## Utilisation (Phase 2)

1. Ouvre **http://localhost:5173**
2. Clique **« Démarrer la session »** et autorise le microphone
3. La transcription s'affiche en temps réel (colonne de gauche)
4. Quand un élément utile est détecté (objection, question, opportunité…), une **fiche d'expert** apparaît à droite : points clés, question à poser, piège à éviter
5. **Mode silence** : tant que rien d'utile ne se dit, aucune suggestion n'est poussée
6. En visio : coche **« Capter aussi l'audio de l'appel »** pour capter les deux interlocuteurs

### Comment ça marche (pipeline)

```
Audio → Deepgram (transcription) → Détection (Claude Haiku, rapide/économe)
      → si pertinent → Orchestrateur (Claude Sonnet) → Fiche d'expert à l'écran
```

---

## Mettre en ligne (app web installable)

L'app se déploie comme **un seul service** (le backend sert l'interface, l'API et le WebSocket) sur **Render** (https://render.com — plan gratuit). Une fois en ligne : une adresse web, protégée par mot de passe, **installable** sur ordinateur et téléphone (PWA).

1. Pousser le code sur GitHub (déjà fait).
2. Sur Render : **New → Blueprint**, connecter ce dépôt et choisir la branche. Render lit `render.yaml`.
3. Renseigner les variables (onglet **Environment**) :
   - `DEEPGRAM_API_KEY` — ta clé Deepgram
   - `ANTHROPIC_API_KEY` — ta clé Anthropic
   - `APP_PASSWORD` — **le mot de passe de ton choix** pour accéder à l'app
   - `AUTH_SECRET` — généré automatiquement
4. Déployer. Render fournit une adresse `https://...onrender.com`.
5. Ouvre l'adresse, entre ton mot de passe, puis **« Installer l'application »** (Chrome/Edge : icône dans la barre d'adresse) pour l'avoir comme une vraie app.

> Plan gratuit : le service se met en veille après ~15 min d'inactivité (réveil en ~30 s au prochain accès). Pour un démarrage instantané, passer au plan payant (~7 $/mois).

Chaque `git push` sur la branche redéploie automatiquement l'app en ligne.

## Notes techniques (Phase 1)

- **Audio** : capture via Web Audio en **PCM brut (linear16)** envoyé au backend par WebSocket. *(Choix volontaire vs `MediaRecorder` du cahier de charges : le PCM brut est plus fiable pour le streaming Deepgram — éprouvé et fonctionnel. À confirmer.)*
- **Deepgram** : modèle et langue configurables dans `backend/.env` (`DEEPGRAM_MODEL`, `DEEPGRAM_LANG`). Par défaut `nova-3` / `fr-CA` (conforme au cahier de charges). Si une erreur de langue apparaît, basculer sur `nova-2` (éprouvé).
- La clé Deepgram **reste sur le serveur**, jamais exposée au navigateur.

## Variables d'environnement (backend/.env)

| Variable            | Rôle                                        | Défaut                  |
| ------------------- | ------------------------------------------- | ----------------------- |
| `DEEPGRAM_API_KEY`  | Clé Deepgram (obligatoire)                  | —                       |
| `ANTHROPIC_API_KEY` | Clé Anthropic (Phase 2+)                    | —                       |
| `DEEPGRAM_MODEL`    | `nova-3` ou `nova-2`                        | `nova-3`                |
| `DEEPGRAM_LANG`     | `fr-CA` ou `fr`                             | `fr-CA`                 |
| `PORT`              | Port du backend                             | `3001`                  |
| `CORS_ORIGIN`       | Origine du frontend en dev                  | `http://localhost:5173` |
