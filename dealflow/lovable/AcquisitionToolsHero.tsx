import { useEffect, useState } from "react";

const DEALS = [
  { secteur: "Manufacturier", region: "Montérégie", prix: "1 650 000 $", verdict: "Prix juste", vtone: "emerald", transfer: 84, matches: 3 },
  { secteur: "Restauration", region: "Montréal", prix: "395 000 $", verdict: "+12 % au-dessus", vtone: "amber", transfer: 61, matches: 1 },
  { secteur: "Distribution", region: "Capitale-Nationale", prix: "850 000 $", verdict: "−7 % sous le marché", vtone: "emerald", transfer: 78, matches: 2 },
  { secteur: "Services pro", region: "Estrie", prix: "585 000 $", verdict: "Prix juste", vtone: "emerald", transfer: 88, matches: 4 },
];

const VTONES: Record<string, string> = {
  emerald: "text-emerald-300 bg-emerald-400/10 ring-emerald-400/30",
  amber: "text-amber-300 bg-amber-400/10 ring-amber-400/30",
  sky: "text-sky-300 bg-sky-400/10 ring-sky-400/30",
};

export default function AcquisitionToolsHero() {
  const [active, setActive] = useState(0);
  const [transfer, setTransfer] = useState(0);

  // Rotation des annonces analysées
  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % DEALS.length), 3000);
    return () => clearInterval(id);
  }, []);

  // Le score de transférabilité monte à chaque changement
  useEffect(() => {
    const target = DEALS[active].transfer;
    setTransfer(0);
    const id = setInterval(() => {
      setTransfer((s) => (s + 3 >= target ? target : s + 3));
    }, 20);
    return () => clearInterval(id);
  }, [active]);

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
            Analyse d'opportunité
          </span>
          <span className="flex items-center gap-1.5 text-xs text-emerald-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            En direct
          </span>
        </div>

        {/* annonce analysée (défile) */}
        <div key={active} className="dealcard mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
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
        </div>

        {/* 3 outils d'intelligence */}
        <div className="mt-5 space-y-3">
          {/* Outil 1 — Ce prix est-il juste ? */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-300">Ce prix est-il juste ?</span>
            <span className={`rounded-md px-2 py-0.5 text-xs font-medium ring-1 ${VTONES[deal.vtone]}`}>
              {deal.verdict}
            </span>
          </div>

          {/* Outil 2 — Score de transférabilité */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300">Transférabilité</span>
              <span className="text-xs font-medium tabular-nums text-slate-200">{transfer}/100</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-400 transition-all duration-500"
                style={{ width: `${transfer}%` }}
              />
            </div>
          </div>

          {/* Outil 3 — Matching privé */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-300">Correspondance privée</span>
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-300">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              {deal.matches} acheteur{deal.matches > 1 ? "s" : ""} ciblé{deal.matches > 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="mt-5 text-[10px] text-slate-500">
          Outils d'intelligence GC · propulsés par 8 sources de données
        </div>
      </div>

      <style>{`
        @keyframes scan { 0% { transform: translateY(0); opacity: 0 } 10% { opacity: 1 } 100% { transform: translateY(420px); opacity: 0 } }
        .scanline { animation: scan 4s ease-in-out infinite; }
        @keyframes dealin { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        .dealcard { animation: dealin .5s ease-out; }
      `}</style>
    </div>
  );
}
