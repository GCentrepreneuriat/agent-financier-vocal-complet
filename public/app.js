// ============================================================
//  Agent financier vocal — logique navigateur
//  - Ecoute le micro (Web Speech API, fr-CA) -> transcription auto
//  - Detecte automatiquement les SUJETS abordes
//  - Un bouton "Generer" par sujet -> information verifiee en direct
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

  // ---------- Etat ----------
  let reconnaissance = null;
  let enEcoute = false;
  let generationEnCours = false;
  let texteFinalise = elTranscription.value || "";

  // Sujets detectes (cle normalisee -> { titre, categorie, nouveau })
  const sujets = new Map();
  // Detection auto
  let detectionEnCours = false;
  let dernierLongueurDetectee = 0;
  let minuterieDetection = null;

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
    };

    r.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        afficherErreur(
          "Acces au micro refuse. Autorisez le microphone dans le navigateur, puis reessayez."
        );
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

  function demarrerEcoute() {
    masquerErreur();
    if (!SR) {
      afficherErreur(
        "Votre navigateur ne supporte pas la reconnaissance vocale. Utilisez Google Chrome ou Microsoft Edge (ordinateur). Vous pouvez aussi taper ou coller la transcription."
      );
      return;
    }
    if (!reconnaissance) reconnaissance = initReconnaissance();
    texteFinalise = elTranscription.value ? elTranscription.value.trim() + " " : "";
    try {
      reconnaissance.start();
    } catch (_) {}
    enEcoute = true;
    majInterfaceEcoute();
    demarrerDetectionAuto();
  }

  function arreterEcoute() {
    enEcoute = false;
    if (reconnaissance) {
      try {
        reconnaissance.stop();
      } catch (_) {}
    }
    elApercu.textContent = "";
    majInterfaceEcoute();
    arreterDetectionAuto();
    // Une derniere detection a l'arret pour capter ce qui vient d'etre dit.
    detecterSujets();
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
  function demarrerDetectionAuto() {
    if (minuterieDetection) return;
    // Premiere detection rapide apres le debut de l'ecoute.
    setTimeout(() => {
      if (enEcoute) detecterSujets();
    }, 3000);
    // Puis toutes les 6 s, des qu'un peu de nouveau texte est apparu.
    minuterieDetection = setInterval(() => {
      const longueur = elTranscription.value.trim().length;
      if (longueur > dernierLongueurDetectee + 60) {
        detecterSujets();
      }
    }, 6000);
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
      /* detection silencieuse : pas d'alerte si ca echoue */
    } finally {
      detectionEnCours = false;
      btnDetecter.disabled = false;
    }
  }

  function rendreSujets() {
    if (sujets.size === 0) {
      elListeSujets.innerHTML =
        '<div class="vide-mini">Aucun sujet detecte pour l\'instant…</div>';
      return;
    }
    let html = "";
    for (const [cle, s] of sujets) {
      html +=
        '<div class="sujet' +
        (s.nouveau ? " sujet-nouveau" : "") +
        '" data-cle="' +
        echapperAttr(cle) +
        '">' +
        '<div class="sujet-info">' +
        '<span class="sujet-titre">' +
        echapper(s.titre) +
        "</span>" +
        '<span class="sujet-cat">' +
        echapper(s.categorie) +
        "</span>" +
        "</div>" +
        '<button class="btn btn-generer" data-cle="' +
        echapperAttr(cle) +
        '">⚡ Generer</button>' +
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

  // ---------- Generation pour un sujet ----------
  async function genererPourSujet(titreSujet, cle) {
    if (generationEnCours) return;
    masquerErreur();
    const transcription = elTranscription.value.trim();

    // Marque le sujet choisi
    if (cle && sujets.has(cle)) sujets.get(cle).nouveau = false;
    elListeSujets.querySelectorAll(".sujet").forEach((el) => {
      el.classList.toggle("sujet-actif", el.getAttribute("data-cle") === cle);
      el.classList.remove("sujet-nouveau");
    });
    elListeSujets.querySelectorAll(".btn-generer").forEach((b) => (b.disabled = true));

    generationEnCours = true;
    elTitreInfo.textContent = "3. " + titreSujet;
    elStatutAnalyse.textContent = "Generation en cours…";
    elStatutAnalyse.className = "badge badge-travail";
    elResultat.innerHTML = "";

    let texteComplet = "";
    try {
      const reponse = await fetch("/api/generer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcription, sujet: titreSujet }),
      });

      if (!reponse.ok) {
        let msg = "Le serveur a refuse la requete.";
        try {
          const j = await reponse.json();
          if (j?.erreur) msg = j.erreur;
        } catch (_) {}
        throw new Error(msg);
      }

      const lecteur = reponse.body.getReader();
      const decodeur = new TextDecoder("utf-8");
      let tampon = "";

      while (true) {
        const { done, value } = await lecteur.read();
        if (done) break;
        tampon += decodeur.decode(value, { stream: true });
        const blocs = tampon.split("\n\n");
        tampon = blocs.pop() || "";

        for (const bloc of blocs) {
          const { evenement, donnees } = lireSSE(bloc);
          if (!evenement) continue;
          if (evenement === "texte" && donnees?.texte) {
            texteComplet += donnees.texte;
            rendreResultat(texteComplet, true);
          } else if (evenement === "statut" && donnees?.message) {
            elStatutAnalyse.textContent = donnees.message;
          } else if (evenement === "erreur") {
            const detail = donnees?.details ? " (" + donnees.details + ")" : "";
            throw new Error((donnees?.message || "Erreur de generation.") + detail);
          }
        }
      }

      rendreResultat(texteComplet, false);
      elStatutAnalyse.textContent = "Termine";
      elStatutAnalyse.className = "badge badge-fini";
    } catch (err) {
      console.error(err);
      afficherErreur(err.message || "Erreur pendant la generation.");
      elStatutAnalyse.textContent = "Erreur";
      elStatutAnalyse.className = "badge badge-erreur";
      if (!texteComplet) {
        elResultat.innerHTML =
          '<div class="vide"><p>La generation n\'a pas pu etre completee. Reessayez.</p></div>';
      }
    } finally {
      generationEnCours = false;
      elListeSujets.querySelectorAll(".btn-generer").forEach((b) => (b.disabled = false));
    }
  }

  function lireSSE(bloc) {
    let evenement = null;
    let donneesBrutes = "";
    for (const ligne of bloc.split("\n")) {
      if (ligne.startsWith("event:")) evenement = ligne.slice(6).trim();
      else if (ligne.startsWith("data:")) donneesBrutes += ligne.slice(5).trim();
    }
    let donnees = null;
    if (donneesBrutes) {
      try {
        donnees = JSON.parse(donneesBrutes);
      } catch (_) {}
    }
    return { evenement, donnees };
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
    t = t.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    t = t.replace(
      /(^|[\s(])(https?:\/\/[^\s)]+)/g,
      '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>'
    );
    t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    t = t.replace(/\[Confirme par source\]/gi, '<span class="certitude cert-confirme">Confirme</span>');
    t = t.replace(/\[A verifier\]/gi, '<span class="certitude cert-verifier">A verifier</span>');
    t = t.replace(/\[Estimation\]/gi, '<span class="certitude cert-estimation">Estimation</span>');
    return t;
  }

  function rendreResultat(markdown, enCours) {
    const lignes = markdown.split("\n");
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
    elResultat.innerHTML = html || '<div class="vide"><p>…</p></div>';
    elResultat.classList.toggle("curseur", !!enCours);
    elResultat.scrollTop = elResultat.scrollHeight;
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
    elResultat.innerHTML =
      '<div class="vide"><p>Choisissez un sujet detecte et cliquez sur <strong>Generer</strong>.</p></div>';
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
    if (!enEcoute) texteFinalise = elTranscription.value;
  });

  if (!SR) {
    elEtatEcoute.textContent = "Vocal indisponible";
    elEtatEcoute.className = "badge badge-erreur";
  }
})();
