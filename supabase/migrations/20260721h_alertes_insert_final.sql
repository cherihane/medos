-- État final de alertes_insert : un établissement (pharmacie/hôpital) peut
-- toujours créer ses propres alertes (comportement d'origine, inchangé).
-- La notification d'un CLIENT par son distributeur passe désormais par
-- notifier_client_distributeur() (SECURITY DEFINER, voir 20260721g) plutôt
-- que par un accès direct — la policy INSERT correspondante s'est avérée
-- systématiquement peu fiable en test malgré une logique correcte (voir
-- journal dans 20260721e/f), donc pas conservée ici pour éviter de la
-- documentation trompeuse sur un chemin qui ne doit plus être emprunté.
DROP POLICY IF EXISTS "alertes_insert" ON public.alertes;
CREATE POLICY "alertes_insert" ON public.alertes FOR INSERT
  WITH CHECK (
    etablissement_id = ANY (ARRAY(SELECT public.mes_etablissements()))
    AND NOT public.is_autorite_sanitaire()
  );
