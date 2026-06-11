// ============================================================
//  Agent financier vocal — logique navigateur
//  - Ecoute le micro (Web Speech API, francais quebecois fr-CA)
//  - Accumule la transcription (modifiable par le conseiller)
//  - Sur « Executer », envoie au serveur et affiche l'analyse en direct
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

  const btnEcoute = document.getElementById("btn-ecoute");
  const btnEffacer = document.getElementById("btn-effacer");
  const btnExecuter = document.getElementById("btn-executer");

  // ---------- Etat ----------
  let reconnaissance = null;
  let enEcoute = false;
  let analyseEnCours = false;
  // Texte deja finalise (les segments confirmes), distinct de l'apercu provisoire.
  let texteFinalise = elTranscription.value || "";

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
        if (segment.isFinal) {
          texteFinalise += texte.trim() + " ";
        } else {
          provisoire += texte;
        }
      }
      // La transcription finalisee va dans la zone modifiable ;
      // le provisoire s'affiche en apercu pour ne pas « sauter ».
      texteFinalise = texteFinalise.replace(/\s+/g, " ");
      elTranscription.value = texteFinalise.trim();
      elApercu.textContent = provisoire ? "… " + provisoire : "";
      elTranscription.scrollTop = elTranscription.scrollHeight;
    };

    r.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        afficherErreur(
          "Acces au micro refuse. Autorisez le microphone dans votre navigateur, puis reessayez."
        );
        arreterEcoute();
      } else if (event.error === "network") {
        afficherErreur("Erreur reseau de la reconnaissance vocale. Verifiez votre connexion.");
      }
    };

    r.onend = () => {
      // Le navigateur coupe la reconnaissance periodiquement : on relance
      // automatiquement tant que le conseiller veut ecouter.
      if (enEcoute) {
        try {
          r.start();
        } catch (_) {
          /* deja en cours */
        }
      }
    };

    return r;
  }

  function demarrerEcoute() {
    masquerErreur();
    if (!SR) {
      afficherErreur(
        "Votre navigateur ne supporte pas la reconnaissance vocale. Utilisez Google Chrome ou Microsoft Edge (ordinateur). Vous pouvez aussi taper ou coller la transcription manuellement."
      );
      return;
    }
    if (!reconnaissance) reconnaissance = initReconnaissance();
    // On synchronise le texte finalise avec d'eventuelles corrections manuelles.
    texteFinalise = elTranscription.value ? elTranscription.value.trim() + " " : "";
    try {
      reconnaissance.start();
      enEcoute = true;
      majInterfaceEcoute();
    } catch (_) {
      // « start » deja appele : on force l'etat actif.
      enEcoute = true;
      majInterfaceEcoute();
    }
  }

  function arreterEcoute() {
    enEcoute = false;
    if (reconnaissance) {
      try {
        reconnaissance.stop();
      } catch (_) {
        /* ignore */
      }
    }
    elApercu.textContent = "";
    majInterfaceEcoute();
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

  // ---------- Analyse (appel serveur en streaming) ----------
  async function executerAnalyse() {
    if (analyseEnCours) return;
    masquerErreur();

    // Si l'utilisateur a corrige le texte a la main, on le prend tel quel.
    const transcription = elTranscription.value.trim();
    if (!transcription) {
      afficherErreur("Aucune transcription. Demarrez l'ecoute ou tapez du texte d'abord.");
      return;
    }

    analyseEnCours = true;
    btnExecuter.disabled = true;
    elStatutAnalyse.textContent = "Analyse en cours…";
    elStatutAnalyse.className = "badge badge-travail";
    elResultat.innerHTML = "";

    let texteComplet = "";

    try {
      const reponse = await fetch("/api/analyser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcription }),
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

        // Decoupage des messages SSE (separes par une ligne vide)
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
            throw new Error(donnees?.message || "Erreur d'analyse.");
          } else if (evenement === "termine") {
            // fin normale
          }
        }
      }

      rendreResultat(texteComplet, false);
      elStatutAnalyse.textContent = "Termine";
      elStatutAnalyse.className = "badge badge-fini";
    } catch (err) {
      console.error(err);
      afficherErreur(err.message || "Erreur pendant l'analyse.");
      elStatutAnalyse.textContent = "Erreur";
      elStatutAnalyse.className = "badge badge-erreur";
      if (!texteComplet) {
        elResultat.innerHTML =
          '<div class="vide"><p>L\'analyse n\'a pas pu etre completee. Reessayez.</p></div>';
      }
    } finally {
      analyseEnCours = false;
      btnExecuter.disabled = false;
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

  // ---------- Rendu Markdown (leger et securitaire) ----------
  function echapper(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function rendreLigneInline(texte) {
    let t = echapper(texte);
    // Liens [texte](url)
    t = t.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    // URLs nues
    t = t.replace(
      /(^|[\s(])(https?:\/\/[^\s)]+)/g,
      '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>'
    );
    // Gras **texte**
    t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    // Etiquettes de certitude
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
      const l = ligne.trimEnd();
      const sansEspace = l.trim();

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
    if (enCours) {
      elResultat.classList.add("curseur");
    } else {
      elResultat.classList.remove("curseur");
    }
    elResultat.scrollTop = elResultat.scrollHeight;
  }

  // ---------- Utilitaires UI ----------
  function afficherErreur(msg) {
    elErreur.textContent = msg;
    elErreur.hidden = false;
  }
  function masquerErreur() {
    elErreur.hidden = true;
    elErreur.textContent = "";
  }

  function effacer() {
    if (analyseEnCours) return;
    texteFinalise = "";
    elTranscription.value = "";
    elApercu.textContent = "";
    elResultat.innerHTML =
      '<div class="vide"><p>Cliquez sur <strong>Executer l\'analyse</strong> pour lancer l\'analyse.</p></div>';
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
  btnExecuter.addEventListener("click", executerAnalyse);

  // Si l'utilisateur tape pendant l'ecoute, on garde sa version comme base.
  elTranscription.addEventListener("input", () => {
    if (!enEcoute) texteFinalise = elTranscription.value;
  });

  // Avertissement si le navigateur ne supporte pas la reconnaissance vocale.
  if (!SR) {
    elEtatEcoute.textContent = "Vocal indisponible";
    elEtatEcoute.className = "badge badge-erreur";
  }
})();
