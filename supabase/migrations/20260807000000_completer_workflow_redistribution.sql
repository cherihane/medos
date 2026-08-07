-- Decision produit (point 4, mission "6 decisions produit") : completer le
-- workflow de redistribution inter-etablissements plutot que le retirer.
-- Diagnostic : seules insertTransfertStock (creation, statut='propose') et
-- fetchTransfertsStock (lecture) existaient - aucun chemin de code ne
-- pouvait jamais faire passer un transfert a accepte/refuse/effectue.
--
-- Les 2 fonctions ci-dessous reprennent exactement le meme patron deja
-- eprouve pour les livraisons distributeur<->pharmacie (receive_livraison /
-- expedier_depuis_entrepot, 20260721l_mouvements_stock_isolation_et_rpc.sql) :
-- SECURITY DEFINER, resolution du medicament par etablissement, ecriture de
-- mouvements_stock, meme comportement si le medicament n'existe pas encore
-- chez le destinataire (retourne 'medicament_introuvable', pas de creation
-- automatique - coherent avec la limite deja acceptee pour les livraisons).

CREATE OR REPLACE FUNCTION public.accepter_transfert_stock(p_transfert_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_transfert record;
  v_med_dest_id uuid;
BEGIN
  SELECT * INTO v_transfert FROM public.transferts_stock WHERE id = p_transfert_id;

  IF v_transfert IS NULL THEN
    RETURN 'transfert_introuvable';
  END IF;
  IF v_transfert.statut <> 'propose' THEN
    RETURN 'statut_invalide';
  END IF;
  -- Seul l'etablissement destinataire peut accepter, jamais un tiers ni meme
  -- la source (SECURITY DEFINER contourne la RLS, donc verification explicite
  -- ici, meme principe que le reste des fonctions de ce fichier).
  IF v_transfert.etablissement_dest_id <> ALL (ARRAY(SELECT public.mes_etablissements())) THEN
    RETURN 'non_autorise';
  END IF;

  SELECT id INTO v_med_dest_id
  FROM public.medicaments
  WHERE etablissement_id = v_transfert.etablissement_dest_id
    AND LOWER(nom) = LOWER(v_transfert.medicament_nom)
  LIMIT 1;

  IF v_med_dest_id IS NULL THEN
    RETURN 'medicament_introuvable';
  END IF;

  -- Decrement source (le medicament source, deja connu par son id exact)
  UPDATE public.medicaments
  SET stock_actuel = GREATEST(0, COALESCE(stock_actuel, 0) - v_transfert.quantite)
  WHERE id = v_transfert.medicament_id;

  INSERT INTO public.mouvements_stock (etablissement_id, medicament_id, type, quantite, motif)
  VALUES (v_transfert.etablissement_source_id, v_transfert.medicament_id, 'sortie', v_transfert.quantite, 'Redistribution vers un autre etablissement');

  -- Increment destination
  UPDATE public.medicaments
  SET stock_actuel = COALESCE(stock_actuel, 0) + v_transfert.quantite
  WHERE id = v_med_dest_id;

  INSERT INTO public.mouvements_stock (etablissement_id, medicament_id, type, quantite, motif)
  VALUES (v_transfert.etablissement_dest_id, v_med_dest_id, 'entree', v_transfert.quantite, 'Redistribution recue');

  UPDATE public.transferts_stock SET statut = 'effectue' WHERE id = p_transfert_id;

  RETURN 'ok';
END;
$$;

CREATE OR REPLACE FUNCTION public.refuser_transfert_stock(p_transfert_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_transfert record;
BEGIN
  SELECT * INTO v_transfert FROM public.transferts_stock WHERE id = p_transfert_id;

  IF v_transfert IS NULL THEN
    RETURN 'transfert_introuvable';
  END IF;
  IF v_transfert.statut <> 'propose' THEN
    RETURN 'statut_invalide';
  END IF;
  IF v_transfert.etablissement_dest_id <> ALL (ARRAY(SELECT public.mes_etablissements())) THEN
    RETURN 'non_autorise';
  END IF;

  UPDATE public.transferts_stock SET statut = 'refuse' WHERE id = p_transfert_id;

  RETURN 'ok';
END;
$$;

GRANT EXECUTE ON FUNCTION public.accepter_transfert_stock(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refuser_transfert_stock(uuid) TO authenticated;
