-- Ordonnances.jsx envoie un champ "lignes" (jsonb, détail des médicaments prescrits)
-- absent de la table : toute création d'ordonnance échouait en production (PGRST204).
-- Trouvé lors du diagnostic du module Pharmacie (2026-07-19).
ALTER TABLE public.ordonnances
  ADD COLUMN IF NOT EXISTS lignes jsonb DEFAULT '[]'::jsonb;
