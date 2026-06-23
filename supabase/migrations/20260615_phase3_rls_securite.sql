-- RLS Phase 3 — Sécurisation de toutes les tables Phase 3
-- Toutes ces tables ont établissement_id directement → pattern standard

-- ─── deces ───────────────────────────────────────────────────────────────────
ALTER TABLE public.deces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deces_select" ON public.deces FOR SELECT TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) OR public.is_autorite_sanitaire());

CREATE POLICY "deces_insert" ON public.deces FOR INSERT TO authenticated
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "deces_update" ON public.deces FOR UPDATE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire())
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "deces_delete" ON public.deces FOR DELETE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

-- ─── compteurs_certificat_deces ───────────────────────────────────────────────
ALTER TABLE public.compteurs_certificat_deces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compteurs_certificat_deces_select" ON public.compteurs_certificat_deces FOR SELECT TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) OR public.is_autorite_sanitaire());

CREATE POLICY "compteurs_certificat_deces_insert" ON public.compteurs_certificat_deces FOR INSERT TO authenticated
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "compteurs_certificat_deces_update" ON public.compteurs_certificat_deces FOR UPDATE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire())
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "compteurs_certificat_deces_delete" ON public.compteurs_certificat_deces FOR DELETE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

-- ─── grossesses ───────────────────────────────────────────────────────────────
ALTER TABLE public.grossesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grossesses_select" ON public.grossesses FOR SELECT TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) OR public.is_autorite_sanitaire());

CREATE POLICY "grossesses_insert" ON public.grossesses FOR INSERT TO authenticated
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "grossesses_update" ON public.grossesses FOR UPDATE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire())
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "grossesses_delete" ON public.grossesses FOR DELETE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

-- ─── consultations_prenatales ─────────────────────────────────────────────────
ALTER TABLE public.consultations_prenatales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consultations_prenatales_select" ON public.consultations_prenatales FOR SELECT TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) OR public.is_autorite_sanitaire());

CREATE POLICY "consultations_prenatales_insert" ON public.consultations_prenatales FOR INSERT TO authenticated
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "consultations_prenatales_update" ON public.consultations_prenatales FOR UPDATE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire())
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "consultations_prenatales_delete" ON public.consultations_prenatales FOR DELETE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

-- ─── partogrammes ─────────────────────────────────────────────────────────────
ALTER TABLE public.partogrammes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partogrammes_select" ON public.partogrammes FOR SELECT TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) OR public.is_autorite_sanitaire());

CREATE POLICY "partogrammes_insert" ON public.partogrammes FOR INSERT TO authenticated
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "partogrammes_update" ON public.partogrammes FOR UPDATE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire())
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "partogrammes_delete" ON public.partogrammes FOR DELETE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

-- ─── accouchements ────────────────────────────────────────────────────────────
ALTER TABLE public.accouchements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accouchements_select" ON public.accouchements FOR SELECT TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) OR public.is_autorite_sanitaire());

CREATE POLICY "accouchements_insert" ON public.accouchements FOR INSERT TO authenticated
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "accouchements_update" ON public.accouchements FOR UPDATE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire())
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "accouchements_delete" ON public.accouchements FOR DELETE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

-- ─── nouveau_nes ──────────────────────────────────────────────────────────────
-- La table a établissement_id directement → pattern standard
ALTER TABLE public.nouveau_nes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nouveau_nes_select" ON public.nouveau_nes FOR SELECT TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) OR public.is_autorite_sanitaire());

CREATE POLICY "nouveau_nes_insert" ON public.nouveau_nes FOR INSERT TO authenticated
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "nouveau_nes_update" ON public.nouveau_nes FOR UPDATE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire())
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "nouveau_nes_delete" ON public.nouveau_nes FOR DELETE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

-- ─── compteurs_maternite ──────────────────────────────────────────────────────
ALTER TABLE public.compteurs_maternite ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compteurs_maternite_select" ON public.compteurs_maternite FOR SELECT TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) OR public.is_autorite_sanitaire());

CREATE POLICY "compteurs_maternite_insert" ON public.compteurs_maternite FOR INSERT TO authenticated
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "compteurs_maternite_update" ON public.compteurs_maternite FOR UPDATE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire())
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "compteurs_maternite_delete" ON public.compteurs_maternite FOR DELETE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

-- ─── salles_operation ─────────────────────────────────────────────────────────
ALTER TABLE public.salles_operation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salles_operation_select" ON public.salles_operation FOR SELECT TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) OR public.is_autorite_sanitaire());

CREATE POLICY "salles_operation_insert" ON public.salles_operation FOR INSERT TO authenticated
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "salles_operation_update" ON public.salles_operation FOR UPDATE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire())
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "salles_operation_delete" ON public.salles_operation FOR DELETE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

-- ─── interventions ────────────────────────────────────────────────────────────
ALTER TABLE public.interventions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "interventions_select" ON public.interventions FOR SELECT TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) OR public.is_autorite_sanitaire());

CREATE POLICY "interventions_insert" ON public.interventions FOR INSERT TO authenticated
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "interventions_update" ON public.interventions FOR UPDATE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire())
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "interventions_delete" ON public.interventions FOR DELETE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

