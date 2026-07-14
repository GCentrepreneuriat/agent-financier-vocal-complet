-- ============================================================================
--  PROFIL D'ACQUÉREUR v3  — flow complet façon SearcherList
--  ALTER (ne détruit RIEN). À exécuter APRÈS profils_acheteurs_v2.sql.
--  Ajoute les champs du parcours : identité, import, expériences,
--  formations, proposition de valeur, énoncé cible, exigences.
-- ============================================================================

alter table public.profils_acheteurs
  -- Identité (SearcherList sépare prénom/nom + localisation détaillée)
  add column if not exists prenom            text,
  add column if not exists nom_famille       text,
  add column if not exists pays              text default 'Canada',
  add column if not exists province          text default 'Québec',
  add column if not exists linkedin_url      text,
  add column if not exists courriel_affiche  text,
  add column if not exists identite_verifiee boolean default false,
  -- Import (CV / profil LinkedIn collé — l'extraction IA viendra plus tard)
  add column if not exists cv_nom            text,
  add column if not exists cv_url            text,
  add column if not exists linkedin_texte    text,
  -- Profil recherché
  add column if not exists prix_range_label  text,          -- ex. « 750 k$ – 1,5 M$ »
  add column if not exists exigences_cles    text,          -- Key Requirements
  add column if not exists enonce_cible      text,          -- Target statement (IA plus tard)
  -- Proposition de valeur & expertise
  add column if not exists proposition_valeur text,         -- Value Proposition
  add column if not exists role_actuel       text,          -- Current role / position
  add column if not exists resume_experience text,          -- Experience summary
  add column if not exists experience_investissement text,  -- Investment Experience
  -- Répétables (stockés en JSONB)
  add column if not exists experiences       jsonb default '[]'::jsonb,   -- [{role,entreprise,debut,fin,details}]
  add column if not exists formations        jsonb default '[]'::jsonb,   -- [{diplome,etablissement,debut,fin,details}]
  -- Consentement
  add column if not exists conditions_acceptees boolean default false;

-- Ajouter les nouveaux champs à la vue publique (coordonnées toujours exclues)
create or replace view public.profils_acheteurs_publics as
select
  share_token, titre, prenom, nom_famille, ville, province, pays, these, photo_url, linkedin_url,
  secteurs_recherches, regions_recherchees, type_cible,
  budget_min, budget_max, prix_range_label, revenue_min, revenue_max,
  type_acquisition, role_post, structure_fiscale, exigences_cles, enonce_cible,
  mise_de_fonds, capital_total, sources_financement, preautorisation, pnl_gere,
  annees_experience, expertises, deja_proprietaire, apport_cedant,
  proposition_valeur, role_actuel, resume_experience, experience_investissement,
  experiences, formations, horizon, verifie, nom
from public.profils_acheteurs
where visibilite = 'public';
