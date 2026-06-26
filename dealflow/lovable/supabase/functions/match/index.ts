// ============================================================================
//  Supabase Edge Function : match
//  Moteur de correspondance privé. Reçoit les critères d'un acheteur,
//  score les annonces (publiques + privées), retourne les correspondances.
//  Les vendeurs PRIVÉS ne sont révélés en détail qu'en mode interne
//  (internal=true) ; sinon ils sont comptés en teaser (rôle de courtier).
// ============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SEUIL = 50;   // score minimum pour considérer une correspondance

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function scoreListing(L: any, p: any) {
  let score = 0;
  const matched: string[] = [];
  const secs: string[] = p.secteurs_recherches || [];
  const regs: string[] = p.regions_recherchees || [];

  if (!secs.length || secs.includes(L.sector)) { score += 40; if (secs.length) matched.push("secteur"); }
  if (!regs.length || regs.includes(L.region)) { score += 30; if (regs.length) matched.push("région"); }

  const price = L.asking_price != null ? Number(L.asking_price) : null;
  if (p.budget_min == null && p.budget_max == null) score += 20;
  else if (price == null) score += 10;
  else if ((p.budget_min == null || price >= p.budget_min) && (p.budget_max == null || price <= p.budget_max)) { score += 20; matched.push("budget"); }

  const rev = L.revenue != null ? Number(L.revenue) : null;
  if (p.revenue_min == null && p.revenue_max == null) score += 10;
  else if (rev == null) score += 5;
  else if ((p.revenue_min == null || rev >= p.revenue_min) && (p.revenue_max == null || rev <= p.revenue_max)) { score += 10; matched.push("taille"); }

  return { score, matched };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json();
    const p = body.profil || body;          // critères de l'acheteur
    const internal = body.internal === true;
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const secs: string[] = p.secteurs_recherches || [];
    const regs: string[] = p.regions_recherchees || [];

    // --- Annonces publiques ---
    let qp = supabase.from("listings_publics")
      .select("id, title, sector, region, city, asking_price, asking_price_text, revenue, ebitda, source_url")
      .eq("status", "active").limit(600);
    if (secs.length) qp = qp.in("sector", secs);
    const { data: pubs } = await qp;
    const publicMatches = (pubs || [])
      .map((L) => ({ L, ...scoreListing(L, p) }))
      .filter((m) => m.score >= SEUIL)
      .sort((a, b) => b.score - a.score)
      .slice(0, 40)
      .map((m) => ({
        id: m.L.id, title: m.L.title, sector: m.L.sector, region: m.L.region, city: m.L.city,
        asking_price_text: m.L.asking_price_text, source_url: m.L.source_url,
        score: m.score, matched_on: m.matched, origine: "publique",
      }));

    // --- Vendeurs privés ---
    let qv = supabase.from("listings_prives")
      .select("id, nom_entreprise, sector, region, city, asking_price, asking_price_text, revenue, ebitda")
      .eq("statut", "actif").limit(300);
    if (secs.length) qv = qv.in("sector", secs);
    const { data: privs } = await qv;
    const privScored = (privs || [])
      .map((L) => ({ L, ...scoreListing(L, p) }))
      .filter((m) => m.score >= SEUIL)
      .sort((a, b) => b.score - a.score);

    const result: any = {
      matches: publicMatches,
      matches_count: publicMatches.length,
      private_count: privScored.length,   // teaser
    };

    // Détails privés seulement en interne (équipe)
    if (internal) {
      result.private_matches = privScored.slice(0, 40).map((m) => ({
        id: m.L.id, nom_entreprise: m.L.nom_entreprise, sector: m.L.sector, region: m.L.region,
        city: m.L.city, asking_price_text: m.L.asking_price_text, revenue: m.L.revenue, ebitda: m.L.ebitda,
        score: m.score, matched_on: m.matched, origine: "privée",
      }));
    }

    return new Response(JSON.stringify(result), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
