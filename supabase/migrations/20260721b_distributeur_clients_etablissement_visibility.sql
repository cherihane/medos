-- Complément à 20260721_distributeur_isolation_rls.sql : la relation
-- distributeur_clients était bien créée (auto via commande, ou manuelle),
-- mais la jointure `client:client_etablissement_id(...)` utilisée par
-- useDistributeurClients() renvoyait `null` pour l'établissement client —
-- etab_select ne l'autorisait pas (RLS filtre aussi les lignes embarquées
-- par jointure PostgREST, pas seulement la requête principale). Résultat :
-- la relation existait en base mais "Mes Clients" affichait 0 client.
--
-- Même exception scopée que pour medicaments (voir med_select_distributeur_clients) :
-- un distributeur peut lire la fiche (nom/ville/type/email/telephone/actif)
-- d'un établissement uniquement s'il figure dans SA relation distributeur_clients.
DROP POLICY IF EXISTS "etab_select_distributeur_clients" ON public.etablissements;
CREATE POLICY "etab_select_distributeur_clients" ON public.etablissements FOR SELECT
  USING (
    id IN (
      SELECT dc.client_etablissement_id FROM public.distributeur_clients dc
      WHERE dc.distributeur_id = ANY (ARRAY(SELECT public.mes_etablissements()))
    )
  );
