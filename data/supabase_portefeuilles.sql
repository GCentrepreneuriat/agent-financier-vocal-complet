-- =====================================================================
-- Import Supabase — Portefeuilles-modèles par profil d'investisseur
-- Portefeuilles FIXES (un par profil). Rééquilibrage manuel via l'admin.
-- À exécuter APRÈS supabase_import.sql (dépend des tables fonds et profils_allocation).
-- =====================================================================

create table if not exists public.portefeuilles_modeles (
  profil             text primary key references public.profils_allocation(profil),
  titre              text not null,
  resume             text,
  cible_revenu       int,
  cible_actions      int,
  contexte_marche    text,
  date_rebalancement date,
  maj_le             timestamptz default now()
);

create table if not exists public.lignes_portefeuille (
  id          bigserial primary key,
  profil      text not null references public.portefeuilles_modeles(profil) on delete cascade,
  code_fonds  text not null references public.fonds(code),
  poids       numeric not null,
  role        text,
  ordre       int
);
create index if not exists idx_lignes_profil on public.lignes_portefeuille(profil);

alter table public.portefeuilles_modeles enable row level security;
alter table public.lignes_portefeuille enable row level security;
drop policy if exists "portefeuilles lisibles authentifies" on public.portefeuilles_modeles;
create policy "portefeuilles lisibles authentifies" on public.portefeuilles_modeles
  for select to authenticated using (true);
drop policy if exists "lignes lisibles authentifies" on public.lignes_portefeuille;
create policy "lignes lisibles authentifies" on public.lignes_portefeuille
  for select to authenticated using (true);

insert into public.portefeuilles_modeles (profil, titre, resume, cible_revenu, cible_actions, contexte_marche, date_rebalancement) values
  ('prudent', 'Portefeuille Prudent', 'Sécurité du capital et revenu régulier, avec une petite part d''actions de qualité pour un léger potentiel de croissance.', 75, 25, 'Au moment de ce rééquilibrage (juillet 2026), le taux directeur de la Banque du Canada est stable à 2,25 %, l''inflation de base tourne autour de 2 % (l''inflation globale, à ~3,2 %, est surtout tirée par le pétrole) et la croissance économique demeure modérée. Les tensions géopolitiques au Moyen-Orient et l''incertitude commerciale entretiennent la volatilité, tandis que les rendements obligataires sont légèrement plus élevés et que les marchés boursiers ont rebondi. Ce portefeuille privilégie donc des obligations de sociétés et de courte durée (moins sensibles aux taux), une bonne diversification mondiale et une exposition aux infrastructures comme protection contre l''inflation.', '2026-07-14'),
  ('modéré', 'Portefeuille Modéré', 'Croissance modérée du capital avec une base obligataire dominante et des revenus relativement stables.', 60, 40, 'Au moment de ce rééquilibrage (juillet 2026), le taux directeur de la Banque du Canada est stable à 2,25 %, l''inflation de base tourne autour de 2 % (l''inflation globale, à ~3,2 %, est surtout tirée par le pétrole) et la croissance économique demeure modérée. Les tensions géopolitiques au Moyen-Orient et l''incertitude commerciale entretiennent la volatilité, tandis que les rendements obligataires sont légèrement plus élevés et que les marchés boursiers ont rebondi. Ce portefeuille privilégie donc des obligations de sociétés et de courte durée (moins sensibles aux taux), une bonne diversification mondiale et une exposition aux infrastructures comme protection contre l''inflation.', '2026-07-14'),
  ('équilibré', 'Portefeuille Équilibré', 'Équilibre entre revenu et croissance, diversifié mondialement, pour une appréciation à moyen et long terme.', 55, 45, 'Au moment de ce rééquilibrage (juillet 2026), le taux directeur de la Banque du Canada est stable à 2,25 %, l''inflation de base tourne autour de 2 % (l''inflation globale, à ~3,2 %, est surtout tirée par le pétrole) et la croissance économique demeure modérée. Les tensions géopolitiques au Moyen-Orient et l''incertitude commerciale entretiennent la volatilité, tandis que les rendements obligataires sont légèrement plus élevés et que les marchés boursiers ont rebondi. Ce portefeuille privilégie donc des obligations de sociétés et de courte durée (moins sensibles aux taux), une bonne diversification mondiale et une exposition aux infrastructures comme protection contre l''inflation.', '2026-07-14'),
  ('croissance', 'Portefeuille Croissance', 'Croissance supérieure à la moyenne, à dominante actions mondiales diversifiées, avec une base obligataire réduite.', 30, 70, 'Au moment de ce rééquilibrage (juillet 2026), le taux directeur de la Banque du Canada est stable à 2,25 %, l''inflation de base tourne autour de 2 % (l''inflation globale, à ~3,2 %, est surtout tirée par le pétrole) et la croissance économique demeure modérée. Les tensions géopolitiques au Moyen-Orient et l''incertitude commerciale entretiennent la volatilité, tandis que les rendements obligataires sont légèrement plus élevés et que les marchés boursiers ont rebondi. Ce portefeuille privilégie donc des obligations de sociétés et de courte durée (moins sensibles aux taux), une bonne diversification mondiale et une exposition aux infrastructures comme protection contre l''inflation.', '2026-07-14'),
  ('audacieux', 'Portefeuille Audacieux', 'Croissance maximale du capital, presque entièrement en actions mondiales diversifiées, pour un horizon long et une forte tolérance au risque.', 15, 85, 'Au moment de ce rééquilibrage (juillet 2026), le taux directeur de la Banque du Canada est stable à 2,25 %, l''inflation de base tourne autour de 2 % (l''inflation globale, à ~3,2 %, est surtout tirée par le pétrole) et la croissance économique demeure modérée. Les tensions géopolitiques au Moyen-Orient et l''incertitude commerciale entretiennent la volatilité, tandis que les rendements obligataires sont légèrement plus élevés et que les marchés boursiers ont rebondi. Ce portefeuille privilégie donc des obligations de sociétés et de courte durée (moins sensibles aux taux), une bonne diversification mondiale et une exposition aux infrastructures comme protection contre l''inflation.', '2026-07-14')
