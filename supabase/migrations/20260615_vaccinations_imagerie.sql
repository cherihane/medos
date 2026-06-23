-- Vaccinations (module Pédiatrie) + Imagerie (dossier patient)

-- ─── Vaccinations ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vaccinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  etablissement_id UUID,
  vaccin TEXT NOT NULL,
  date_administration DATE NOT NULL DEFAULT CURRENT_DATE,
  dose_numero INTEGER DEFAULT 1,
  lot TEXT,
  administre_par TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.vaccinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vaccinations_select" ON public.vaccinations FOR SELECT TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) OR public.is_autorite_sanitaire());

CREATE POLICY "vaccinations_insert" ON public.vaccinations FOR INSERT TO authenticated
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "vaccinations_update" ON public.vaccinations FOR UPDATE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire())
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "vaccinations_delete" ON public.vaccinations FOR DELETE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

-- ─── Imagerie ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.imagerie (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  examen_id UUID REFERENCES public.examens(id) ON DELETE SET NULL,
  etablissement_id UUID,
  type_examen TEXT NOT NULL,
  region TEXT,
  indication TEXT,
  compte_rendu TEXT,
  conclusion TEXT,
  radiologue TEXT,
  date_examen DATE NOT NULL DEFAULT CURRENT_DATE,
  date_demande TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.imagerie ENABLE ROW LEVEL SECURITY;

CREATE POLICY "imagerie_select" ON public.imagerie FOR SELECT TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) OR public.is_autorite_sanitaire());

CREATE POLICY "imagerie_insert" ON public.imagerie FOR INSERT TO authenticated
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "imagerie_update" ON public.imagerie FOR UPDATE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire())
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());

CREATE POLICY "imagerie_delete" ON public.imagerie FOR DELETE TO authenticated
  USING (etablissement_id = ANY(ARRAY(SELECT public.mes_etablissements())) AND NOT public.is_autorite_sanitaire());
