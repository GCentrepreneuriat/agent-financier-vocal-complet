// ============================================================
//  Agent financier vocal — serveur
//  - Garde la cle Anthropic en securite (jamais envoyee au navigateur)
//  - Detecte automatiquement les SUJETS abordes dans la rencontre
//  - Sur demande (bouton par sujet), genere l'information verifiee
//    avec sources officielles, questions a poser et directions optimales
// ============================================================

import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- Configuration ----------
const PORT = process.env.PORT || 3000;
const MODELE = process.env.MODELE || "claude-opus-4-8"; // generation (qualite)
const MODELE_DETECTION = process.env.MODELE_DETECTION || "claude-haiku-4-5"; // detection (rapide)
const EFFORT = process.env.EFFORT || "medium"; // low | medium | high
const API_KEY = process.env.ANTHROPIC_API_KEY;
// Recherche web activee par defaut ; repli automatique si indisponible.
const RECHERCHE_WEB = (process.env.RECHERCHE_WEB || "true").toLowerCase() !== "false";

const MAX_CARACTERES_TRANSCRIPTION = 24000;
const MAX_CONTINUATIONS = 4;
const DELAI_MAX_MS = 180000; // securite : ne jamais rester bloque indefiniment

if (!API_KEY) {
  console.error(
    "\n[ERREUR] La variable ANTHROPIC_API_KEY est absente.\n" +
      "  -> Copie le fichier .env.example en .env et mets ta cle Anthropic.\n"
  );
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: API_KEY });

// ---------- Consignes systeme ----------
const CONSIGNE_DETECTION = `Tu analyses la transcription (francais quebecois, langage parle) d'une rencontre entre un conseiller financier et son client, au Quebec.

Identifie les SUJETS financiers CONCRETS reellement abordes ou en train d'etre abordes. Exemples de sujets : "Gel successoral", "Fiscalite entreprise agricole", "Cotisation REER", "Transfert d'actions", "Assurance vie", "Remuneration salaire vs dividende", "CELIAPP", "Planification de la retraite".

Regles :
- Donne des titres COURTS et precis (2 a 5 mots).
- Maximum 8 sujets, du plus pertinent au moins pertinent.
- Ignore le bavardage (meteo, politesses) : seulement les sujets financiers.
- Si rien de financier n'est encore clair, retourne une liste vide.

Reponds UNIQUEMENT avec du JSON valide, sans aucun texte autour, exactement dans ce format :
{"sujets":[{"titre":"...","categorie":"..."}]}
ou "categorie" est l'un de : Placements, Assurances, Fiscalite, Retraite, Succession, Corporatif, Prets, Autre.`;

const CONSIGNE_GENERATION = `Tu es un assistant expert en services financiers au Quebec. On te donne la transcription (francais quebecois) d'une rencontre conseiller-client, ainsi qu'UN sujet precis a approfondir. Tu fournis au conseiller, EN DIRECT pendant la rencontre, l'information utile sur ce sujet.

Domaines : placements (REER, CELI, CELIAPP, REEE, FERR), assurances, prets/hypotheques, fiscalite personnelle et corporative (fiscalite avancee, transfert de parts/actions, gel successoral, salaire vs dividende, fiscalite agricole), structures corporatives, retraite (RRQ, PSV, SRG), succession.

REGLES DE VERACITE :
- Pour tout chiffre, plafond, taux, regle fiscale ou date pouvant changer d'une annee a l'autre, UTILISE la recherche web et cite des sources OFFICIELLES en priorite : Revenu Quebec, Agence du revenu du Canada (ARC), Autorite des marches financiers (AMF), Retraite Quebec, ministere des Finances, Educaloi.
- N'INVENTE JAMAIS un chiffre ou une regle. Si incertain, dis-le.
- Indique le niveau de certitude de chaque element : [Confirme par source], [A verifier] ou [Estimation], et l'annee de reference des chiffres.
- Sur les sujets pointus (fiscalite avancee, transfert de parts, structures corporatives), rappelle qu'une validation par un fiscaliste, CPA ou notaire est requise. Tu es une aide a la decision, pas un avis professionnel definitif.

STYLE : francais quebecois professionnel, clair, concis, oriente action (le conseiller te lit en pleine rencontre).

Reponds TOUJOURS avec exactement ces sections, dans cet ordre, avec ces titres exacts :

## Reponse verifiee
(L'information exacte sur le sujet, avec niveaux de certitude et annee de reference.)

## Questions a poser au client
(3 a 5 questions strategiques et pertinentes pour ce sujet.)

## Directions optimales
(2 a 4 pistes concretes et optimales a explorer avec ce client sur ce sujet, avec une courte justification chacune.)

## Sources
(Sources officielles utilisees avec leurs liens. Si tu n'as pas pu utiliser la recherche web, indique-le clairement et invite a verifier les chiffres a la source.)`;

