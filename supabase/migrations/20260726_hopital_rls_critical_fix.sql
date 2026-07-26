-- ============================================================
-- Hôpital — Audit sécurité RLS (session 15) : 3 failles critiques
--
-- Trouvées par grep systématique de tout l'historique de migrations,
-- documentées dans DEBUG_PROGRESS.md ("Session 15 — Hôpital : Audit
-- initial"). Corrigées ici avec l'autorisation explicite de
-- l'utilisateur (déviation du scope "audit only" de la mission,
-- vu la gravité). N'importe quel compte authentifié de la plateforme,
-- quel que soit son établissement ou son rôle, pouvait :
--   1. Lire le diagnostic médical complet de tous les patients de tous
--      les hôpitaux (comptes_rendus_select : `using (true)`).
--   2. Lire/modifier toutes les factures de tous les hôpitaux
--      (factures_hopital : policy se terminant par `OR true`).
--   3. Lire/modifier/supprimer directement via l'API 9 tables qui
--      n'ont jamais activé RLS depuis leur création (juin 2026) :
--      sessions_caisse, paiements_facture, compteurs_recu, config_caisse,
--      perfusions, plan_soins, administrations_medicament,
--      commandes_internes, transmissions_garde.
--
-- Toutes ces tables ont une colonne etablissement_id directe (vérifié
-- avant d'écrire cette migration) et tous les points d'insertion côté
-- application la renseignent déjà systématiquement (vérifié dans
-- CaissePage.jsx, Facturation.jsx, MonService.jsx, TransmissionGarde.jsx,
-- Patients.jsx) — ce correctif ne casse donc aucun flux existant.
-- Isolation scopée par public.mes_etablissements() (même helper que
-- patients/consultations/examens), pas de dérogation "autorité
-- sanitaire" ajoutée : aucun écran du module Autorité sanitaire ne lit
-- ces tables (vérifié par grep).
-- ============================================================

-- ── 1. comptes_rendus ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "comptes_rendus_select" ON public.comptes_rendus;
DROP POLICY IF EXISTS "comptes_rendus_insert" ON public.comptes_rendus;
DROP POLICY IF EXISTS "comptes_rendus_update" ON public.comptes_rendus;

CREATE POLICY "comptes_rendus_select" ON public.comptes_rendus FOR SELECT
  TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())));

CREATE POLICY "comptes_rendus_insert" ON public.comptes_rendus FOR INSERT
  TO authenticated
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())));

CREATE POLICY "comptes_rendus_update" ON public.comptes_rendus FOR UPDATE
  TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())))
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())));

-- ── 2. factures_hopital ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Etablissement propre — factures_hopital" ON public.factures_hopital;

CREATE POLICY "factures_hopital_select" ON public.factures_hopital FOR SELECT
  TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())));

CREATE POLICY "factures_hopital_insert" ON public.factures_hopital FOR INSERT
  TO authenticated
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())));

CREATE POLICY "factures_hopital_update" ON public.factures_hopital FOR UPDATE
  TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())))
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())));

-- ── 3. Les 9 tables jamais protégées par RLS ─────────────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sessions_caisse', 'paiements_facture', 'compteurs_recu', 'config_caisse',
    'perfusions', 'plan_soins', 'administrations_medicament',
    'commandes_internes', 'transmissions_garde'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update', t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())))',
      t || '_select', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())))',
      t || '_insert', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements()))) WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())))',
      t || '_update', t
    );
  END LOOP;
END $$;
