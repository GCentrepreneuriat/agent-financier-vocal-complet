// ============================================================================
//  ProfilAcquereurBuilder.tsx  —  « Bâtis ton profil de repreneur »
//  Reproduction fidèle du parcours SearcherList, version GC Repreneuriat (FR).
//
//  Parcours :
//   0. Vérification d'identité (courriel ou cellulaire → code 6 chiffres)
//   1. Import (dépôt d'un CV  OU  collage du profil LinkedIn)
//   2. Profil recherché (secteurs, régions, fourchette de prix, exigences clés)
//   3. Proposition de valeur & champs d'expertise
//   4. Traitement (animation de génération)
//   5. Révision du sommaire (formulaire complet, sections modifiables)
//   →  Profil généré : partageable, matché aux entreprises en vente
//
//  L'extraction IA du CV/LinkedIn et la « génération du résumé » seront
//  branchées dans une 2e phase (les boutons sont déjà en place).
//
//  Dépendance : @supabase/supabase-js (configuré par Lovable).
//  Routes : /profil-acquereur (ce builder) et /profil/:token (ProfilPublic).
// ============================================================================

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
//  Référentiels — adaptés au Québec
// ---------------------------------------------------------------------------
const SECTEURS = [
  "SaaS / Logiciel", "Commerce en ligne", "Services professionnels", "Manufacturier",
  "Santé", "Construction", "Commerce de détail", "Restauration / Alimentation",
  "Distribution", "Immobilier", "Commerce de gros", "Services financiers",
  "Assurance", "Agriculture", "Gestion des déchets", "Gestion immobilière",
  "Énergie & services publics", "Services résidentiels", "Conseil financier",
  "Transport", "Technologie", "Tourisme",
];
const REGIONS = [
  "Montréal", "Montérégie", "Capitale-Nationale", "Laurentides", "Lanaudière",
  "Estrie", "Outaouais", "Chaudière-Appalaches", "Mauricie", "Laval",
  "Saguenay–Lac-Saint-Jean", "Centre-du-Québec", "Bas-Saint-Laurent", "Partout au Québec",
];
const PRICE_BRACKETS = [
  { label: "0 – 100 k$", min: 0, max: 100_000 },
  { label: "100 – 200 k$", min: 100_000, max: 200_000 },
  { label: "200 – 300 k$", min: 200_000, max: 300_000 },
  { label: "300 – 500 k$", min: 300_000, max: 500_000 },
  { label: "500 – 750 k$", min: 500_000, max: 750_000 },
  { label: "750 k$ – 1,5 M$", min: 750_000, max: 1_500_000 },
  { label: "1,5 – 2 M$", min: 1_500_000, max: 2_000_000 },
  { label: "2 – 3 M$", min: 2_000_000, max: 3_000_000 },
  { label: "3 – 5 M$", min: 3_000_000, max: 5_000_000 },
  { label: "5 – 10 M$", min: 5_000_000, max: 10_000_000 },
  { label: "10 M$ +", min: 10_000_000, max: null },
];
const EXIGENCES = [
  "Historique de rentabilité", "Faible concentration de clientèle", "Entreprise mature",
  "Revenus récurrents", "Maintien de l'équipe de direction", "Basé sur contrats / mandats",
  "Clientèle diversifiée", "Marge BAIIA élevée", "Accompagnement du cédant",
  "Actifs immobiliers inclus", "Équipe de gestion en place", "Croissance démontrée",
];
const PROPOSITIONS = [
  "Leadership axé sur les personnes et développement d'équipe",
  "Stratégie opérationnelle et optimisation des processus",
  "Analyse financière et gestion budgétaire",
  "Acquisition d'entreprises et évaluation d'investissements",
  "Mobilisation de capitaux et conception organisationnelle",
  "Gestion de projets complexes dans plusieurs secteurs",
  "Entrepreneur-opérateur avec expérience complète du cycle d'affaires",
  "Gestion du changement et amélioration de la performance",
  "Développement des affaires axé sur les relations",
  "Bâtir des systèmes évolutifs et des organisations durables",
];
const EXPERTISES = [
  "Développement des affaires", "Finance", "Consolidation d'équipe", "Marketing",
  "Gestion des opérations", "Analyse financière", "Leadership", "Planification stratégique",
  "Structure de transaction & négociation", "Intégrité & confiance",
  "Développement des personnes", "Gestion de projets complexes", "Optimisation des processus",
  "Intégration technologique", "Croissance des revenus", "Relations clients",
  "Gestion du changement", "Données & analyse", "Opérations SaaS", "Succès client",
  "Stratégie corporative", "Développement de marque", "Développement de partenariats",
  "Expansion de marché", "Amélioration des processus", "Intelligence d'affaires",
  "Analytique & rapports", "Indicateurs de performance", "Acquisition de clients",
];
const TITRES = ["Repreneur", "Entrepreneur en acquisition", "Investisseur", "Groupe familial", "Recherche de fonds (searcher)"];

const STEPS = ["Vérification", "Importer", "Profil recherché", "Proposition de valeur", "Traitement", "Révision"];

