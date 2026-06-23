import { useEffect, useState } from "react";

const PROFILS = [
  {
    secteur: "Manufacturier", region: "Montérégie", ca: "1,2 M$",
    baiiaDeclare: "180 k$", baiiaNorm: "235 k$", uplift: "+31 %",
    multiple: "5.9×", low: "1,2 M$", high: "1,5 M$", medPct: 52,
  },
  {
    secteur: "Restauration", region: "Montréal", ca: "900 k$",
    baiiaDeclare: "95 k$", baiiaNorm: "130 k$", uplift: "+37 %",
    multiple: "3.4×", low: "380 k$", high: "530 k$", medPct: 48,
  },
  {
    secteur: "Services pro", region: "Capitale-Nationale", ca: "750 k$",
    baiiaDeclare: "120 k$", baiiaNorm: "155 k$", uplift: "+29 %",
    multiple: "3.9×", low: "520 k$", high: "700 k$", medPct: 55,
  },
];

export default function VendreValeurHero() {
  const [active, setActive] = useState(0);
  const [fill, setFill] = useState(0);

  // Rotation des profils
  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % PROFILS.length), 3200);
    return () => clearInterval(id);
  }, []);

  // La barre de fourchette se remplit à chaque changement
  useEffect(() => {
    setFill(0);
    const id = setInterval(() => setFill((f) => (f + 4 >= 100 ? 100 : f + 4)), 18);
    return () => clearInterval(id);
  }, [active]);

  const p = PROFILS[active];

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
            Diagnostic de valeur
          </span>
          <span className="flex items-center gap-1.5 text-xs text-emerald-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            En direct
          </span>
        </div>

        {/* profil entreprise (chips) */}
        <div key={`chips-${active}`} className="dealcard mt-4 flex flex-wrap gap-2">
          {[p.secteur, p.region, `CA ${p.ca}`].map((chip) => (
            <span
              key={chip}
              className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-slate-300"
            >
              {chip}
            </span>
          ))}
        </div>

        {/* normalisation du BAIIA */}
        <div key={`norm-${active}`} className="dealcard mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-xs font-medium text-slate-300">Normalisation du BAIIA</div>
          <div className="mt-2 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">déclaré</div>
              <div className="text-sm font-medium text-slate-300 line-through decoration-slate-500">
                {p.baiiaDeclare}
              </div>
            </div>
            <span className="text-slate-500">→</span>
            <div className="text-right">
              <div className="text-xs text-slate-400">normalisé</div>
              <div className="text-lg font-semibold text-white">{p.baiiaNorm}</div>
            </div>
            <span className="rounded-md bg-emerald-400/10 px-2 py-0.5 text-xs font-medium text-emerald-300 ring-1 ring-emerald-400/30">
              {p.uplift}
            </span>
          </div>
        </div>

        {/* fourchette de valeur */}
        <div key={`val-${active}`} className="dealcard mt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-slate-300">Valeur estimée au marché</span>
            <span className="text-xs text-slate-400">{p.multiple} · {p.secteur}</span>
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-white">
            {p.low} <span className="text-slate-500">–</span> {p.high}
          </div>
          {/* barre de fourchette avec repère médian */}
          <div className="relative mt-3 h-2 rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400/70 to-sky-400/70 transition-all duration-300"
              style={{ width: `${fill}%` }}
            />
            <div
              className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 bg-white"
              style={{ left: `${p.medPct}%`, opacity: fill >= p.medPct ? 1 : 0 }}
            />
          </div>
        </div>

        <div className="mt-5 text-[10px] text-slate-500">
          Basé sur les transactions réelles de votre secteur · 8 sources agrégées
        </div>
      </div>

      <style>{`
        @keyframes scan { 0% { transform: translateY(0); opacity: 0 } 10% { opacity: 1 } 100% { transform: translateY(440px); opacity: 0 } }
        .scanline { animation: scan 4s ease-in-out infinite; }
        @keyframes dealin { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        .dealcard { animation: dealin .5s ease-out; }
      `}</style>
    </div>
  );
}
