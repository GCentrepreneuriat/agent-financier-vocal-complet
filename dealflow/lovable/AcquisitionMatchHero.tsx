import { useEffect, useState } from "react";

const MATCHES = [
  { secteur: "Manufacturier", region: "Montérégie", prix: "1 650 000 $", match: 94 },
  { secteur: "Distribution", region: "Capitale-Nationale", prix: "850 000 $", match: 88 },
  { secteur: "Services pro", region: "Estrie", prix: "585 000 $", match: 82 },
  { secteur: "Construction", region: "Montréal", prix: "995 000 $", match: 79 },
];

const CHECKS = [
  "Dépendance au propriétaire",
  "Revenus récurrents",
  "Équipe en place",
  "Concentration client",
];

export default function AcquisitionMatchHero() {
  const [count, setCount] = useState(0);
  const [active, setActive] = useState(0);
  const [score, setScore] = useState(0);

  // Compteur d'opportunités -> 47
  useEffect(() => {
    const target = 47;
    const id = setInterval(() => {
      setCount((c) => (c + 1 >= target ? target : c + 1));
    }, 35);
    return () => clearInterval(id);
  }, []);

  // Rotation des correspondances
  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % MATCHES.length), 2800);
    return () => clearInterval(id);
  }, []);

  // Le score de compatibilité monte à chaque changement de carte
  useEffect(() => {
    const target = MATCHES[active].match;
    setScore(0);
    const id = setInterval(() => {
      setScore((s) => (s + 3 >= target ? target : s + 3));
    }, 18);
    return () => clearInterval(id);
  }, [active]);

  const deal = MATCHES[active];

  return (
    <div className="relative w-full max-w-md">
      {/* halo */}
      <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-tr from-emerald-500/20 via-transparent to-sky-500/10 blur-2xl" />

      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl ring-1 ring-white/5">
        {/* ligne de scan */}
        <div className="scanline pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent" />

        {/* entête */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium tracking-wide text-slate-300">
            Correspondance d'acquisition
          </span>
          <span className="flex items-center gap-1.5 text-xs text-emerald-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            En direct
          </span>
        </div>

        {/* votre recherche */}
        <div className="mt-4 flex flex-wrap gap-2">
          {["Manufacturier", "Montérégie", "1–3 M$"].map((chip) => (
            <span
              key={chip}
              className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-slate-300"
            >
              {chip}
            </span>
          ))}
        </div>

        {/* compteur */}
        <div className="mt-4">
          <div className="text-4xl font-semibold tabular-nums text-white">
            {count}
          </div>
          <div className="text-sm text-slate-400">opportunités correspondent à votre profil</div>
        </div>

        {/* correspondance qui défile */}
        <div key={active} className="dealcard mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white">{deal.secteur}</div>
              <div className="text-xs text-slate-400">{deal.region} · {deal.prix}</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold tabular-nums text-emerald-300">{score}%</div>
              <div className="text-xs text-slate-400">compatible</div>
            </div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-400 transition-all duration-500"
              style={{ width: `${score}%` }}
            />
          </div>
        </div>

        {/* ce qu'on vérifie */}
        <div className="mt-5 space-y-2">
          <div className="text-xs font-medium text-slate-300">Ce qu'on vérifie pour vous</div>
          {CHECKS.map((c, i) => (
            <div
              key={c}
              className="checkrow flex items-center gap-2 text-xs text-slate-300"
              style={{ animationDelay: `${i * 150}ms` }}
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                  <path
                    fillRule="evenodd"
                    d="M16.7 5.3a1 1 0 010 1.4l-7 7a1 1 0 01-1.4 0l-3-3a1 1 0 011.4-1.4l2.3 2.29 6.3-6.29a1 1 0 011.4 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
              {c}
            </div>
          ))}
        </div>

        <div className="mt-4 text-[10px] text-slate-500">
          Filtré pour éviter d'acheter une job · 8 sources agrégées
        </div>
      </div>

      <style>{`
        @keyframes scan { 0% { transform: translateY(0); opacity: 0 } 10% { opacity: 1 } 100% { transform: translateY(440px); opacity: 0 } }
        .scanline { animation: scan 4s ease-in-out infinite; }
        @keyframes dealin { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        .dealcard { animation: dealin .5s ease-out; }
        @keyframes checkin { from { opacity: 0; transform: translateX(-6px) } to { opacity: 1; transform: translateX(0) } }
        .checkrow { animation: checkin .5s ease-out both; }
      `}</style>
    </div>
  );
}
