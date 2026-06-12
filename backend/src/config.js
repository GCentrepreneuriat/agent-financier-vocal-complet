// Configuration centrale du backend. Charge le .env et expose les constantes.
// override: true => le backend/.env fait toujours foi, meme si une variable
// systeme (ex. PORT) existe deja sur la machine.
import dotenv from "dotenv";
dotenv.config({ override: true });

export const PORT = process.env.PORT || 3001;
export const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

export const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || "";
export const DEEPGRAM_MODEL = process.env.DEEPGRAM_MODEL || "nova-3";
export const DEEPGRAM_LANG = process.env.DEEPGRAM_LANG || "fr-CA";

export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

// Verifie au demarrage les cles requises pour la phase courante (Phase 1 = Deepgram).
export function verifierConfig() {
  const manquantes = [];
  if (!DEEPGRAM_API_KEY) manquantes.push("DEEPGRAM_API_KEY");
  return manquantes;
}
