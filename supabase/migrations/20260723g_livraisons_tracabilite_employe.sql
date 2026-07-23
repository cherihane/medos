-- Traçabilité par employé sur les livraisons — même pattern que caissier_id/
-- caissier_email en pharmacie (Caisse.jsx) : qui (utilisateur MedOS connecté)
-- a créé, modifié et expédié chaque livraison. Trois actions distinctes
-- demandées, donc trois paires id/email plutôt qu'une seule (une livraison
-- peut être créée par une personne et expédiée par une autre, dans une
-- équipe logistique réelle).
ALTER TABLE public.livraisons
  ADD COLUMN IF NOT EXISTS cree_par_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cree_par_email   text,
  ADD COLUMN IF NOT EXISTS traite_par_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS traite_par_email text,
  ADD COLUMN IF NOT EXISTS expedie_par_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS expedie_par_email   text;
