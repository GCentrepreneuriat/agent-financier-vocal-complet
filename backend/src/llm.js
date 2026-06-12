// Accès aux modèles Claude (Anthropic). La clé reste côté serveur.
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY } from "./config.js";

export const anthropicDispo = !!ANTHROPIC_API_KEY;

const client = anthropicDispo ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

/**
 * Appelle un modèle Claude et renvoie le texte concaténé de la réponse.
 */
export async function appelerModele({ model, system, user, maxTokens = 600, sansReflexion = false }) {
  if (!client) throw new Error("Anthropic non configuré");
  const params = {
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  };
  // Pour la latence temps réel, on désactive la réflexion étendue.
  if (sansReflexion) params.thinking = { type: "disabled" };

  const res = await client.messages.create(params);
  let texte = "";
  for (const bloc of res.content) {
    if (bloc.type === "text") texte += bloc.text;
  }
  return texte;
}

/**
 * Extrait un objet JSON d'une réponse de modèle, en tolérant le texte autour
 * ou les blocs de code ```json. Renvoie null si rien d'exploitable.
 */
export function extraireJSON(texte) {
  if (!texte) return null;
  const debut = texte.indexOf("{");
  const fin = texte.lastIndexOf("}");
  if (debut === -1 || fin === -1 || fin <= debut) return null;
  try {
    return JSON.parse(texte.slice(debut, fin + 1));
  } catch (_) {
    return null;
  }
}
