// ============================================================
//  Agent financier vocal — serveur
//  - Garde la cle Anthropic en securite (jamais envoyee au navigateur)
//  - Detecte automatiquement les SUJETS abordes dans la rencontre
//  - Sur demande (bouton par sujet), genere l'information verifiee
//    avec sources officielles, questions a poser et directions optimales
//  - Mode SANS streaming (plus fiable derriere antivirus / proxy Windows)
// ============================================================

import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { WebSocketServer, WebSocket } from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- Configuration ----------
const PORT = process.env.PORT || 3000;
const MODELE = process.env.MODELE || "claude-opus-4-8"; // mode Approfondi (qualite)
const MODELE_RAPIDE = process.env.MODELE_RAPIDE || "claude-sonnet-4-6"; // mode Rapide
const MODELE_DETECTION = process.env.MODELE_DETECTION || "claude-haiku-4-5"; // detection (rapide)
const EFFORT = process.env.EFFORT || "medium"; // effort du mode Approfondi
const API_KEY = process.env.ANTHROPIC_API_KEY;
const RECHERCHE_WEB = (process.env.RECHERCHE_WEB || "true").toLowerCase() !== "false";

// Transcription Deepgram (optionnelle). Si absente, on utilise le moteur gratuit du navigateur.
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || "";
const DEEPGRAM_MODEL = process.env.DEEPGRAM_MODEL || "nova-2";
const DEEPGRAM_LANG = process.env.DEEPGRAM_LANG || "fr-CA";

const MAX_CARACTERES_TRANSCRIPTION = 24000;
const MAX_CONTINUATIONS = 4;
const DELAI_REQUETE_MS = 120000; // securite par requete au modele

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

STYLE : francais quebecois professionnel, clair, concis, oriente action (le conseiller te lit en pleine rencontre). Reponds DIRECTEMENT avec les sections demandees, sans afficher de raisonnement, de brouillon ni de preambule.

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
  res.json({
    ok: true,
    modele: MODELE,
    detection: MODELE_DETECTION,
    rechercheWeb: RECHERCHE_WEB,
    deepgram: !!DEEPGRAM_API_KEY,
  });
});

function outilsRecherche(maxUses) {
  return [
    {
      type: "web_search_20260209",
      name: "web_search",
      max_uses: maxUses || 3,
      user_location: { type: "approximate", country: "CA", region: "Quebec" },
    },
  ];
}

function tronquer(transcription) {
  if (transcription.length > MAX_CARACTERES_TRANSCRIPTION) {
    return "[...debut de la rencontre tronque...]\n" + transcription.slice(-MAX_CARACTERES_TRANSCRIPTION);
  }
  return transcription;
}

function texteDesBlocs(reponse) {
  return (reponse.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
}

function messageErreur(err) {
  if (err?.status === 401) return "Cle API invalide. Verifie ANTHROPIC_API_KEY dans le fichier .env.";
  if (err?.status === 404) return "Modele introuvable. Verifie MODELE dans .env (ex: claude-opus-4-8 ou claude-sonnet-4-6).";
  if (err?.status === 429) return "Limite de requetes atteinte. Attends quelques secondes et reessaie.";
  if (err?.name === "APIConnectionTimeoutError") return "Le modele n'a pas repondu a temps. Reessaie, ou mets MODELE=claude-sonnet-4-6.";
  return "Une erreur est survenue.";
}

// ---------- Detection des sujets ----------
app.post("/api/sujets", async (req, res) => {
  const transcription = tronquer((req.body?.transcription || "").toString().trim());
  if (!transcription || transcription.length < 15) {
    return res.json({ sujets: [] });
  }

  try {
    const reponse = await anthropic.messages.create(
      {
        model: MODELE_DETECTION,
        max_tokens: 1024,
        system: CONSIGNE_DETECTION,
        messages: [
          { role: "user", content: "Transcription de la rencontre en cours :\n\n" + transcription + "\n\nRetourne le JSON des sujets." },
        ],
      },
      { timeout: 30000, maxRetries: 1 }
    );

    const texte = texteDesBlocs(reponse);
    let sujets = [];
    try {
      const debut = texte.indexOf("{");
      const fin = texte.lastIndexOf("}");
      if (debut !== -1 && fin !== -1) {
        const json = JSON.parse(texte.slice(debut, fin + 1));
        if (Array.isArray(json.sujets)) {
          sujets = json.sujets
            .filter((s) => s && s.titre)
            .map((s) => ({ titre: String(s.titre).trim().slice(0, 80), categorie: String(s.categorie || "Autre").trim() }))
            .slice(0, 8);
        }
      }
    } catch (_) {}
    res.json({ sujets });
  } catch (err) {
    console.error("[Erreur detection]", err?.status, err?.message);
    res.status(500).json({ sujets: [], erreur: messageErreur(err) });
  }
});

// ---------- Generation d'information pour UN sujet (SANS streaming) ----------
app.post("/api/generer", async (req, res) => {
  const transcription = tronquer((req.body?.transcription || "").toString().trim());
  const sujet = (req.body?.sujet || "").toString().trim().slice(0, 120);
  const approfondi = (req.body?.mode || "rapide") === "approfondi";
  if (!sujet) {
    return res.status(400).json({ erreur: "Aucun sujet fourni." });
  }

  // Profil selon le mode choisi par l'utilisateur :
  // - Rapide      : Sonnet, effort faible, pas de recherche web -> reponse rapide
  // - Approfondi  : Opus, effort moyen, recherche web -> sources verifiees, plus long
  const modele = approfondi ? MODELE : MODELE_RAPIDE;
  const effort = approfondi ? EFFORT : "low";
  const avecWebDefaut = approfondi && RECHERCHE_WEB;
  const maxTokens = approfondi ? 8000 : 5000;

  const messageUtilisateur =
    "SUJET A APPROFONDIR : " +
    sujet +
    "\n\nVoici la transcription (francais quebecois) de la rencontre en cours, comme contexte :\n\n" +
    "=== TRANSCRIPTION ===\n" +
    (transcription || "(transcription vide)") +
    "\n=== FIN ===\n\n" +
    "Donne l'information sur le sujet ci-dessus, avec les sections demandees.";

  async function lancer(avecOutils) {
    const messages = [{ role: "user", content: messageUtilisateur }];
    let texte = "";
    for (let i = 0; i < MAX_CONTINUATIONS; i++) {
      const params = {
        model: modele,
        max_tokens: maxTokens,
        thinking: { type: "disabled" },
        output_config: { effort },
        system: CONSIGNE_GENERATION,
        messages,
      };
      if (avecOutils) params.tools = outilsRecherche(approfondi ? 3 : 2);

      const reponse = await anthropic.messages.create(params, { timeout: DELAI_REQUETE_MS, maxRetries: 1 });
      texte += texteDesBlocs(reponse);
      if (reponse.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: reponse.content });
        continue;
      }
      break;
    }
    return texte.trim();
  }

  try {
    let texte = "";
    let sansRecherche = !avecWebDefaut;
    try {
      texte = await lancer(avecWebDefaut);
    } catch (err1) {
      console.error("[generer] echec 1er essai:", err1?.status, err1?.name, err1?.message);
      if (avecWebDefaut) {
        sansRecherche = true;
        texte = await lancer(false); // repli sans recherche web
      } else {
        throw err1;
      }
    }

    if (!texte) {
      return res.json({ erreur: "Aucune reponse generee. Reessaie." });
    }
    res.json({ texte, sansRecherche });
  } catch (err) {
    console.error("[Erreur generation]", err?.status, err?.name, err?.message);
    res.status(500).json({ erreur: messageErreur(err), details: err?.message || "" });
  }
});

