// Gestion du jeton d'accès (mot de passe). Stocké dans le navigateur.
import { BACKEND_HTTP } from "./config";

const CLE = "agentToken";

export function getToken(): string {
  try {
    return localStorage.getItem(CLE) || "";
  } catch (_) {
    return "";
  }
}

export function setToken(t: string) {
  try {
    localStorage.setItem(CLE, t);
  } catch (_) {}
}

export function clearToken() {
  try {
    localStorage.removeItem(CLE);
  } catch (_) {}
}

export async function seConnecter(motDePasse: string): Promise<boolean> {
  const r = await fetch(`${BACKEND_HTTP}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ motDePasse }),
  });
  if (!r.ok) return false;
  const d = await r.json();
  if (d && d.token) {
    setToken(d.token);
    return true;
  }
  return false;
}
