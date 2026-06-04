-- Correction 5 : Table traçable pour les transferts de stock inter-établissements
-- Remplace l'ancienne pratique de mettre l'info dans le champ notes d'une commande

CREATE TABLE IF NOT EXISTS transferts_stock (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_source_id UUID,
  etablissement_dest_id   UUID,
  medicament_id           UUID REFERENCES medicaments(id),
  medicament_nom          TEXT,
  quantite                INTEGER NOT NULL,
  statut                  TEXT NOT NULL DEFAULT 'propose', -- 'propose' | 'accepte' | 'refuse' | 'effectue'
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour les requêtes par établissement source ou dest
CREATE INDEX IF NOT EXISTS idx_transferts_source ON transferts_stock (etablissement_source_id);
CREATE INDEX IF NOT EXISTS idx_transferts_dest   ON transferts_stock (etablissement_dest_id);

-- RLS : un établissement ne voit que ses propres transferts
ALTER TABLE transferts_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transferts_own_etab" ON transferts_stock
  FOR ALL
  USING (
    etablissement_source_id = (
      SELECT etablissement_id FROM etablissements WHERE email = auth.jwt() ->> 'email' LIMIT 1
    )
    OR
    etablissement_dest_id = (
      SELECT etablissement_id FROM etablissements WHERE email = auth.jwt() ->> 'email' LIMIT 1
    )
  );
