-- Phase 2 (audit sécurité plateforme), point 5 — complétude des journaux/notifications.
--
-- Découvert en testant le correctif du bug ".catch is not a function" (voir migration
-- précédente en JS) : la table alertes n'a jamais eu de colonne patient_id, alors que TOUS les
-- appels insert("alertes", { patient_id: ..., ... }) du code applicatif (Examens.jsx,
-- Consultations.jsx, Urgences.jsx, Stock.jsx, Patients.jsx — constante critique, recommandation
-- IA, nouvelle ordonnance, résultat d'examen, consultation terminée, médicament servi, arrivée
-- urgente) l'ont toujours supposée présente. Conséquence : même après avoir corrigé le bug
-- ".catch" qui empêchait ces insert de s'exécuter, PostgREST rejette l'insert avec une colonne
-- inconnue — AUCUNE de ces notifications cliniques liées à un patient n'a donc jamais été créée
-- en base depuis l'écriture de ce code, silencieusement absorbée par le même bug ".catch".
--
-- Ajoute la colonne manquante pour faire correspondre le schéma à l'intention du code
-- (purement additive, aucune donnée existante affectée).

alter table public.alertes
  add column if not exists patient_id uuid references public.patients(id) on delete set null;

create index if not exists idx_alertes_patient_id on public.alertes(patient_id) where patient_id is not null;
