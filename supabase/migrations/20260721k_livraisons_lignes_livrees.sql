-- Étape 1, point 6 : marquer une livraison "Livrée" échouait systématiquement
-- pour TOUT distributeur (bug pré-existant, jamais testé jusqu'ici) —
-- Livraisons.jsx écrit `lignes_livrees` (JSON, détail des médicaments
-- effectivement livrés, même pattern que `commandes`/DetailModal) mais la
-- colonne n'a jamais existé en base (PGRST204).
ALTER TABLE public.livraisons
  ADD COLUMN IF NOT EXISTS lignes_livrees jsonb;
