// ============================================================================
//  ProfilAcquereurBuilder.tsx  —  « Bâtis ton profil de repreneur »
//  Style SearcherList, version GC Repreneuriat.
//  6 étapes → sauvegarde Supabase (profils_acheteurs) → carte de profil
//  téléchargeable (PDF via impression), partageable (lien privé) et
//  matchée en direct aux entreprises en vente (edge function `match`).
//
//  Dépendances : @supabase/supabase-js déjà configuré dans le projet Lovable.
//  Place ce fichier dans src/components/ et route-le sur /profil-acquereur.
// ============================================================================

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client"; // ← chemin Lovable par défaut

// ---------------------------------------------------------------------------
//  Référentiels (adaptés au Québec)
// ---------------------------------------------------------------------------
const SECTEURS = [
  "Manufacturier", "Distribution", "Commerce de détail", "Restauration",
  "Construction", "Services professionnels", "Technologie", "Santé",
  "Transport", "Agroalimentaire", "Tourisme", "Immobilier",
];
const REGIONS = [
  "Montréal", "Montérégie", "Capitale-Nationale", "Laurentides", "Lanaudière",
  "Estrie", "Outaouais", "Chaudière-Appalaches", "Mauricie", "Laval",
  "Saguenay–Lac-Saint-Jean", "Centre-du-Québec", "Bas-Saint-Laurent", "Autre / partout au Québec",
];
const SOURCES_FIN = [
  "Fonds personnels", "BDC", "Banque / Desjardins", "Investissement Québec",
  "Balance de vente (vendeur)", "Investisseurs privés", "Fonds fiscalisés (FSTQ, Fondaction)",
];
const EXPERTISES = [
  "Opérations", "Ventes & marketing", "Finance", "Ressources humaines",
  "Redressement", "Croissance / M&A", "Production", "Technologie", "Export",
];
const TITRES = ["Repreneur", "Entrepreneur en acquisition", "Investisseur", "Groupe familial", "Recherche de fonds (searcher)"];

const STEPS = ["Identité & thèse", "Cible", "Structure", "Capacité", "Expérience", "Échéancier"];

// ---------------------------------------------------------------------------
//  État initial
// ---------------------------------------------------------------------------
const VIDE: any = {
  nom: "", titre: "Repreneur", ville: "", these: "", photo_url: "",
  secteurs_recherches: [], regions_recherchees: [], type_cible: "entreprise",
  budget_min: "", budget_max: "", revenue_min: "", revenue_max: "", ebitda_min: "",
  taille_equipe: "", type_acquisition: "100%", role_post: "operateur", structure_fiscale: "flexible",
  mise_de_fonds: "", capital_total: "", sources_financement: [], preautorisation: "non", pnl_gere: "",
  annees_experience: "", expertises: [], deja_proprietaire: false, apport_cedant: "",
  horizon: "3-6 mois", motivation: "", courriel: "", telephone: "", visibilite: "confidentiel",
};

const money = (n: any) => (n === "" || n == null ? "—" : Number(n).toLocaleString("fr-CA") + " $");
const toNum = (v: any) => (v === "" || v == null ? null : Number(v));

