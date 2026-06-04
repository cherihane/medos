-- Phase 2 : Rôle Caissier — 4 nouvelles tables + RPC

-- Sessions de caisse (une par caissier par jour)
CREATE TABLE IF NOT EXISTS sessions_caisse (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID,
  caissier_email TEXT NOT NULL,
  caissier_nom TEXT,
  date_session DATE NOT NULL DEFAULT CURRENT_DATE,
  heure_ouverture TIMESTAMPTZ DEFAULT now(),
  heure_fermeture TIMESTAMPTZ,
  fond_initial INTEGER NOT NULL DEFAULT 0,
  total_especes INTEGER DEFAULT 0,
  total_mobile_money INTEGER DEFAULT 0,
  total_cheque INTEGER DEFAULT 0,
  total_tiers_payant INTEGER DEFAULT 0,
  total_theorique INTEGER DEFAULT 0,
  total_physique_compte INTEGER,
  ecart INTEGER,
  statut TEXT DEFAULT 'ouverte',
  notes_fermeture TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(etablissement_id, caissier_email, date_session)
);

-- Paiements (permet les acomptes : plusieurs paiements par facture)
CREATE TABLE IF NOT EXISTS paiements_facture (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facture_id UUID REFERENCES factures_hopital(id) ON DELETE CASCADE,
  etablissement_id UUID,
  session_id UUID REFERENCES sessions_caisse(id),
  caissier_email TEXT,
  montant INTEGER NOT NULL,
  montant_recu INTEGER,
  monnaie_rendue INTEGER DEFAULT 0,
  mode_paiement TEXT NOT NULL,
  reference_paiement TEXT,
  numero_recu TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Compteur de reçus (numerotation sequentielle sans trous)
CREATE TABLE IF NOT EXISTS compteurs_recu (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID UNIQUE,
  annee INTEGER NOT NULL,
  dernier_numero INTEGER DEFAULT 0
);

-- Configuration caisse par etablissement
CREATE TABLE IF NOT EXISTS config_caisse (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID UNIQUE,
  tva_taux NUMERIC(5,2) DEFAULT 0,
  tva_active BOOLEAN DEFAULT false,
  assureurs JSONB DEFAULT '[]',
  mention_legale TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RPC : incrementer le compteur de recus de façon atomique
CREATE OR REPLACE FUNCTION incrementer_compteur_recu(p_etablissement_id UUID, p_annee INTEGER)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE v_num INTEGER;
BEGIN
  INSERT INTO compteurs_recu(etablissement_id, annee, dernier_numero)
  VALUES (p_etablissement_id, p_annee, 1)
  ON CONFLICT (etablissement_id) DO UPDATE
    SET dernier_numero = compteurs_recu.dernier_numero + 1
  RETURNING dernier_numero INTO v_num;
  RETURN v_num;
END;
$$;

-- Index performances
CREATE INDEX IF NOT EXISTS idx_sessions_etab     ON sessions_caisse (etablissement_id, date_session);
CREATE INDEX IF NOT EXISTS idx_paiements_facture  ON paiements_facture (facture_id);
CREATE INDEX IF NOT EXISTS idx_paiements_session  ON paiements_facture (session_id);
CREATE INDEX IF NOT EXISTS idx_paiements_etab     ON paiements_facture (etablissement_id, created_at);

-- Ajout colonne statut 'acompte' : aucune migration DDL requise car statut est TEXT libre
-- S'assurer que factures_hopital accepte le statut 'acompte' (pas de contrainte CHECK existante)
