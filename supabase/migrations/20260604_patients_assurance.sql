-- Phase 2 : Secrétaire médicale — champs assurance sur patients
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS assurance TEXT,
  ADD COLUMN IF NOT EXISTS numero_assurance TEXT;
