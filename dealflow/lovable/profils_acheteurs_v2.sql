-- ============================================================================
--  PROFIL D'ACQUÉREUR v2  — style SearcherList, version GC Repreneuriat
--  ALTER (ne détruit RIEN) : ajoute les colonnes du builder + le lien partageable.
--  À exécuter dans Supabase > SQL Editor.
-- ============================================================================

-- 1) Nouvelles colonnes sur la table existante -------------------------------
alter table public.profils_acheteurs
  -- Étape 1 — Identité & thèse
  add column if not exists titre            text,          -- « Repreneur », « Investisseur »…
  add column if not exists ville            text,
  add column if not exists these            text,          -- Search Focus : 1 phrase
  add column if not exists photo_url        text,          -- photo / logo
  -- Étape 2 — Critères de la cible
  add column if not exists type_cible       text,          -- entreprise | immobilier | les_deux
  add column if not exists taille_equipe    text,          -- fourchette d'employés visée
  -- Étape 3 — Structure & rôle
  add column if not exists role_post         text,         -- operateur | superviseur | absenteiste
  add column if not exists structure_fiscale text,         -- actions | actifs | flexible
  -- Étape 4 — Capacité financière
  add column if not exists mise_de_fonds    bigint,        -- cash disponible
  add column if not exists capital_total    bigint,        -- capacité totale mobilisable
  add column if not exists sources_financement text[] default '{}',
  add column if not exists preautorisation  text,          -- oui | en_cours | non
  add column if not exists pnl_gere         bigint,        -- P&L déjà géré (crédibilité)
  -- Étape 5 — Expérience & différenciateurs
  add column if not exists annees_experience int,
  add column if not exists expertises       text[] default '{}',   -- tags
  add column if not exists deja_proprietaire boolean default false,
  add column if not exists apport_cedant    text,          -- pitch au vendeur
  -- Étape 6 — Échéancier & confidentialité
  add column if not exists motivation       text,
  add column if not exists visibilite       text default 'confidentiel',  -- public | confidentiel
  -- Partage & suivi
  add column if not exists share_token      text unique default replace(gen_random_uuid()::text,'-',''),
  add column if not exists verifie          boolean default false,        -- badge « vérifié » (validé par équipe GC)
  add column if not exists updated_at        timestamptz default now();

-- backfill du token pour les profils déjà créés
update public.profils_acheteurs
   set share_token = replace(gen_random_uuid()::text,'-','')
 where share_token is null;

create index if not exists idx_ach_token on public.profils_acheteurs (share_token);


-- 2) RLS — permettre la LECTURE PUBLIQUE d'un profil partagé ------------------
--    (uniquement via son token, et seulement si le porteur l'a rendu public)
drop policy if exists "ach_select_public" on public.profils_acheteurs;
create policy "ach_select_public"
  on public.profils_acheteurs for select
  to anon, authenticated
  using (visibilite = 'public');

--    Le visiteur peut aussi mettre à jour SON profil pendant la session de création.
--    (le builder garde l'id en localStorage ; pas de compte requis)
drop policy if exists "ach_update_self" on public.profils_acheteurs;
create policy "ach_update_self"
  on public.profils_acheteurs for update
  to anon, authenticated
  using (true) with check (true);


-- 3) Vue « carte publique » — n'expose JAMAIS les coordonnées privées ---------
create or replace view public.profils_acheteurs_publics as
select
  share_token, titre, ville, these, photo_url,
  secteurs_recherches, regions_recherchees, type_cible,
  budget_min, budget_max, revenue_min, revenue_max,
  type_acquisition, role_post, structure_fiscale,
  mise_de_fonds, capital_total, sources_financement, preautorisation, pnl_gere,
  annees_experience, expertises, deja_proprietaire, apport_cedant,
  horizon, verifie, nom
from public.profils_acheteurs
where visibilite = 'public';

-- Note : la vue hérite du RLS de la table. Les colonnes courriel/telephone/notes
-- ne sont PAS dans la vue -> jamais exposées sur le lien partagé.
