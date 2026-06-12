import { useState } from "react";
import { seConnecter } from "../lib/auth";

interface Props {
  onSucces: () => void;
}

export function Login({ onSucces }: Props) {
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);
    setChargement(true);
    try {
      const ok = await seConnecter(motDePasse);
      if (ok) onSucces();
      else setErreur("Mot de passe incorrect.");
    } catch (_) {
      setErreur("Impossible de joindre le serveur.");
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="login">
      <form className="login-carte" onSubmit={soumettre}>
        <div className="login-marque">GC Groupe Conseil</div>
        <h1 className="login-titre">Agent financier</h1>
        <p className="login-sous">Accès réservé — entre ton mot de passe.</p>
        <input
          className="login-champ"
          type="password"
          placeholder="Mot de passe"
          value={motDePasse}
          autoFocus
          onChange={(e) => setMotDePasse(e.target.value)}
        />
        {erreur && <div className="login-erreur">{erreur}</div>}
        <button className="btn btn-start" type="submit" disabled={chargement || !motDePasse}>
          {chargement ? "Connexion…" : "Entrer"}
        </button>
      </form>
    </div>
  );
}
