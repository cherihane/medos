-- ============================================================
-- MedOS — RLS par établissement
-- Migration : 20240110000000_rls_by_etablissement.sql
--
-- Modèle de sécurité :
--   • Chaque utilisateur ne voit que les données de SON établissement
--     (soit il est propriétaire — son email = etablissements.email —
--      soit il est membre actif via membres_personnel)
--   • Distributeur : accès lecture à TOUTES les commandes et livraisons
--     (il est le fournisseur, pas l'émetteur — pas de FK direct à corriger ici)
--   • Autorité sanitaire : lecture seule sur toutes les tables
--   • medicaments, lots, fournisseurs : catalogue partagé — lecture
--     pour tous, écriture pour les membres d'un établissement actif
-- ============================================================


-- ============================================================
-- 0. Supprimer toutes les politiques permissives héritées
-- ============================================================
DO $$
DECLARE
  pol  record;
  tbls text[] := ARRAY[
    'etablissements','medicaments','lots','fournisseurs',
    'patients','ordonnances','ventes','commandes','livraisons',
    'alertes','membres_personnel','comptes_rendus','journal_caisse'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    FOR pol IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;
  END LOOP;
END $$;


-- ============================================================
-- 1. Fonctions d'aide (SECURITY DEFINER pour éviter la récursion RLS)
-- ============================================================

-- Retourne les UUIDs de tous les établissements auxquels
-- l'utilisateur connecté appartient (propriétaire OU membre actif).
CREATE OR REPLACE FUNCTION public.mes_etablissements()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  -- Propriétaire : email de l'auth correspond à l'email de l'établissement
  SELECT id
  FROM public.etablissements
  WHERE email = (auth.jwt() ->> 'email')

  UNION

  -- Membre actif
  SELECT etablissement_id
  FROM public.membres_personnel
  WHERE email = (auth.jwt() ->> 'email')
    AND actif = true
$$;

-- Vrai si l'utilisateur appartient à un établissement de type 'autorite'
CREATE OR REPLACE FUNCTION public.is_autorite_sanitaire()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.etablissements
    WHERE id = ANY(ARRAY(SELECT public.mes_etablissements()))
      AND type = 'autorite'
  )
$$;

-- Vrai si l'utilisateur appartient à un établissement de type 'distributeur'
CREATE OR REPLACE FUNCTION public.is_distributeur()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.etablissements
    WHERE id = ANY(ARRAY(SELECT public.mes_etablissements()))
      AND type = 'distributeur'
  )
$$;

-- Vrai si l'utilisateur appartient à au moins un établissement actif
CREATE OR REPLACE FUNCTION public.is_membre_actif()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.mes_etablissements())
$$;


-- ============================================================
-- 2. RLS activé sur toutes les tables (idempotent)
-- ============================================================
ALTER TABLE public.etablissements    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicaments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lots              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fournisseurs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordonnances       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commandes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.livraisons        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membres_personnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comptes_rendus    ENABLE ROW LEVEL SECURITY;

-- journal_caisse peut ne pas encore exister — on l'active si elle existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'journal_caisse'
  ) THEN
    EXECUTE 'ALTER TABLE public.journal_caisse ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;


-- ============================================================
-- 3. etablissements
--    • Chaque établissement ne voit que sa propre fiche
--    • Autorité sanitaire voit tout en lecture
-- ============================================================
CREATE POLICY "etab_select"
  ON public.etablissements FOR SELECT
  TO authenticated
  USING (
    id = ANY(ARRAY(SELECT public.mes_etablissements()))
    OR public.is_autorite_sanitaire()
  );

CREATE POLICY "etab_update"
  ON public.etablissements FOR UPDATE
  TO authenticated
  USING (id = ANY(ARRAY(SELECT public.mes_etablissements())))
  WITH CHECK (id = ANY(ARRAY(SELECT public.mes_etablissements())));

-- INSERT réservé à Supabase Auth (inscription via trigger ou service role)
-- Pas de politique INSERT ici → seul le service_role peut créer un établissement


-- ============================================================
-- 4. medicaments — catalogue partagé
--    • Lecture : tous les membres actifs + autorité
--    • Écriture : membres actifs uniquement (pas autorité)
-- ============================================================
CREATE POLICY "med_select"
  ON public.medicaments FOR SELECT
  TO authenticated
  USING (public.is_membre_actif() OR public.is_autorite_sanitaire());

