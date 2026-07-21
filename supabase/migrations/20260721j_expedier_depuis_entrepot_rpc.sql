-- Étape 1, point 6 : marquer une livraison "livrée" incrémentait déjà le
-- stock du destinataire (receive_livraison, existant) mais ne décrémentait
-- jamais le stock ENTREPÔT du distributeur qui l'expédie — son propre
-- "Entrepôt" restait donc figé indéfiniment, sans jamais refléter les
-- expéditions réelles. Fonction miroir de receive_livraison, même
-- construction (SECURITY DEFINER, recherche par nom insensible à la casse
-- dans le catalogue du distributeur).
CREATE OR REPLACE FUNCTION public.expedier_depuis_entrepot(
  p_medicament_nom text,
  p_quantite integer,
  p_distributeur_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_med_id uuid;
BEGIN
  SELECT id INTO v_med_id
  FROM public.medicaments
  WHERE etablissement_id = p_distributeur_id
    AND LOWER(nom) = LOWER(p_medicament_nom)
  LIMIT 1;

  IF v_med_id IS NULL THEN
    RETURN 'medicament_introuvable';
  END IF;

  UPDATE public.medicaments
  SET stock_actuel = GREATEST(0, COALESCE(stock_actuel, 0) - p_quantite)
  WHERE id = v_med_id;

  RETURN 'ok';
END;
$$;

GRANT EXECUTE ON FUNCTION public.expedier_depuis_entrepot(text, integer, uuid) TO authenticated;
