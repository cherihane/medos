-- La dispensation d'ordonnance (Ordonnances.jsx) envoie medicament_nom et
-- type_vente, colonnes absentes de ventes : toute dispensation echouait en
-- production (PGRST204). Ajoutees car denormaliser le nom du medicament sur
-- la ligne de vente et distinguer vente directe/ordonnance a une vraie valeur
-- pour les rapports (evite un join, et ordonnance_id seul ne dit pas si une
-- vente caisse classique existe aussi).
-- Trouve lors du diagnostic du module Pharmacie (2026-07-19).
ALTER TABLE public.ventes
  ADD COLUMN IF NOT EXISTS medicament_nom text,
  ADD COLUMN IF NOT EXISTS type_vente text;
