import { useEffect, useState } from "react";

const DEALS = [
  { secteur: "Manufacturier", region: "Montérégie", prix: "1 650 000 $", badge: "5.9× BAIIA", verdict: "Multiple sain", tone: "emerald" },
  { secteur: "Restauration", region: "Montréal", prix: "395 000 $", badge: "0.40× ventes", verdict: "Dans le marché", tone: "sky" },
  { secteur: "Services pro", region: "Capitale-Nationale", prix: "585 000 $", badge: "3.9× BAIIA", verdict: "Récurrent", tone: "emerald" },
  { secteur: "Commerce détail", region: "Laval", prix: "350 000 $", badge: "4.1× BAIIA", verdict: "À surveiller", tone: "amber" },
  { secteur: "Construction", region: "Estrie", prix: "995 000 $", badge: "4.8× BAIIA", verdict: "Carnet solide", tone: "emerald" },
];

const MULTIPLES = [
  { label: "Manufacturier", val: 5.9, pct: 100 },
  { label: "Construction", val: 4.8, pct: 81 },
  { label: "Commerce détail", val: 4.1, pct: 69 },
  { label: "Services pro", val: 3.9, pct: 66 },
  { label: "Restauration", val: 3.4, pct: 58 },
];

const TONES: Record<string, string> = {
  emerald: "text-emerald-300 bg-emerald-400/10 ring-emerald-400/30",
  sky: "text-sky-300 bg-sky-400/10 ring-sky-400/30",
  amber: "text-amber-300 bg-amber-400/10 ring-amber-400/30",
};

export default function MarketIntelligenceHero() {
  const [count, setCount] = useState(0);
  const [active, setActive] = useState(0);

  // Compteur qui monte jusqu'à 1 114
  useEffect(() => {
    const target = 1114;
    const step = Math.ceil(target / 60);
    const id = setInterval(() => {
      setCount((c) => (c + step >= target ? target : c + step));
    }, 25);
    return () => clearInterval(id);
  }, []);

  // Rotation des annonces
  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % DEALS.length), 2600);
    return () => clearInterval(id);
  }, []);

  const deal = DEALS[active];

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
            Intelligence de marché
          </span>
          <span className="flex items-center gap-1.5 text-xs text-emerald-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            En direct
          </span>
        </div>

        {/* compteur */}
        <div className="mt-4">
          <div className="text-4xl font-semibold tabular-nums text-white">
            {count.toLocaleString("fr-CA")}
          </div>
          <div className="text-sm text-slate-400">entreprises analysées au Québec</div>
        </div>

        {/* annonce qui défile */}
        <div key={active} className="dealcard mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white">{deal.secteur}</div>
              <div className="text-xs text-slate-400">{deal.region}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-white">{deal.prix}</div>
              <div className="text-xs text-slate-400">prix demandé</div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className={`rounded-md px-2 py-0.5 text-xs font-medium ring-1 ${TONES[deal.tone]}`}>
              {deal.badge}
            </span>
            <span className="text-xs text-slate-400">{deal.verdict}</span>
          </div>
        </div>

        {/* multiples par secteur */}
        <div className="mt-5 space-y-2">
          <div className="text-xs font-medium text-slate-300">Multiples du marché (BAIIA)</div>
          {MULTIPLES.map((m, i) => (
            <div key={m.label} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-xs text-slate-400">{m.label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                <div
                  className="bar h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-400"
                  style={{ width: `${m.pct}%`, animationDelay: `${i * 120}ms` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-xs font-medium tabular-nums text-slate-200">
                {m.val}×
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 text-[10px] text-slate-500">
          Données agrégées de 8 sources · mises à jour en continu
        </div>
      </div>

      <style>{`
        @keyframes scan { 0% { transform: translateY(0); opacity: 0 } 10% { opacity: 1 } 100% { transform: translateY(420px); opacity: 0 } }
        .scanline { animation: scan 4s ease-in-out infinite; }
        @keyframes dealin { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        .dealcard { animation: dealin .5s ease-out; }
        @keyframes grow { from { width: 0 } }
        .bar { animation: grow 1s ease-out both; }
      `}</style>
    </div>
  );
}
