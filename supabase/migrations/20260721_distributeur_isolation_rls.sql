-- ============================================================
-- MedOS — Isolation par distributeur + vraie relation "Mes Clients"
-- Migration : 20260721_distributeur_isolation_rls.sql
--
-- Bug corrigé : is_distributeur() est vrai pour N'IMPORTE QUEL compte
-- distributeur, sans distinction. Utilisé en "OR is_distributeur()" dans les
-- policies de commandes / commande_statut_historique / livraisons /
-- commande_lignes, ça donnait à tout distributeur un accès total à TOUTES
-- les commandes/livraisons de TOUS les établissements MedOS, quel que soit
-- le distributeur réellement visé par la commande.
--
-- Correctif : chaque commande/livraison porte désormais un distributeur_id
-- explicite (l'établissement distributeur réellement destinataire). Les
-- policies scopent sur ce champ (distributeur_id = ANY(mes_etablissements()))
-- au lieu du test de rôle global is_distributeur().
-- ============================================================


-- ============================================================
-- 1. Colonnes de routage vers un distributeur précis
-- ============================================================

-- Un "fournisseur" (contact pharmacie) peut pointer vers un vrai compte
-- distributeur MedOS. NULL = fournisseur externe classique (email only),
-- comme avant.
ALTER TABLE public.fournisseurs
  ADD COLUMN IF NOT EXISTS distributeur_etablissement_id uuid REFERENCES public.etablissements(id);

ALTER TABLE public.commandes
  ADD COLUMN IF NOT EXISTS distributeur_id uuid REFERENCES public.etablissements(id);

ALTER TABLE public.livraisons
  ADD COLUMN IF NOT EXISTS distributeur_id uuid REFERENCES public.etablissements(id);

ALTER TABLE public.commande_statut_historique
  ADD COLUMN IF NOT EXISTS distributeur_id uuid;

CREATE INDEX IF NOT EXISTS idx_commandes_distributeur_id ON public.commandes(distributeur_id);
CREATE INDEX IF NOT EXISTS idx_livraisons_distributeur_id ON public.livraisons(distributeur_id);
CREATE INDEX IF NOT EXISTS idx_fournisseurs_distributeur_etablissement_id ON public.fournisseurs(distributeur_etablissement_id);


-- ============================================================
-- 2. commandes — policies scopées au distributeur réellement visé
-- ============================================================
DROP POLICY IF EXISTS "cmd_select" ON public.commandes;
CREATE POLICY "cmd_select" ON public.commandes FOR SELECT
  USING (
    etablissement_id = ANY (ARRAY(SELECT public.mes_etablissements()))
    OR (distributeur_id IS NOT NULL AND distributeur_id = ANY (ARRAY(SELECT public.mes_etablissements())))
    OR public.is_autorite_sanitaire()
  );

DROP POLICY IF EXISTS "cmd_insert" ON public.commandes;
CREATE POLICY "cmd_insert" ON public.commandes FOR INSERT
  WITH CHECK (
    etablissement_id = ANY (ARRAY(SELECT public.mes_etablissements()))
    AND NOT public.is_autorite_sanitaire()
    -- Le champ distributeur_id est choisi par l'émetteur (pharmacie/hôpital) pour router
    -- sa commande, mais doit obligatoirement pointer vers un vrai compte distributeur actif
    -- (empêche de le détourner pour polluer/exposer les commandes d'un autre établissement).
    AND (
      distributeur_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.etablissements e
        WHERE e.id = distributeur_id AND e.type = 'distributeur' AND e.actif = true
      )
    )
  );

DROP POLICY IF EXISTS "cmd_update" ON public.commandes;
CREATE POLICY "cmd_update" ON public.commandes FOR UPDATE
  USING (
    etablissement_id = ANY (ARRAY(SELECT public.mes_etablissements()))
    OR (distributeur_id IS NOT NULL AND distributeur_id = ANY (ARRAY(SELECT public.mes_etablissements())))
  )
  WITH CHECK (
    etablissement_id = ANY (ARRAY(SELECT public.mes_etablissements()))
    OR (distributeur_id IS NOT NULL AND distributeur_id = ANY (ARRAY(SELECT public.mes_etablissements())))
  );

DROP POLICY IF EXISTS "cmd_delete" ON public.commandes;
CREATE POLICY "cmd_delete" ON public.commandes FOR DELETE
  USING (
    etablissement_id = ANY (ARRAY(SELECT public.mes_etablissements()))
    AND NOT public.is_autorite_sanitaire()
    AND NOT (distributeur_id IS NOT NULL AND distributeur_id = ANY (ARRAY(SELECT public.mes_etablissements())))
    AND statut = 'brouillon'
  );


-- ============================================================
-- 3. commande_statut_historique — même correctif + trigger mis à jour
-- ============================================================
DROP POLICY IF EXISTS "csh_select" ON public.commande_statut_historique;
CREATE POLICY "csh_select" ON public.commande_statut_historique FOR SELECT
  USING (
    etablissement_id = ANY (ARRAY(SELECT public.mes_etablissements()))
    OR (distributeur_id IS NOT NULL AND distributeur_id = ANY (ARRAY(SELECT public.mes_etablissements())))
    OR public.is_autorite_sanitaire()
  );

DROP POLICY IF EXISTS "csh_insert" ON public.commande_statut_historique;
CREATE POLICY "csh_insert" ON public.commande_statut_historique FOR INSERT
  WITH CHECK (
    etablissement_id = ANY (ARRAY(SELECT public.mes_etablissements()))
    OR (distributeur_id IS NOT NULL AND distributeur_id = ANY (ARRAY(SELECT public.mes_etablissements())))
  );

CREATE OR REPLACE FUNCTION public.log_commande_statut_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.commande_statut_historique (commande_id, etablissement_id, distributeur_id, statut, changed_by)
    VALUES (NEW.id, NEW.etablissement_id, NEW.distributeur_id, NEW.statut, auth.uid());
  ELSIF TG_OP = 'UPDATE' AND NEW.statut IS DISTINCT FROM OLD.statut THEN
    INSERT INTO public.commande_statut_historique (commande_id, etablissement_id, distributeur_id, statut, changed_by)
    VALUES (NEW.id, NEW.etablissement_id, NEW.distributeur_id, NEW.statut, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;


-- ============================================================
-- 4. commande_lignes — même correctif (via jointure sur commandes)
-- ============================================================
DROP POLICY IF EXISTS "cl_select" ON public.commande_lignes;
CREATE POLICY "cl_select" ON public.commande_lignes FOR SELECT
  USING (
    etablissement_id = ANY (ARRAY(SELECT public.mes_etablissements()))
    OR EXISTS (
      SELECT 1 FROM public.commandes c
      WHERE c.id = commande_lignes.commande_id
        AND c.distributeur_id IS NOT NULL
        AND c.distributeur_id = ANY (ARRAY(SELECT public.mes_etablissements()))
    )
    OR public.is_autorite_sanitaire()
  );


-- ============================================================
-- 5. livraisons — même correctif ; l'auteur (distributeur) doit être
--    propriétaire du distributeur_id qu'il déclare (anti-usurpation).
-- ============================================================
DROP POLICY IF EXISTS "livr_select" ON public.livraisons;
CREATE POLICY "livr_select" ON public.livraisons FOR SELECT
  USING (
    etablissement_id = ANY (ARRAY(SELECT public.mes_etablissements()))
    OR (distributeur_id IS NOT NULL AND distributeur_id = ANY (ARRAY(SELECT public.mes_etablissements())))
    OR public.is_autorite_sanitaire()
  );

DROP POLICY IF EXISTS "livr_insert" ON public.livraisons;
CREATE POLICY "livr_insert" ON public.livraisons FOR INSERT
  WITH CHECK (
    NOT public.is_autorite_sanitaire()
    AND (
      etablissement_id = ANY (ARRAY(SELECT public.mes_etablissements()))
      OR (distributeur_id IS NOT NULL AND distributeur_id = ANY (ARRAY(SELECT public.mes_etablissements())))
    )
    AND (distributeur_id IS NULL OR distributeur_id = ANY (ARRAY(SELECT public.mes_etablissements())))
  );

DROP POLICY IF EXISTS "livr_update" ON public.livraisons;
CREATE POLICY "livr_update" ON public.livraisons FOR UPDATE
  USING (
    etablissement_id = ANY (ARRAY(SELECT public.mes_etablissements()))
    OR (distributeur_id IS NOT NULL AND distributeur_id = ANY (ARRAY(SELECT public.mes_etablissements())))
  )
  WITH CHECK (
    etablissement_id = ANY (ARRAY(SELECT public.mes_etablissements()))
    OR (distributeur_id IS NOT NULL AND distributeur_id = ANY (ARRAY(SELECT public.mes_etablissements())))
  );

DROP POLICY IF EXISTS "livr_delete" ON public.livraisons;
CREATE POLICY "livr_delete" ON public.livraisons FOR DELETE
  USING (
    (
      etablissement_id = ANY (ARRAY(SELECT public.mes_etablissements()))
      OR (distributeur_id IS NOT NULL AND distributeur_id = ANY (ARRAY(SELECT public.mes_etablissements())))
    )
    AND NOT public.is_autorite_sanitaire()
  );


-- ============================================================
-- 6. distributeur_clients — la vraie relation "Mes Clients"
--    Un établissement devient client d'un distributeur via :
--    (a) sa première commande routée vers ce distributeur (auto, trigger)
--    (b) un ajout manuel explicite par le distributeur (lookup exact, pas
--        une liste de tous les établissements MedOS)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.distributeur_clients (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributeur_id         uuid NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE,
  client_etablissement_id uuid NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE,
  source                  text NOT NULL DEFAULT 'manuel' CHECK (source IN ('commande', 'manuel')),
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (distributeur_id, client_etablissement_id)
);

ALTER TABLE public.distributeur_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dc_select" ON public.distributeur_clients;
CREATE POLICY "dc_select" ON public.distributeur_clients FOR SELECT
  USING (
    distributeur_id = ANY (ARRAY(SELECT public.mes_etablissements()))
    OR public.is_autorite_sanitaire()
  );

DROP POLICY IF EXISTS "dc_insert" ON public.distributeur_clients;
CREATE POLICY "dc_insert" ON public.distributeur_clients FOR INSERT
  WITH CHECK (
    distributeur_id = ANY (ARRAY(SELECT public.mes_etablissements()))
    AND source = 'manuel'
  );
-- Pas de policy UPDATE/DELETE : la relation manuelle, une fois posée, reste
-- (cohérent avec l'historique commercial) ; le rattachement automatique via
-- commande passe par la fonction SECURITY DEFINER ci-dessous, hors RLS.

-- Rattachement automatique dès la première commande routée vers un distributeur
CREATE OR REPLACE FUNCTION public.attacher_client_distributeur()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.distributeur_id IS NOT NULL THEN
    INSERT INTO public.distributeur_clients (distributeur_id, client_etablissement_id, source)
    VALUES (NEW.distributeur_id, NEW.etablissement_id, 'commande')
    ON CONFLICT (distributeur_id, client_etablissement_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attacher_client_distributeur ON public.commandes;
CREATE TRIGGER trg_attacher_client_distributeur
  AFTER INSERT ON public.commandes
  FOR EACH ROW
  EXECUTE FUNCTION public.attacher_client_distributeur();


-- ============================================================
-- 7. Exception RLS scopée : le distributeur peut lire le stock de SES
--    clients réels (relation distributeur_clients), pas de tous les
--    établissements. Additive (OR) avec med_select existant.
-- ============================================================
DROP POLICY IF EXISTS "med_select_distributeur_clients" ON public.medicaments;
CREATE POLICY "med_select_distributeur_clients" ON public.medicaments FOR SELECT
  USING (
    etablissement_id IN (
      SELECT dc.client_etablissement_id FROM public.distributeur_clients dc
      WHERE dc.distributeur_id = ANY (ARRAY(SELECT public.mes_etablissements()))
    )
  );


-- ============================================================
-- 8. Annuaire public des distributeurs (pour que les pharmacies puissent
--    choisir un distributeur MedOS comme fournisseur — les distributeurs
--    sont des fournisseurs qui veulent être visibles, contrairement à la
--    liste des pharmacies/hôpitaux qui reste privée).
-- ============================================================
DROP POLICY IF EXISTS "etab_select_distributeurs_publics" ON public.etablissements;
CREATE POLICY "etab_select_distributeurs_publics" ON public.etablissements FOR SELECT
  USING (
    type = 'distributeur' AND actif = true AND statut_inscription = 'validee'
  );

-- Recherche exacte (par email) pour qu'un distributeur puisse rattacher
-- manuellement un client déjà inscrit sur MedOS sans parcourir un annuaire
-- de tous les établissements (cartographie volontairement non construite).
CREATE OR REPLACE FUNCTION public.rechercher_client_par_email(p_email text)
RETURNS TABLE (id uuid, nom text, ville text, type text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.nom, e.ville, e.type
  FROM public.etablissements e
  WHERE public.is_distributeur()
    AND e.type IN ('pharmacie', 'hopital', 'clinique')
    AND e.actif = true
    AND lower(trim(e.email)) = lower(trim(p_email))
  LIMIT 1
$$;
