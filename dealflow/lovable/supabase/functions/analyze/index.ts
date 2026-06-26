// ============================================================================
//  Supabase Edge Function : analyze
//  « Découvrir le potentiel » d'une annonce du marché.
//  6 dimensions calculées sur DONNÉES DURES (aucune IA) + indice composite
//  + classement percentile vs les annonces du même secteur.
// ============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ----------------------------------------------------------------------------
//  BOUTONS D'AJUSTEMENT
// ----------------------------------------------------------------------------
const POIDS = {            // pondération de l'indice composite (sur dimensions dispo)
  prix: 0.25, rentabilite: 0.20, secteur: 0.15,
  robustesse: 0.20, transparence: 0.10, liquidite: 0.10,
};
const MARGE_CIBLE = 0.20;  // marge BAIIA donnant un score de 100
// ----------------------------------------------------------------------------

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

type Ctx = { baiiaMult: number; revMult: number | null; sectorCount: number };

function computeScores(L: any, ctx: Ctx) {
  const price = Number(L.asking_price) || null;
  const rev = Number(L.revenue) || null;
  const eb = Number(L.ebitda) || null;
  const s: Record<string, number | null> = {
    prix: null, rentabilite: null, secteur: null,
    robustesse: null, transparence: null, liquidite: null,
  };

  // 1. Opportunité prix : multiple implicite vs multiple du secteur
  let impliedMult: number | null = null;
  if (price && eb && eb > 0) { impliedMult = price / eb; s.prix = clamp(50 + (1 - impliedMult / ctx.baiiaMult) * 100, 5, 95); }
  else if (price && rev && rev > 0 && ctx.revMult) { const im = price / rev; s.prix = clamp(50 + (1 - im / ctx.revMult) * 100, 5, 95); }

  // 2. Rentabilité : marge BAIIA
  if (eb && rev && rev > 0) s.rentabilite = clamp((eb / rev) / MARGE_CIBLE * 100, 5, 100);

  // 3. Attrait du secteur : niveau de multiple
  s.secteur = clamp(20 + (ctx.baiiaMult - 2) / 5 * 75, 20, 95);

  // 4. Robustesse : taille du BAIIA (anti-fragilité)
  const base = eb || (rev ? rev * 0.15 : null);
  if (base && base > 0) s.robustesse = clamp((Math.log10(base) - 4.5) / 1.5 * 80 + 15, 10, 95);

  // 5. Transparence : complétude des données divulguées
  let t = 0;
  if (price) t += 35;
  if (rev) t += 30;
  if (eb) t += 25;
  if ((L.description || "").length > 120) t += 10;
  s.transparence = t;

  // 6. Liquidité : profondeur du marché du secteur
  s.liquidite = clamp(20 + Math.log10(Math.max(1, ctx.sectorCount)) * 40, 20, 95);

  // composite (repondéré sur les dimensions disponibles)
  let sum = 0, w = 0;
  for (const k in POIDS) {
    if (s[k] != null) { sum += (s[k] as number) * POIDS[k as keyof typeof POIDS]; w += POIDS[k as keyof typeof POIDS]; }
  }
  const composite = w > 0 ? Math.round(sum / w) : null;
  const available = Object.values(s).filter((v) => v != null).length;
  return { scores: s, composite, available, impliedMult };
}

function grade(c: number | null): string {
  if (c == null) return "—";
  return c >= 80 ? "A" : c >= 65 ? "B" : c >= 50 ? "C" : c >= 35 ? "D" : "E";
}

function highlights(s: Record<string, number | null>): { type: string; text: string }[] {
  const h: { type: string; text: string }[] = [];
  if (s.prix != null && s.prix >= 65) h.push({ type: "force", text: "Prix attractif sous le multiple du secteur" });
  if (s.prix != null && s.prix <= 35) h.push({ type: "risque", text: "Prix au-dessus du marché — marge de négociation" });
  if (s.rentabilite != null && s.rentabilite >= 65) h.push({ type: "force", text: "Bonne marge BAIIA pour son secteur" });
  if (s.rentabilite != null && s.rentabilite < 40) h.push({ type: "levier", text: "Marge sous la norme — potentiel d'amélioration" });
  if (s.secteur != null && s.secteur >= 70) h.push({ type: "force", text: "Secteur bien valorisé sur le marché" });
  if (s.robustesse != null && s.robustesse < 35) h.push({ type: "risque", text: "Petite taille — rentabilité plus fragile (à valider)" });
  if (s.robustesse != null && s.robustesse >= 70) h.push({ type: "force", text: "Taille offrant une bonne robustesse" });
  if (s.transparence != null && s.transparence < 50) h.push({ type: "risque", text: "Données financières partielles — vérification diligente clé" });
  return h;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { listing_id } = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: L } = await supabase.from("listings_publics").select("*").eq("id", listing_id).single();
    if (!L) return new Response(JSON.stringify({ error: "Annonce introuvable" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
    const sector = L.sector || "autre";

    // benchmarks du secteur (baiia + revenus)
    const { data: bench } = await supabase.from("valuation_benchmarks").select("*")
      .in("method", ["baiia", "revenus"]).in("sector", [sector, "autre"]).eq("size_tier", "all");
    const pick = (m: string) => (bench || []).find((r: any) => r.method === m && r.sector === sector)
      || (bench || []).find((r: any) => r.method === m && r.sector === "autre");
    const baiiaMult = Number(pick("baiia")?.mult_median) || 3.5;
    const revMult = Number(pick("revenus")?.mult_median) || null;
    const confidence = pick("baiia")?.confidence ?? "indicative";

    // pairs du secteur (pour la liquidité + le classement)
    const { data: peers } = await supabase.from("listings_publics")
      .select("asking_price, revenue, ebitda, description").eq("sector", sector).limit(300);
    const sectorCount = (peers || []).length;
    const ctx: Ctx = { baiiaMult, revMult, sectorCount };

    const target = computeScores(L, ctx);

    // classement percentile
    const peerComposites = (peers || []).map((p) => computeScores(p, ctx).composite).filter((c): c is number => c != null);
    let percentile: number | null = null;
    if (target.composite != null && peerComposites.length > 1) {
      const below = peerComposites.filter((c) => c <= (target.composite as number)).length;
      percentile = Math.round((below / peerComposites.length) * 100);
    }

    const result = {
      listing: { title: L.title, sector, region: L.region, city: L.city, asking_price_text: L.asking_price_text, revenue: L.revenue, ebitda: L.ebitda, source_url: L.source_url },
      scores: target.scores,
      composite: target.composite,
      grade: grade(target.composite),
      percentile,
      peers_count: sectorCount,
      completeness: { available: target.available, total: 6 },
      price_position: target.impliedMult != null ? {
        implied_multiple: +target.impliedMult.toFixed(1),
        sector_multiple: baiiaMult,
        verdict: target.impliedMult < baiiaMult * 0.9 ? "sous le marché" : target.impliedMult > baiiaMult * 1.1 ? "au-dessus du marché" : "dans le marché",
      } : null,
      highlights: highlights(target.scores),
      confidence,
      disclaimer: "Analyse fondée uniquement sur les données publiques de l'annonce. Indicative — une vérification diligente est requise avant toute décision.",
    };

    return new Response(JSON.stringify(result), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