-- ─── checklists_preop ─────────────────────────────────────────────────────────
-- La table a établissement_id directement → pattern standard
ALTER TABLE public.checklists_preop ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklists_preop_select" ON public.checklists_preop FOR SELECT TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) OR public.is_autorite_sanitaire());

CREATE POLICY "checklists_preop_insert" ON public.checklists_preop FOR INSERT TO authenticated
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "checklists_preop_update" ON public.checklists_preop FOR UPDATE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire())
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "checklists_preop_delete" ON public.checklists_preop FOR DELETE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

-- ─── comptes_rendus_operatoires ───────────────────────────────────────────────
-- La table a établissement_id directement → pattern standard
ALTER TABLE public.comptes_rendus_operatoires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comptes_rendus_operatoires_select" ON public.comptes_rendus_operatoires FOR SELECT TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) OR public.is_autorite_sanitaire());

CREATE POLICY "comptes_rendus_operatoires_insert" ON public.comptes_rendus_operatoires FOR INSERT TO authenticated
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "comptes_rendus_operatoires_update" ON public.comptes_rendus_operatoires FOR UPDATE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire())
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "comptes_rendus_operatoires_delete" ON public.comptes_rendus_operatoires FOR DELETE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

-- ─── feuilles_reveil ──────────────────────────────────────────────────────────
-- La table a établissement_id directement → pattern standard
ALTER TABLE public.feuilles_reveil ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feuilles_reveil_select" ON public.feuilles_reveil FOR SELECT TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) OR public.is_autorite_sanitaire());

CREATE POLICY "feuilles_reveil_insert" ON public.feuilles_reveil FOR INSERT TO authenticated
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "feuilles_reveil_update" ON public.feuilles_reveil FOR UPDATE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire())
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "feuilles_reveil_delete" ON public.feuilles_reveil FOR DELETE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

-- ─── compteurs_bloc ───────────────────────────────────────────────────────────
ALTER TABLE public.compteurs_bloc ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compteurs_bloc_select" ON public.compteurs_bloc FOR SELECT TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) OR public.is_autorite_sanitaire());

CREATE POLICY "compteurs_bloc_insert" ON public.compteurs_bloc FOR INSERT TO authenticated
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "compteurs_bloc_update" ON public.compteurs_bloc FOR UPDATE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire())
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "compteurs_bloc_delete" ON public.compteurs_bloc FOR DELETE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

-- ─── prescriptions_dietetiques ────────────────────────────────────────────────
ALTER TABLE public.prescriptions_dietetiques ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prescriptions_dietetiques_select" ON public.prescriptions_dietetiques FOR SELECT TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) OR public.is_autorite_sanitaire());

CREATE POLICY "prescriptions_dietetiques_insert" ON public.prescriptions_dietetiques FOR INSERT TO authenticated
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "prescriptions_dietetiques_update" ON public.prescriptions_dietetiques FOR UPDATE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire())
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "prescriptions_dietetiques_delete" ON public.prescriptions_dietetiques FOR DELETE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

-- ─── plateaux_repas ───────────────────────────────────────────────────────────
ALTER TABLE public.plateaux_repas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plateaux_repas_select" ON public.plateaux_repas FOR SELECT TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) OR public.is_autorite_sanitaire());

CREATE POLICY "plateaux_repas_insert" ON public.plateaux_repas FOR INSERT TO authenticated
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "plateaux_repas_update" ON public.plateaux_repas FOR UPDATE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire())
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "plateaux_repas_delete" ON public.plateaux_repas FOR DELETE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

-- ─── equipements_sterilisation ────────────────────────────────────────────────
ALTER TABLE public.equipements_sterilisation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "equipements_sterilisation_select" ON public.equipements_sterilisation FOR SELECT TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) OR public.is_autorite_sanitaire());

CREATE POLICY "equipements_sterilisation_insert" ON public.equipements_sterilisation FOR INSERT TO authenticated
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "equipements_sterilisation_update" ON public.equipements_sterilisation FOR UPDATE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire())
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "equipements_sterilisation_delete" ON public.equipements_sterilisation FOR DELETE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

-- ─── lots_sterilisation ───────────────────────────────────────────────────────
ALTER TABLE public.lots_sterilisation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lots_sterilisation_select" ON public.lots_sterilisation FOR SELECT TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) OR public.is_autorite_sanitaire());

CREATE POLICY "lots_sterilisation_insert" ON public.lots_sterilisation FOR INSERT TO authenticated
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "lots_sterilisation_update" ON public.lots_sterilisation FOR UPDATE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire())
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "lots_sterilisation_delete" ON public.lots_sterilisation FOR DELETE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

-- ─── compteurs_sterilisation ──────────────────────────────────────────────────
ALTER TABLE public.compteurs_sterilisation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compteurs_sterilisation_select" ON public.compteurs_sterilisation FOR SELECT TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) OR public.is_autorite_sanitaire());

CREATE POLICY "compteurs_sterilisation_insert" ON public.compteurs_sterilisation FOR INSERT TO authenticated
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "compteurs_sterilisation_update" ON public.compteurs_sterilisation FOR UPDATE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire())
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "compteurs_sterilisation_delete" ON public.compteurs_sterilisation FOR DELETE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());
