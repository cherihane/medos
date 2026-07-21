-- Étape 1, point 3 (Traçabilité) : un lot enregistré par un distributeur
-- (table `lots`, registre anti-contrefaçon volontairement partagé — voir
-- session Pharmacie du 2026-07-19) est bien visible par n'importe quel
-- établissement membre (lots_select: is_membre_actif()), MAIS la jointure
-- PostgREST `lots.medicaments(nom, code)` renvoyait `medicaments: null` pour
-- toute pharmacie autre que le distributeur propriétaire — med_select
-- restreint désormais medicaments à son propre établissement (isolation
-- posée pendant le sprint Pharmacie), ce qui bloque aussi la lecture du nom
-- du médicament pour un simple scan de vérification d'authenticité.
--
-- Un médicament référencé par au moins un lot fait partie du registre
-- public anti-contrefaçon par construction — sa fiche descriptive doit donc
-- être lisible par quiconque peut déjà lire ce lot.
DROP POLICY IF EXISTS "med_select_via_lot_public" ON public.medicaments;
CREATE POLICY "med_select_via_lot_public" ON public.medicaments FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.lots l WHERE l.medicament_id = medicaments.id)
  );
