// Hook de session : capture audio (micro + audio d'appel optionnel),
// streaming PCM vers le backend, reception de la transcription temps reel.
import { useCallback, useEffect, useRef, useState } from "react";
import { BACKEND_WS } from "../lib/config";

export type StatutSession = "inactif" | "connexion" | "ecoute" | "erreur";

interface MessageBackend {
  type: "pret" | "transcript" | "erreur";
  texte?: string;
  final?: boolean;
  message?: string;
}

export function useSession() {
  const [statut, setStatut] = useState<StatutSession>("inactif");
  const [transcription, setTranscription] = useState("");
  const [partiel, setPartiel] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [secondes, setSecondes] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const fluxRef = useRef<MediaStream[]>([]);
  const minuterieRef = useRef<number | null>(null);
  const finalRef = useRef("");
  const statutRef = useRef<StatutSession>("inactif");

  const majStatut = (s: StatutSession) => {
    statutRef.current = s;
    setStatut(s);
  };

  const arreter = useCallback(() => {
    if (minuterieRef.current) {
      clearInterval(minuterieRef.current);
      minuterieRef.current = null;
    }
    if (procRef.current) {
      procRef.current.onaudioprocess = null;
      try {
        procRef.current.disconnect();
      } catch (_) {}
      procRef.current = null;
    }
    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) wsRef.current.close();
      } catch (_) {}
      wsRef.current = null;
    }
    if (ctxRef.current) {
      try {
        ctxRef.current.close();
      } catch (_) {}
      ctxRef.current = null;
    }
    for (const flux of fluxRef.current) {
      try {
        flux.getTracks().forEach((t) => t.stop());
      } catch (_) {}
    }
    fluxRef.current = [];
    setPartiel("");
    majStatut("inactif");
  }, []);

  const demarrer = useCallback(
    async (capterAppel: boolean) => {
      setErreur(null);
      finalRef.current = "";
      setTranscription("");
      setPartiel("");
      setSecondes(0);
      majStatut("connexion");

      try {
        // 1) Micro (toujours) + audio de l'appel (optionnel, partage d'onglet)
        const micro = await navigator.mediaDevices.getUserMedia({ audio: true });
        fluxRef.current.push(micro);

        let appel: MediaStream | null = null;
        if (capterAppel) {
          try {
            appel = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            fluxRef.current.push(appel);
          } catch (_) {
            setErreur("Partage de l'audio d'appel annulé — on continue avec le micro seulement.");
          }
        }

        // 2) Melange via Web Audio, conversion en PCM
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        ctxRef.current = ctx;
        const muet = ctx.createGain();
        muet.gain.value = 0; // pas d'echo dans les haut-parleurs
        muet.connect(ctx.destination);

        const proc = ctx.createScriptProcessor(4096, 1, 1);
        procRef.current = proc;
        ctx.createMediaStreamSource(micro).connect(proc);
        if (appel && appel.getAudioTracks().length > 0) {
          ctx.createMediaStreamSource(appel).connect(proc);
        }
        proc.connect(muet);

        // 3) WebSocket vers le backend
        const sr = Math.round(ctx.sampleRate);
        const ws = new WebSocket(`${BACKEND_WS}/audio?sr=${sr}`);
        ws.binaryType = "arraybuffer";
        wsRef.current = ws;

        ws.onopen = () => {
          majStatut("ecoute");
          minuterieRef.current = window.setInterval(() => setSecondes((s) => s + 1), 1000);
        };

        ws.onmessage = (ev) => {
          let msg: MessageBackend;
          try {
            msg = JSON.parse(ev.data);
          } catch (_) {
            return;
          }
          if (msg.type === "transcript" && msg.texte) {
            if (msg.final) {
              finalRef.current = (finalRef.current + " " + msg.texte).replace(/\s+/g, " ").trim();
              setTranscription(finalRef.current);
              setPartiel("");
            } else {
              setPartiel(msg.texte);
            }
          } else if (msg.type === "erreur") {
            setErreur(msg.message || "Erreur de transcription.");
          }
        };

        ws.onerror = () => setErreur("Connexion au serveur interrompue.");
        ws.onclose = () => {
          if (statutRef.current === "ecoute") arreter();
        };

        // 4) Envoi du PCM (Int16) au fil de l'audio
        proc.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const entree = e.inputBuffer.getChannelData(0);
          const pcm = new Int16Array(entree.length);
          for (let i = 0; i < entree.length; i++) {
            const s = Math.max(-1, Math.min(1, entree[i]));
            pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          ws.send(pcm.buffer);
        };

        // Arret du partage d'onglet -> on arrete la session proprement
        if (appel) {
          appel.getVideoTracks().forEach((t) => (t.onended = () => arreter()));
        }
      } catch (err) {
        console.error(err);
        setErreur("Micro indisponible ou refusé. Autorise le microphone, puis réessaie.");
        majStatut("erreur");
        arreter();
      }
    },
    [arreter]
  );

  // Nettoyage si le composant est demonte
  useEffect(() => () => arreter(), [arreter]);

  return { statut, transcription, partiel, erreur, secondes, demarrer, arreter };
}
