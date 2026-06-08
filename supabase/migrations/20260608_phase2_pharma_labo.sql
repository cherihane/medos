-- Phase 2 : Pharmacien hospitalier + Laborantin

CREATE TABLE IF NOT EXISTS commandes_internes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID,
  demandeur_email TEXT NOT NULL,
  demandeur_service TEXT,
  pharmacien_email TEXT,
  medicament_nom TEXT NOT NULL,
  medicament_id UUID REFERENCES medicaments(id) ON DELETE SET NULL,
  quantite_demandee INTEGER NOT NULL,
  quantite_servie INTEGER,
  motif TEXT,
  statut TEXT DEFAULT 'en_attente', -- 'en_attente' | 'approuvee' | 'refusee' | 'servie'
  notes_pharmacien TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commandes_internes_etab   ON commandes_internes (etablissement_id, statut);
CREATE INDEX IF NOT EXISTS idx_commandes_internes_demandeur ON commandes_internes (demandeur_email);

-- Ajouter resultat_valeurs (JSONB) sur examens si pas encore present
ALTER TABLE examens ADD COLUMN IF NOT EXISTS resultat_valeurs JSONB;
