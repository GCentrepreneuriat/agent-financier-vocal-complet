// ============================================================
//  Agent financier vocal — serveur
//  - Garde la cle Anthropic en securite (jamais envoyee au navigateur)
//  - Recoit la transcription de la rencontre
//  - Appelle Claude (Opus 4.8) AVEC recherche web sur sources officielles
//  - Renvoie l'analyse en streaming (SSE) : sujet, questions du client,
//    reponse verifiee + sources, questions a poser, directions optimales
// ============================================================

import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- Configuration ----------
const PORT = process.env.PORT || 3000;
const MODELE = process.env.MODELE || "claude-opus-4-8";
const EFFORT = process.env.EFFORT || "medium"; // low | medium | high
const API_KEY = process.env.ANTHROPIC_API_KEY;

// Limite de securite sur la longueur de la transcription envoyee au modele.
// On garde la portion la plus RECENTE de la rencontre (la plus pertinente).
const MAX_CARACTERES_TRANSCRIPTION = 24000;
// Nombre max de relances quand la recherche web atteint sa limite interne.
const MAX_CONTINUATIONS = 4;

if (!API_KEY) {
  console.error(
    "\n[ERREUR] La variable ANTHROPIC_API_KEY est absente.\n" +
      "  -> Copie le fichier .env.example en .env et mets ta cle Anthropic.\n"
  );
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: API_KEY });

// ---------- Consigne systeme (le « cerveau » de l'agent) ----------
const CONSIGNE_SYSTEME = `Tu es un assistant expert en services financiers qui ecoute une rencontre entre un conseiller et son client, au Quebec. La rencontre se deroule en francais quebecois (langage parle, abreviations, parfois imprecis).

Ta mission, quand le conseiller declenche l'analyse :
1. Comprendre le SUJET reel de la rencontre et la direction qu'elle prend.
2. Detecter les QUESTIONS posees par le client (explicites ou implicites).
3. Fournir de l'information EXACTE et VERIFIABLE sur le sujet.
4. Proposer des QUESTIONS PERTINENTES que le conseiller devrait poser.
5. Proposer des DIRECTIONS optimales a prendre avec ce client.

Domaines couverts : placements (REER, CELI, CELIAPP, REEE, FERR), assurances (vie, invalidite, maladies graves), prets et hypotheques, fiscalite (personnelle et corporative, fiscalite avancee, transfert de parts/actions, gel successoral, remuneration salaire vs dividende), structures corporatives, planification de la retraite (RRQ, PSV, SRG), succession et planification successorale.

REGLES DE VERACITE (essentielles) :
- Pour tout chiffre precis, plafond, taux, regle fiscale ou date qui peut changer d'une annee a l'autre, UTILISE l'outil de recherche web et cite des sources OFFICIELLES en priorite : Revenu Quebec, Agence du revenu du Canada (ARC), Autorite des marches financiers (AMF), Retraite Quebec, ministere des Finances, Educaloi, Chambre de la securite financiere.
- N'INVENTE JAMAIS un chiffre, un plafond ou une regle. Si tu n'es pas certain, dis-le clairement.
- Indique pour chaque element ton niveau de certitude : [Confirme par source], [A verifier] ou [Estimation].
- Sur les sujets tres pointus (fiscalite avancee, transfert de parts, structures corporatives), rappelle quand c'est pertinent qu'une validation par un fiscaliste, comptable (CPA) ou notaire est requise. Tu es une aide a la decision, pas un avis professionnel definitif.
- Indique l'annee de reference des chiffres (ex : « plafond CELI 2026 »).

STYLE :
- Reponds en francais quebecois professionnel, clair et concis. Va droit au but.
- Le conseiller lit ta reponse en pleine rencontre : priorise l'utile, pas le bavardage.
- Reponds TOUJOURS avec exactement ces sections, dans cet ordre, en utilisant ces titres exacts :

## Sujet detecte
(1 a 3 phrases : de quoi parle la rencontre et ou elle s'en va.)

## Questions du client
(Liste a puces des questions detectees. Si aucune question claire, ecris la principale preoccupation detectee.)

## Reponse verifiee
(L'information exacte sur le sujet, avec les niveaux de certitude [Confirme par source]/[A verifier]/[Estimation] et l'annee de reference des chiffres.)

## Questions a poser au client
(3 a 5 questions pertinentes et strategiques que le conseiller devrait poser maintenant.)

## Directions optimales
(2 a 4 pistes concretes et optimales a explorer avec ce client, avec une courte justification chacune.)

## Sources
(Liste des sources officielles utilisees, avec leurs liens. Si tu n'as pas utilise la recherche web, indique-le et invite a verifier les chiffres.)`;