// ---------- Application ----------
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/sante", (req, res) => {
  res.json({ ok: true, modele: MODELE, detection: MODELE_DETECTION, rechercheWeb: RECHERCHE_WEB });
});

function outilsRecherche() {
  return [
    {
      type: "web_search_20260209",
      name: "web_search",
      max_uses: 5,
      user_location: { type: "approximate", country: "CA", region: "Quebec" },
    },
  ];
}

function envoyerSSE(res, evenement, donnees) {
  res.write(`event: ${evenement}\n`);
  res.write(`data: ${JSON.stringify(donnees)}\n\n`);
}

function tronquer(transcription) {
  if (transcription.length > MAX_CARACTERES_TRANSCRIPTION) {
    return (
      "[...debut de la rencontre tronque...]\n" +
      transcription.slice(-MAX_CARACTERES_TRANSCRIPTION)
    );
  }
  return transcription;
}

// ---------- Detection des sujets ----------
app.post("/api/sujets", async (req, res) => {
  const transcription = tronquer((req.body?.transcription || "").toString().trim());
  if (!transcription || transcription.length < 15) {
    return res.json({ sujets: [] });
  }

  try {
    const reponse = await anthropic.messages.create({
      model: MODELE_DETECTION,
      max_tokens: 1024,
      system: CONSIGNE_DETECTION,
      messages: [
        {
          role: "user",
          content:
            "Transcription de la rencontre en cours :\n\n" +
            transcription +
            "\n\nRetourne le JSON des sujets.",
        },
      ],
    });

    const texte = (reponse.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    let sujets = [];
    try {
      const debut = texte.indexOf("{");
      const fin = texte.lastIndexOf("}");
      if (debut !== -1 && fin !== -1) {
        const json = JSON.parse(texte.slice(debut, fin + 1));
        if (Array.isArray(json.sujets)) {
          sujets = json.sujets
            .filter((s) => s && s.titre)
            .map((s) => ({
              titre: String(s.titre).trim().slice(0, 80),
              categorie: String(s.categorie || "Autre").trim(),
            }))
            .slice(0, 8);
        }
      }
    } catch (_) {
      /* JSON imparfait : on renvoie une liste vide plutot que de planter */
    }

    res.json({ sujets });
  } catch (err) {
    console.error("[Erreur detection sujets]", err?.status, err?.message);
    res.status(500).json({
      sujets: [],
      erreur: err?.status === 401 ? "Cle API invalide." : "Detection impossible.",
    });
  }
});

// ---------- Generation d'information pour UN sujet ----------
app.post("/api/generer", async (req, res) => {
  const transcription = tronquer((req.body?.transcription || "").toString().trim());
  const sujet = (req.body?.sujet || "").toString().trim().slice(0, 120);

  if (!sujet) {
    return res.status(400).json({ erreur: "Aucun sujet fourni." });
  }

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  let clientFerme = false;
  req.on("close", () => {
    clientFerme = true;
  });

  // Maintien de connexion (evite les coupures sur les longues reponses)
  const battement = setInterval(() => {
    if (!clientFerme) res.write(": ping\n\n");
  }, 12000);

  // Securite : ne jamais rester bloque indefiniment
  let delaiDepasse = false;
  const minuterie = setTimeout(() => {
    delaiDepasse = true;
  }, DELAI_MAX_MS);

  const messageUtilisateur =
    "SUJET A APPROFONDIR : " +
    sujet +
    "\n\nVoici la transcription (francais quebecois) de la rencontre en cours, comme contexte :\n\n" +
    "=== TRANSCRIPTION ===\n" +
    (transcription || "(transcription vide)") +
    "\n=== FIN ===\n\n" +
    "Donne l'information sur le sujet ci-dessus, avec les sections demandees.";

  // Tente avec la recherche web ; en cas d'echec avant tout texte, repli sans outils.
  async function lancer(avecOutils) {
    const messages = [{ role: "user", content: messageUtilisateur }];
    let aEcrit = false;

    for (let i = 0; i < MAX_CONTINUATIONS && !clientFerme && !delaiDepasse; i++) {
      const params = {
        model: MODELE,
        max_tokens: 8000,
        thinking: { type: "adaptive" },
        output_config: { effort: EFFORT },
        system: CONSIGNE_GENERATION,
        messages,
      };
      if (avecOutils) params.tools = outilsRecherche();

      const stream = anthropic.messages.stream(params);

      for await (const event of stream) {
        if (clientFerme || delaiDepasse) break;
        if (
          event.type === "content_block_start" &&
          event.content_block?.type === "server_tool_use"
        ) {
          envoyerSSE(res, "statut", { message: "Recherche de sources verifiees..." });
        }
        if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
          aEcrit = true;
          envoyerSSE(res, "texte", { texte: event.delta.text });
        }
      }

      const messageFinal = await stream.finalMessage();
      if (messageFinal.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: messageFinal.content });
        continue;
      }
      break;
    }
    return aEcrit;
  }

  try {
    let aEcrit = false;
    try {
      aEcrit = await lancer(RECHERCHE_WEB);
    } catch (err1) {
      console.error("[generer] echec 1er essai:", err1?.status, err1?.message);
      // Repli : si la recherche web a echoue avant tout texte, on reessaie sans outils.
      if (RECHERCHE_WEB && !clientFerme && !delaiDepasse) {
        envoyerSSE(res, "statut", {
          message: "Recherche web indisponible — reponse basee sur les connaissances du modele.",
        });
        aEcrit = await lancer(false);
      } else {
        throw err1;
      }
    }

    if (delaiDepasse && !aEcrit) {
      envoyerSSE(res, "erreur", {
        message: "Le delai a ete depasse. Reessaie (ou mets MODELE=claude-sonnet-4-6 pour aller plus vite).",
      });
    } else if (!clientFerme) {
      envoyerSSE(res, "termine", { ok: true });
    }
  } catch (err) {
    console.error("[Erreur generation]", err?.status, err?.message, err);
    if (!clientFerme) {
      const base =
        err?.status === 401
          ? "Cle API invalide. Verifie ANTHROPIC_API_KEY dans le fichier .env."
          : err?.status === 404
          ? "Modele introuvable. Verifie MODELE dans .env (ex: claude-opus-4-8 ou claude-sonnet-4-6)."
          : err?.status === 429
          ? "Limite de requetes atteinte. Attends quelques secondes et reessaie."
          : "Une erreur est survenue pendant la generation.";
      envoyerSSE(res, "erreur", { message: base, details: err?.message || "" });
    }
  } finally {
    clearInterval(battement);
    clearTimeout(minuterie);
    if (!clientFerme) res.end();
  }
});

app.listen(PORT, () => {
  console.log(`\n  Agent financier vocal demarre.`);
  console.log(`  Ouvre Chrome/Edge sur : http://localhost:${PORT}`);
  console.log(`  Generation : ${MODELE}  |  Detection : ${MODELE_DETECTION}  |  Recherche web : ${RECHERCHE_WEB}\n`);
});
