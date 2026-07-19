-- Caisse.jsx propose 6 modes de paiement (especes, mobile_money, especes_mobile
-- "Mixte", credit, assurance, cnss), mais la contrainte ventes_mode_paiement_check
-- n'autorisait que especes/carte/mobile_money/credit/assurance : toute vente en
-- mode "Mixte" ou "CNSS" était rejetée en production (23514, check constraint).
-- Trouvé lors du diagnostic du module Pharmacie (2026-07-19).
ALTER TABLE public.ventes DROP CONSTRAINT IF EXISTS ventes_mode_paiement_check;

ALTER TABLE public.ventes ADD CONSTRAINT ventes_mode_paiement_check
  CHECK (mode_paiement = ANY (ARRAY[
    'especes'::text, 'carte'::text, 'mobile_money'::text, 'especes_mobile'::text,
    'credit'::text, 'assurance'::text, 'cnss'::text
  ]));
