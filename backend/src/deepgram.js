// Pont de transcription temps reel vers Deepgram.
// Le navigateur envoie de l'audio PCM brut (linear16) a notre serveur via
// WebSocket ; on le relaie a Deepgram et on renvoie les transcriptions.
// La cle Deepgram ne quitte JAMAIS le serveur.
import { WebSocket } from "ws";
import { DEEPGRAM_API_KEY, DEEPGRAM_MODEL, DEEPGRAM_LANG } from "./config.js";

/**
 * Branche un client navigateur (clientWs) a une session Deepgram.
 * @param {import('ws').WebSocket} clientWs  Connexion vers le navigateur
 * @param {number} sampleRate                Frequence d'echantillonnage de l'audio
 */
export function brancherDeepgram(clientWs, sampleRate) {
  const sr = Number.isFinite(sampleRate) && sampleRate > 0 ? Math.round(sampleRate) : 48000;

  const url =
    "wss://api.deepgram.com/v1/listen" +
    "?model=" + encodeURIComponent(DEEPGRAM_MODEL) +
    "&language=" + encodeURIComponent(DEEPGRAM_LANG) +
    "&encoding=linear16" +
    "&sample_rate=" + sr +
    "&channels=1" +
    "&smart_format=true" +
    "&punctuate=true" +
    "&interim_results=true" +
    "&endpointing=300";

  const dg = new WebSocket(url, { headers: { Authorization: "Token " + DEEPGRAM_API_KEY } });
  const fileAttente = [];
  let dgOuvert = false;

  const envoyerClient = (obj) => {
    try {
      if (clientWs.readyState === WebSocket.OPEN) clientWs.send(JSON.stringify(obj));
    } catch (_) {}
  };

  dg.on("open", () => {
    dgOuvert = true;
    for (const buf of fileAttente) dg.send(buf);
    fileAttente.length = 0;
    envoyerClient({ type: "pret" });
  });

  dg.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      const alt = msg?.channel?.alternatives?.[0];
      const texte = alt?.transcript || "";
      if (texte) {
        envoyerClient({ type: "transcript", texte, final: !!msg.is_final });
      }
    } catch (_) {}
  });

  dg.on("error", (e) => {
    console.error("[Deepgram] erreur :", e?.message || e);
    envoyerClient({
      type: "erreur",
      message: "Connexion Deepgram impossible. Verifie DEEPGRAM_API_KEY (et le modele/langue).",
    });
  });

  dg.on("close", (code) => {
    if (code && code !== 1000) {
      console.error("[Deepgram] fermeture inattendue, code", code);
    }
    try {
      if (clientWs.readyState === WebSocket.OPEN) clientWs.close();
    } catch (_) {}
  });

  // Deepgram ferme apres ~10 s sans audio : on garde la connexion vivante.
  const battement = setInterval(() => {
    if (dgOuvert && dg.readyState === WebSocket.OPEN) {
      try {
        dg.send(JSON.stringify({ type: "KeepAlive" }));
      } catch (_) {}
    }
  }, 7000);

  // Audio binaire venant du navigateur -> Deepgram
  const onAudio = (data) => {
    if (dgOuvert && dg.readyState === WebSocket.OPEN) dg.send(data);
    else fileAttente.push(data);
  };

  const fermer = () => {
    clearInterval(battement);
    try {
      if (dg.readyState === WebSocket.OPEN) {
        dg.send(JSON.stringify({ type: "CloseStream" }));
        dg.close();
      }
    } catch (_) {}
  };

  return { onAudio, fermer };
}
