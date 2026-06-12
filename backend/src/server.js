// Serveur backend — app unique : sert l'interface, l'API, le WebSocket temps réel.
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";
import {
  PORT,
  CORS_ORIGIN,
  PRODUCTION,
  DEEPGRAM_MODEL,
  DEEPGRAM_LANG,
  DETECTION_MODEL,
  ORCHESTRATEUR_MODEL,
  verifierConfig,
} from "./config.js";
import { brancherDeepgram } from "./deepgram.js";
import { AgentSession } from "./agent.js";
import { anthropicDispo } from "./llm.js";
import { authActive, motDePasseValide, jetonAttendu, jetonValide } from "./auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, "../../frontend/dist");

const app = express();
app.use(cors({ origin: PRODUCTION ? true : CORS_ORIGIN }));
app.use(express.json());

// État de santé
app.get("/api/sante", (req, res) => {
  const manquantes = verifierConfig();
  res.json({
    ok: manquantes.length === 0,
    phase: 2,
    auth: authActive,
    deepgram: { modele: DEEPGRAM_MODEL, langue: DEEPGRAM_LANG },
    anthropic: { actif: anthropicDispo, detection: DETECTION_MODEL, orchestrateur: ORCHESTRATEUR_MODEL },
    cles_manquantes: manquantes,
  });
});

// Connexion par mot de passe -> renvoie un jeton à réutiliser
app.post("/api/login", (req, res) => {
  const mdp = req.body && req.body.motDePasse;
  if (!motDePasseValide(mdp)) {
    return res.status(401).json({ erreur: "Mot de passe invalide." });
  }
  res.json({ token: jetonAttendu() });
});

// En production : servir l'interface React compilée (frontend/dist)
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  // Repli SPA pour toute route non-API
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(DIST, "index.html")));
}

const serveur = app.listen(PORT, () => {
  const manquantes = verifierConfig();
  console.log(`\n  [Backend] Agent financier — ${PRODUCTION ? "production" : "développement"}`);
  console.log(`  En ecoute sur http://localhost:${PORT}`);
  console.log(`  Deepgram : ${DEEPGRAM_MODEL} / ${DEEPGRAM_LANG}`);
  console.log(`  Suggestions : ${anthropicDispo ? `${DETECTION_MODEL} + ${ORCHESTRATEUR_MODEL}` : "désactivées (ANTHROPIC_API_KEY absente)"}`);
  console.log(`  Accès : ${authActive ? "protégé par mot de passe" : "libre (aucun mot de passe)"}`);
  if (manquantes.length) {
    console.log(`  ⚠️  Cles manquantes : ${manquantes.join(", ")}`);
  }
  console.log("");
});

// WebSocket : audio (binaire montant) + transcription & suggestions (JSON descendant)
const wss = new WebSocketServer({ server: serveur, path: "/audio" });

wss.on("connection", (clientWs, req) => {
  let sampleRate = 48000;
  let token = "";
  try {
    const params = new URL(req.url, "http://localhost").searchParams;
    const sr = params.get("sr");
    if (sr) sampleRate = parseInt(sr, 10);
    token = params.get("token") || "";
  } catch (_) {}

  // Authentification du flux temps réel
  if (!jetonValide(token)) {
    try {
      clientWs.send(JSON.stringify({ type: "erreur", message: "Authentification requise." }));
    } catch (_) {}
    clientWs.close(1008, "non autorise");
    return;
  }

  const agent = new AgentSession(clientWs);
  const pont = brancherDeepgram(clientWs, sampleRate, {
    onFinal: (texte) => agent.ajouterFinal(texte),
  });

  clientWs.on("message", (data, isBinary) => {
    if (isBinary) pont.onAudio(data);
  });

  const nettoyer = () => {
    pont.fermer();
    agent.arreter();
  };
  clientWs.on("close", nettoyer);
  clientWs.on("error", nettoyer);
});

console.log("  [Backend] WebSocket audio pret sur /audio");
