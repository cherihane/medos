-- Phase 3 : Bloc opératoire

CREATE TABLE IF NOT EXISTS salles_operation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID,
  nom TEXT NOT NULL,
  specialite TEXT,
  statut TEXT DEFAULT 'libre',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS interventions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID,
  patient_id UUID REFERENCES patients(id) ON DELETE RESTRICT,
  salle_id UUID REFERENCES salles_operation(id) ON DELETE SET NULL,
  numero_intervention TEXT NOT NULL,
  date_prevue DATE NOT NULL,
  heure_prevue TIME NOT NULL,
  duree_prevue_min INTEGER DEFAULT 60,
  intitule TEXT NOT NULL,
  type TEXT DEFAULT 'programmee',
  specialite TEXT,
  chirurgien_principal TEXT NOT NULL,
  chirurgien_aide TEXT,
  anesthesiste TEXT,
  instrumentiste TEXT,
  statut TEXT DEFAULT 'planifiee',
  heure_debut_reelle TIMESTAMPTZ,
  heure_fin_reelle TIMESTAMPTZ,
  consentement_signe BOOLEAN DEFAULT false,
  date_consentement DATE,
  diagnostic_preoperatoire TEXT,
  notes_preoperatoires TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS checklists_preop (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id UUID REFERENCES interventions(id) ON DELETE CASCADE,
  etablissement_id UUID,
  signin_identite_confirmee BOOLEAN DEFAULT false,
  signin_site_marque BOOLEAN DEFAULT false,
  signin_allergie_verifiee BOOLEAN DEFAULT false,
  signin_voie_aerienne_ok BOOLEAN DEFAULT false,
  signin_risque_hemorragie BOOLEAN DEFAULT false,
  signin_materiel_ok BOOLEAN DEFAULT false,
  signin_par TEXT,
  signin_heure TIMESTAMPTZ,
  timeout_equipe_presentee BOOLEAN DEFAULT false,
  timeout_patient_confirme BOOLEAN DEFAULT false,
  timeout_intervention_confirmee BOOLEAN DEFAULT false,
  timeout_antibioprophylaxie BOOLEAN DEFAULT false,
  timeout_images_disponibles BOOLEAN DEFAULT false,
  timeout_par TEXT,
  timeout_heure TIMESTAMPTZ,
  signout_intervention_notee BOOLEAN DEFAULT false,
  signout_compte_instruments BOOLEAN DEFAULT false,
  signout_pieces_anatomiques BOOLEAN DEFAULT false,
  signout_equipement_ok BOOLEAN DEFAULT false,
  signout_consignes_reveil TEXT,
  signout_par TEXT,
  signout_heure TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comptes_rendus_operatoires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id UUID REFERENCES interventions(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  etablissement_id UUID,
  intitule_acte TEXT NOT NULL,
  voie_abord TEXT,
  position TEXT,
  type_anesthesie TEXT,
  inducteur TEXT,
  curare TEXT,
  morphinique TEXT,
  gaz TEXT,
  description_acte TEXT NOT NULL,
  incidents_perop TEXT,
  pertes_sang_ml INTEGER,
  transfusion BOOLEAN DEFAULT false,
  transfusion_detail TEXT,
  suites_operatoires TEXT,
  consignes_postop TEXT,
  consommables JSONB DEFAULT '[]',
  chirurgien TEXT NOT NULL,
  anesthesiste TEXT,
  instrumentiste TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feuilles_reveil (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id UUID REFERENCES interventions(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  etablissement_id UUID,
  heure_arrivee_reveil TIMESTAMPTZ DEFAULT now(),
  releves_aldrete JSONB DEFAULT '[]',
  douleur_numerique INTEGER,
  nausees BOOLEAN DEFAULT false,
  agitation BOOLEAN DEFAULT false,
  score_aldrete_sortie INTEGER,
  heure_sortie_reveil TIMESTAMPTZ,
  destination TEXT,
  infirmiere_reveil TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compteurs_bloc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID UNIQUE,
  annee INTEGER NOT NULL,
  dernier_numero INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_interventions_etab_date ON interventions (etablissement_id, date_prevue);
CREATE INDEX IF NOT EXISTS idx_interventions_statut    ON interventions (statut);
CREATE INDEX IF NOT EXISTS idx_salles_etab             ON salles_operation (etablissement_id);
CREATE INDEX IF NOT EXISTS idx_checklists_inter        ON checklists_preop (intervention_id);
CREATE INDEX IF NOT EXISTS idx_cro_inter               ON comptes_rendus_operatoires (intervention_id);
CREATE INDEX IF NOT EXISTS idx_reveil_inter            ON feuilles_reveil (intervention_id);

CREATE OR REPLACE FUNCTION incrementer_compteur_bloc(p_etablissement_id UUID, p_annee INTEGER)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE v_num INTEGER;
BEGIN
  INSERT INTO compteurs_bloc(etablissement_id, annee, dernier_numero)
  VALUES (p_etablissement_id, p_annee, 1)
  ON CONFLICT (etablissement_id) DO UPDATE
    SET dernier_numero = compteurs_bloc.dernier_numero + 1
  RETURNING dernier_numero INTO v_num;
  RETURN v_num;
END;
$$;
