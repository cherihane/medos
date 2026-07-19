-- La dispensation d'ordonnance passe le statut a "dispensee", valeur absente de
-- ordonnances_statut_check. Consequence grave : la vente et le decrement de stock
-- avaient deja eu lieu (executes avant ce dernier update dans handleSave) quand
-- l'update de statut echouait -> l'ordonnance restait "validee" indefiniment,
-- risquant une double dispensation (double vente, double decrement de stock)
-- par un pharmacien qui la croit toujours en attente.
-- Trouve lors du diagnostic du module Pharmacie (2026-07-19).
ALTER TABLE public.ordonnances DROP CONSTRAINT IF EXISTS ordonnances_statut_check;

ALTER TABLE public.ordonnances ADD CONSTRAINT ordonnances_statut_check
  CHECK (statut = ANY (ARRAY[
    'en_attente'::text, 'validee'::text, 'traitee'::text, 'refusee'::text,
    'expiree'::text, 'dispensee'::text
  ]));
