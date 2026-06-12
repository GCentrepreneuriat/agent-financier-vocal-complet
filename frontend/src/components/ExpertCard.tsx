import type { FicheExpert } from "../hooks/useSession";

interface Props {
  fiche: FicheExpert | null;
  sujet: string;
  analyseActive: boolean;
  statut: string;
}

const COULEURS: Record<string, string> = {
  objection: "#c0392b",
  question: "#2f80b8",
  opportunite: "#d98324",
  conformite: "#8e44ad",
  info: "#2f9e8f",
};

export function ExpertCard({ fiche, sujet, analyseActive, statut }: Props) {
  return (
    <section className="fiche">
      <div className="fiche-entete">
        <h2 className="fiche-titre-section">Fiche d'expert</h2>
        {analyseActive && <span className="analyse-indic">Analyse…</span>}
      </div>

      {!fiche ? (
        <div className="fiche-vide">
          {statut === "ecoute"
            ? "À l'écoute. Une suggestion apparaîtra dès qu'un élément utile est détecté."
            : "Les suggestions s'afficheront ici pendant la rencontre."}
        </div>
      ) : (
        <article className="carte">
          <header className="carte-tete">
            {fiche.categorie && (
              <span
                className="badge"
                style={{ background: COULEURS[fiche.categorie] || "#3a5161" }}
              >
                {fiche.categorie}
              </span>
            )}
            <h3 className="carte-titre">{fiche.titre || sujet || "Suggestion"}</h3>
          </header>

          {Array.isArray(fiche.points_cles) && fiche.points_cles.length > 0 && (
            <ul className="carte-points">
              {fiche.points_cles.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          )}

          {fiche.question_relance && (
            <div className="carte-bloc carte-question">
              <span className="carte-etiq">💬 À demander</span>
              <p>{fiche.question_relance}</p>
            </div>
          )}

          {fiche.a_eviter && (
            <div className="carte-bloc carte-eviter">
              <span className="carte-etiq">⚠️ À éviter</span>
              <p>{fiche.a_eviter}</p>
            </div>
          )}
        </article>
      )}
    </section>
  );
}
