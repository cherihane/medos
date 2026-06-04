-- Ajout des colonnes mode_paiement et date_paiement sur factures_hopital
ALTER TABLE public.factures_hopital
  ADD COLUMN IF NOT EXISTS mode_paiement TEXT,
  ADD COLUMN IF NOT EXISTS date_paiement TIMESTAMPTZ;
