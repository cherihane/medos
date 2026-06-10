-- Phase 3 : Gestion des décès + Urgences dédiées

-- Table décès
CREATE TABLE IF NOT EXISTS deces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE RESTRICT,
  hospitalisation_id UUID REFERENCES hospitalisations(id) ON DELETE SET NULL,
  etablissement_id UUID,
  date_heure_deces TIMESTAMPTZ NOT NULL,
  lieu_deces TEXT DEFAULT 'Etablissement',
  service TEXT,
  lit TEXT,
  chambre TEXT,
  cause_immediate TEXT NOT NULL,
  cause_intermediaire TEXT,
  cause_initiale TEXT,
  autres_affections TEXT,
  medecin_certificateur TEXT NOT NULL,
  temoin_nom TEXT,
  temoin_qualite TEXT,
  famille_prevenue BOOLEAN DEFAULT false,
  famille_contact TEXT,
  transfert_morgue BOOLEAN DEFAULT false,
  heure_transfert_morgue TIMESTAMPTZ,
  numero_case_morgue TEXT,
  numero_certificat TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deces_etab    ON deces (etablissement_id, date_heure_deces);
CREATE INDEX IF NOT EXISTS idx_deces_patient ON deces (patient_id);

-- Compteur numéros de certificat
CREATE TABLE IF NOT EXISTS compteurs_certificat_deces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID UNIQUE,
  annee INTEGER NOT NULL,
  dernier_numero INTEGER DEFAULT 0
);

-- RPC incrémentation
CREATE OR REPLACE FUNCTION incrementer_compteur_certificat(
  p_etablissement_id UUID,
  p_annee INTEGER
)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE v_num INTEGER;
BEGIN
  INSERT INTO compteurs_certificat_deces(etablissement_id, annee, dernier_numero)
  VALUES (p_etablissement_id, p_annee, 1)
  ON CONFLICT (etablissement_id) DO UPDATE
    SET dernier_numero = compteurs_certificat_deces.dernier_numero + 1
  RETURNING dernier_numero INTO v_num;
  RETURN v_num;
END;
$$;
