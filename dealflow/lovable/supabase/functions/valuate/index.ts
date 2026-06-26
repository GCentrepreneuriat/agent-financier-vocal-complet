// ============================================================================
//  Supabase Edge Function : valuate
//  Moteur de valorisation GC Repreneuriat.
//  Route vers la bonne MÉTHODE -> normalise -> applique le multiple réel
//  (secteur x taille) -> ajuste selon les facteurs -> fourchette + comparables.
//
//  Déploiement : Supabase > Edge Functions > New function "valuate"
//  (ou Lovable Cloud > Edge Functions). Aucune clé à exposer côté client.
// ============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ----------------------------------------------------------------------------
//  BOUTONS D'AJUSTEMENT  ←←←  c'est ICI que tu calibres avec ton expertise
// ----------------------------------------------------------------------------
const SALAIRE_MARCHE_DEFAUT = 75_000;        // salaire normal d'un dirigeant si non fourni
const SEUIL_MICRO = 500_000;                 // < = micro
const SEUIL_PETITE = 2_000_000;              // < = petite
const SEUIL_PME = 10_000_000;                // < = PME, sinon grande
const SEUIL_SDE_REVENU = 1_000_000;          // sous ce CA + dépendance proprio => méthode SDE
const SECTEURS_ACTIFS = ["construction", "immobilier"]; // routés vers méthode actifs si actif net fourni

// Combien chaque facteur déplace le multiple dans la fourchette [bas, haut] (position 0..1)
const POIDS = {
  recurrence:   { high: +0.15, medium: 0, low: -0.10 },
  dependance:   { low: +0.12, medium: 0, high: -0.22 },   // dépendance au proprio (high = risque)
  croissance:   { growing: +0.15, stable: 0, declining: -0.18 },
  concentration:{ low: +0.06, medium: 0, high: -0.15 },   // concentration client (high = risque)
  equipe:       { true: +0.10, false: 0 },                // équipe de gestion en place
};
const ESCOMPTE_DEMANDE_CONCLU = 0.85;        // prix de transaction ≈ 85% du prix demandé typique
// ----------------------------------------------------------------------------

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const METHOD_LABEL: Record<string, string> = {
  baiia: "Multiple du BAIIA normalisé",
  sde: "Multiple du flux discrétionnaire (SDE)",
  revenus: "Multiple des revenus",
  actifs: "Évaluation par les actifs",
};

function sizeTier(revenue: number): string {
  if (revenue < SEUIL_MICRO) return "micro";
  if (revenue < SEUIL_PETITE) return "petite";
  if (revenue < SEUIL_PME) return "pme";
  return "grande";
}

function chooseMethod(i: any): string {
  const rev = Number(i.revenue) || 0;
  const profitFaible = (Number(i.baiia_declared) || 0) <= 0;
  if (Number(i.net_assets) > 0 && (SECTEURS_ACTIFS.includes(i.sector) || profitFaible)) return "actifs";
  if (i.sector === "technologie" && i.recurrence === "high") return "revenus";
  if (rev > 0 && (rev < SEUIL_MICRO || (i.dependance === "high" && rev < SEUIL_SDE_REVENU))) return "sde";
  return "baiia";
}

