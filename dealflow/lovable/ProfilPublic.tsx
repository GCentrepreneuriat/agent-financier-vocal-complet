// ============================================================================
//  ProfilPublic.tsx  —  Page du lien de partage privé  /profil/:token
//  Lit un profil rendu « public » via la vue profils_acheteurs_publics
//  (les coordonnées ne sont JAMAIS exposées). Réutilise la carte du builder.
// ============================================================================

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ProfilCard } from "./ProfilAcquereurBuilder";

export default function ProfilPublic() {
  const { token } = useParams();
  const [f, setF] = useState<any>(null);
  const [state, setState] = useState<"loading" | "ok" | "notfound">("loading");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profils_acheteurs_publics")
        .select("*")
        .eq("share_token", token)
        .maybeSingle();
      if (data) { setF(data); setState("ok"); }
      else setState("notfound");
    })();
  }, [token]);

  if (state === "loading") return <div className="py-20 text-center text-slate-400">Chargement…</div>;
  if (state === "notfound")
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="text-4xl">🔒</div>
        <h1 className="mt-4 text-lg font-semibold text-slate-800">Profil indisponible</h1>
        <p className="mt-2 text-sm text-slate-500">Ce lien est privé, expiré, ou le profil n'est pas public.</p>
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <span className="text-xs font-semibold tracking-wide text-slate-400">PROFIL DE REPRENEUR · GC REPRENEURIAT</span>
        <button onClick={() => window.print()}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          ⬇ Télécharger (PDF)
        </button>
      </div>
      <ProfilCard f={f} />
      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5 text-center print:hidden">
        <p className="text-sm text-slate-600">Vous cédez une entreprise qui correspond à ce profil ?</p>
        <a href="/vendre" className="mt-3 inline-block rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
          Contacter GC Repreneuriat
        </a>
      </div>
    </div>
  );
}
