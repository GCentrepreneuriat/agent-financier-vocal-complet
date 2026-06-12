// Serveur backend — Phase 1 : audio + transcription temps reel.
// HTTP (Express) pour l'etat de sante + WebSocket (/audio) pour le flux audio.
import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import { PORT, CORS_ORIGIN, DEEPGRAM_MODEL, DEEPGRAM_LANG, verifierConfig } from "./config.js";
import { brancherDeepgram } from "./deepgram.js";

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

app.get("/api/sante", (req, res) => {
  const manquantes = verifierConfig();
  res.json({
    ok: manquantes.length === 0,
    phase: 1,
    deepgram: { modele: DEEPGRAM_MODEL, langue: DEEPGRAM_LANG },
    cles_manquantes: manquantes,
  });
});

const serveur = app.listen(PORT, () => {
  const manquantes = verifierConfig();
  console.log(`\n  [Backend] Agent financier — Phase 1`);
  console.log(`  En ecoute sur http://localhost:${PORT}`);
  console.log(`  Deepgram : ${DEEPGRAM_MODEL} / ${DEEPGRAM_LANG}`);
  if (manquantes.length) {
    console.log(`  ⚠️  Cles manquantes dans backend/.env : ${manquantes.join(", ")}`);
  }
  console.log("");
});

// WebSocket : flux audio (binaire, navigateur -> serveur) et transcription (JSON retour)
const wss = new WebSocketServer({ server: serveur, path: "/audio" });

wss.on("connection", (clientWs, req) => {
  let sampleRate = 48000;
  try {
    const sr = new URL(req.url, "http://localhost").searchParams.get("sr");
    if (sr) sampleRate = parseInt(sr, 10);
  } catch (_) {}

  const pont = brancherDeepgram(clientWs, sampleRate);

  clientWs.on("message", (data, isBinary) => {
    // Audio binaire -> Deepgram. (Les messages texte eventuels sont ignores en Phase 1.)
    if (isBinary) pont.onAudio(data);
  });

  clientWs.on("close", () => pont.fermer());
  clientWs.on("error", () => pont.fermer());
});

console.log("  [Backend] WebSocket audio pret sur /audio");
