// Agent de session : suit la transcription, déclenche la détection (Haiku)
// puis l'orchestrateur (Sonnet), et pousse les suggestions au navigateur.
// Inclut le « mode silence » : aucune suggestion quand rien d'utile ne se dit.
import { appelerModele, extraireJSON, anthropicDispo } from "./llm.js";
import { DETECTION_MODEL, ORCHESTRATEUR_MODEL } from "./config.js";
import { PROMPT_DETECTION, PROMPT_ORCHESTRATEUR } from "./prompts.js";

const DELAI_ANALYSE_MS = 1400; // pause après le dernier segment avant d'analyser
const MIN_NOUVEAU_TEXTE = 25; // caractères nouveaux mini pour relancer une analyse
const FENETRE_CONTEXTE = 1400; // caractères récents transmis aux modèles

export class AgentSession {
  constructor(clientWs) {
    this.ws = clientWs;
    this.transcript = "";
    this.longueurAnalysee = 0;
    this.minuterie = null;
    this.enCours = false;
  }

  envoyer(obj) {
    try {
      if (this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
    } catch (_) {}
  }

  // Appelé à chaque segment final de transcription.
  ajouterFinal(texte) {
    if (!texte) return;
    this.transcript = (this.transcript + " " + texte).replace(/\s+/g, " ").trim();
    if (!anthropicDispo) return;
    if (this.minuterie) clearTimeout(this.minuterie);
    this.minuterie = setTimeout(() => this.analyser(), DELAI_ANALYSE_MS);
  }

  contexteRecent() {
    return this.transcript.slice(-FENETRE_CONTEXTE);
  }

  async analyser() {
    if (this.enCours) return;
    if (this.transcript.length - this.longueurAnalysee < MIN_NOUVEAU_TEXTE) return;

    this.enCours = true;
    this.longueurAnalysee = this.transcript.length;
    const contexte = this.contexteRecent();

    try {
      this.envoyer({ type: "analyse", actif: true });

      // 1) Détection rapide (Haiku)
      const detTexte = await appelerModele({
        model: DETECTION_MODEL,
        system: PROMPT_DETECTION,
        user:
          "Conversation récente (transcription brute, locuteurs mélangés) :\n" +
          `"""${contexte}"""\n\nRéponds en JSON.`,
        maxTokens: 200,
      });
      const det = extraireJSON(detTexte) || { pertinent: false };

      if (!det.pertinent) {
        this.envoyer({ type: "silence" });
        return;
      }

      // 2) Suggestion experte (Sonnet)
      const sugTexte = await appelerModele({
        model: ORCHESTRATEUR_MODEL,
        system: PROMPT_ORCHESTRATEUR,
        user:
          `Élément détecté : ${det.categorie || "?"} — ${det.sujet || ""}\n\n` +
          "Conversation récente :\n" +
          `"""${contexte}"""\n\nProduis la fiche d'expert en JSON.`,
        maxTokens: 700,
        sansReflexion: true,
      });
      const sug = extraireJSON(sugTexte);

      if (sug && (sug.titre || (Array.isArray(sug.points_cles) && sug.points_cles.length))) {
        this.envoyer({
          type: "suggestion",
          suggestion: sug,
          categorie: det.categorie,
          sujet: det.sujet,
          ts: Date.now(),
        });
      } else {
        this.envoyer({ type: "silence" });
      }
    } catch (e) {
      console.error("[Agent] analyse :", e?.message || e);
      this.envoyer({ type: "erreur", message: "Suggestion indisponible (vérifie ANTHROPIC_API_KEY)." });
    } finally {
      this.enCours = false;
      this.envoyer({ type: "analyse", actif: false });
    }
  }

  arreter() {
    if (this.minuterie) clearTimeout(this.minuterie);
    this.minuterie = null;
  }
}
