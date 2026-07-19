-- Ajout de la colonne date_peremption sur medicaments, utilisée par l'import CSV/Excel
-- et le module Péremptions, mais absente jusqu'ici (bloquait l'import ET la saisie manuelle).
ALTER TABLE public.medicaments
  ADD COLUMN IF NOT EXISTS date_peremption DATE;
