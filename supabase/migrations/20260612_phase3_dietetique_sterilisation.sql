-- Phase 3 : Diététique + Stérilisation

-- Ajouter poids_kg dans constantes_vitales
ALTER TABLE constantes_vitales
  ADD COLUMN IF NOT EXISTS poids_kg NUMERIC(5,2);

-- Prescriptions diététiques
CREATE TABLE IF NOT EXISTS prescriptions_dietetiques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  hospitalisation_id UUID REFERENCES hospitalisations(id) ON DELETE SET NULL,
  etablissement_id UUID,
  prescripteur TEXT NOT NULL,
  type_regime TEXT NOT NULL,
  texture TEXT DEFAULT 'normal',
  allergies_alimentaires JSONB DEFAULT '[]',
  restrictions_specifiques TEXT,
  objectif_calorique INTEGER,
  notes TEXT,
  date_debut DATE NOT NULL DEFAULT CURRENT_DATE,
  date_fin DATE,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Plateaux repas
CREATE TABLE IF NOT EXISTS plateaux_repas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  etablissement_id UUID,
  date_repas DATE NOT NULL DEFAULT CURRENT_DATE,
  moment TEXT NOT NULL,
  regime_applique TEXT,
  statut TEXT DEFAULT 'planifie',
  motif_refus TEXT,
  note_cuisiniere TEXT,
  distribue_par TEXT,
  heure_distribution TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_diet_patient ON prescriptions_dietetiques (patient_id, actif);
CREATE INDEX IF NOT EXISTS idx_prescriptions_diet_etab    ON prescriptions_dietetiques (etablissement_id, actif);
CREATE INDEX IF NOT EXISTS idx_plateaux_etab_date         ON plateaux_repas (etablissement_id, date_repas);

-- Équipements de stérilisation
CREATE TABLE IF NOT EXISTS equipements_sterilisation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID,
  nom TEXT NOT NULL,
  type TEXT NOT NULL,
  numero_serie TEXT,
  date_derniere_maintenance DATE,
  statut TEXT DEFAULT 'operationnel',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Lots de stérilisation
CREATE TABLE IF NOT EXISTS lots_sterilisation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID,
  equipement_id UUID REFERENCES equipements_sterilisation(id) ON DELETE SET NULL,
  numero_lot TEXT NOT NULL,
  description_contenu TEXT NOT NULL,
  service_destinataire TEXT,
  nombre_sets INTEGER DEFAULT 1,
  date_sterilisation TIMESTAMPTZ NOT NULL DEFAULT now(),
  methode TEXT NOT NULL,
  temperature INTEGER,
  duree_min INTEGER,
  pression_bar NUMERIC(4,2),
  indicateur_chimique TEXT DEFAULT 'non_verifie',
  test_biologique TEXT DEFAULT 'non_fait',
  date_peremption_sterilite DATE,
  operateur TEXT NOT NULL,
  valide_par TEXT,
  statut TEXT DEFAULT 'en_attente_validation',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Compteur lots stérilisation
CREATE TABLE IF NOT EXISTS compteurs_sterilisation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID UNIQUE,
  annee INTEGER NOT NULL,
  dernier_numero INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_lots_steril_etab  ON lots_sterilisation (etablissement_id, created_at);
CREATE INDEX IF NOT EXISTS idx_lots_steril_statut ON lots_sterilisation (statut);

CREATE OR REPLACE FUNCTION incrementer_compteur_sterilisation(
  p_etablissement_id UUID, p_annee INTEGER
)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE v_num INTEGER;
BEGIN
  INSERT INTO compteurs_sterilisation(etablissement_id, annee, dernier_numero)
  VALUES (p_etablissement_id, p_annee, 1)
  ON CONFLICT (etablissement_id) DO UPDATE
    SET dernier_numero = compteurs_sterilisation.dernier_numero + 1
  RETURNING dernier_numero INTO v_num;
  RETURN v_num;
END;
$$;
