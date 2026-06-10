-- Phase 3 : Module Maternité

CREATE TABLE IF NOT EXISTS grossesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE RESTRICT,
  etablissement_id UUID,
  numero_grossesse TEXT NOT NULL,
  date_dernieres_regles DATE,
  date_accouchement_prevue DATE,
  gestite INTEGER DEFAULT 1,
  parite INTEGER DEFAULT 0,
  groupe_sanguin_confirme TEXT,
  rhesus TEXT,
  statut TEXT DEFAULT 'en_cours',
  grossesse_a_risque BOOLEAN DEFAULT false,
  facteurs_risque JSONB DEFAULT '[]',
  sage_femme_referente TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consultations_prenatales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grossesse_id UUID REFERENCES grossesses(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  etablissement_id UUID,
  numero_cpn INTEGER NOT NULL,
  date_cpn DATE NOT NULL DEFAULT CURRENT_DATE,
  age_gestationnel_sa INTEGER,
  poids_kg NUMERIC(5,2),
  tension_systolique INTEGER,
  tension_diastolique INTEGER,
  temperature NUMERIC(4,1),
  hauteur_uterine_cm NUMERIC(4,1),
  presentation TEXT,
  bruit_coeur_foetal INTEGER,
  mouvements_foetaux BOOLEAN,
  oedemes BOOLEAN DEFAULT false,
  hemoglobine NUMERIC(4,1),
  glycemie NUMERIC(5,2),
  albuminurie TEXT,
  serologie_syphilis TEXT,
  test_vih TEXT,
  serologie_hepatite_b TEXT,
  groupe_sanguin TEXT,
  supplementation_fer BOOLEAN DEFAULT true,
  supplementation_acide_folique BOOLEAN DEFAULT true,
  milda_distribue BOOLEAN DEFAULT false,
  ttv_administre BOOLEAN DEFAULT false,
  numero_ttv INTEGER,
  date_prochain_rdv DATE,
  prescripteur TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS partogrammes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grossesse_id UUID REFERENCES grossesses(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  etablissement_id UUID,
  heure_debut_travail TIMESTAMPTZ NOT NULL DEFAULT now(),
  heure_rupture_membranes TIMESTAMPTZ,
  type_rupture_membranes TEXT,
  releves JSONB DEFAULT '[]',
  statut TEXT DEFAULT 'en_cours',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accouchements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grossesse_id UUID REFERENCES grossesses(id) ON DELETE RESTRICT,
  patient_id UUID REFERENCES patients(id) ON DELETE RESTRICT,
  partogramme_id UUID REFERENCES partogrammes(id) ON DELETE SET NULL,
  etablissement_id UUID,
  numero_accouchement TEXT NOT NULL,
  date_heure_accouchement TIMESTAMPTZ NOT NULL DEFAULT now(),
  type_accouchement TEXT NOT NULL,
  indication_cesarienne TEXT,
  duree_travail_heures NUMERIC(4,1),
  sage_femme TEXT NOT NULL,
  medecin TEXT,
  perinee TEXT,
  delivrance TEXT,
  pertes_sang_ml INTEGER,
  complications_mere TEXT,
  nb_nouveau_nes INTEGER DEFAULT 1,
  transfert_neonat BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nouveau_nes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accouchement_id UUID REFERENCES accouchements(id) ON DELETE CASCADE,
  grossesse_id UUID REFERENCES grossesses(id) ON DELETE CASCADE,
  mere_patient_id UUID REFERENCES patients(id) ON DELETE RESTRICT,
  etablissement_id UUID,
  prenom TEXT,
  nom TEXT,
  sexe TEXT,
  poids_naissance_g INTEGER NOT NULL,
  taille_naissance_cm NUMERIC(4,1),
  perimetre_cranien_cm NUMERIC(4,1),
  apgar_1min INTEGER,
  apgar_5min INTEGER,
  apgar_10min INTEGER,
  etat_naissance TEXT DEFAULT 'vivant',
  cri_naissance BOOLEAN DEFAULT true,
  reanimation_necessaire BOOLEAN DEFAULT false,
  type_reanimation TEXT,
  vitamine_k BOOLEAN DEFAULT true,
  collyre BOOLEAN DEFAULT true,
  bcg_vaccine BOOLEAN DEFAULT false,
  vhb_vaccine BOOLEAN DEFAULT false,
  allaitement_maternel BOOLEAN DEFAULT true,
  numero_certificat_naissance TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compteurs_maternite (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID UNIQUE,
  annee INTEGER NOT NULL,
  dernier_grossesse INTEGER DEFAULT 0,
  dernier_accouchement INTEGER DEFAULT 0,
  dernier_naissance INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_grossesses_etab    ON grossesses (etablissement_id, statut);
CREATE INDEX IF NOT EXISTS idx_grossesses_patient ON grossesses (patient_id);
CREATE INDEX IF NOT EXISTS idx_cpn_grossesse       ON consultations_prenatales (grossesse_id);
CREATE INDEX IF NOT EXISTS idx_partogrammes_patient ON partogrammes (patient_id, statut);
CREATE INDEX IF NOT EXISTS idx_accouchements_etab  ON accouchements (etablissement_id, date_heure_accouchement);
CREATE INDEX IF NOT EXISTS idx_nouveau_nes_etab    ON nouveau_nes (etablissement_id, created_at);

CREATE OR REPLACE FUNCTION incrementer_compteur_maternite(
  p_etablissement_id UUID, p_annee INTEGER, p_type TEXT
)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE v_num INTEGER;
BEGIN
  INSERT INTO compteurs_maternite(etablissement_id, annee)
  VALUES (p_etablissement_id, p_annee)
  ON CONFLICT (etablissement_id) DO NOTHING;

  IF p_type = 'grossesse' THEN
    UPDATE compteurs_maternite SET dernier_grossesse = dernier_grossesse + 1
      WHERE etablissement_id = p_etablissement_id RETURNING dernier_grossesse INTO v_num;
  ELSIF p_type = 'accouchement' THEN
    UPDATE compteurs_maternite SET dernier_accouchement = dernier_accouchement + 1
      WHERE etablissement_id = p_etablissement_id RETURNING dernier_accouchement INTO v_num;
  ELSIF p_type = 'naissance' THEN
    UPDATE compteurs_maternite SET dernier_naissance = dernier_naissance + 1
      WHERE etablissement_id = p_etablissement_id RETURNING dernier_naissance INTO v_num;
  END IF;
  RETURN v_num;
END;
$$;
