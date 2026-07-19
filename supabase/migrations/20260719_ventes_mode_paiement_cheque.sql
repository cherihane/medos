-- La dispensation d'ordonnance propose aussi le paiement par cheque, absent de
-- ventes_mode_paiement_check. Normalise au passage : Ordonnances.jsx envoyait
-- des libellés capitalisés ("Especes") non alignés avec les clés minuscules
-- utilisées par Caisse.jsx/la contrainte ("especes") ; corrigé côté frontend
-- en même temps que cette migration.
-- Trouvé lors du diagnostic du module Pharmacie (2026-07-19).
ALTER TABLE public.ventes DROP CONSTRAINT IF EXISTS ventes_mode_paiement_check;

ALTER TABLE public.ventes ADD CONSTRAINT ventes_mode_paiement_check
  CHECK (mode_paiement = ANY (ARRAY[
    'especes'::text, 'carte'::text, 'mobile_money'::text, 'especes_mobile'::text,
    'credit'::text, 'assurance'::text, 'cnss'::text, 'cheque'::text
  ]));
