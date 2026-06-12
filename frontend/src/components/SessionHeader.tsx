import type { StatutSession } from "../hooks/useSession";

interface Props {
  statut: StatutSession;
  secondes: number;
}

function format(secondes: number): string {
  const m = Math.floor(secondes / 60).toString().padStart(2, "0");
  const s = (secondes % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const ETIQUETTES: Record<StatutSession, string> = {
  inactif: "Inactif",
  connexion: "Connexion…",
  ecoute: "Écoute active",
  erreur: "Erreur",
};

export function SessionHeader({ statut, secondes }: Props) {
  return (
    <header className="entete">
      <div className={`indic indic-${statut}`}>
        <span className="point" />
        {ETIQUETTES[statut]}
      </div>
      <div className="chrono">{format(secondes)}</div>
      <div className="marque">GC Groupe Conseil</div>
    </header>
  );
}
