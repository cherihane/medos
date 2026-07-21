-- Faille transversale trouvée en testant le traitement d'une livraison
-- (Étape 1, point 6) : mouvements_stock n'a AUCUNE isolation par
-- établissement — `mouvements_stock_insert`/`_select` ne vérifient que
-- `auth.uid() IS NOT NULL`. N'importe quel compte authentifié (pharmacie,
-- hôpital, distributeur, autorité) peut lire ET écrire l'historique de
-- mouvements de stock de N'IMPORTE QUEL établissement (quantités, motifs,
-- numéro de bon de livraison, fournisseur). Même famille que la faille
-- RLS "10 tables permissives" trouvée pendant le sprint Pharmacie
-- (2026-07-19), passée inaperçue pour cette table à l'époque.
DROP POLICY IF EXISTS "mouvements_stock_select" ON public.mouvements_stock;
CREATE POLICY "mouvements_stock_select" ON public.mouvements_stock FOR SELECT
  USING (
    etablissement_id = ANY (ARRAY(SELECT public.mes_etablissements()))
    OR public.is_autorite_sanitaire()
  );

DROP POLICY IF EXISTS "mouvements_stock_insert" ON public.mouvements_stock;
CREATE POLICY "mouvements_stock_insert" ON public.mouvements_stock FOR INSERT
  WITH CHECK (
    etablissement_id = ANY (ARRAY(SELECT public.mes_etablissements()))
    AND NOT public.is_autorite_sanitaire()
  );

-- receive_livraison / expedier_depuis_entrepot appellent désormais
-- elles-mêmes l'écriture du mouvement correspondant (medicament_id résolu
-- en interne, executé en SECURITY DEFINER) — la tentative précédente de
-- l'écrire depuis le frontend avec `medicament_nom` (colonne inexistante,
-- la vraie colonne est `medicament_id`) échouait silencieusement dans les
-- deux sens (nom de colonne erroné ET, pour le côté client, désormais
-- bloqué par l'isolation ci-dessus de toute façon).
CREATE OR REPLACE FUNCTION public.receive_livraison(p_medicament_nom text, p_quantite integer, p_etablissement_destinataire uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_med_id UUID;
BEGIN
  SELECT id INTO v_med_id
  FROM public.medicaments
  WHERE etablissement_id = p_etablissement_destinataire
    AND LOWER(nom) = LOWER(p_medicament_nom)
  LIMIT 1;

  IF v_med_id IS NULL THEN
    RETURN 'medicament_introuvable';
  END IF;

  UPDATE public.medicaments
  SET stock_actuel = COALESCE(stock_actuel, 0) + p_quantite
  WHERE id = v_med_id;

  INSERT INTO public.mouvements_stock (etablissement_id, medicament_id, type, quantite, motif)
  VALUES (p_etablissement_destinataire, v_med_id, 'entree', p_quantite, 'Livraison reçue');

  RETURN 'ok';
END;
$$;

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

  INSERT INTO public.mouvements_stock (etablissement_id, medicament_id, type, quantite, motif)
  VALUES (p_distributeur_id, v_med_id, 'sortie', p_quantite, 'Expédition vers un client');

  RETURN 'ok';
END;
$$;