// ---------------------------------------------------------------------------
const VIDE: any = {
  // identité
  prenom: "", nom_famille: "", titre: "Repreneur", telephone: "", courriel: "",
  courriel_affiche: "", pays: "Canada", province: "Québec", ville: "", linkedin_url: "", photo_url: "",
  // import
  cv_nom: "", linkedin_texte: "",
  // profil recherché
  secteurs_recherches: [], regions_recherchees: [], type_cible: "entreprise",
  budget_min: "", budget_max: "", prix_range_label: "", exigences_cles: "", these: "", enonce_cible: "",
  revenue_min: "", revenue_max: "", ebitda_min: "",
  // structure / capacité (conservé du modèle précédent, optionnel)
  type_acquisition: "100%", role_post: "operateur", structure_fiscale: "flexible",
  mise_de_fonds: "", capital_total: "", sources_financement: [], preautorisation: "non", pnl_gere: "",
  // proposition & expertise
  proposition_valeur: "", expertises: [], role_actuel: "", resume_experience: "",
  experience_investissement: "", apport_cedant: "",
  // répétables
  experiences: [], formations: [],
  // divers
  annees_experience: "", horizon: "3-6 mois", visibilite: "confidentiel",
  conditions_acceptees: false, identite_verifiee: false,
};

const money = (n: any) => (n === "" || n == null ? "—" : Number(n).toLocaleString("fr-CA") + " $");
const toNum = (v: any) => (v === "" || v == null ? null : Number(v));
const nom_complet = (f: any) => [f.prenom, f.nom_famille].filter(Boolean).join(" ").trim();

// génère l'énoncé cible (gabarit — l'IA le raffinera en phase 2)
function genEnonce(f: any) {
  const sect = (f.secteurs_recherches || []).slice(0, 2).join(" ou ") || "une entreprise établie et rentable";
  const reg = (f.regions_recherchees || []).length
    ? (f.regions_recherchees.includes("Partout au Québec") ? "au Québec" : "en " + f.regions_recherchees.slice(0, 2).join(" ou "))
    : "au Québec";
  const prix = f.prix_range_label ? `, dans une fourchette de ${f.prix_range_label}` : "";
  return `Je souhaite acquérir une entreprise établie dans le secteur ${sect}, ${reg}${prix}.`;
}

// ---------------------------------------------------------------------------
//  UI de base
// ---------------------------------------------------------------------------
const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none";

