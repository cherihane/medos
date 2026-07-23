-- Annulation d'une livraison (déjà expédiée depuis l'entrepôt, mais pas
-- encore livrée) — restitue le stock entrepôt du distributeur, MAIS garde
-- les lignes intactes (contrairement à ajuster_ligne_livraison à 0) pour
-- conserver une trace d'audit de ce qui avait été initialement prévu.
CREATE OR REPLACE FUNCTION public.annuler_livraison(
  p_livraison_id uuid,
  p_distributeur_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_statut text;
  v_ligne record;
BEGIN
  SELECT statut INTO v_statut FROM public.livraisons
  WHERE id = p_livraison_id AND distributeur_id = p_distributeur_id
  FOR UPDATE;

  IF v_statut IS NULL THEN
    RETURN 'livraison_introuvable';
  END IF;
  IF v_statut = 'livree' THEN
    RETURN 'livraison_deja_livree';
  END IF;
  IF v_statut = 'annulee' THEN
    RETURN 'ok';
  END IF;

  FOR v_ligne IN
    SELECT medicament_id, quantite FROM public.livraison_lignes
    WHERE livraison_id = p_livraison_id AND medicament_id IS NOT NULL
  LOOP
    UPDATE public.medicaments
    SET stock_actuel = stock_actuel + v_ligne.quantite
    WHERE id = v_ligne.medicament_id;

    INSERT INTO public.mouvements_stock (etablissement_id, medicament_id, type, quantite, motif)
    VALUES (p_distributeur_id, v_ligne.medicament_id, 'entree', v_ligne.quantite, 'Annulation livraison');
  END LOOP;

  UPDATE public.livraisons SET statut = 'annulee' WHERE id = p_livraison_id;

  RETURN 'ok';
END;
$$;

GRANT EXECUTE ON FUNCTION public.annuler_livraison(uuid, uuid) TO authenticated;
