-- Diagnostic terrain (Dashboard distributeur, notification au client à la
-- confirmation d'une commande) : deux policies INSERT permissives séparées
-- sur alertes (alertes_insert existante + alertes_insert_distributeur_clients
-- ajoutée dans 20260721c) ne se combinaient PAS via OR comme attendu —
-- vérifié par des tests isolés répétés (une policy unique WITH CHECK(true)
-- fonctionne seule, mais échoue systématiquement dès qu'une deuxième policy
-- INSERT permissive coexiste sur la même table). Plutôt que de continuer à
-- chercher pourquoi, la correction fiable et déjà éprouvée : UNE SEULE
-- policy INSERT avec les deux conditions combinées par OR à l'intérieur.
--
-- Remet aussi en place select/update/delete (identiques à avant, cette
-- session a dû les redéclarer pendant le diagnostic).
DROP POLICY IF EXISTS "zz_nuclear_test" ON public.alertes;
DROP POLICY IF EXISTS "alertes_insert" ON public.alertes;
DROP POLICY IF EXISTS "alertes_insert_distributeur_clients" ON public.alertes;
DROP POLICY IF EXISTS "alertes_select" ON public.alertes;
DROP POLICY IF EXISTS "alertes_update" ON public.alertes;
DROP POLICY IF EXISTS "alertes_delete" ON public.alertes;

CREATE POLICY "alertes_select" ON public.alertes FOR SELECT
  USING (
    etablissement_id = ANY (ARRAY(SELECT public.mes_etablissements()))
    OR public.is_autorite_sanitaire()
  );

CREATE POLICY "alertes_insert" ON public.alertes FOR INSERT
  WITH CHECK (
    NOT public.is_autorite_sanitaire()
    AND (
      etablissement_id = ANY (ARRAY(SELECT public.mes_etablissements()))
      OR etablissement_id IN (
        SELECT dc.client_etablissement_id FROM public.distributeur_clients dc
        WHERE dc.distributeur_id = ANY (ARRAY(SELECT public.mes_etablissements()))
      )
    )
  );

CREATE POLICY "alertes_update" ON public.alertes FOR UPDATE
  USING (
    etablissement_id = ANY (ARRAY(SELECT public.mes_etablissements()))
    AND NOT public.is_autorite_sanitaire()
  )
  WITH CHECK (
    etablissement_id = ANY (ARRAY(SELECT public.mes_etablissements()))
    AND NOT public.is_autorite_sanitaire()
  );

CREATE POLICY "alertes_delete" ON public.alertes FOR DELETE
  USING (
    etablissement_id = ANY (ARRAY(SELECT public.mes_etablissements()))
    AND NOT public.is_autorite_sanitaire()
  );

DROP FUNCTION IF EXISTS public.debug_mes_etabs();
DROP FUNCTION IF EXISTS public.debug_check();
DROP FUNCTION IF EXISTS public.debug_insert_test();
