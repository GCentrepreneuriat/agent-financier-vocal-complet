import type { FicheAffichee } from "../hooks/useSession";

interface Props {
  fiches: FicheAffichee[];
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

export function ExpertCard({ fiches, analyseActive, statut }: Props) {
  return (
    <section className="fiche">
      <div className="fiche-entete">
        <h2 className="fiche-titre-section">
          Fiches d'expert {fiches.length > 0 && <span className="compteur">({fiches.length})</span>}
        </h2>
        {analyseActive && <span className="analyse-indic">Analyse…</span>}
      </div>

      {fiches.length === 0 ? (
        <div className="fiche-vide">
          {statut === "ecoute"
            ? "À l'écoute. Une suggestion apparaîtra dès qu'un élément utile est détecté."
            : "Les suggestions s'afficheront ici pendant la rencontre."}
        </div>
      ) : (
        <div className="fiche-liste">
          {fiches.map(({ id, fiche, sujet, heure }, index) => (
            <article key={id} className={`carte${index === 0 ? " carte-recente" : ""}`}>
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
                <span className="carte-heure">{heure}</span>
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
          ))}
        </div>
      )}
    </section>
  );
}