CREATE POLICY "med_insert"
  ON public.medicaments FOR INSERT
  TO authenticated
  WITH CHECK (public.is_membre_actif() AND NOT public.is_autorite_sanitaire());

CREATE POLICY "med_update"
  ON public.medicaments FOR UPDATE
  TO authenticated
  USING (public.is_membre_actif() AND NOT public.is_autorite_sanitaire())
  WITH CHECK (public.is_membre_actif() AND NOT public.is_autorite_sanitaire());

CREATE POLICY "med_delete"
  ON public.medicaments FOR DELETE
  TO authenticated
  USING (public.is_membre_actif() AND NOT public.is_autorite_sanitaire());


-- ============================================================
-- 5. lots — catalogue partagé (traçabilité)
-- ============================================================
CREATE POLICY "lots_select"
  ON public.lots FOR SELECT
  TO authenticated
  USING (public.is_membre_actif() OR public.is_autorite_sanitaire());

CREATE POLICY "lots_insert"
  ON public.lots FOR INSERT
  TO authenticated
  WITH CHECK (public.is_membre_actif() AND NOT public.is_autorite_sanitaire());

CREATE POLICY "lots_update"
  ON public.lots FOR UPDATE
  TO authenticated
  USING (public.is_membre_actif() AND NOT public.is_autorite_sanitaire())
  WITH CHECK (public.is_membre_actif() AND NOT public.is_autorite_sanitaire());

CREATE POLICY "lots_delete"
  ON public.lots FOR DELETE
  TO authenticated
  USING (public.is_membre_actif() AND NOT public.is_autorite_sanitaire());


-- ============================================================
-- 6. fournisseurs — catalogue partagé
-- ============================================================
CREATE POLICY "fourn_select"
  ON public.fournisseurs FOR SELECT
  TO authenticated
  USING (public.is_membre_actif() OR public.is_autorite_sanitaire());

CREATE POLICY "fourn_insert"
  ON public.fournisseurs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_membre_actif() AND NOT public.is_autorite_sanitaire());

CREATE POLICY "fourn_update"
  ON public.fournisseurs FOR UPDATE
  TO authenticated
  USING (public.is_membre_actif() AND NOT public.is_autorite_sanitaire())
  WITH CHECK (public.is_membre_actif() AND NOT public.is_autorite_sanitaire());

CREATE POLICY "fourn_delete"
  ON public.fournisseurs FOR DELETE
  TO authenticated
  USING (public.is_membre_actif() AND NOT public.is_autorite_sanitaire());


-- ============================================================
-- 7. patients — strictement par établissement
-- ============================================================
CREATE POLICY "patients_select"
  ON public.patients FOR SELECT
  TO authenticated
  USING (
    etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
    OR public.is_autorite_sanitaire()
  );

CREATE POLICY "patients_insert"
  ON public.patients FOR INSERT
  TO authenticated
  WITH CHECK (
    etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
    AND NOT public.is_autorite_sanitaire()
  );

CREATE POLICY "patients_update"
  ON public.patients FOR UPDATE
  TO authenticated
  USING (
    etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
    AND NOT public.is_autorite_sanitaire()
  )
  WITH CHECK (
    etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
    AND NOT public.is_autorite_sanitaire()
  );

CREATE POLICY "patients_delete"
  ON public.patients FOR DELETE
  TO authenticated
  USING (
    etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
    AND NOT public.is_autorite_sanitaire()
  );


-- ============================================================
-- 8. ordonnances — par établissement émetteur
-- ============================================================
CREATE POLICY "ordo_select"
  ON public.ordonnances FOR SELECT
  TO authenticated
  USING (
    etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
    OR public.is_autorite_sanitaire()
  );

CREATE POLICY "ordo_insert"
  ON public.ordonnances FOR INSERT
  TO authenticated
  WITH CHECK (
    etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
    AND NOT public.is_autorite_sanitaire()
  );

