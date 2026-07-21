-- Le Dashboard distributeur notifie le client (table alertes) à chaque
-- changement de statut d'une commande (confirmée/en transit/livrée/annulée).
-- alertes_insert exige etablissement_id = ANY(mes_etablissements()) — un
-- distributeur ne peut insérer une alerte que pour SON PROPRE établissement,
-- jamais pour celui d'un client. La notification échouait donc toujours
-- (RLS 42501, en plus d'un bug JS séparé — .insert(...).catch() sur le query
-- builder Postgrest, qui n'implémente pas .catch — corrigé dans Dashboard.jsx).
--
-- Même exception scopée que medicaments/etablissements (voir
-- 20260721_distributeur_isolation_rls.sql et son complément 20260721b) :
-- un distributeur peut notifier uniquement SES clients réels.
DROP POLICY IF EXISTS "alertes_insert_distributeur_clients" ON public.alertes;
CREATE POLICY "alertes_insert_distributeur_clients" ON public.alertes FOR INSERT
  WITH CHECK (
    etablissement_id IN (
      SELECT dc.client_etablissement_id FROM public.distributeur_clients dc
      WHERE dc.distributeur_id = ANY (ARRAY(SELECT public.mes_etablissements()))
    )
  );
