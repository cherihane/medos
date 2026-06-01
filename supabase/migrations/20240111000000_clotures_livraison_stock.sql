-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 20240111000000 — Clôtures de caisse + réception livraison → stock
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Table clotures_caisse ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clotures_caisse (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID         REFERENCES public.etablissements(id) ON DELETE SET NULL,
  gerant_id        UUID,
  gerant_email     TEXT,
  date_journee     DATE         NOT NULL,
  total_especes    NUMERIC      NOT NULL DEFAULT 0,
  total_mobile     NUMERIC      NOT NULL DEFAULT 0,
  total_credit     NUMERIC      NOT NULL DEFAULT 0,
  total_encaisse   NUMERIC      NOT NULL DEFAULT 0,
  nb_transactions  INTEGER      NOT NULL DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (etablissement_id, date_journee)
);

ALTER TABLE public.clotures_caisse ENABLE ROW LEVEL SECURITY;

-- Seul l'établissement propriétaire peut lire/écrire ses clôtures
CREATE POLICY "clotures_caisse_own"
  ON public.clotures_caisse
  FOR ALL TO authenticated
  USING  (etablissement_id = ANY(mes_etablissements()))
  WITH CHECK (etablissement_id = ANY(mes_etablissements()));

-- ── 2. Colonnes optionnelles sur livraisons (réception) ──────────────────────
ALTER TABLE public.livraisons
  ADD COLUMN IF NOT EXISTS medicament_nom   TEXT,
  ADD COLUMN IF NOT EXISTS quantite_livree  INTEGER;

-- ── 3. Fonction SECURITY DEFINER — réception livraison → incrément stock ─────
-- Le distributeur ne peut pas écrire directement dans le stock du destinataire
-- (RLS par établissement). Cette fonction tourne en SECURITY DEFINER pour
-- contourner les RLS côté serveur de façon contrôlée.

CREATE OR REPLACE FUNCTION public.receive_livraison(
  p_livraison_id   UUID,
  p_medicament_nom TEXT,
  p_quantite       INTEGER
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_etab_id  UUID;
  v_med_id   UUID;
BEGIN
  -- Récupère l'établissement destinataire depuis la livraison
  SELECT etablissement_id INTO v_etab_id
  FROM public.livraisons
  WHERE id = p_livraison_id;

  IF v_etab_id IS NULL THEN
    RETURN 'livraison_introuvable';
  END IF;

  -- Cherche le médicament par nom dans l'établissement destinataire
  SELECT id INTO v_med_id
  FROM public.medicaments
  WHERE etablissement_id = v_etab_id
    AND LOWER(nom) = LOWER(p_medicament_nom)
  LIMIT 1;

  IF v_med_id IS NULL THEN
    RETURN 'medicament_introuvable';
  END IF;

  UPDATE public.medicaments
  SET stock_actuel = COALESCE(stock_actuel, 0) + p_quantite
  WHERE id = v_med_id;

  RETURN 'ok';
END;
$$;

GRANT EXECUTE ON FUNCTION public.receive_livraison(UUID, TEXT, INTEGER) TO authenticated;

-- ── 4. Index utiles ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_clotures_caisse_etab_date
  ON public.clotures_caisse (etablissement_id, date_journee);
