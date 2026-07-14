-- =====================================================================
-- Patch — Objectif de rendement par portefeuille
-- À exécuter APRÈS supabase_portefeuilles.sql.
-- Ajoute une colonne cible_rendement (texte) et la remplit par profil,
-- pour que le badge « Objectif de rendement » soit modifiable via l'admin
-- plutôt que codé en dur dans l'interface.
-- Ré-exécutable sans risque.
-- =====================================================================

alter table public.portefeuilles_modeles
  add column if not exists cible_rendement text;

update public.portefeuilles_modeles set cible_rendement = '3 à 4 %'  where profil = 'prudent';
update public.portefeuilles_modeles set cible_rendement = '4 à 6 %'  where profil = 'modéré';
update public.portefeuilles_modeles set cible_rendement = '5 à 6 %'  where profil = 'équilibré';
update public.portefeuilles_modeles set cible_rendement = '6 à 8 %'  where profil = 'croissance';
update public.portefeuilles_modeles set cible_rendement = '8 à 10 %' where profil = 'audacieux';
