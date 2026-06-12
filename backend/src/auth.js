// Authentification mono-utilisateur par mot de passe.
// Le jeton est dérivé du mot de passe + d'un secret serveur (sans état,
// survit aux redémarrages). Si APP_PASSWORD est vide, l'accès est libre.
import crypto from "crypto";
import { APP_PASSWORD, AUTH_SECRET } from "./config.js";

export const authActive = !!APP_PASSWORD;

export function jetonAttendu() {
  return crypto.createHash("sha256").update(`${APP_PASSWORD}:${AUTH_SECRET}`).digest("hex");
}

function comparer(a, b) {
  const ba = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

export function motDePasseValide(mdp) {
  if (!authActive) return true;
  return comparer(mdp, APP_PASSWORD);
}

export function jetonValide(jeton) {
  if (!authActive) return true;
  return comparer(jeton, jetonAttendu());
}