// ---------- Application Express ----------
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

// Petite verification d'etat (utile pour diagnostiquer)
app.get("/api/sante", (req, res) => {
  res.json({ ok: true, modele: MODELE, effort: EFFORT });
});

// Outil de recherche web (sources a jour + citations automatiques)
const OUTILS = [
  {
    type: "web_search_20260209",
    name: "web_search",
    max_uses: 6,
    user_location: {
      type: "approximate",
      country: "CA",
      region: "Quebec",
    },
  },
];

function envoyerSSE(res, evenement, donnees) {
  res.write(`event: ${evenement}\n`);
  res.write(`data: ${JSON.stringify(donnees)}\n\n`);
}

// ---------- Endpoint principal : analyse de la rencontre ----------
app.post("/api/analyser", async (req, res) => {
  const transcriptionBrute = (req.body?.transcription || "").toString().trim();

  if (!transcriptionBrute) {
    return res
      .status(400)
      .json({ erreur: "La transcription est vide. Demarre l'ecoute d'abord." });
  }

  // On garde la portion la plus recente si c'est tres long.
  let transcription = transcriptionBrute;
  if (transcription.length > MAX_CARACTERES_TRANSCRIPTION) {
    transcription =
      "[...debut de la rencontre tronque...]\n" +
      transcription.slice(-MAX_CARACTERES_TRANSCRIPTION);
  }

  // En-tetes SSE (streaming vers le navigateur)
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const messages = [
    {
      role: "user",
      content:
        "Voici la transcription (francais quebecois) de la rencontre en cours. " +
        "Analyse-la et reponds avec les sections demandees.\n\n" +
        "=== TRANSCRIPTION ===\n" +
        transcription +
        "\n=== FIN ===",
    },
  ];

  let clientFerme = false;
  req.on("close", () => {
    clientFerme = true;
  });

  try {
    for (let i = 0; i < MAX_CONTINUATIONS && !clientFerme; i++) {
      const stream = anthropic.messages.stream({
        model: MODELE,
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        output_config: { effort: EFFORT },
        system: CONSIGNE_SYSTEME,
        tools: OUTILS,
        messages,
      });

      for await (const event of stream) {
        if (clientFerme) break;
        if (
          event.type === "content_block_start" &&
          event.content_block?.type === "server_tool_use"
        ) {
          envoyerSSE(res, "statut", {
            message: "Recherche de sources verifiees en cours...",
          });
        }
        if (
          event.type === "content_block_delta" &&
          event.delta?.type === "text_delta"
        ) {
          envoyerSSE(res, "texte", { texte: event.delta.text });
        }
      }

      const messageFinal = await stream.finalMessage();

      // La recherche web a atteint sa limite interne : on relance pour continuer.
      if (messageFinal.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: messageFinal.content });
        continue;
      }
      break;
    }

    if (!clientFerme) {
      envoyerSSE(res, "termine", { ok: true });
    }
  } catch (err) {
    console.error("[Erreur analyse]", err);
    if (!clientFerme) {
      const message =
        err?.status === 401
          ? "Cle API invalide. Verifie ANTHROPIC_API_KEY dans le fichier .env."
          : err?.status === 429
          ? "Limite de requetes atteinte. Attends quelques secondes et reessaie."
          : "Une erreur est survenue pendant l'analyse. Reessaie.";
      envoyerSSE(res, "erreur", { message });
    }
  } finally {
    if (!clientFerme) res.end();
  }
});

app.listen(PORT, () => {
  console.log(`\n  Agent financier vocal demarre.`);
  console.log(`  Ouvre ton navigateur (Chrome/Edge) sur : http://localhost:${PORT}`);
  console.log(`  Modele : ${MODELE}  |  Effort : ${EFFORT}\n`);
});
