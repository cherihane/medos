-- Mission (session 9) — points 1, 2, 3 : panier multi-médicaments pour les
-- livraisons, décrément entrepôt bloquant au moment de l'expédition, et
-- archivage pour le CRUD entrepôt.

-- ── Point 1 : lignes d'une livraison (même construction que commande_lignes) ──
CREATE TABLE IF NOT EXISTS public.livraison_lignes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  livraison_id   uuid NOT NULL REFERENCES public.livraisons(id) ON DELETE CASCADE,
  medicament_id  uuid REFERENCES public.medicaments(id),
  medicament_nom text NOT NULL,
  quantite       integer NOT NULL CHECK (quantite > 0),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_livraison_lignes_livraison_id ON public.livraison_lignes(livraison_id);

ALTER TABLE public.livraison_lignes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ll_select" ON public.livraison_lignes;
CREATE POLICY "ll_select" ON public.livraison_lignes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.livraisons l
      WHERE l.id = livraison_lignes.livraison_id
        AND (
          l.etablissement_id = ANY (ARRAY(SELECT public.mes_etablissements()))
          OR (l.distributeur_id IS NOT NULL AND l.distributeur_id = ANY (ARRAY(SELECT public.mes_etablissements())))
        )
    )
  );

-- Seul le distributeur qui a créé la livraison peut y ajouter des lignes
-- (jamais le client destinataire, qui ne fait que recevoir).
DROP POLICY IF EXISTS "ll_insert" ON public.livraison_lignes;
CREATE POLICY "ll_insert" ON public.livraison_lignes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.livraisons l
      WHERE l.id = livraison_lignes.livraison_id
        AND l.distributeur_id IS NOT NULL
        AND l.distributeur_id = ANY (ARRAY(SELECT public.mes_etablissements()))
    )
  );

-- ── Point 2 : décrément entrepôt bloquant, par medicament_id (précis, plus
-- besoin de recherche par nom puisque la ligne est choisie dans le
-- catalogue du distributeur au moment de la création). Remplace
-- expedier_depuis_entrepot (nom-based, floor-at-zero, jamais bloquant —
-- n'était utilisé que par le flux "livrée" que ce chantier redessine :
-- le décrément a désormais lieu à l'expédition, pas à la confirmation de
-- réception par le client).
DROP FUNCTION IF EXISTS public.expedier_depuis_entrepot(text, integer, uuid);

CREATE OR REPLACE FUNCTION public.expedier_ligne_livraison(
  p_medicament_id uuid,
  p_quantite integer,
  p_distributeur_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_stock integer;
BEGIN
  SELECT stock_actuel INTO v_stock
  FROM public.medicaments
  WHERE id = p_medicament_id AND etablissement_id = p_distributeur_id
  FOR UPDATE;

  IF v_stock IS NULL THEN
    RETURN 'medicament_introuvable';
  END IF;

  IF v_stock < p_quantite THEN
    RETURN 'stock_insuffisant';
  END IF;

  UPDATE public.medicaments
  SET stock_actuel = stock_actuel - p_quantite
  WHERE id = p_medicament_id;

  INSERT INTO public.mouvements_stock (etablissement_id, medicament_id, type, quantite, motif)
  VALUES (p_distributeur_id, p_medicament_id, 'sortie', p_quantite, 'Expédition — livraison créée');

  RETURN 'ok';
END;
$$;

GRANT EXECUTE ON FUNCTION public.expedier_ligne_livraison(uuid, integer, uuid) TO authenticated;

-- ── Point 3 : archivage (CRUD entrepôt) ──────────────────────────────────────
ALTER TABLE public.medicaments
  ADD COLUMN IF NOT EXISTS actif boolean NOT NULL DEFAULT true;
