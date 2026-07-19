-- Patients.jsx envoie "adresse" à l'insert/update, colonne absente de la table :
-- "Ajouter un patient" échouait systématiquement en production (PGRST204).
-- Trouvé lors du diagnostic du module Pharmacie (2026-07-19).
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS adresse text;
