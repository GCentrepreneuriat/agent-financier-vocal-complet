# Agent financier — temps réel

Application web temps réel qui assiste un conseiller en sécurité financière québécois pendant ses rencontres clients. Architecture **monorepo** :

```
/backend     Node.js + Express + WebSocket + Deepgram (transcription temps réel)
/frontend    React (Vite) + TypeScript — interface conseiller
```

> 🚧 **Construction par phases.** Voir la roadmap dans le cahier de charges.
> **Phase actuelle : Phase 1 — MVP audio + transcription temps réel.**

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

Puis ouvre `backend/.env` et remplis au minimum :

```
DEEPGRAM_API_KEY=ta-cle-deepgram
```

## Lancer (développement)

```bash
npm run dev
```

- **Backend** : http://localhost:3001
- **Frontend** : http://localhost:5173 ← **ouvre cette adresse dans Chrome/Edge**

*(Tu peux aussi lancer séparément : `npm run dev:backend` et `npm run dev:frontend` dans deux terminaux.)*

---

## Utilisation (Phase 1)

1. Ouvre **http://localhost:5173**
2. Clique **« Démarrer la session »** et autorise le microphone
3. La transcription s'affiche en temps réel
4. En visio : coche **« Capter aussi l'audio de l'appel »** pour partager l'onglet de l'appel et capter les deux interlocuteurs

---

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
