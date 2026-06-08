-- Phase 2 : Rôle Infirmière — perfusions, plan de soins, administrations

CREATE TABLE IF NOT EXISTS perfusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  hospitalisation_id UUID REFERENCES hospitalisations(id) ON DELETE SET NULL,
  etablissement_id UUID,
  infirmiere_email TEXT,
  type_solute TEXT NOT NULL,
  volume_ml INTEGER NOT NULL,
  debit_ml_h INTEGER,
  heure_debut TIMESTAMPTZ DEFAULT now(),
  heure_fin_prevue TIMESTAMPTZ,
  heure_fin_reelle TIMESTAMPTZ,
  statut TEXT DEFAULT 'en_cours',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plan_soins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  ordonnance_id UUID REFERENCES ordonnances(id) ON DELETE CASCADE,
  etablissement_id UUID,
  medicament_nom TEXT NOT NULL,
  dose TEXT NOT NULL,
  voie TEXT NOT NULL,
  horaires JSONB NOT NULL DEFAULT '[]',
  date_debut DATE NOT NULL DEFAULT CURRENT_DATE,
  date_fin DATE,
  actif BOOLEAN DEFAULT true,
  prescripteur TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS administrations_medicament (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_soins_id UUID REFERENCES plan_soins(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  etablissement_id UUID,
  infirmiere_email TEXT NOT NULL,
  medicament_nom TEXT NOT NULL,
  dose TEXT,
  voie TEXT,
  heure_prevue TEXT NOT NULL,
  heure_reelle TIMESTAMPTZ DEFAULT now(),
  statut TEXT DEFAULT 'administre',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_perfusions_etab   ON perfusions (etablissement_id, statut);
CREATE INDEX IF NOT EXISTS idx_perfusions_patient ON perfusions (patient_id);
CREATE INDEX IF NOT EXISTS idx_plan_soins_patient ON plan_soins (patient_id, actif);
CREATE INDEX IF NOT EXISTS idx_plan_soins_etab    ON plan_soins (etablissement_id, actif);
CREATE INDEX IF NOT EXISTS idx_admin_etab         ON administrations_medicament (etablissement_id, heure_reelle);
