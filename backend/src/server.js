// Serveur backend — Phase 2 : audio + transcription + suggestions temps réel.
// HTTP (Express) pour l'état de santé + WebSocket (/audio) pour le flux.
import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import {
  PORT,
  CORS_ORIGIN,
  DEEPGRAM_MODEL,
  DEEPGRAM_LANG,
  DETECTION_MODEL,
  ORCHESTRATEUR_MODEL,
  verifierConfig,
} from "./config.js";
import { brancherDeepgram } from "./deepgram.js";
import { AgentSession } from "./agent.js";
import { anthropicDispo } from "./llm.js";

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

app.get("/api/sante", (req, res) => {
  const manquantes = verifierConfig();
  res.json({
    ok: manquantes.length === 0,
    phase: 2,
    deepgram: { modele: DEEPGRAM_MODEL, langue: DEEPGRAM_LANG },
    anthropic: { actif: anthropicDispo, detection: DETECTION_MODEL, orchestrateur: ORCHESTRATEUR_MODEL },
    cles_manquantes: manquantes,
  });
});

const serveur = app.listen(PORT, () => {
  const manquantes = verifierConfig();
  console.log(`\n  [Backend] Agent financier — Phase 2`);
  console.log(`  En ecoute sur http://localhost:${PORT}`);
  console.log(`  Deepgram : ${DEEPGRAM_MODEL} / ${DEEPGRAM_LANG}`);
  console.log(`  Suggestions : ${anthropicDispo ? `${DETECTION_MODEL} + ${ORCHESTRATEUR_MODEL}` : "désactivées (ANTHROPIC_API_KEY absente)"}`);
  if (manquantes.length) {
    console.log(`  ⚠️  Cles manquantes dans backend/.env : ${manquantes.join(", ")}`);
  }
  console.log("");
});

// WebSocket : audio (binaire montant) + transcription & suggestions (JSON descendant)
const wss = new WebSocketServer({ server: serveur, path: "/audio" });

wss.on("connection", (clientWs, req) => {
  let sampleRate = 48000;
  try {
    const sr = new URL(req.url, "http://localhost").searchParams.get("sr");
    if (sr) sampleRate = parseInt(sr, 10);
  } catch (_) {}

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
