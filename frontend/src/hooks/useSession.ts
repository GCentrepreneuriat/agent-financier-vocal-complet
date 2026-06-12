// Hook de session : capture audio (micro + audio d'appel optionnel),
// streaming PCM vers le backend, réception de la transcription temps réel
// ET des suggestions (fiche d'expert) générées par l'agent.
import { useCallback, useEffect, useRef, useState } from "react";
import { BACKEND_WS } from "../lib/config";

export type StatutSession = "inactif" | "connexion" | "ecoute" | "erreur";

export interface FicheExpert {
  titre?: string;
  categorie?: string;
  points_cles?: string[];
  question_relance?: string | null;
  a_eviter?: string | null;
}

// Une fiche affichée = une suggestion + son heure d'arrivée (pour l'historique).
export interface FicheAffichee {
  id: number;
  fiche: FicheExpert;
  sujet: string;
  heure: string;
}

interface MessageBackend {
  type: "pret" | "transcript" | "erreur" | "suggestion" | "silence" | "analyse";
  texte?: string;
  final?: boolean;
  message?: string;
  suggestion?: FicheExpert;
  categorie?: string;
  sujet?: string;
  actif?: boolean;
}

export function useSession() {
  const [statut, setStatut] = useState<StatutSession>("inactif");
  const [transcription, setTranscription] = useState("");
  const [partiel, setPartiel] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [secondes, setSecondes] = useState(0);

  // Phase 2 : suggestions (historique empilé, la plus récente en haut)
  const [fiches, setFiches] = useState<FicheAffichee[]>([]);
  const [analyseActive, setAnalyseActive] = useState(false);
  const compteurRef = useRef(0);

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
    setAnalyseActive(false);
    majStatut("inactif");
  }, []);

  const demarrer = useCallback(
    async (capterAppel: boolean) => {
      setErreur(null);
      finalRef.current = "";
      setTranscription("");
      setPartiel("");
      setSecondes(0);
      setFiches([]);
      compteurRef.current = 0;
      setAnalyseActive(false);
      majStatut("connexion");

      try {
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

        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        ctxRef.current = ctx;
        const muet = ctx.createGain();
        muet.gain.value = 0;
        muet.connect(ctx.destination);

        const proc = ctx.createScriptProcessor(4096, 1, 1);
        procRef.current = proc;
        ctx.createMediaStreamSource(micro).connect(proc);
        if (appel && appel.getAudioTracks().length > 0) {
          ctx.createMediaStreamSource(appel).connect(proc);
        }
        proc.connect(muet);

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
          switch (msg.type) {
            case "transcript":
              if (!msg.texte) break;
              if (msg.final) {
                finalRef.current = (finalRef.current + " " + msg.texte).replace(/\s+/g, " ").trim();
                setTranscription(finalRef.current);
                setPartiel("");
              } else {
                setPartiel(msg.texte);
              }
              break;
            case "suggestion":
              if (msg.suggestion) {
                const heure = new Date().toLocaleTimeString("fr-CA", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                });
                const item: FicheAffichee = {
                  id: ++compteurRef.current,
                  fiche: msg.suggestion,
                  sujet: msg.sujet || "",
                  heure,
                };
                // On empile : la nouvelle en haut, on garde les précédentes (max 50).
                setFiches((prev) => [item, ...prev].slice(0, 50));
              }
              break;
            case "analyse":
              setAnalyseActive(!!msg.actif);
              break;
            case "silence":
              // Mode silence : on garde la dernière fiche affichée, rien de neuf.
              break;
            case "erreur":
              setErreur(msg.message || "Erreur.");
              break;
          }
        };

        ws.onerror = () => setErreur("Connexion au serveur interrompue.");
        ws.onclose = () => {
          if (statutRef.current === "ecoute") arreter();
        };

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

  useEffect(() => () => arreter(), [arreter]);

  return {
    statut,
    transcription,
    partiel,
    erreur,
    secondes,
    fiches,
    analyseActive,
    demarrer,
    arreter,
  };
}
