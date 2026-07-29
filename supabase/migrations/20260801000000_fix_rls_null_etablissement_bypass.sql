-- Audit exhaustif module Hôpital — Étape 4 (sécurité)
--
-- 5 tables (consultations, examens, notes_evolution, tarifs_actes,
-- configuration_lits) avaient une policy RLS héritée d'un template initial
-- (20260604_hopital_features.sql) qui autorisait explicitement
-- "OR etablissement_id IS NULL" — càd que toute ligne dont etablissement_id
-- serait NULL devenait visible ET modifiable par N'IMPORTE QUEL compte hôpital
-- authentifié, tous établissements confondus (fuite de données patients
-- inter-établissements : consultations, résultats d'examens, notes
-- d'évolution).
--
-- Aucune ligne NULL trouvée en production au moment de l'audit (vérifié),
-- mais le code frontend contient de nombreux appels du type
-- `etablissement_id: etabId ?? null` (CaissePage.jsx, Facturation.jsx,
-- Examens.jsx...) qui, en cas de contexte établissement pas encore chargé,
-- inséreraient réellement une ligne NULL — donc la fenêtre d'exposition est
-- réelle, pas seulement théorique.
--
-- Correctif à deux niveaux : (1) retirer le bypass NULL de la policy RLS,
-- (2) rendre la colonne NOT NULL pour échouer bruyamment à l'insertion
-- plutôt que de risquer une fuite silencieuse plus tard.

alter table public.consultations alter column etablissement_id set not null;
alter table public.examens alter column etablissement_id set not null;
alter table public.notes_evolution alter column etablissement_id set not null;
alter table public.tarifs_actes alter column etablissement_id set not null;
alter table public.configuration_lits alter column etablissement_id set not null;

drop policy if exists "consultations_all" on public.consultations;
create policy "consultations_all" on public.consultations for all
  using (etablissement_id in (select public.mes_etablissements()))
  with check (etablissement_id in (select public.mes_etablissements()));

drop policy if exists "examens_all" on public.examens;
create policy "examens_all" on public.examens for all
  using (etablissement_id in (select public.mes_etablissements()))
  with check (etablissement_id in (select public.mes_etablissements()));

drop policy if exists "notes_evolution_all" on public.notes_evolution;
create policy "notes_evolution_all" on public.notes_evolution for all
  using (etablissement_id in (select public.mes_etablissements()))
  with check (etablissement_id in (select public.mes_etablissements()));

drop policy if exists "tarifs_actes_all" on public.tarifs_actes;
create policy "tarifs_actes_all" on public.tarifs_actes for all
  using (etablissement_id in (select public.mes_etablissements()))
  with check (etablissement_id in (select public.mes_etablissements()));

drop policy if exists "configuration_lits_all" on public.configuration_lits;
create policy "configuration_lits_all" on public.configuration_lits for all
  using (etablissement_id in (select public.mes_etablissements()))
  with check (etablissement_id in (select public.mes_etablissements()));