// position 0..1 dans la fourchette selon les facteurs de valeur
function position(i: any): number {
  let p = 0.5;
  p += POIDS.recurrence[i.recurrence as keyof typeof POIDS.recurrence] ?? 0;
  p += POIDS.dependance[i.dependance as keyof typeof POIDS.dependance] ?? 0;
  p += POIDS.croissance[i.croissance as keyof typeof POIDS.croissance] ?? 0;
  p += POIDS.concentration[i.concentration as keyof typeof POIDS.concentration] ?? 0;
  p += i.equipe ? POIDS.equipe.true : 0;
  return Math.max(0, Math.min(1, p));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const i = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const revenue = Number(i.revenue) || 0;
    const baiiaDeclared = Number(i.baiia_declared) || 0;
    const ownerSalary = Number(i.owner_salary) || 0;
    const marketSalary = Number(i.market_salary) || SALAIRE_MARCHE_DEFAUT;
    const perso = Number(i.personal_expenses) || 0;
    const nonRec = Number(i.non_recurring) || 0;
    const nonRecRev = Number(i.non_recurring_revenue) || 0;

    // 1) Normalisation
    const excesSalaire = Math.max(0, ownerSalary - marketSalary);
    const baiiaNormalise = baiiaDeclared + excesSalaire + perso + nonRec - nonRecRev;
    const sde = baiiaDeclared + ownerSalary + perso + nonRec - nonRecRev;

    // 2) Routage de méthode + taille
    const method = chooseMethod(i);
    const tier = sizeTier(revenue);

    // métrique appliquée selon la méthode
    const metric =
      method === "baiia" ? baiiaNormalise :
      method === "sde" ? sde :
      method === "revenus" ? revenue :
      Number(i.net_assets) || 0;

    // 3) Benchmarks (secteur + taille)
    const { data: secRowArr } = await supabase
      .from("valuation_benchmarks")
      .select("*")
      .eq("method", method === "actifs" ? "actifs" : method)
      .in("sector", [i.sector, "autre"])
      .eq("size_tier", method === "sde" ? tier : "all");
    const secRow =
      (secRowArr || []).find((r: any) => r.sector === i.sector) ||
      (secRowArr || []).find((r: any) => r.sector === "autre") ||
      (secRowArr || [])[0];

    let result: any;

    if (method === "actifs" || !secRow || secRow.mult_median == null) {
      // Méthode actifs : pas de multiple, valeur = actif net
      result = {
        method, method_label: METHOD_LABEL[method],
        size_tier: tier,
        valuation: { low: metric * 0.9, median: metric, high: metric * 1.15 },
        note_methode: "Valeur fondée sur l'actif net réévalué. Un goodwill peut s'ajouter selon la rentabilité et le carnet de commandes.",
      };
    } else {
      // ajustement taille (pour BAIIA on mélange secteur + taille)
      let lo = Number(secRow.mult_low), me = Number(secRow.mult_median), hi = Number(secRow.mult_high);
      if (method === "baiia") {
        const { data: szArr } = await supabase
          .from("valuation_benchmarks")
          .select("*").eq("method", "baiia").eq("sector", "all").eq("size_tier", tier);
        const sz = (szArr || [])[0];
        if (sz) {
          lo = (lo + Number(sz.mult_low)) / 2;
          me = (me + Number(sz.mult_median)) / 2;
          hi = (hi + Number(sz.mult_high)) / 2;
        }
      }
      const pos = position(i);
      const multEstime = +(lo + pos * (hi - lo)).toFixed(2);

      const valueLow = Math.round(metric * lo);
      const valueHigh = Math.round(metric * hi);
      const valueEstime = Math.round(metric * multEstime);

      // reality-check demandé vs conclu
      let realityCheck = null;
      if (secRow.mult_asking_median) {
        const prixDemande = Math.round(metric * Number(secRow.mult_asking_median));
        const prixConclu = Math.round(prixDemande * ESCOMPTE_DEMANDE_CONCLU);
        realityCheck = {
          prix_demande_typique: prixDemande,
          prix_transaction_estime: prixConclu,
          ecart_pct: Math.round((1 - ESCOMPTE_DEMANDE_CONCLU) * 100),
          multiple_demande: Number(secRow.mult_asking_median),
        };
      }

      result = {
        method, method_label: METHOD_LABEL[method],
        size_tier: tier,
        metric: { type: method, valeur: Math.round(metric) },
        normalisation: {
          baiia_declare: baiiaDeclared,
          salaire_excedentaire: excesSalaire,
          depenses_personnelles: perso,
          depenses_non_recurrentes: nonRec,
          revenus_non_recurrents: nonRecRev,
          baiia_normalise: Math.round(baiiaNormalise),
          uplift_pct: baiiaDeclared > 0 ? Math.round((baiiaNormalise / baiiaDeclared - 1) * 100) : null,
          sde: Math.round(sde),
        },
        multiple: { bas: +lo.toFixed(2), median: +me.toFixed(2), haut: +hi.toFixed(2), estime: multEstime, position: +pos.toFixed(2) },
        valuation: { low: valueLow, median: valueEstime, high: valueHigh },
        reality_check: realityCheck,
      };
    }

    // 4) Comparables réels (mêmes secteur, taille proche)
    const { data: comps } = await supabase
      .from("listings_publics")
      .select("title, region, city, asking_price, asking_price_text, revenue, ebitda, source_url")
      .eq("sector", i.sector)
      .not("asking_price", "is", null)
      .limit(40);
    const comparables = (comps || [])
      .map((c: any) => ({ ...c, ecart: Math.abs((Number(c.revenue) || revenue) - revenue) }))
      .sort((a: any, b: any) => a.ecart - b.ecart)
      .slice(0, 6)
      .map(({ ecart, ...c }: any) => c);

    result.confidence = secRow?.confidence ?? "indicative";
    result.sample_size = secRow?.sample_size ?? null;
    result.comparables = comparables;
    result.comparables_count = comparables.length;

    // 5) Note structure de transaction (levier fiscal)
    result.structure_note =
      "Pensez à la structure : une vente d'ACTIONS peut donner droit à l'exonération du gain en capital (jusqu'à ~1,25 M$), alors qu'une vente d'ACTIFS change la fiscalité et souvent le prix. À valider avec votre conseiller.";
    result.disclaimer =
      "Estimation préliminaire à titre indicatif, fondée sur des données de marché agrégées. Ne remplace pas une évaluation formelle par un expert agréé (EEE/CBV).";

    return new Response(JSON.stringify(result), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
