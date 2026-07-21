-- Diagnostic (Dashboard distributeur → notification client à la commande) :
-- une policy INSERT (WITH CHECK) référençant directement une AUTRE table
-- protégée par RLS (distributeur_clients) en sous-requête échoue de façon
-- systématique et reproductible, alors que la même expression fonctionne
-- normalement en SELECT (confirmé par de nombreux tests isolés : la
-- sous-requête directe renvoie le bon résultat en lecture seule, mais une
-- fois utilisée dans un WITH CHECK d'INSERT, la ligne est refusée). C'est
-- exactement le problème que mes_etablissements()/is_distributeur() (déjà
-- SECURITY DEFINER) sont censés éviter dans ce projet — med_select_distributeur_clients
-- et etab_select_distributeur_clients utilisaient le même anti-pattern
-- (sous-requête directe sur distributeur_clients) et fonctionnaient par
-- chance en SELECT, mais restaient fragiles. Correction : un helper
-- SECURITY DEFINER unique, réutilisé partout où on doit vérifier "cet
-- établissement est-il un client réel de MOI, le distributeur courant ?".
CREATE OR REPLACE FUNCTION public.est_client_de_distributeur(p_etablissement_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.distributeur_clients dc
    WHERE dc.client_etablissement_id = p_etablissement_id
      AND dc.distributeur_id = ANY (ARRAY(SELECT public.mes_etablissements()))
  )
$$;

-- alertes : notification au client à un changement de statut de commande
DROP POLICY IF EXISTS "alertes_insert" ON public.alertes;
CREATE POLICY "alertes_insert" ON public.alertes FOR INSERT
  WITH CHECK (
    NOT public.is_autorite_sanitaire()
    AND (
      etablissement_id = ANY (ARRAY(SELECT public.mes_etablissements()))
      OR public.est_client_de_distributeur(etablissement_id)
    )
  );

-- medicaments : stock bas / ruptures du client réel (fiche "Mes Clients")
DROP POLICY IF EXISTS "med_select_distributeur_clients" ON public.medicaments;
CREATE POLICY "med_select_distributeur_clients" ON public.medicaments FOR SELECT
  USING (public.est_client_de_distributeur(etablissement_id));

-- etablissements : jointure client:client_etablissement_id(...) dans "Mes Clients"
DROP POLICY IF EXISTS "etab_select_distributeur_clients" ON public.etablissements;
CREATE POLICY "etab_select_distributeur_clients" ON public.etablissements FOR SELECT
  USING (public.est_client_de_distributeur(id));