CREATE POLICY "ordo_update"
  ON public.ordonnances FOR UPDATE
  TO authenticated
  USING (
    etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
    AND NOT public.is_autorite_sanitaire()
  )
  WITH CHECK (
    etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
    AND NOT public.is_autorite_sanitaire()
  );

CREATE POLICY "ordo_delete"
  ON public.ordonnances FOR DELETE
  TO authenticated
  USING (
    etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
    AND NOT public.is_autorite_sanitaire()
  );


-- ============================================================
-- 9. ventes — par établissement
-- ============================================================
CREATE POLICY "ventes_select"
  ON public.ventes FOR SELECT
  TO authenticated
  USING (
    etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
    OR public.is_autorite_sanitaire()
  );

CREATE POLICY "ventes_insert"
  ON public.ventes FOR INSERT
  TO authenticated
  WITH CHECK (
    etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
    AND NOT public.is_autorite_sanitaire()
  );

CREATE POLICY "ventes_update"
  ON public.ventes FOR UPDATE
  TO authenticated
  USING (
    etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
    AND NOT public.is_autorite_sanitaire()
  )
  WITH CHECK (
    etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
    AND NOT public.is_autorite_sanitaire()
  );

CREATE POLICY "ventes_delete"
  ON public.ventes FOR DELETE
  TO authenticated
  USING (
    etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
    AND NOT public.is_autorite_sanitaire()
  );


-- ============================================================
-- 10. commandes
--     • Émetteur (pharmacie/hôpital) : voit ses propres commandes
--     • Distributeur : voit TOUTES les commandes (il est le fournisseur)
--       Note : pas de FK fournisseurs → etablissements dans le schéma actuel.
--       Un FK distributeur_id pourra affiner cette règle en V2.
--     • Autorité : lecture seule totale
-- ============================================================
CREATE POLICY "cmd_select"
  ON public.commandes FOR SELECT
  TO authenticated
  USING (
    etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
    OR public.is_distributeur()
    OR public.is_autorite_sanitaire()
  );

CREATE POLICY "cmd_insert"
  ON public.commandes FOR INSERT
  TO authenticated
  WITH CHECK (
    etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
    AND NOT public.is_autorite_sanitaire()
  );

CREATE POLICY "cmd_update"
  ON public.commandes FOR UPDATE
  TO authenticated
  USING (
    -- L'émetteur peut modifier sa commande
    etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
    -- Le distributeur peut changer le statut (confirmée, en transit, livrée)
    OR public.is_distributeur()
  )
  WITH CHECK (
    etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
    OR public.is_distributeur()
  );

CREATE POLICY "cmd_delete"
  ON public.commandes FOR DELETE
  TO authenticated
  USING (
    etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
    AND NOT public.is_autorite_sanitaire()
    AND NOT public.is_distributeur()
  );


-- ============================================================
-- 11. livraisons
--     Même logique que commandes (distributeur = expéditeur)
-- ============================================================
CREATE POLICY "livr_select"
  ON public.livraisons FOR SELECT
  TO authenticated
  USING (
    etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
    OR public.is_distributeur()
    OR public.is_autorite_sanitaire()
  );

CREATE POLICY "livr_insert"
  ON public.livraisons FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
      OR public.is_distributeur()
    )
    AND NOT public.is_autorite_sanitaire()
  );

CREATE POLICY "livr_update"
  ON public.livraisons FOR UPDATE
  TO authenticated
  USING (
    etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
    OR public.is_distributeur()
  )
  WITH CHECK (
    etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
    OR public.is_distributeur()
  );

CREATE POLICY "livr_delete"
  ON public.livraisons FOR DELETE
  TO authenticated
  USING (
    (
      etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
      OR public.is_distributeur()
    )
    AND NOT public.is_autorite_sanitaire()
  );


-- ============================================================
-- 12. alertes — par établissement
-- ============================================================
CREATE POLICY "alertes_select"
  ON public.alertes FOR SELECT
  TO authenticated
  USING (
    etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
    OR public.is_autorite_sanitaire()
  );

CREATE POLICY "alertes_insert"
  ON public.alertes FOR INSERT
  TO authenticated
  WITH CHECK (
    etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
    AND NOT public.is_autorite_sanitaire()
  );

