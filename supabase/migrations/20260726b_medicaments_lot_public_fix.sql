-- ============================================================
-- Fuite critique confirmée en LIVE (session 15, audit Hôpital) :
-- med_select_via_lot_public (20260721i_medicaments_visible_via_lot_public.sql)
-- rend visible la ligne ENTIÈRE de medicaments.SELECT * (stock_actuel,
-- stock_minimum, prix_unitaire, etablissement_id...) pour tout médicament
-- référencé par au moins un lot — pas seulement nom/code comme prévu par
-- l'intention documentée dans cette migration. RLS ne fait pas de
-- restriction par colonne : une fois la ligne visible via CETTE policy,
-- n'importe quelle requête "select *" ailleurs dans l'app (ex:
-- useMedicaments() sur l'écran Stock) récupère tout, quel que soit
-- l'établissement propriétaire. Vérifié en conditions réelles : un
-- compte hôpital flambant neuf, zéro activité, voyait déjà le stock et
-- les prix exacts de 3 établissements tiers sur /hopital/stock.
--
-- Correctif : suppression de la policy table-level (aucune requête "select *"
-- ne doit plus jamais voir une ligne medicaments hors de son propre
-- établissement, quelle que soit l'existence d'un lot). Les 2 seuls usages
-- réels de l'ancien comportement (src/hooks/useVerificationLot.js —
-- verifierSupabase() pour le scanner d'authenticité, rechercherLotPourPrefill()
-- pour le pré-remplissage à la réception) sont remplacés par 2 fonctions
-- SECURITY DEFINER qui ne renvoient QUE les colonnes déjà utilisées par le
-- frontend (jamais stock_actuel/stock_minimum/etablissement_id) — la
-- restriction se fait donc dans la fonction elle-même, pas via RLS +
-- colonnes (Postgres ne permet pas de restreindre des colonnes par policy).
-- ============================================================

DROP POLICY IF EXISTS "med_select_via_lot_public" ON public.medicaments;

-- ── 1. Vérification d'authenticité (Scanner) ─────────────────────────────────
-- Reproduit exactement la logique de verifierSupabase() dans
-- useVerificationLot.js : filtre par numero_lot (ILIKE) si fourni, sinon
-- renvoie les lots les plus récents (le nom est ensuite filtré côté client).
CREATE OR REPLACE FUNCTION public.verifier_lot_public(
  p_numero_lot text DEFAULT NULL
)
RETURNS TABLE (
  lot_id             uuid,
  numero_lot         text,
  fabricant          text,
  date_fabrication   date,
  date_expiration    date,
  quantite_initiale  int,
  med_nom            text,
  med_code           text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id, l.numero_lot, l.fabricant, l.date_fabrication, l.date_expiration,
    l.quantite_initiale, m.nom, m.code
  FROM public.lots l
  LEFT JOIN public.medicaments m ON m.id = l.medicament_id
  WHERE (p_numero_lot IS NOT NULL AND length(p_numero_lot) > 2 AND l.numero_lot ILIKE '%' || p_numero_lot || '%')
     OR (p_numero_lot IS NULL)
  ORDER BY l.created_at DESC
  LIMIT 10;
$$;

GRANT EXECUTE ON FUNCTION public.verifier_lot_public(text) TO authenticated;

-- ── 2. Pré-remplissage à la réception (scan QR/code-barres) ──────────────────
-- Reproduit exactement rechercherLotPourPrefill() : recherche par qr_code
-- exact d'abord, puis par numero_lot exact. Ne renvoie que les colonnes déjà
-- destructurées par le frontend (jamais stock_actuel/stock_minimum/
-- etablissement_id, qui n'y figuraient déjà pas explicitement, mais
-- passaient par la porte dérobée d'un éventuel "select *" ailleurs).
CREATE OR REPLACE FUNCTION public.prefill_medicament_via_lot(
  p_code text
)
RETURNS TABLE (
  medicament_id    uuid,
  nom              text,
  dosage           text,
  categorie        text,
  forme            text,
  fabricant        text,
  dci              text,
  prix_achat       numeric,
  prix_unitaire    numeric,
  date_expiration  date
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id, m.nom, m.dosage, m.categorie, m.forme,
    COALESCE(m.fabricant, l.fabricant), m.dci, m.prix_achat, m.prix_unitaire,
    l.date_expiration
  FROM public.lots l
  JOIN public.medicaments m ON m.id = l.medicament_id
  WHERE l.qr_code = p_code OR l.numero_lot = p_code
  ORDER BY (l.qr_code = p_code) DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.prefill_medicament_via_lot(text) TO authenticated;