const serveur = app.listen(PORT, () => {
  console.log(`\n  Agent financier vocal demarre.`);
  console.log(`  Ouvre Chrome/Edge sur : http://localhost:${PORT}`);
  console.log(`  Generation : ${MODELE}  |  Detection : ${MODELE_DETECTION}  |  Recherche web : ${RECHERCHE_WEB}`);
  console.log(`  Transcription : ${DEEPGRAM_API_KEY ? "Deepgram (" + DEEPGRAM_MODEL + ", " + DEEPGRAM_LANG + ")" : "moteur gratuit du navigateur"}\n`);
});

// ---------- Pont WebSocket : navigateur -> serveur -> Deepgram ----------
// L'audio (PCM brut) arrive du navigateur, on le relaie a Deepgram, et on
// renvoie les transcriptions. La cle Deepgram ne quitte jamais le serveur.
if (DEEPGRAM_API_KEY) {
  const wss = new WebSocketServer({ server: serveur, path: "/ws/transcription" });

  wss.on("connection", (client, req) => {
    let sr = "48000";
    try {
      sr = new URL(req.url, "http://localhost").searchParams.get("sr") || "48000";
    } catch (_) {}

    const urlDg =
      "wss://api.deepgram.com/v1/listen" +
      "?model=" + encodeURIComponent(DEEPGRAM_MODEL) +
      "&language=" + encodeURIComponent(DEEPGRAM_LANG) +
      "&encoding=linear16&sample_rate=" + encodeURIComponent(sr) +
      "&channels=1&smart_format=true&punctuate=true&interim_results=true&endpointing=300";

    const dg = new WebSocket(urlDg, { headers: { Authorization: "Token " + DEEPGRAM_API_KEY } });
    const fileAttente = [];
    let dgOuvert = false;

    dg.on("open", () => {
      dgOuvert = true;
      for (const b of fileAttente) dg.send(b);
      fileAttente.length = 0;
      try { client.send(JSON.stringify({ type: "pret" })); } catch (_) {}
    });

    dg.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        const alt = msg?.channel?.alternatives?.[0];
        const texte = alt?.transcript || "";
        if (texte) {
          client.send(JSON.stringify({ type: "transcript", texte, final: !!msg.is_final }));
        }
      } catch (_) {}
    });

    dg.on("error", (e) => {
      console.error("[Deepgram]", e?.message || e);
      try { client.send(JSON.stringify({ type: "erreur", message: "Connexion Deepgram impossible (verifie DEEPGRAM_API_KEY)." })); } catch (_) {}
    });

    dg.on("close", () => {
      try { client.close(); } catch (_) {}
    });

    // Deepgram ferme apres ~10 s sans audio : on garde la connexion vivante.
    const battement = setInterval(() => {
      if (dgOuvert && dg.readyState === WebSocket.OPEN) {
        try { dg.send(JSON.stringify({ type: "KeepAlive" })); } catch (_) {}
      }
    }, 7000);

    client.on("message", (data) => {
      if (dgOuvert && dg.readyState === WebSocket.OPEN) dg.send(data);
      else fileAttente.push(data);
    });

    client.on("close", () => {
      clearInterval(battement);
      try {
        if (dg.readyState === WebSocket.OPEN) {
          dg.send(JSON.stringify({ type: "CloseStream" }));
          dg.close();
        }
      } catch (_) {}
    });
  });

  console.log("  Pont de transcription Deepgram : actif (/ws/transcription)\n");
}
