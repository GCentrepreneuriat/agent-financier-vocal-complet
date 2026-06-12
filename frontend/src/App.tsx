import { useEffect, useState } from "react";
import { useSession } from "./hooks/useSession";
import { SessionHeader } from "./components/SessionHeader";
import { Controls } from "./components/Controls";
import { TranscriptionPanel } from "./components/TranscriptionPanel";
import { ExpertCard } from "./components/ExpertCard";
import { Login } from "./components/Login";
import { BACKEND_HTTP } from "./lib/config";
import { getToken } from "./lib/auth";

interface Sante {
  ok: boolean;
  cles_manquantes: string[];
  auth?: boolean;
  anthropic?: { actif: boolean };
}

export default function App() {
  const { statut, transcription, partiel, erreur, secondes, fiches, analyseActive, demarrer, arreter } =
    useSession();
  const [capterAppel, setCapterAppel] = useState(false);
  const [sante, setSante] = useState<Sante | null>(null);
  const [authOK, setAuthOK] = useState(false);

  // Verifie l'etat du backend au chargement (cles + auth)
  useEffect(() => {
    fetch(`${BACKEND_HTTP}/api/sante`)
      .then((r) => r.json())
      .then(setSante)
      .catch(() => setSante(null));
  }, []);

  // Décide si l'écran de connexion est nécessaire
  useEffect(() => {
    if (sante) {
      if (!sante.auth) setAuthOK(true);
      else if (getToken()) setAuthOK(true);
    }
  }, [sante]);

  // Écran de connexion (si accès protégé et pas encore authentifié)
  if (sante && sante.auth && !authOK) {
    return <Login onSucces={() => setAuthOK(true)} />;
  }

  return (
    <div className="app">
      <SessionHeader statut={statut} secondes={secondes} />

      <main className="contenu">
        {sante && sante.cles_manquantes.length > 0 && (
          <div className="alerte">
            Clé(s) manquante(s) dans <code>backend/.env</code> : {sante.cles_manquantes.join(", ")}.
            La transcription ne fonctionnera pas tant que ce n'est pas configuré.
          </div>
        )}
        {sante === null && (
          <div className="alerte">
            Impossible de joindre le backend. Vérifiez qu'il est démarré (port 3001).
          </div>
        )}
        {sante && sante.anthropic && !sante.anthropic.actif && (
          <div className="alerte">
            Suggestions désactivées : ajoutez <code>ANTHROPIC_API_KEY</code> dans <code>backend/.env</code>.
            La transcription fonctionne quand même.
          </div>
        )}
        {erreur && <div className="alerte alerte-erreur">{erreur}</div>}

        <Controls
          statut={statut}
          capterAppel={capterAppel}
          setCapterAppel={setCapterAppel}
          onDemarrer={() => demarrer(capterAppel)}
          onArreter={arreter}
        />

        <div className="grille">
          <TranscriptionPanel transcription={transcription} partiel={partiel} statut={statut} />
          <ExpertCard fiches={fiches} analyseActive={analyseActive} statut={statut} />
        </div>
      </main>

      <footer className="pied">
        Phase 2 — suggestions temps réel · à valider avant la suite
      </footer>
    </div>
  );
}
