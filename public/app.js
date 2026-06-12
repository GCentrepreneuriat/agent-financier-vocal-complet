// ============================================================
//  Agent financier vocal — logique navigateur
//  - Ecoute le micro (Web Speech API, fr-CA) -> transcription auto
//  - Detecte automatiquement les SUJETS abordes (en continu)
//  - Un bouton "Generer" par sujet -> information verifiee (mode simple)
// ============================================================

(() => {
  "use strict";

  // ---------- Elements ----------
  const elTranscription = document.getElementById("transcription");
  const elApercu = document.getElementById("apercu-temps-reel");
  const elResultat = document.getElementById("resultat");
  const elErreur = document.getElementById("message-erreur");
  const elEtatEcoute = document.getElementById("etat-ecoute");
  const elStatutAnalyse = document.getElementById("statut-analyse");
  const elPastille = document.getElementById("pastille-etat");
  const elListeSujets = document.getElementById("liste-sujets");
  const elTitreInfo = document.getElementById("titre-info");

  const btnEcoute = document.getElementById("btn-ecoute");
  const btnEffacer = document.getElementById("btn-effacer");
  const btnDetecter = document.getElementById("btn-detecter");
  const selMode = document.getElementById("mode-generation");
  const elModeTranscription = document.getElementById("mode-transcription");
  const blocCapterAppel = document.getElementById("bloc-capter-appel");
  const caseCapterAppel = document.getElementById("capter-appel");

  // ---------- Etat ----------
  let reconnaissance = null;
  let enEcoute = false;
  let generationEnCours = false;
  let texteFinalise = elTranscription.value || "";

  // Transcription : "deepgram" (si dispo cote serveur) ou "webspeech" (gratuit)
  let deepgramDispo = false;
  // Objets Deepgram (audio + WebSocket)
  let dgSocket = null;
  let dgAudioCtx = null;
  let dgProcesseur = null;
  let dgFlux = []; // MediaStreams a stopper a l'arret

  const sujets = new Map(); // cle normalisee -> { titre, categorie, nouveau }
  let detectionEnCours = false;
  let dernierLongueurDetectee = 0;
  let minuterieDetection = null;
  let minuterieSaisie = null;

  // ---------- Reconnaissance vocale ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  function initReconnaissance() {
    if (!SR) return null;
    const r = new SR();
    r.lang = "fr-CA";
    r.continuous = true;
    r.interimResults = true;

    r.onresult = (event) => {
      let provisoire = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const segment = event.results[i];
        const texte = segment[0].transcript;
        if (segment.isFinal) texteFinalise += texte.trim() + " ";
        else provisoire += texte;
      }
      texteFinalise = texteFinalise.replace(/\s+/g, " ");
      elTranscription.value = texteFinalise.trim();
      elApercu.textContent = provisoire ? "… " + provisoire : "";
      elTranscription.scrollTop = elTranscription.scrollHeight;
      planifierDetection(); // detection au fil de la parole
    };

    r.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        afficherErreur("Acces au micro refuse. Autorisez le microphone dans le navigateur, puis reessayez.");
        arreterEcoute();
      } else if (event.error === "network") {
        afficherErreur("Erreur reseau de la reconnaissance vocale. Verifiez votre connexion.");
      }
    };

    r.onend = () => {
      if (enEcoute) {
        try {
          r.start();
        } catch (_) {}
      }
    };
    return r;
  }

  // Dispatcher : Deepgram si disponible, sinon moteur gratuit du navigateur
  async function demarrerEcoute() {
    masquerErreur();
    texteFinalise = elTranscription.value ? elTranscription.value.trim() + " " : "";
    if (deepgramDispo) {
      const ok = await demarrerDeepgram();
      if (!ok) return;
    } else {
      if (!SR) {
        afficherErreur("Votre navigateur ne supporte pas la reconnaissance vocale. Utilisez Google Chrome ou Microsoft Edge (ordinateur). Vous pouvez aussi taper ou coller la transcription.");
        return;
      }
      if (!reconnaissance) reconnaissance = initReconnaissance();
      try {
        reconnaissance.start();
      } catch (_) {}
    }
    enEcoute = true;
    majInterfaceEcoute();
    demarrerDetectionAuto();
  }

  function arreterEcoute() {
    enEcoute = false;
    if (deepgramDispo) {
      arreterDeepgram();
    } else if (reconnaissance) {
      try {
        reconnaissance.stop();
      } catch (_) {}
    }
    elApercu.textContent = "";
    majInterfaceEcoute();
    arreterDetectionAuto();
    detecterSujets(); // une derniere detection a l'arret
  }

  // ---------- Moteur Deepgram (PCM brut via WebSocket) ----------
  async function demarrerDeepgram() {
    try {
      // 1) Micro (toujours) + audio de l'appel (optionnel)
      const fluxMicro = await navigator.mediaDevices.getUserMedia({ audio: true });
      dgFlux.push(fluxMicro);

      let fluxAppel = null;
      if (caseCapterAppel && caseCapterAppel.checked) {
        try {
          fluxAppel = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
          dgFlux.push(fluxAppel);
        } catch (_) {
          afficherErreur("Partage d'audio de l'appel annule. On continue avec le micro seulement.");
        }
      }

      // 2) Melange micro + appel via Web Audio
      dgAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const destinationMuette = dgAudioCtx.createGain();
      destinationMuette.gain.value = 0; // evite l'echo dans les haut-parleurs
      destinationMuette.connect(dgAudioCtx.destination);

      dgProcesseur = dgAudioCtx.createScriptProcessor(4096, 1, 1);
      dgAudioCtx.createMediaStreamSource(fluxMicro).connect(dgProcesseur);
      if (fluxAppel && fluxAppel.getAudioTracks().length > 0) {
        dgAudioCtx.createMediaStreamSource(fluxAppel).connect(dgProcesseur);
      }
      dgProcesseur.connect(destinationMuette);

      // 3) WebSocket vers notre serveur (qui relaie a Deepgram)
      const sr = Math.round(dgAudioCtx.sampleRate);
      const proto = location.protocol === "https:" ? "wss" : "ws";
      dgSocket = new WebSocket(`${proto}://${location.host}/ws/transcription?sr=${sr}`);
      dgSocket.binaryType = "arraybuffer";

      dgSocket.onmessage = (ev) => {
        let msg;
        try {
          msg = JSON.parse(ev.data);
        } catch (_) {
          return;
        }
        if (msg.type === "transcript" && msg.texte) {
          if (msg.final) {
            texteFinalise = (texteFinalise + " " + msg.texte).replace(/\s+/g, " ");
            elTranscription.value = texteFinalise.trim();
            elApercu.textContent = "";
            elTranscription.scrollTop = elTranscription.scrollHeight;
            planifierDetection();
          } else {
            elApercu.textContent = "… " + msg.texte;
          }
        } else if (msg.type === "erreur") {
          afficherErreur(msg.message || "Erreur de transcription.");
        }
      };
      dgSocket.onerror = () => afficherErreur("Connexion de transcription interrompue.");

      // 4) Envoi du PCM (Int16) quand l'audio arrive
      dgProcesseur.onaudioprocess = (e) => {
        if (!dgSocket || dgSocket.readyState !== WebSocket.OPEN) return;
        const entree = e.inputBuffer.getChannelData(0);
        const pcm = new Int16Array(entree.length);
        for (let i = 0; i < entree.length; i++) {
          let s = Math.max(-1, Math.min(1, entree[i]));
          pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        dgSocket.send(pcm.buffer);
      };

      // Si l'utilisateur arrete le partage d'onglet, on arrete proprement.
      if (fluxAppel) {
        fluxAppel.getVideoTracks().forEach((t) => (t.onended = () => arreterEcoute()));
      }
      return true;
    } catch (err) {
      console.error(err);
      afficherErreur("Acces au micro refuse ou indisponible. Autorisez le microphone, puis reessayez.");
      arreterDeepgram();
      return false;
    }
  }

  function arreterDeepgram() {
    try {
      if (dgProcesseur) {
        dgProcesseur.onaudioprocess = null;
        dgProcesseur.disconnect();
      }
    } catch (_) {}
    try {
      if (dgSocket && dgSocket.readyState === WebSocket.OPEN) dgSocket.close();
    } catch (_) {}
    try {
      if (dgAudioCtx) dgAudioCtx.close();
    } catch (_) {}
    for (const flux of dgFlux) {
      try {
        flux.getTracks().forEach((t) => t.stop());
      } catch (_) {}
    }
    dgFlux = [];
    dgProcesseur = null;
    dgSocket = null;
    dgAudioCtx = null;
  }

  function majInterfaceEcoute() {
    if (enEcoute) {
      btnEcoute.classList.add("ecoute-active");
      btnEcoute.innerHTML = '<span class="ico">&#9209;</span> Arreter l\'ecoute';
      elEtatEcoute.textContent = "En ecoute";
      elEtatEcoute.className = "badge badge-actif";
      elPastille.classList.add("actif");
    } else {
      btnEcoute.classList.remove("ecoute-active");
      btnEcoute.innerHTML = '<span class="ico">&#127908;</span> Demarrer l\'ecoute';
      elEtatEcoute.textContent = "Arrete";
      elEtatEcoute.className = "badge badge-gris";
      elPastille.classList.remove("actif");
    }
  }

  // ---------- Detection des sujets ----------
  function planifierDetection() {
    // Detecte ~1,5 s apres la derniere parole, si assez de nouveau texte.
    if (minuterieSaisie) clearTimeout(minuterieSaisie);
    minuterieSaisie = setTimeout(() => {
      if (elTranscription.value.trim().length > dernierLongueurDetectee + 35) {
        detecterSujets();
      }
    }, 1500);
  }

  function demarrerDetectionAuto() {
    if (minuterieDetection) return;
    setTimeout(() => {
      if (enEcoute) detecterSujets();
    }, 2000);
    minuterieDetection = setInterval(() => {
      if (elTranscription.value.trim().length > dernierLongueurDetectee + 35) {
        detecterSujets();
      }
    }, 4000);
  }

  function arreterDetectionAuto() {
    if (minuterieDetection) {
      clearInterval(minuterieDetection);
      minuterieDetection = null;
    }
  }

  function normaliser(titre) {
    return titre
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  async function detecterSujets() {
    const transcription = elTranscription.value.trim();
    if (detectionEnCours || transcription.length < 15) return;
    detectionEnCours = true;
    dernierLongueurDetectee = transcription.length;
    btnDetecter.disabled = true;
    btnDetecter.textContent = "⏳ Detection…";

    try {
      const reponse = await fetch("/api/sujets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcription }),
      });
      const data = await reponse.json();
      if (Array.isArray(data.sujets)) {
        let ajout = false;
        for (const s of data.sujets) {
          const cle = normaliser(s.titre);
          if (cle && !sujets.has(cle)) {
            sujets.set(cle, { titre: s.titre, categorie: s.categorie || "Autre", nouveau: true });
            ajout = true;
          }
        }
        if (ajout) rendreSujets();
      }
    } catch (_) {
      /* detection silencieuse */
    } finally {
      detectionEnCours = false;
      btnDetecter.disabled = false;
      btnDetecter.innerHTML = "&#128269; Detecter";
    }
  }

  function rendreSujets() {
    if (sujets.size === 0) {
      elListeSujets.innerHTML = '<div class="vide-mini">Aucun sujet detecte pour l\'instant…</div>';
      return;
    }
    let html = "";
    for (const [cle, s] of sujets) {
      html +=
        '<div class="sujet' + (s.nouveau ? " sujet-nouveau" : "") + '" data-cle="' + echapperAttr(cle) + '">' +
        '<div class="sujet-info">' +
        '<span class="sujet-titre">' + echapper(s.titre) + "</span>" +
        '<span class="sujet-cat">' + echapper(s.categorie) + "</span>" +
        "</div>" +
        '<button class="btn btn-generer" data-cle="' + echapperAttr(cle) + '">⚡ Generer</button>' +
        "</div>";
    }
    elListeSujets.innerHTML = html;
    elListeSujets.querySelectorAll(".btn-generer").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cle = btn.getAttribute("data-cle");
        const s = sujets.get(cle);
        if (s) genererPourSujet(s.titre, cle);
      });
    });
  }

  // ---------- Generation pour un sujet (mode simple, sans streaming) ----------
  async function genererPourSujet(titreSujet, cle) {
    if (generationEnCours) return;
    masquerErreur();
    const transcription = elTranscription.value.trim();

    if (cle && sujets.has(cle)) sujets.get(cle).nouveau = false;
    elListeSujets.querySelectorAll(".sujet").forEach((el) => {
      el.classList.toggle("sujet-actif", el.getAttribute("data-cle") === cle);
      el.classList.remove("sujet-nouveau");
    });
    elListeSujets.querySelectorAll(".btn-generer").forEach((b) => (b.disabled = true));

    generationEnCours = true;
    elTitreInfo.textContent = "3. " + titreSujet;
    elResultat.innerHTML = '<div class="vide"><p>Recherche d\'information en cours…</p></div>';
    elResultat.classList.add("curseur");

    // Statut anime pendant l'attente
    const messages = [
      "Analyse du sujet…",
      "Recherche d'information verifiee…",
      "Verification des sources…",
      "Redaction de la reponse…",
    ];
    let idx = 0;
    elStatutAnalyse.textContent = messages[0];
    elStatutAnalyse.className = "badge badge-travail";
    const minuterie = setInterval(() => {
      idx = (idx + 1) % messages.length;
      elStatutAnalyse.textContent = messages[idx];
    }, 3000);

    try {
      const mode = selMode ? selMode.value : "rapide";
      const reponse = await fetch("/api/generer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcription, sujet: titreSujet, mode }),
      });
      const data = await reponse.json().catch(() => ({}));

      if (!reponse.ok || data.erreur) {
        const detail = data.details ? " (" + data.details + ")" : "";
        throw new Error((data.erreur || "Le serveur a refuse la requete.") + detail);
      }

      rendreResultat(data.texte || "", false);
      elStatutAnalyse.textContent = data.sansRecherche ? "Termine (sans recherche web)" : "Termine";
      elStatutAnalyse.className = "badge badge-fini";
    } catch (err) {
      console.error(err);
      afficherErreur(err.message || "Erreur pendant la generation.");
      elStatutAnalyse.textContent = "Erreur";
      elStatutAnalyse.className = "badge badge-erreur";
      elResultat.innerHTML = '<div class="vide"><p>La generation n\'a pas pu etre completee. Reessayez.</p></div>';
    } finally {
      clearInterval(minuterie);
      elResultat.classList.remove("curseur");
      generationEnCours = false;
      elListeSujets.querySelectorAll(".btn-generer").forEach((b) => (b.disabled = false));
    }
  }

  // ---------- Rendu Markdown (leger, securitaire) ----------
  function echapper(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function echapperAttr(s) {
    return echapper(s).replace(/"/g, "&quot;");
  }

  function rendreLigneInline(texte) {
    let t = echapper(texte);
    t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    t = t.replace(/(^|[\s(])(https?:\/\/[^\s)]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
    t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    t = t.replace(/\[Confirme par source\]/gi, '<span class="certitude cert-confirme">Confirme</span>');
    t = t.replace(/\[A verifier\]/gi, '<span class="certitude cert-verifier">A verifier</span>');
    t = t.replace(/\[Estimation\]/gi, '<span class="certitude cert-estimation">Estimation</span>');
    return t;
  }

  function rendreResultat(markdown, enCours) {
    const lignes = String(markdown).split("\n");
    let html = "";
    let dansListe = false;
    const fermerListe = () => {
      if (dansListe) {
        html += "</ul>";
        dansListe = false;
      }
    };
    for (const ligne of lignes) {
      const sansEspace = ligne.trim();
      if (sansEspace.startsWith("### ")) {
        fermerListe();
        html += "<h4>" + rendreLigneInline(sansEspace.slice(4)) + "</h4>";
      } else if (sansEspace.startsWith("## ")) {
        fermerListe();
        html += "<h3>" + rendreLigneInline(sansEspace.slice(3)) + "</h3>";
      } else if (/^[-*•]\s+/.test(sansEspace)) {
        if (!dansListe) {
          html += "<ul>";
          dansListe = true;
        }
        html += "<li>" + rendreLigneInline(sansEspace.replace(/^[-*•]\s+/, "")) + "</li>";
      } else if (/^\d+\.\s+/.test(sansEspace)) {
        if (!dansListe) {
          html += "<ul>";
          dansListe = true;
        }
        html += "<li>" + rendreLigneInline(sansEspace.replace(/^\d+\.\s+/, "")) + "</li>";
      } else if (sansEspace === "") {
        fermerListe();
      } else {
        fermerListe();
        html += "<p>" + rendreLigneInline(sansEspace) + "</p>";
      }
    }
    fermerListe();
    elResultat.innerHTML = html || '<div class="vide"><p>Aucun contenu.</p></div>';
    elResultat.classList.toggle("curseur", !!enCours);
    elResultat.scrollTop = 0;
  }

  // ---------- UI utilitaires ----------
  function afficherErreur(msg) {
    elErreur.textContent = msg;
    elErreur.hidden = false;
  }
  function masquerErreur() {
    elErreur.hidden = true;
    elErreur.textContent = "";
  }

  function effacer() {
    if (generationEnCours) return;
    texteFinalise = "";
    elTranscription.value = "";
    elApercu.textContent = "";
    sujets.clear();
    dernierLongueurDetectee = 0;
    rendreSujets();
    elTitreInfo.textContent = "3. Information";
    elResultat.innerHTML = '<div class="vide"><p>Choisissez un sujet detecte et cliquez sur <strong>Generer</strong>.</p></div>';
    elStatutAnalyse.textContent = "En attente";
    elStatutAnalyse.className = "badge badge-gris";
    masquerErreur();
  }

  // ---------- Branchements ----------
  btnEcoute.addEventListener("click", () => {
    if (enEcoute) arreterEcoute();
    else demarrerEcoute();
  });
  btnEffacer.addEventListener("click", effacer);
  btnDetecter.addEventListener("click", detecterSujets);
  elTranscription.addEventListener("input", () => {
    if (!enEcoute) {
      texteFinalise = elTranscription.value;
      planifierDetection();
    }
  });

  // ---------- Initialisation : quel moteur de transcription ? ----------
  async function init() {
    try {
      const r = await fetch("/api/sante");
      const s = await r.json();
      deepgramDispo = !!s.deepgram;
    } catch (_) {}

    if (deepgramDispo) {
      elModeTranscription.textContent = "Transcription Pro";
      elModeTranscription.className = "badge badge-actif";
      if (blocCapterAppel) blocCapterAppel.hidden = false;
    } else {
      elModeTranscription.textContent = "Transcription gratuite";
      elModeTranscription.className = "badge badge-gris";
      if (!SR) {
        elEtatEcoute.textContent = "Vocal indisponible";
        elEtatEcoute.className = "badge badge-erreur";
      }
    }
  }

  init();
})();
