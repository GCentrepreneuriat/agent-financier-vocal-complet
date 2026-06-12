import type { StatutSession } from "../hooks/useSession";

interface Props {
  statut: StatutSession;
  capterAppel: boolean;
  setCapterAppel: (v: boolean) => void;
  onDemarrer: () => void;
  onArreter: () => void;
}

export function Controls({ statut, capterAppel, setCapterAppel, onDemarrer, onArreter }: Props) {
  const actif = statut === "ecoute" || statut === "connexion";

  return (
    <div className="controles">
      {actif ? (
        <button className="btn btn-stop" onClick={onArreter}>
          ⏹ Arrêter la session
        </button>
      ) : (
        <button className="btn btn-start" onClick={onDemarrer}>
          🎙 Démarrer la session
        </button>
      )}

      <label className="case">
        <input
          type="checkbox"
          checked={capterAppel}
          disabled={actif}
          onChange={(e) => setCapterAppel(e.target.checked)}
        />
        Capter aussi l'audio de l'appel (partage d'onglet — visio au casque)
      </label>
    </div>
  );
}