CREATE POLICY "alertes_update"
  ON public.alertes FOR UPDATE
  TO authenticated
  USING (
    etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
    AND NOT public.is_autorite_sanitaire()
  )
  WITH CHECK (
    etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
    AND NOT public.is_autorite_sanitaire()
  );

CREATE POLICY "alertes_delete"
  ON public.alertes FOR DELETE
  TO authenticated
  USING (
    etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
    AND NOT public.is_autorite_sanitaire()
  );


-- ============================================================
-- 13. membres_personnel — par établissement
--     Seul le propriétaire (email = etablissements.email) peut gérer
-- ============================================================
-- Supprimer les anciennes politiques de la migration 20240107
DROP POLICY IF EXISTS "membres_select" ON public.membres_personnel;
DROP POLICY IF EXISTS "membres_insert" ON public.membres_personnel;
DROP POLICY IF EXISTS "membres_update" ON public.membres_personnel;

CREATE POLICY "membres_select"
  ON public.membres_personnel FOR SELECT
  TO authenticated
  USING (
    etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
  );

-- Seul le propriétaire (son email = etablissements.email) gère le personnel
CREATE POLICY "membres_insert"
  ON public.membres_personnel FOR INSERT
  TO authenticated
  WITH CHECK (
    etablissement_id IN (
      SELECT id FROM public.etablissements
      WHERE email = (auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "membres_update"
  ON public.membres_personnel FOR UPDATE
  TO authenticated
  USING (
    etablissement_id IN (
      SELECT id FROM public.etablissements
      WHERE email = (auth.jwt() ->> 'email')
    )
  )
  WITH CHECK (
    etablissement_id IN (
      SELECT id FROM public.etablissements
      WHERE email = (auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "membres_delete"
  ON public.membres_personnel FOR DELETE
  TO authenticated
  USING (
    etablissement_id IN (
      SELECT id FROM public.etablissements
      WHERE email = (auth.jwt() ->> 'email')
    )
  );


-- ============================================================
-- 14. comptes_rendus — par établissement
--     (remplace les politiques permissives de 20240109)
-- ============================================================
DROP POLICY IF EXISTS "comptes_rendus_select" ON public.comptes_rendus;
DROP POLICY IF EXISTS "comptes_rendus_insert" ON public.comptes_rendus;
DROP POLICY IF EXISTS "comptes_rendus_update" ON public.comptes_rendus;

CREATE POLICY "cr_select"
  ON public.comptes_rendus FOR SELECT
  TO authenticated
  USING (
    etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
    OR public.is_autorite_sanitaire()
  );

CREATE POLICY "cr_insert"
  ON public.comptes_rendus FOR INSERT
  TO authenticated
  WITH CHECK (
    etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
    AND NOT public.is_autorite_sanitaire()
  );

CREATE POLICY "cr_update"
  ON public.comptes_rendus FOR UPDATE
  TO authenticated
  USING (
    etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
    AND NOT public.is_autorite_sanitaire()
  )
  WITH CHECK (
    etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
    AND NOT public.is_autorite_sanitaire()
  );

CREATE POLICY "cr_delete"
  ON public.comptes_rendus FOR DELETE
  TO authenticated
  USING (
    etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
    AND NOT public.is_autorite_sanitaire()
  );


-- ============================================================
-- 15. journal_caisse — par établissement (si table existe)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'journal_caisse'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "caisse_select"
        ON public.journal_caisse FOR SELECT
        TO authenticated
        USING (
          etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
          OR public.is_autorite_sanitaire()
        )
    $pol$;

    EXECUTE $pol$
      CREATE POLICY "caisse_insert"
        ON public.journal_caisse FOR INSERT
        TO authenticated
        WITH CHECK (
          etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
          AND NOT public.is_autorite_sanitaire()
        )
    $pol$;

    EXECUTE $pol$
      CREATE POLICY "caisse_update"
        ON public.journal_caisse FOR UPDATE
        TO authenticated
        USING (
          etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
          AND NOT public.is_autorite_sanitaire()
        )
        WITH CHECK (
          etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))
          AND NOT public.is_autorite_sanitaire()
        )
    $pol$;
  END IF;
END $$;


-- ============================================================
-- 16. Vérification finale
-- ============================================================
SELECT
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;

SELECT 'RLS MedOS par établissement activé.' AS resultat;
