-- ============================================================
-- Livraisons — cycle de vie complet (mission session 10, point 4)
--   a. modification tant que non "livree"
--   b. traçabilité lots (pas de changement de schéma nécessaire — lots est
--      déjà un registre public par medicament_id, lien ajouté côté UI)
--   c. statut de disponibilité par ligne
--   d. suppression uniquement si "planifiee" (équivalent brouillon pour les
--      livraisons — jamais expédiée), "annulee" sinon (trace d'audit)
-- + support des clients manuels (point 2/3) : une livraison doit pouvoir
--   cibler un client sans compte MedOS.
-- ============================================================

-- ── a/d. Rattachement à distributeur_clients (MedOS ou manuel) + statut "annulee"
ALTER TABLE public.livraisons
  ADD COLUMN IF NOT EXISTS distributeur_clients_id uuid REFERENCES public.distributeur_clients(id) ON DELETE SET NULL;

ALTER TABLE public.livraisons DROP CONSTRAINT IF EXISTS livraisons_statut_check;
ALTER TABLE public.livraisons ADD CONSTRAINT livraisons_statut_check
  CHECK (statut = ANY (ARRAY['planifiee','en_transit','livree','incident','annulee']));

-- ── c. Disponibilité par ligne ────────────────────────────────────────────────
ALTER TABLE public.livraison_lignes
  ADD COLUMN IF NOT EXISTS disponible boolean NOT NULL DEFAULT true;

-- ── a. Modification des lignes tant que non livrée (update/delete manquants —
--       seuls select/insert existaient jusqu'ici) ──────────────────────────────
DROP POLICY IF EXISTS "ll_update" ON public.livraison_lignes;
CREATE POLICY "ll_update" ON public.livraison_lignes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.livraisons l
      WHERE l.id = livraison_lignes.livraison_id
        AND l.distributeur_id IS NOT NULL
        AND l.distributeur_id = ANY (ARRAY(SELECT public.mes_etablissements()))
        AND l.statut != 'livree'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.livraisons l
      WHERE l.id = livraison_lignes.livraison_id
        AND l.distributeur_id IS NOT NULL
        AND l.distributeur_id = ANY (ARRAY(SELECT public.mes_etablissements()))
        AND l.statut != 'livree'
    )
  );

DROP POLICY IF EXISTS "ll_delete" ON public.livraison_lignes;
CREATE POLICY "ll_delete" ON public.livraison_lignes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.livraisons l
      WHERE l.id = livraison_lignes.livraison_id
        AND l.distributeur_id IS NOT NULL
        AND l.distributeur_id = ANY (ARRAY(SELECT public.mes_etablissements()))
        AND l.statut != 'livree'
    )
  );

-- Transporteur/dates/destinataire déjà couverts par livr_update existante —
-- pas de restriction de statut dessus pour l'instant (une livraison "en
-- transit" doit pouvoir être recontactée/redatée) ; seule la ligne "livree"
-- doit devenir figée, ce que garantit déjà receive_livraison/StatutModal en
-- pratique (personne ne repasse une livraison livrée à un autre statut dans
-- l'UI). Le verrou dur est sur les LIGNES (ci-dessus), pas la livraison
-- elle-même, pour rester cohérent avec ce que demande la mission.

-- ── d. Suppression uniquement si "planifiee" (jamais expédiée) ───────────────
-- Comme pour cmd_delete (commandes) : la policy livr_delete existante ne
-- vérifiait que l'établissement, pas le statut — n'importe quelle livraison
-- pouvait être supprimée. Restreint ici pour garder une trace d'audit sur
-- tout ce qui a déjà été expédié/annoncé à un client (utiliser "Annuler" via
-- livr_update à la place).
DROP POLICY IF EXISTS "livr_delete" ON public.livraisons;
CREATE POLICY "livr_delete" ON public.livraisons FOR DELETE
  USING (
    distributeur_id IS NOT NULL
    AND distributeur_id = ANY (ARRAY(SELECT public.mes_etablissements()))
    AND statut = 'planifiee'
  );

-- ── RPC : ajuster une ligne de livraison (édition tant que non livrée) ───────
-- Réconcilie le stock entrepôt du distributeur avec la nouvelle quantité :
-- incrémente si la quantité baisse (ou ligne supprimée), décrémente (avec le
-- même verrou/vérification que expedier_ligne_livraison) si elle augmente.
-- p_nouvelle_quantite = 0 supprime la ligne.
CREATE OR REPLACE FUNCTION public.ajuster_ligne_livraison(
  p_livraison_id uuid,
  p_medicament_id uuid,
  p_medicament_nom text,
  p_nouvelle_quantite integer,
  p_distributeur_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_statut text;
  v_ligne_id uuid;
  v_ancienne_quantite integer;
  v_stock integer;
  v_delta integer;
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

  SELECT id, quantite INTO v_ligne_id, v_ancienne_quantite
  FROM public.livraison_lignes
  WHERE livraison_id = p_livraison_id AND medicament_id = p_medicament_id;

  v_ancienne_quantite := COALESCE(v_ancienne_quantite, 0);
  v_delta := p_nouvelle_quantite - v_ancienne_quantite;

  IF v_delta = 0 THEN
    RETURN 'ok';
  END IF;

  SELECT stock_actuel INTO v_stock FROM public.medicaments
  WHERE id = p_medicament_id AND etablissement_id = p_distributeur_id
  FOR UPDATE;

  IF v_stock IS NULL THEN
    RETURN 'medicament_introuvable';
  END IF;

  IF v_delta > 0 THEN
    IF v_stock < v_delta THEN
      RETURN 'stock_insuffisant';
    END IF;
    UPDATE public.medicaments SET stock_actuel = stock_actuel - v_delta WHERE id = p_medicament_id;
    INSERT INTO public.mouvements_stock (etablissement_id, medicament_id, type, quantite, motif)
    VALUES (p_distributeur_id, p_medicament_id, 'sortie', v_delta, 'Ajustement — modification livraison');
  ELSE
    UPDATE public.medicaments SET stock_actuel = stock_actuel - v_delta WHERE id = p_medicament_id; -- delta négatif -> incrémente
    INSERT INTO public.mouvements_stock (etablissement_id, medicament_id, type, quantite, motif)
    VALUES (p_distributeur_id, p_medicament_id, 'entree', -v_delta, 'Ajustement — modification livraison');
  END IF;

  IF p_nouvelle_quantite <= 0 THEN
    DELETE FROM public.livraison_lignes WHERE id = v_ligne_id;
  ELSIF v_ligne_id IS NOT NULL THEN
    UPDATE public.livraison_lignes SET quantite = p_nouvelle_quantite WHERE id = v_ligne_id;
  ELSE
    INSERT INTO public.livraison_lignes (livraison_id, medicament_id, medicament_nom, quantite)
    VALUES (p_livraison_id, p_medicament_id, p_medicament_nom, p_nouvelle_quantite);
  END IF;

  RETURN 'ok';
END;
$$;

GRANT EXECUTE ON FUNCTION public.ajuster_ligne_livraison(uuid, uuid, text, integer, uuid) TO authenticated;