function Field({ label, hint, children, req }: any) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}{req && <span className="text-emerald-600"> *</span>}</span>
      {hint && <span className="mt-0.5 block text-xs text-slate-400">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
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

// tags multi-sélection avec ajout libre + suggestions
function TagField({ value, onChange, suggestions, placeholder }: any) {
  const [input, setInput] = useState("");
  const add = (t: string) => { const v = t.trim(); if (v && !value.includes(v)) onChange([...value, v]); setInput(""); };
  const remove = (t: string) => onChange(value.filter((x: string) => x !== t));
  return (
    <div>
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((t: string) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white">
              {t}<button type="button" onClick={() => remove(t)} className="text-white/70 hover:text-white">×</button>
            </span>
          ))}
        </div>
      )}
      <input className={inputCls} value={input} onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(input); } }}
        placeholder={placeholder || "Écris puis appuie sur Entrée…"} />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {suggestions.filter((s: string) => !value.includes(s)).map((s: string) => (
          <button key={s} type="button" onClick={() => add(s)}
            className="rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-xs text-slate-500 hover:border-emerald-400 hover:text-emerald-700">
            + {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// zone de texte + suggestions qui s'ajoutent au texte
function SuggestText({ value, onChange, suggestions, rows = 4, placeholder }: any) {
  const append = (t: string) => {
    const sep = value && !value.endsWith("\n") ? "\n" : "";
    onChange(`${value}${sep}• ${t}`);
  };
  return (
    <div>
      <textarea className={inputCls} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {suggestions.map((s: string) => (
          <button key={s} type="button" onClick={() => append(s)}
            className="rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-xs text-slate-500 hover:border-emerald-400 hover:text-emerald-700">
            + {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// éditeur répétable (expériences / formations)
function Repeater({ items, onChange, fields, addLabel }: any) {
  const add = () => onChange([...items, Object.fromEntries(fields.map((f: any) => [f.k, ""]))]);
  const upd = (i: number, k: string, v: string) => onChange(items.map((it: any, j: number) => (j === i ? { ...it, [k]: v } : it)));
  const del = (i: number) => onChange(items.filter((_: any, j: number) => j !== i));
  return (
    <div className="space-y-3">
      {items.map((it: any, i: number) => (
        <div key={i} className="rounded-xl border border-slate-200 p-4">
          <div className="mb-2 flex justify-end">
            <button type="button" onClick={() => del(i)} className="text-xs text-slate-400 hover:text-red-500">Supprimer</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((fl: any) => (
              <div key={fl.k} className={fl.full ? "sm:col-span-2" : ""}>
                <span className="text-xs font-medium text-slate-500">{fl.label}</span>
                {fl.textarea
                  ? <textarea className={inputCls + " mt-1"} rows={2} value={it[fl.k] || ""} onChange={(e) => upd(i, fl.k, e.target.value)} placeholder={fl.ph} />
                  : <input className={inputCls + " mt-1"} value={it[fl.k] || ""} onChange={(e) => upd(i, fl.k, e.target.value)} placeholder={fl.ph} />}
              </div>
            ))}
          </div>
        </div>
      ))}
      <button type="button" onClick={add}
        className="w-full rounded-xl border border-dashed border-slate-300 py-2.5 text-sm font-medium text-slate-500 hover:border-emerald-400 hover:text-emerald-700">
        + {addLabel}
      </button>
    </div>
  );
}

// ============================================================================
export default function ProfilAcquereurBuilder() {
  const [step, setStep] = useState(0);
  const [f, setF] = useState<any>(VIDE);
  const [id, setId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [matches, setMatches] = useState<any[] | null>(null);

  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const toggle = (k: string, v: string) =>
    setF((p: any) => ({ ...p, [k]: p[k].includes(v) ? p[k].filter((x: string) => x !== v) : [...p[k], v] }));

  useEffect(() => {
    const saved = localStorage.getItem("gc_profil_acquereur");
    if (saved) { try { const d = JSON.parse(saved); setF({ ...VIDE, ...d.f }); setId(d.id || null); if (d.step) setStep(d.step); } catch {} }
  }, []);

  const payload = () => ({
    prenom: f.prenom, nom_famille: f.nom_famille, nom: nom_complet(f), titre: f.titre,
    telephone: f.telephone, courriel: f.courriel, courriel_affiche: f.courriel_affiche || f.courriel,
    pays: f.pays, province: f.province, ville: f.ville, linkedin_url: f.linkedin_url, photo_url: f.photo_url || null,
    cv_nom: f.cv_nom, linkedin_texte: f.linkedin_texte, identite_verifiee: f.identite_verifiee,
    secteurs_recherches: f.secteurs_recherches, regions_recherchees: f.regions_recherchees, type_cible: f.type_cible,
    budget_min: toNum(f.budget_min), budget_max: toNum(f.budget_max), prix_range_label: f.prix_range_label,
    revenue_min: toNum(f.revenue_min), revenue_max: toNum(f.revenue_max), ebitda_min: toNum(f.ebitda_min),
    exigences_cles: f.exigences_cles, these: f.these, enonce_cible: f.enonce_cible,
    type_acquisition: f.type_acquisition, role_post: f.role_post, structure_fiscale: f.structure_fiscale,
    mise_de_fonds: toNum(f.mise_de_fonds), capital_total: toNum(f.capital_total),
    sources_financement: f.sources_financement, preautorisation: f.preautorisation, pnl_gere: toNum(f.pnl_gere),
    proposition_valeur: f.proposition_valeur, expertises: f.expertises, role_actuel: f.role_actuel,
    resume_experience: f.resume_experience, experience_investissement: f.experience_investissement,
    apport_cedant: f.apport_cedant, experiences: f.experiences, formations: f.formations,
    annees_experience: toNum(f.annees_experience), horizon: f.horizon, visibilite: f.visibilite,
    conditions_acceptees: f.conditions_acceptees,
  });

  async function persist(extra: any = {}) {
    setSaving(true);
    try {
      const body = { ...payload(), ...extra };
      if (id) {
        await supabase.from("profils_acheteurs").update({ ...body, updated_at: new Date().toISOString() }).eq("id", id);
      } else {
        const { data } = await supabase.from("profils_acheteurs").insert(body).select("id, share_token").single();
        if (data) { setId(data.id); setToken(data.share_token); }
      }
      localStorage.setItem("gc_profil_acquereur", JSON.stringify({ f: { ...f, ...extra }, id, step }));
    } finally { setSaving(false); }
  }

  const goto = async (s: number) => { await persist(); setStep(s); window.scrollTo({ top: 0 }); };

  async function soumettre() {
    const enonce = f.enonce_cible || genEnonce(f);
    set("enonce_cible", enonce);
    await persist({ enonce_cible: enonce });
    if (!token && id) {
      const { data } = await supabase.from("profils_acheteurs").select("share_token").eq("id", id).single();
      if (data) setToken(data.share_token);
    }
    try {
      const { data } = await supabase.functions.invoke("match", { body: { profil: payload() } });
      setMatches(data?.matches || []);
    } catch { setMatches([]); }
    setDone(true);
    window.scrollTo({ top: 0 });
  }

  const shareUrl = token ? `${window.location.origin}/profil/${token}` : "";

  // -------------------------------------------------------------------------
  //  PROFIL GÉNÉRÉ
  // -------------------------------------------------------------------------
  if (done) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ProfilCard f={f} />
        <div className="mt-6 flex flex-wrap gap-3 print:hidden">
          {shareUrl && (
            <button onClick={() => navigator.clipboard.writeText(shareUrl)}
              className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
              🔗 Partager mon profil
            </button>
          )}
          {/* La génération du résumé sera branchée en phase 2 */}
          <button disabled title="Bientôt disponible"
            className="cursor-not-allowed rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-400">
            📄 Générer mon résumé (bientôt)
          </button>
          <button onClick={() => window.print()}
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            ⬇ Télécharger (PDF)
          </button>
          <button onClick={() => { setDone(false); setStep(5); }}
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            ✎ Modifier
          </button>
        </div>
        {shareUrl && (
          <p className="mt-2 text-xs text-slate-500 print:hidden">
            Lien privé : <span className="font-mono text-slate-700">{shareUrl}</span>
            {f.visibilite !== "public" && " — deviendra actif quand tu rendras le profil public."}
          </p>
        )}
        <MatchList matches={matches} />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  //  BUILDER
  // -------------------------------------------------------------------------
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      {/* progression */}
      <div className="mb-8">
        <div className="flex items-center">
          {STEPS.map((s, i) => (
            <div key={s} className="flex flex-1 items-center last:flex-none">
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                i < step ? "bg-emerald-600 text-white" : i === step ? "bg-emerald-600 text-white ring-4 ring-emerald-100" : "bg-slate-200 text-slate-500"}`}>
                {i < step ? "✓" : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 ${i < step ? "bg-emerald-600" : "bg-slate-200"}`} />}
            </div>
          ))}
        </div>
        <div className="mt-2 text-sm font-medium text-slate-700">Étape {step + 1} — {STEPS[step]}</div>
      </div>

      {step === 0 && <StepVerify f={f} set={set} onVerified={(courriel: string) => { set("courriel", courriel); set("identite_verifiee", true); goto(1); }} />}

      {step === 1 && <StepImport f={f} set={set} />}

      {step === 2 && (
        <div className="space-y-6">
          <Field label="Type d'entreprise / secteur visé" req hint="Aussi précis ou large que tu veux. Sélectionne ou ajoute les tiens.">
            <TagField value={f.secteurs_recherches} onChange={(v: any) => set("secteurs_recherches", v)} suggestions={SECTEURS} placeholder="Ex. Manufacturier de précision…" />
          </Field>
          <Field label="Régions visées" hint="Améliore le pairage avec les entreprises en vente.">
            <div className="flex flex-wrap gap-2">
              {REGIONS.map((r) => <Chip key={r} label={r} on={f.regions_recherchees.includes(r)} toggle={() => toggle("regions_recherchees", r)} />)}
            </div>
          </Field>
          <Field label="Fourchette de prix d'acquisition" req hint="Saisis un montant ou choisis une tranche.">
            <div className="grid grid-cols-2 gap-3">
              <input type="number" className={inputCls} value={f.budget_min} onChange={(e) => { set("budget_min", e.target.value); set("prix_range_label", ""); }} placeholder="Minimum ($)" />
              <input type="number" className={inputCls} value={f.budget_max} onChange={(e) => { set("budget_max", e.target.value); set("prix_range_label", ""); }} placeholder="Maximum ($)" />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PRICE_BRACKETS.map((b) => (
                <Chip key={b.label} label={b.label} on={f.prix_range_label === b.label}
                  toggle={() => { set("prix_range_label", b.label); set("budget_min", String(b.min)); set("budget_max", b.max == null ? "" : String(b.max)); }} />
              ))}
            </div>
          </Field>
          <Field label="Exigences clés" req hint="Tes incontournables, tes points de rupture, tes critères essentiels.">
            <SuggestText value={f.exigences_cles} onChange={(v: any) => set("exigences_cles", v)} suggestions={EXIGENCES}
              placeholder="Décris ce qui compte le plus pour toi dans une acquisition idéale…" />
          </Field>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            Ta proposition de valeur et tes champs d'expertise te démarquent aux yeux des cédants. Sois descriptif : ce qui te distingue nous aide à te positionner sur le bon dossier.
          </div>
          <Field label="Ta proposition de valeur" hint="Ce que tu apportes d'unique comme repreneur. Pourquoi es-tu le bon opérateur ?">
            <SuggestText value={f.proposition_valeur} onChange={(v: any) => set("proposition_valeur", v)} suggestions={PROPOSITIONS} rows={5}
              placeholder="Décris ta valeur ajoutée…" />
          </Field>
          <Field label="Champs d'expertise" hint="Vise une dizaine de compétences démontrables, pertinentes à l'entreprise convoitée.">
            <TagField value={f.expertises} onChange={(v: any) => set("expertises", v)} suggestions={EXPERTISES} placeholder="Ajoute une compétence…" />
          </Field>
        </div>
      )}

      {step === 4 && <StepProcessing onDone={() => goto(5)} />}

      {step === 5 && (
        <div className="space-y-8">
          {/* 1. Renseignements personnels */}
          <Section title="Renseignements personnels" sub="Coordonnées et détails de base du profil.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Prénom" req><input className={inputCls} value={f.prenom} onChange={(e) => set("prenom", e.target.value)} /></Field>
              <Field label="Nom" req><input className={inputCls} value={f.nom_famille} onChange={(e) => set("nom_famille", e.target.value)} /></Field>
              <Field label="Téléphone" req><input className={inputCls} value={f.telephone} onChange={(e) => set("telephone", e.target.value)} /></Field>
              <Field label="Comment tu te présentes"><select className={inputCls} value={f.titre} onChange={(e) => set("titre", e.target.value)}>{TITRES.map((t) => <option key={t}>{t}</option>)}</select></Field>
              <Field label="Pays" req><input className={inputCls} value={f.pays} onChange={(e) => set("pays", e.target.value)} /></Field>
              <Field label="Province" req><input className={inputCls} value={f.province} onChange={(e) => set("province", e.target.value)} /></Field>
              <Field label="Ville" req><input className={inputCls} value={f.ville} onChange={(e) => set("ville", e.target.value)} /></Field>
              <Field label="Profil LinkedIn" req><input className={inputCls} value={f.linkedin_url} onChange={(e) => set("linkedin_url", e.target.value)} placeholder="https://linkedin.com/in/…" /></Field>
              <Field label="Adresse courriel"><input className={inputCls} value={f.courriel} onChange={(e) => set("courriel", e.target.value)} /></Field>
              <Field label="Courriel affiché"><input className={inputCls} value={f.courriel_affiche} onChange={(e) => set("courriel_affiche", e.target.value)} placeholder={f.courriel} /></Field>
            </div>
          </Section>

          {/* 2. Cible d'acquisition */}
          <Section title="Cible d'acquisition" sub="Secteur, fourchette de prix et énoncé de recherche.">
            <div className="space-y-3">
              <Line k="Secteurs" v={(f.secteurs_recherches || []).join(", ") || "—"} />
              <Line k="Régions" v={(f.regions_recherchees || []).join(", ") || "Partout au Québec"} />
              <Line k="Fourchette de prix" v={f.prix_range_label || `${money(f.budget_min)} – ${money(f.budget_max)}`} />
              <Field label="Énoncé cible" hint="Généré à partir de tes réponses — ajuste-le à ta voix.">
                <textarea className={inputCls} rows={2} value={f.enonce_cible || genEnonce(f)} onChange={(e) => set("enonce_cible", e.target.value)} />
              </Field>
            </div>
          </Section>

          {/* 3. Réalisations & impact */}
          <Section title="Réalisations & impact" sub="Met en valeur des réalisations mesurables et l'impact généré.">
            <div className="space-y-4">
              <Field label="Rôle / poste actuel"><input className={inputCls} value={f.role_actuel} onChange={(e) => set("role_actuel", e.target.value)} placeholder="Ex. Directeur des opérations" /></Field>
              <Field label="Sommaire d'expérience"><textarea className={inputCls} rows={3} value={f.resume_experience} onChange={(e) => set("resume_experience", e.target.value)} placeholder="Résumé de ton parcours…" /></Field>
              <div>
                <div className="mb-2 text-sm font-medium text-slate-700">Expérience professionnelle</div>
                <Repeater items={f.experiences} onChange={(v: any) => set("experiences", v)} addLabel="Ajouter une expérience"
                  fields={[
                    { k: "role", label: "Poste", ph: "Ex. Directeur marketing" },
                    { k: "entreprise", label: "Entreprise", ph: "Où as-tu travaillé ?" },
                    { k: "debut", label: "Début", ph: "Ex. 2020" },
                    { k: "fin", label: "Fin", ph: "Ex. 2025 ou Présent" },
                    { k: "details", label: "Détails de l'expérience", ph: "Réalisations, responsabilités…", full: true, textarea: true },
                  ]} />
              </div>
              <div>
                <div className="mb-2 text-sm font-medium text-slate-700">Formation & certifications</div>
                <Repeater items={f.formations} onChange={(v: any) => set("formations", v)} addLabel="Ajouter une formation"
                  fields={[
                    { k: "diplome", label: "Diplôme / certification", ph: "Ex. MBA" },
                    { k: "etablissement", label: "Établissement", ph: "Ex. HEC Montréal" },
                    { k: "debut", label: "Début", ph: "Ex. 2015" },
                    { k: "fin", label: "Fin", ph: "Ex. 2017" },
                    { k: "details", label: "Détails", ph: "Mention, spécialisation…", full: true, textarea: true },
                  ]} />
              </div>
            </div>
          </Section>

          {/* 4. Investissement & vision d'affaires */}
          <Section title="Investissement & vision d'affaires" sub="Ton approche d'investissement et tes critères d'acquisition.">
            <div className="space-y-4">
              <Field label="Proposition de valeur"><textarea className={inputCls} rows={4} value={f.proposition_valeur} onChange={(e) => set("proposition_valeur", e.target.value)} /></Field>
              <Field label="Champs d'expertise"><TagField value={f.expertises} onChange={(v: any) => set("expertises", v)} suggestions={EXPERTISES} /></Field>
              <Field label="Expérience d'investissement"><textarea className={inputCls} rows={3} value={f.experience_investissement} onChange={(e) => set("experience_investissement", e.target.value)} placeholder="Acquisitions, investissements ou projets antérieurs…" /></Field>
            </div>
          </Section>

          {/* Confidentialité + consentement */}
          <Section title="Confidentialité & protection des données" sub="">
            <p className="text-sm text-slate-600">
              Tes renseignements ne seront partagés qu'avec des cédants vérifiés dont l'entreprise correspond à tes critères d'acquisition.
              En continuant, tu acceptes nos <a href="/conditions" className="text-emerald-700 underline">Conditions d'utilisation</a> et notre <a href="/confidentialite" className="text-emerald-700 underline">Politique de confidentialité (Loi 25)</a>.
            </p>
            <Field label="Visibilité du profil" hint="Public : ton lien de partage affiche une carte SANS tes coordonnées. Confidentiel : équipe GC seulement.">
              <div className="flex gap-2">
                <Chip label="🔒 Confidentiel" on={f.visibilite === "confidentiel"} toggle={() => set("visibilite", "confidentiel")} />
                <Chip label="🔗 Partageable (public)" on={f.visibilite === "public"} toggle={() => set("visibilite", "public")} />
              </div>
            </Field>
            <label className="mt-3 flex items-start gap-3">
              <input type="checkbox" checked={f.conditions_acceptees} onChange={(e) => set("conditions_acceptees", e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
              <span className="text-sm text-slate-600">
                J'accepte les Conditions d'utilisation et la Politique de confidentialité. En soumettant, je reconnais avoir lu et accepté les modalités.
              </span>
            </label>
          </Section>
        </div>
      )}

      {/* navigation (masquée pendant vérification et traitement) */}
      {step !== 0 && step !== 4 && (
        <div className="mt-8 flex items-center justify-between">
          <button onClick={() => goto(Math.max(step - 1, 0))}
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">← Retour</button>
          <span className="text-xs text-slate-400">{saving ? "Sauvegarde…" : id ? "Sauvegardé" : ""}</span>
          {step < 5 ? (
            <button onClick={() => goto(step + 1)}
              className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">Continuer →</button>
          ) : (
            <button onClick={soumettre} disabled={!f.conditions_acceptees}
              className="rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40">
              Soumettre & générer le profil ✓
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
//  ÉTAPE 0 — Vérification d'identité (code à 6 chiffres)
//  Courriel : via Supabase Auth OTP (fonctionne d'emblée dans Lovable Cloud).
//  SMS : nécessite un fournisseur (Twilio) activé dans Supabase > Auth.
// ============================================================================
function StepVerify({ f, set, onVerified }: any) {
  const [method, setMethod] = useState<"email" | "sms">("email");
  const [contact, setContact] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function envoyer() {
    setBusy(true); setMsg("");
    try {
      const opts = method === "email"
        ? { email: contact, options: { shouldCreateUser: true } }
        : { phone: contact, options: { shouldCreateUser: true } };
      const { error } = await supabase.auth.signInWithOtp(opts as any);
      if (error) throw error;
      setSent(true);
      setMsg(method === "email" ? "Code envoyé par courriel." : "Code envoyé par texto.");
    } catch (e: any) {
      setMsg("Impossible d'envoyer le code : " + (e?.message || e) + (method === "sms" ? " (le SMS requiert un fournisseur activé dans Supabase.)" : ""));
    } finally { setBusy(false); }
  }

  async function verifier() {
    setBusy(true); setMsg("");
    try {
      const args = method === "email"
        ? { email: contact, token: code, type: "email" as const }
        : { phone: contact, token: code, type: "sms" as const };
      const { error } = await supabase.auth.verifyOtp(args as any);
      if (error) throw error;
      if (method === "email") set("courriel", contact); else set("telephone", contact);
      onVerified(method === "email" ? contact : f.courriel);
    } catch (e: any) {
      setMsg("Code invalide ou expiré. Réessaie.");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
        Vérifions ton identité. Reçois un code à 6 chiffres par courriel ou par texto, puis saisis-le ci-dessous.
      </div>
      <div className="flex gap-2">
        <Chip label="✉ Par courriel" on={method === "email"} toggle={() => { setMethod("email"); setSent(false); }} />
        <Chip label="📱 Par cellulaire" on={method === "sms"} toggle={() => { setMethod("sms"); setSent(false); }} />
      </div>
      <Field label={method === "email" ? "Adresse courriel" : "Numéro de cellulaire"} req hint={method === "sms" ? "Format international, ex. +15140000000" : undefined}>
        <input className={inputCls} value={contact} onChange={(e) => setContact(e.target.value)}
          placeholder={method === "email" ? "toi@courriel.com" : "+1 514 000-0000"} disabled={sent} />
      </Field>

      {!sent ? (
        <button onClick={envoyer} disabled={busy || !contact}
          className="w-full rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">
          {busy ? "Envoi…" : "Envoyer le code"}
        </button>
      ) : (
        <>
          <Field label="Code à 6 chiffres" req>
            <input className={inputCls + " text-center text-lg tracking-[0.5em]"} value={code} maxLength={6}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="••••••" />
          </Field>
          <div className="flex gap-3">
            <button onClick={() => { setSent(false); setCode(""); }} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50">Changer</button>
            <button onClick={verifier} disabled={busy || code.length !== 6}
              className="flex-1 rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40">
              {busy ? "Vérification…" : "Vérifier mon identité →"}
            </button>
          </div>
        </>
      )}
      {msg && <p className="text-xs text-slate-500">{msg}</p>}
    </div>
  );
}

// ============================================================================
//  ÉTAPE 1 — Import (CV en glisser-déposer OU collage LinkedIn)
//  L'extraction IA sera branchée en phase 2 ; ici on capture la source.
// ============================================================================
function StepImport({ f, set }: any) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file?: File) => { if (file) set("cv_nom", file.name); };

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
        Accélère la construction de ton profil : dépose ton CV, ou colle ton profil LinkedIn. Tu pourras tout réviser et compléter à l'étape suivante.
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files?.[0]); }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition ${
          drag ? "border-emerald-500 bg-emerald-50" : "border-slate-300 hover:border-emerald-400"}`}>
        <div className="text-3xl">📄</div>
        <div className="mt-2 text-sm font-medium text-slate-700">{f.cv_nom || "Glisse ton CV ici, ou clique pour choisir un fichier"}</div>
        <div className="mt-1 text-xs text-slate-400">PDF, Word ou texte</div>
        <input ref={inputRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] || undefined)} />
      </div>

      <div className="flex items-center gap-3 text-xs text-slate-400">
        <div className="h-px flex-1 bg-slate-200" /> OU <div className="h-px flex-1 bg-slate-200" />
      </div>

      <Field label="Colle ton profil LinkedIn" hint="Copie le contenu de ta page LinkedIn (À propos, expériences, formation).">
        <textarea className={inputCls} rows={6} value={f.linkedin_texte} onChange={(e) => set("linkedin_texte", e.target.value)}
          placeholder="Colle ici le texte de ton profil LinkedIn…" />
      </Field>
      <Field label="ou l'URL de ton profil LinkedIn">
        <input className={inputCls} value={f.linkedin_url} onChange={(e) => set("linkedin_url", e.target.value)} placeholder="https://linkedin.com/in/…" />
      </Field>

      <p className="text-xs text-slate-400">
        L'extraction automatique (CV/LinkedIn → profil pré-rempli) sera activée sous peu. Pour l'instant, tu peux passer à l'étape suivante et remplir manuellement — c'est rapide.
      </p>
    </div>
  );
}

// ============================================================================
//  ÉTAPE 4 — Traitement (animation)
// ============================================================================
function StepProcessing({ onDone }: any) {
  const CHECKS = ["Extraction des informations…", "Analyse de l'expérience…", "Identification des réalisations…", "Organisation de la formation…"];
  const [pct, setPct] = useState(0);
  const [checks, setChecks] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setPct((p) => (p >= 100 ? 100 : p + 2)), 45);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const c = Math.min(CHECKS.length, Math.floor(pct / 25) + (pct >= 100 ? 1 : 0));
    setChecks(c);
    if (pct >= 100) { const t = setTimeout(onDone, 700); return () => clearTimeout(t); }
  }, [pct]);

  return (
    <div className="py-8">
      <div className="text-center">
        <div className="text-sm font-medium text-slate-700">Construction de ton profil…</div>
        <div className="mx-auto mt-4 h-2 max-w-sm overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1 text-xs text-slate-400">{pct}%</div>
      </div>
      <div className="mx-auto mt-6 max-w-sm space-y-2">
        {CHECKS.map((c, i) => (
          <div key={c} className={`flex items-center gap-2 text-sm transition ${i < checks ? "text-emerald-700" : "text-slate-400"}`}>
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${i < checks ? "bg-emerald-600 text-white" : "bg-slate-200"}`}>
              {i < checks ? "✓" : "•"}
            </span>
            {c}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
//  Liste des correspondances (partagée avec l'écran final)
// ============================================================================
function MatchList({ matches }: { matches: any[] | null }) {
  return (
    <div className="mt-10 print:hidden">
      <h3 className="text-lg font-semibold text-slate-900">
        Entreprises qui correspondent à ton profil
        {matches && <span className="ml-2 text-sm font-normal text-slate-500">{matches.length} correspondance(s)</span>}
      </h3>
      {!matches && <p className="mt-2 text-sm text-slate-500">Analyse en cours…</p>}
      {matches && matches.length === 0 && (
        <p className="mt-2 text-sm text-slate-500">Aucune correspondance publique pour l'instant — l'équipe GC te contactera dès qu'une cible correspond.</p>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(matches || []).slice(0, 8).map((m: any) => (
          <a key={m.id} href={m.source_url} target="_blank" rel="noopener"
            className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-emerald-400 hover:shadow-sm">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">{m.score}% compatible</span>
              <span className="text-xs text-slate-400">{m.region}</span>
            </div>
            <div className="mt-2 line-clamp-2 text-sm font-medium text-slate-800">{m.title}</div>
            <div className="mt-1 text-xs text-slate-500">{m.sector} · {m.asking_price_text || "prix sur demande"}</div>
          </a>
        ))}
      </div>
    </div>
  );
}

const Section = ({ title, sub, children }: any) => (
  <div className="rounded-2xl border border-slate-200 p-5">
    <div className="mb-4 border-b border-slate-100 pb-3">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
    {children}
  </div>
);
const Line = ({ k, v }: any) => (
  <div className="flex justify-between gap-3 text-sm"><span className="text-slate-500">{k}</span><span className="text-right font-medium text-slate-800">{v}</span></div>
);

// ============================================================================
//  CARTE / PROFIL GÉNÉRÉ — brandé GC Repreneuriat
//  Réutilisé par l'écran final ET la page publique /profil/:token
// ============================================================================
export function ProfilCard({ f }: { f: any }) {
  const nom = nom_complet(f) || f.nom || "Profil de repreneur";
  const initiales = (nom || "?").split(" ").map((x: string) => x[0]).slice(0, 2).join("").toUpperCase();
  const localisation = [f.ville, f.province].filter(Boolean).join(", ");
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print:shadow-none">
      <div className="relative h-24 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-900">
        <div className="absolute right-4 top-4 text-xs font-semibold tracking-wide text-white/70">GC REPRENEURIAT</div>
      </div>
      <div className="px-6 pb-6">
        <div className="-mt-10 flex items-end gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border-4 border-white bg-emerald-600 text-2xl font-bold text-white shadow">
            {f.photo_url ? <img src={f.photo_url} alt="" className="h-full w-full object-cover" /> : initiales}
          </div>
          <div className="pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">{nom}</h2>
              {f.verifie && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 ring-1 ring-sky-200">✓ Vérifié</span>}
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">Prêt à acquérir</span>
            </div>
            <div className="text-sm text-slate-500">{f.titre}{localisation && ` · ${localisation}`}</div>
          </div>
        </div>

        {(f.enonce_cible || f.these) && (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm italic text-slate-700">« {f.enonce_cible || f.these} »</p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Capital mobilisable" value={money(f.capital_total)} />
          <Stat label="Fourchette de prix" value={f.prix_range_label || `${money(f.budget_min)}+`} />
          <Stat label="Expérience" value={f.annees_experience ? `${f.annees_experience} ans` : "—"} />
          <Stat label="P&L géré" value={money(f.pnl_gere)} />
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Block title="Cible d'acquisition">
            <Line k="Secteurs" v={(f.secteurs_recherches || []).join(", ") || "Ouvert"} />
            <Line k="Régions" v={(f.regions_recherchees || []).join(", ") || "Tout le Québec"} />
            <Line k="Prix" v={f.prix_range_label || `${money(f.budget_min)} – ${money(f.budget_max)}`} />
            <Line k="Rôle post-transaction" v={f.role_post || "—"} />
          </Block>
          <Block title="Profil du repreneur">
            <Line k="Poste actuel" v={f.role_actuel || "—"} />
            <Line k="Structure visée" v={f.structure_fiscale || "flexible"} />
            <Line k="Horizon" v={f.horizon || "—"} />
            <Line k="Pré-autorisation" v={f.preautorisation === "oui" ? "Obtenue" : f.preautorisation === "en_cours" ? "En cours" : "—"} />
          </Block>
        </div>

        {f.proposition_valeur && (
          <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
            <div className="text-xs font-semibold text-emerald-800">Proposition de valeur</div>
            <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{f.proposition_valeur}</p>
          </div>
        )}

        {(f.expertises?.length > 0) && (
          <div className="mt-4">
            <div className="text-xs font-medium text-slate-500">Champs d'expertise</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">{f.expertises.map((x: string) => <Tag key={x}>{x}</Tag>)}</div>
          </div>
        )}

        {f.exigences_cles && (
          <div className="mt-4">
            <div className="text-xs font-medium text-slate-500">Exigences clés</div>
            <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{f.exigences_cles}</p>
          </div>
        )}

        {(f.experiences?.length > 0) && (
          <div className="mt-4">
            <div className="text-xs font-medium text-slate-500">Expérience professionnelle</div>
            <div className="mt-2 space-y-2">
              {f.experiences.map((e: any, i: number) => (
                <div key={i} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-slate-800">{e.role}{e.entreprise && ` · ${e.entreprise}`}</span>
                    <span className="text-xs text-slate-400">{[e.debut, e.fin].filter(Boolean).join(" – ")}</span>
                  </div>
                  {e.details && <p className="mt-1 text-xs text-slate-500">{e.details}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {(f.formations?.length > 0) && (
          <div className="mt-4">
            <div className="text-xs font-medium text-slate-500">Formation & certifications</div>
            <div className="mt-2 space-y-1.5">
              {f.formations.map((e: any, i: number) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-slate-700">{e.diplome}{e.etablissement && ` · ${e.etablissement}`}</span>
                  <span className="text-xs text-slate-400">{[e.debut, e.fin].filter(Boolean).join(" – ")}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {f.experience_investissement && (
          <div className="mt-4">
            <div className="text-xs font-medium text-slate-500">Expérience d'investissement</div>
            <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{f.experience_investissement}</p>
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
const Tag = ({ children }: any) => (
  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{children}</span>
);