// ---------------------------------------------------------------------------
//  Composants UI réutilisables
// ---------------------------------------------------------------------------
function Chip({ label, on, toggle }: any) {
  return (
    <button type="button" onClick={toggle}
      className={`rounded-full border px-3 py-1.5 text-sm transition ${
        on ? "border-emerald-500 bg-emerald-50 text-emerald-800 font-medium"
           : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
      {label}
    </button>
  );
}
function Field({ label, hint, children }: any) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {hint && <span className="block text-xs text-slate-400">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none";

// ============================================================================
export default function ProfilAcquereurBuilder() {
  const [step, setStep] = useState(0);
  const [f, setF] = useState<any>(VIDE);
  const [id, setId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [matches, setMatches] = useState<any[] | null>(null);

  // reprise d'un profil en cours (localStorage)
  useEffect(() => {
    const saved = localStorage.getItem("gc_profil_acquereur");
    if (saved) { try { const d = JSON.parse(saved); setF({ ...VIDE, ...d.f }); setId(d.id || null); } catch {} }
  }, []);

  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const toggle = (k: string, v: string) =>
    setF((p: any) => ({ ...p, [k]: p[k].includes(v) ? p[k].filter((x: string) => x !== v) : [...p[k], v] }));

  const payload = () => ({
    nom: f.nom, titre: f.titre, ville: f.ville, these: f.these, photo_url: f.photo_url || null,
    secteurs_recherches: f.secteurs_recherches, regions_recherchees: f.regions_recherchees, type_cible: f.type_cible,
    budget_min: toNum(f.budget_min), budget_max: toNum(f.budget_max),
    revenue_min: toNum(f.revenue_min), revenue_max: toNum(f.revenue_max), ebitda_min: toNum(f.ebitda_min),
    taille_equipe: f.taille_equipe, type_acquisition: f.type_acquisition, role_post: f.role_post,
    structure_fiscale: f.structure_fiscale, mise_de_fonds: toNum(f.mise_de_fonds), capital_total: toNum(f.capital_total),
    sources_financement: f.sources_financement, preautorisation: f.preautorisation, pnl_gere: toNum(f.pnl_gere),
    annees_experience: toNum(f.annees_experience), expertises: f.expertises, deja_proprietaire: f.deja_proprietaire,
    apport_cedant: f.apport_cedant, horizon: f.horizon, motivation: f.motivation,
    courriel: f.courriel, telephone: f.telephone, visibilite: f.visibilite,
  });

  // sauvegarde progressive (upsert)
  async function persist() {
    setSaving(true);
    try {
      if (id) {
        await supabase.from("profils_acheteurs").update({ ...payload(), updated_at: new Date().toISOString() }).eq("id", id);
      } else {
        const { data } = await supabase.from("profils_acheteurs").insert(payload()).select("id, share_token").single();
        if (data) { setId(data.id); setToken(data.share_token); }
      }
      localStorage.setItem("gc_profil_acquereur", JSON.stringify({ f, id }));
    } finally { setSaving(false); }
  }

  async function finaliser() {
    await persist();
    // récupère le token si pas déjà là
    if (!token && id) {
      const { data } = await supabase.from("profils_acheteurs").select("share_token").eq("id", id).single();
      if (data) setToken(data.share_token);
    }
    // matching en direct
    try {
      const { data } = await supabase.functions.invoke("match", { body: { profil: payload() } });
      setMatches(data?.matches || []);
    } catch { setMatches([]); }
    setDone(true);
  }

  const next = async () => { await persist(); setStep((s) => Math.min(s + 1, STEPS.length - 1)); };
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const shareUrl = token ? `${window.location.origin}/profil/${token}` : "";

  // -------------------------------------------------------------------------
  //  ÉCRAN FINAL : la carte de profil (téléchargeable + partageable + matchs)
  // -------------------------------------------------------------------------
  if (done) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ProfilCard f={f} />
        <div className="mt-6 flex flex-wrap gap-3 print:hidden">
          <button onClick={() => window.print()}
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800">
            ⬇ Télécharger (PDF)
          </button>
          {shareUrl && (
            <button onClick={() => { navigator.clipboard.writeText(shareUrl); }}
              className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              🔗 Copier le lien de partage
            </button>
          )}
          <button onClick={() => setDone(false)}
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            ✎ Modifier mon profil
          </button>
        </div>
        {shareUrl && (
          <p className="mt-2 text-xs text-slate-500 print:hidden">
            Lien privé (non indexé) : <span className="font-mono text-slate-700">{shareUrl}</span>
            {f.visibilite !== "public" && " — activé seulement si tu rends le profil public à l'étape Échéancier."}
          </p>
        )}

        {/* Matching en direct */}
        <div className="mt-10 print:hidden">
          <h3 className="text-lg font-semibold text-slate-900">
            Entreprises qui correspondent à ton profil
            {matches && <span className="ml-2 text-sm font-normal text-slate-500">{matches.length} correspondance(s)</span>}
          </h3>
          {!matches && <p className="mt-2 text-sm text-slate-500">Analyse en cours…</p>}
          {matches && matches.length === 0 && (
            <p className="mt-2 text-sm text-slate-500">Aucune correspondance publique pour l'instant — l'équipe GC te contactera dès qu'une cible privée correspond.</p>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(matches || []).slice(0, 8).map((m: any) => (
              <a key={m.id} href={m.source_url} target="_blank" rel="noopener"
                className="rounded-xl border border-slate-200 bg-white p-4 hover:border-emerald-400 hover:shadow-sm transition">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">
                    {m.score}% compatible
                  </span>
                  <span className="text-xs text-slate-400">{m.region}</span>
                </div>
                <div className="mt-2 text-sm font-medium text-slate-800 line-clamp-2">{m.title}</div>
                <div className="mt-1 text-xs text-slate-500">{m.sector} · {m.asking_price_text || "prix sur demande"}</div>
                {m.matched_on?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {m.matched_on.map((x: string) => (
                      <span key={x} className="text-[10px] text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">✓ {x}</span>
                    ))}
                  </div>
                )}
              </a>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  //  BUILDER (les 6 étapes)
  // -------------------------------------------------------------------------
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      {/* progression */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => (
            <div key={s} className="flex flex-1 items-center">
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                i <= step ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500"}`}>{i + 1}</div>
              {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 ${i < step ? "bg-emerald-600" : "bg-slate-200"}`} />}
            </div>
          ))}
        </div>
        <div className="mt-2 text-sm font-medium text-slate-700">Étape {step + 1} — {STEPS[step]}</div>
      </div>

      <div className="space-y-5">
        {/* ---- Étape 1 : Identité & thèse ---- */}
        {step === 0 && (
          <>
            <Field label="Ton nom complet"><input className={inputCls} value={f.nom} onChange={(e) => set("nom", e.target.value)} placeholder="Ex. Marie Tremblay" /></Field>
            <Field label="Comment tu te présentes">
              <select className={inputCls} value={f.titre} onChange={(e) => set("titre", e.target.value)}>
                {TITRES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Ville de résidence"><input className={inputCls} value={f.ville} onChange={(e) => set("ville", e.target.value)} placeholder="Ex. Saint-Hyacinthe" /></Field>
            <Field label="Ta thèse d'acquisition" hint="Une phrase claire — ce que les cédants et courtiers liront en premier.">
              <textarea className={inputCls} rows={3} value={f.these} onChange={(e) => set("these", e.target.value)}
                placeholder="Ex. Je cherche une PME manufacturière rentable en Montérégie, 1 à 5 M$ de CA, avec une équipe en place et un cédant prêt à accompagner la transition." />
            </Field>
            <Field label="Photo ou logo (URL, optionnel)"><input className={inputCls} value={f.photo_url} onChange={(e) => set("photo_url", e.target.value)} placeholder="https://…" /></Field>
          </>
        )}

        {/* ---- Étape 2 : Cible ---- */}
        {step === 1 && (
          <>
            <Field label="Secteurs recherchés">
              <div className="flex flex-wrap gap-2">
                {SECTEURS.map((s) => <Chip key={s} label={s} on={f.secteurs_recherches.includes(s)} toggle={() => toggle("secteurs_recherches", s)} />)}
              </div>
            </Field>
            <Field label="Régions visées">
              <div className="flex flex-wrap gap-2">
                {REGIONS.map((r) => <Chip key={r} label={r} on={f.regions_recherchees.includes(r)} toggle={() => toggle("regions_recherchees", r)} />)}
              </div>
            </Field>
            <Field label="Type de cible">
              <div className="flex gap-2">
                {[["entreprise", "Entreprise"], ["immobilier", "Immobilier commercial"], ["les_deux", "Les deux"]].map(([v, l]) =>
                  <Chip key={v} label={l} on={f.type_cible === v} toggle={() => set("type_cible", v)} />)}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Prix d'acquisition — min"><input type="number" className={inputCls} value={f.budget_min} onChange={(e) => set("budget_min", e.target.value)} placeholder="500000" /></Field>
              <Field label="Prix — max"><input type="number" className={inputCls} value={f.budget_max} onChange={(e) => set("budget_max", e.target.value)} placeholder="3000000" /></Field>
              <Field label="Chiffre d'affaires — min"><input type="number" className={inputCls} value={f.revenue_min} onChange={(e) => set("revenue_min", e.target.value)} placeholder="1000000" /></Field>
              <Field label="Chiffre d'affaires — max"><input type="number" className={inputCls} value={f.revenue_max} onChange={(e) => set("revenue_max", e.target.value)} placeholder="8000000" /></Field>
              <Field label="BAIIA minimum"><input type="number" className={inputCls} value={f.ebitda_min} onChange={(e) => set("ebitda_min", e.target.value)} placeholder="200000" /></Field>
              <Field label="Taille d'équipe visée"><input className={inputCls} value={f.taille_equipe} onChange={(e) => set("taille_equipe", e.target.value)} placeholder="5 à 25 employés" /></Field>
            </div>
          </>
        )}

        {/* ---- Étape 3 : Structure ---- */}
        {step === 2 && (
          <>
            <Field label="Type d'acquisition">
              <div className="flex flex-wrap gap-2">
                {[["100%", "100 %"], ["majoritaire", "Majoritaire"], ["partenariat", "Partenariat"], ["releve", "Relève progressive"], ["investisseur", "Investisseur passif"]].map(([v, l]) =>
                  <Chip key={v} label={l} on={f.type_acquisition === v} toggle={() => set("type_acquisition", v)} />)}
              </div>
            </Field>
            <Field label="Ton rôle après la transaction">
              <div className="flex flex-wrap gap-2">
                {[["operateur", "Opérateur à temps plein"], ["superviseur", "Superviseur"], ["absenteiste", "Absentéiste"]].map(([v, l]) =>
                  <Chip key={v} label={l} on={f.role_post === v} toggle={() => set("role_post", v)} />)}
              </div>
            </Field>
            <Field label="Structure fiscale visée" hint="Une vente d'actions peut donner droit à l'exonération du gain en capital (LCGE, ~1,25 M$).">
              <div className="flex flex-wrap gap-2">
                {[["actions", "Achat d'actions"], ["actifs", "Achat d'actifs"], ["flexible", "Flexible / à conseiller"]].map(([v, l]) =>
                  <Chip key={v} label={l} on={f.structure_fiscale === v} toggle={() => set("structure_fiscale", v)} />)}
              </div>
            </Field>
          </>
        )}

        {/* ---- Étape 4 : Capacité financière ---- */}
        {step === 3 && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Mise de fonds disponible" hint="Ton capital liquide."><input type="number" className={inputCls} value={f.mise_de_fonds} onChange={(e) => set("mise_de_fonds", e.target.value)} placeholder="250000" /></Field>
              <Field label="Capital total mobilisable" hint="Avec financement."><input type="number" className={inputCls} value={f.capital_total} onChange={(e) => set("capital_total", e.target.value)} placeholder="1500000" /></Field>
            </div>
            <Field label="Sources de financement envisagées">
              <div className="flex flex-wrap gap-2">
                {SOURCES_FIN.map((s) => <Chip key={s} label={s} on={f.sources_financement.includes(s)} toggle={() => toggle("sources_financement", s)} />)}
              </div>
            </Field>
            <Field label="Pré-autorisation bancaire">
              <div className="flex gap-2">
                {[["oui", "Obtenue"], ["en_cours", "En cours"], ["non", "Pas encore"]].map(([v, l]) =>
                  <Chip key={v} label={l} on={f.preautorisation === v} toggle={() => set("preautorisation", v)} />)}
              </div>
            </Field>
            <Field label="P&L déjà géré (optionnel)" hint="Budget d'exploitation que tu as déjà dirigé — renforce ta crédibilité.">
              <input type="number" className={inputCls} value={f.pnl_gere} onChange={(e) => set("pnl_gere", e.target.value)} placeholder="5000000" />
            </Field>
          </>
        )}

        {/* ---- Étape 5 : Expérience ---- */}
        {step === 4 && (
          <>
            <Field label="Années d'expérience en gestion"><input type="number" className={inputCls} value={f.annees_experience} onChange={(e) => set("annees_experience", e.target.value)} placeholder="8" /></Field>
            <Field label="Tes forces">
              <div className="flex flex-wrap gap-2">
                {EXPERTISES.map((x) => <Chip key={x} label={x} on={f.expertises.includes(x)} toggle={() => toggle("expertises", x)} />)}
              </div>
            </Field>
            <Field label="As-tu déjà été propriétaire / repreneur ?">
              <div className="flex gap-2">
                <Chip label="Oui" on={f.deja_proprietaire === true} toggle={() => set("deja_proprietaire", true)} />
                <Chip label="Non" on={f.deja_proprietaire === false} toggle={() => set("deja_proprietaire", false)} />
              </div>
            </Field>
            <Field label="Ce que tu apportes au cédant" hint="Ton pitch : pourquoi te vendre à toi plutôt qu'à un autre.">
              <textarea className={inputCls} rows={3} value={f.apport_cedant} onChange={(e) => set("apport_cedant", e.target.value)}
                placeholder="Ex. 15 ans en production manufacturière, capacité de conserver l'équipe et de poursuivre l'héritage de l'entreprise." />
            </Field>
          </>
        )}

        {/* ---- Étape 6 : Échéancier & confidentialité ---- */}
        {step === 5 && (
          <>
            <Field label="Horizon d'acquisition">
              <div className="flex flex-wrap gap-2">
                {["0-3 mois", "3-6 mois", "6-12 mois", "12 mois +"].map((h) =>
                  <Chip key={h} label={h} on={f.horizon === h} toggle={() => set("horizon", h)} />)}
              </div>
            </Field>
            <Field label="Ta motivation (optionnel)">
              <textarea className={inputCls} rows={2} value={f.motivation} onChange={(e) => set("motivation", e.target.value)} placeholder="Pourquoi acquérir maintenant ?" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Courriel"><input type="email" className={inputCls} value={f.courriel} onChange={(e) => set("courriel", e.target.value)} placeholder="toi@courriel.com" /></Field>
              <Field label="Téléphone"><input className={inputCls} value={f.telephone} onChange={(e) => set("telephone", e.target.value)} placeholder="514 000-0000" /></Field>
            </div>
            <Field label="Visibilité du profil" hint="Public = ton lien de partage affiche une carte (SANS tes coordonnées). Confidentiel = visible par l'équipe GC seulement.">
              <div className="flex gap-2">
                <Chip label="🔒 Confidentiel" on={f.visibilite === "confidentiel"} toggle={() => set("visibilite", "confidentiel")} />
                <Chip label="🔗 Partageable (public)" on={f.visibilite === "public"} toggle={() => set("visibilite", "public")} />
              </div>
            </Field>
            <p className="text-xs text-slate-400">
              En soumettant, tu acceptes que GC Repreneuriat traite tes renseignements conformément à la Politique de confidentialité (Loi 25).
            </p>
          </>
        )}
      </div>

      {/* navigation */}
      <div className="mt-8 flex items-center justify-between">
        <button onClick={prev} disabled={step === 0}
          className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 disabled:opacity-40 hover:bg-slate-50">
          ← Retour
        </button>
        <span className="text-xs text-slate-400">{saving ? "Sauvegarde…" : id ? "Sauvegardé" : ""}</span>
        {step < STEPS.length - 1 ? (
          <button onClick={next}
            className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
            Continuer →
          </button>
        ) : (
          <button onClick={finaliser}
            className="rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
            Générer mon profil ✓
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
//  La CARTE de profil — style SearcherList, aux couleurs GC Repreneuriat
//  (aussi utilisée par la page publique /profil/[token])
// ============================================================================
export function ProfilCard({ f }: { f: any }) {
  const initiales = (f.nom || "?").split(" ").map((x: string) => x[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print:shadow-none">
      {/* bandeau brandé */}
      <div className="relative h-24 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-900">
        <div className="absolute right-4 top-4 text-xs font-semibold tracking-wide text-white/70">GC REPRENEURIAT</div>
      </div>
      <div className="px-6 pb-6">
        {/* avatar + identité */}
        <div className="-mt-10 flex items-end gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-xl border-4 border-white bg-emerald-600 text-2xl font-bold text-white shadow">
            {f.photo_url ? <img src={f.photo_url} alt="" className="h-full w-full rounded-lg object-cover" /> : initiales}
          </div>
          <div className="pb-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">{f.nom || "Profil de repreneur"}</h2>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">Prêt à acquérir</span>
            </div>
            <div className="text-sm text-slate-500">{f.titre}{f.ville && ` · ${f.ville}`}</div>
          </div>
        </div>

        {/* thèse */}
        {f.these && (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm italic text-slate-700">« {f.these} »</p>
        )}

        {/* métriques clés */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Capital mobilisable" value={money(f.capital_total)} />
          <Stat label="Mise de fonds" value={money(f.mise_de_fonds)} />
          <Stat label="Expérience" value={f.annees_experience ? `${f.annees_experience} ans` : "—"} />
          <Stat label="P&L géré" value={money(f.pnl_gere)} />
        </div>

        {/* critères */}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Block title="Ce que je cherche">
            <Line k="Secteurs" v={(f.secteurs_recherches || []).join(", ") || "Ouvert"} />
            <Line k="Régions" v={(f.regions_recherchees || []).join(", ") || "Tout le Québec"} />
            <Line k="Prix" v={`${money(f.budget_min)} – ${money(f.budget_max)}`} />
            <Line k="Chiffre d'affaires" v={`${money(f.revenue_min)} – ${money(f.revenue_max)}`} />
          </Block>
          <Block title="Structure & horizon">
            <Line k="Type" v={f.type_acquisition} />
            <Line k="Rôle post-transaction" v={f.role_post} />
            <Line k="Structure fiscale" v={f.structure_fiscale} />
            <Line k="Horizon" v={f.horizon} />
          </Block>
        </div>

        {/* financement + expertises */}
        {(f.sources_financement?.length > 0) && (
          <div className="mt-4">
            <div className="text-xs font-medium text-slate-500">Financement</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {f.sources_financement.map((s: string) => <Tag key={s}>{s}</Tag>)}
              {f.preautorisation === "oui" && <Tag tone="emerald">✓ Pré-autorisation obtenue</Tag>}
            </div>
          </div>
        )}
        {(f.expertises?.length > 0) && (
          <div className="mt-4">
            <div className="text-xs font-medium text-slate-500">Forces</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">{f.expertises.map((x: string) => <Tag key={x}>{x}</Tag>)}</div>
          </div>
        )}

        {/* apport au cédant */}
        {f.apport_cedant && (
          <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
            <div className="text-xs font-semibold text-emerald-800">Ce que j'apporte au cédant</div>
            <p className="mt-1 text-sm text-slate-700">{f.apport_cedant}</p>
          </div>
        )}

        <div className="mt-5 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
          Profil bâti sur GC Repreneuriat · Les données financières sont déclarées par le repreneur.
        </div>
      </div>
    </div>
  );
}

const Stat = ({ label, value }: any) => (
  <div className="rounded-xl border border-slate-100 bg-white p-3">
    <div className="text-[11px] text-slate-400">{label}</div>
    <div className="mt-0.5 text-sm font-semibold text-slate-900">{value}</div>
  </div>
);
const Block = ({ title, children }: any) => (
  <div className="rounded-xl border border-slate-100 p-4">
    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</div>
    <div className="mt-2 space-y-1.5">{children}</div>
  </div>
);
const Line = ({ k, v }: any) => (
  <div className="flex justify-between gap-3 text-sm">
    <span className="text-slate-500">{k}</span>
    <span className="text-right font-medium text-slate-800">{v}</span>
  </div>
);
const Tag = ({ children, tone }: any) => (
  <span className={`rounded-md px-2 py-0.5 text-xs ${tone === "emerald" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{children}</span>
);
