interface Props {
  transcription: string;
  partiel: string;
  statut: string;
}

export function TranscriptionPanel({ transcription, partiel, statut }: Props) {
  const vide = !transcription && !partiel;

  return (
    <section className="panneau">
      <h2 className="panneau-titre">Transcription en direct</h2>
      <div className="transcription" aria-live="polite">
        {vide ? (
          <p className="vide">
            {statut === "ecoute"
              ? "En écoute… parlez, la transcription apparaîtra ici."
              : "Démarrez une session pour voir la transcription en temps réel."}
          </p>
        ) : (
          <p className="texte">
            {transcription}{" "}
            {partiel && <span className="partiel">{partiel}</span>}
          </p>
        )}
      </div>
    </section>
  );
}
