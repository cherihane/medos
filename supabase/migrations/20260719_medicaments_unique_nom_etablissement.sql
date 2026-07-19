-- upsertMedicaments() (import CSV/Excel) utilise
-- .upsert(rows, { onConflict: "nom,etablissement_id" }), qui exige une
-- contrainte unique exacte sur ces colonnes -- absente jusqu'ici (seule
-- medicaments_code_key existait). Sans elle, Postgres renvoie 42P10
-- ("no unique or exclusion constraint matching the ON CONFLICT specification")
-- et l'import CSV echoue integralement.
-- Trouve lors du diagnostic du module Pharmacie (2026-07-19).
ALTER TABLE public.medicaments
  ADD CONSTRAINT medicaments_nom_etablissement_key UNIQUE (nom, etablissement_id);
