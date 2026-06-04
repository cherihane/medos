-- Phase 2 : Rôle Médecin — table transmissions de garde
CREATE TABLE IF NOT EXISTS transmissions_garde (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID,
  medecin_sortant TEXT NOT NULL,
  medecin_entrant TEXT,
  service TEXT,
  date_transmission TIMESTAMPTZ DEFAULT now(),
  patients_critiques JSONB DEFAULT '[]',
  message_general TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transmissions_etab ON transmissions_garde (etablissement_id, created_at DESC);