on conflict (profil) do update set titre=excluded.titre, resume=excluded.resume, cible_revenu=excluded.cible_revenu, cible_actions=excluded.cible_actions, contexte_marche=excluded.contexte_marche, date_rebalancement=excluded.date_rebalancement, maj_le=now();

-- Remplace les lignes existantes des portefeuilles gérés ici
delete from public.lignes_portefeuille where profil in ('prudent', 'modéré', 'équilibré', 'croissance', 'audacieux');
insert into public.lignes_portefeuille (profil, code_fonds, poids, role, ordre) values
  ('prudent', '070', 10, 'Coussin de liquidités sécuritaire; profite du taux monétaire actuel (~2,4 %) sans risque de fluctuation.', 1),
  ('prudent', '170', 20, 'Obligations de courte durée, peu sensibles aux mouvements de taux — approprié dans le contexte de taux encore élevés.', 2),
  ('prudent', '762', 25, 'Obligations de sociétés de qualité : rendement supérieur aux obligations gouvernementales, durée plus courte.', 3),
  ('prudent', '605', 20, 'Diversification obligataire mondiale et multisectorielle pour réduire la dépendance au marché canadien.', 4),
  ('prudent', '515', 15, 'Actions canadiennes de dividendes en croissance : revenu et stabilité, volatilité plus faible que le marché.', 5),
  ('prudent', '876', 10, 'Cœur d''actions mondiales indiciel, à faible coût, pour une diversification géographique large.', 6),
  ('modéré', '170', 15, 'Obligations courtes, tampon défensif contre la volatilité des taux.', 1),
  ('modéré', '762', 20, 'Obligations de sociétés de qualité, moteur de revenu principal.', 2),
  ('modéré', '605', 15, 'Obligations mondiales multisectorielles pour diversifier les sources de revenu.', 3),
  ('modéré', '893', 10, 'Revenu fixe mondial (PIMCO) : gestion active flexible dans un contexte de taux incertain.', 4),
  ('modéré', '515', 12, 'Actions canadiennes de dividendes : revenu et participation à la croissance avec moins de volatilité.', 5),
  ('modéré', '180', 13, 'Indiciel américain, cœur d''actions du plus grand marché mondial, à faible coût.', 6),
  ('modéré', '876', 15, 'Actions mondiales indicielles pour une exposition diversifiée hors Canada.', 7),
  ('équilibré', '762', 20, 'Obligations de sociétés de qualité, base de revenu stable.', 1),
  ('équilibré', '605', 20, 'Obligations mondiales multisectorielles, diversification et gestion active de la durée.', 2),
  ('équilibré', '893', 15, 'Revenu fixe mondial (PIMCO), flexibilité face aux taux.', 3),
  ('équilibré', '010', 15, 'Actions nord-américaines de grandes sociétés : cœur canadien et américain.', 4),
  ('équilibré', '180', 12, 'Indiciel américain, exposition au moteur de croissance mondial.', 5),
  ('équilibré', '300', 10, 'Indiciel international (hors Amérique du Nord) pour diversifier les régions.', 6),
  ('équilibré', '085', 8, 'Infrastructures mondiales : actifs réels générant des revenus, protection contre l''inflation.', 7),
  ('croissance', '762', 15, 'Obligations de sociétés de qualité : stabilité et amortisseur de volatilité.', 1),
  ('croissance', '605', 15, 'Obligations mondiales multisectorielles pour diversifier le volet défensif.', 2),
  ('croissance', '010', 15, 'Actions nord-américaines, cœur du portefeuille d''actions.', 3),
  ('croissance', '180', 15, 'Indiciel américain, exposition au principal marché de croissance.', 4),
  ('croissance', '707', 15, 'Actions mondiales gérées activement pour capter les occasions mondiales.', 5),
  ('croissance', '300', 12, 'Indiciel international pour élargir la diversification géographique.', 6),
  ('croissance', '085', 8, 'Infrastructures mondiales : revenus et protection contre l''inflation.', 7),
  ('croissance', '921', 5, 'Actions mondiales concentrées (Fidelity) : convictions fortes, potentiel de surperformance.', 8),
  ('audacieux', '605', 15, 'Unique volet défensif : obligations mondiales pour amortir légèrement la volatilité.', 1),
  ('audacieux', '180', 20, 'Indiciel américain, plus forte pondération, moteur principal de croissance.', 2),
  ('audacieux', '707', 18, 'Actions mondiales gérées activement, cœur diversifié du portefeuille.', 3),
  ('audacieux', '876', 15, 'Actions mondiales indicielles tous pays, diversification à faible coût.', 4),
  ('audacieux', '300', 12, 'Indiciel international pour l''exposition hors Amérique du Nord.', 5),
  ('audacieux', '921', 10, 'Actions mondiales concentrées (Fidelity) : convictions fortes.', 6),
  ('audacieux', '085', 5, 'Infrastructures mondiales : actifs réels, protection contre l''inflation.', 7),
  ('audacieux', '084', 5, 'Marchés émergents : potentiel de croissance supplémentaire à long terme.', 8);
