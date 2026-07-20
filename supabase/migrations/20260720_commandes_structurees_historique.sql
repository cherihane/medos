-- Le module Fournisseurs doit gérer l'envoi réel de commande par email, la
-- consultation du bon de commande après coup, le changement manuel de statut
-- (avec incrément de stock à la réception) et un historique filtrable.
-- Jusqu'ici, commandes ne stockait le médicament et la quantité que dans un
-- champ notes texte libre ("Amoxicilline 500mg — Qté : 30") — impossible à
-- exploiter de façon fiable pour incrémenter le bon stock ou regénérer le
-- bon de commande. On structure ces données.

ALTER TABLE public.commandes
  ADD COLUMN IF NOT EXISTS medicament_id uuid REFERENCES public.medicaments(id),
  ADD COLUMN IF NOT EXISTS quantite integer,
  ADD COLUMN IF NOT EXISTS email_statut text NOT NULL DEFAULT 'non_envoye',
  ADD COLUMN IF NOT EXISTS email_erreur text;

ALTER TABLE public.commandes DROP CONSTRAINT IF EXISTS commandes_email_statut_check;
ALTER TABLE public.commandes ADD CONSTRAINT commandes_email_statut_check
  CHECK (email_statut = ANY (ARRAY['non_envoye'::text, 'envoye'::text, 'echec'::text]));

-- ── Historique des changements de statut ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.commande_statut_historique (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id      uuid NOT NULL REFERENCES public.commandes(id) ON DELETE CASCADE,
  etablissement_id uuid,
  statut           text NOT NULL,
  changed_at       timestamptz NOT NULL DEFAULT now(),
  changed_by       uuid
);

ALTER TABLE public.commande_statut_historique ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "csh_select" ON public.commande_statut_historique;
CREATE POLICY "csh_select" ON public.commande_statut_historique
  FOR SELECT USING (
    (etablissement_id = ANY (ARRAY(SELECT mes_etablissements()))) OR is_distributeur() OR is_autorite_sanitaire()
  );

DROP POLICY IF EXISTS "csh_insert" ON public.commande_statut_historique;
CREATE POLICY "csh_insert" ON public.commande_statut_historique
  FOR INSERT WITH CHECK (
    (etablissement_id = ANY (ARRAY(SELECT mes_etablissements()))) OR is_distributeur()
  );
-- Pas de policy update/delete : historique en lecture seule une fois écrit (append-only).

-- Log automatique : chaque insert de commande ET chaque changement réel de
-- statut est tracé, sans dépendre du code frontend (cohérent même via SQL
-- direct ou une future intégration distributeur).
CREATE OR REPLACE FUNCTION public.log_commande_statut_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.commande_statut_historique (commande_id, etablissement_id, statut, changed_by)
    VALUES (NEW.id, NEW.etablissement_id, NEW.statut, auth.uid());
  ELSIF TG_OP = 'UPDATE' AND NEW.statut IS DISTINCT FROM OLD.statut THEN
    INSERT INTO public.commande_statut_historique (commande_id, etablissement_id, statut, changed_by)
    VALUES (NEW.id, NEW.etablissement_id, NEW.statut, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_commande_statut ON public.commandes;
CREATE TRIGGER trg_log_commande_statut
  AFTER INSERT OR UPDATE OF statut ON public.commandes
  FOR EACH ROW
  EXECUTE FUNCTION public.log_commande_statut_change();

-- ── Incrément de stock automatique à la réception ───────────────────────────
-- Se déclenche uniquement sur une vraie transition VERS "livree" (pas de
-- double incrément possible en reclique/retry), et seulement si la commande
-- a bien un medicament_id/quantite structurés (les anciennes commandes,
-- créées avant cette migration, n'ont que du texte libre en notes -- pas
-- d'incrément automatique possible pour elles).
CREATE OR REPLACE FUNCTION public.increment_stock_reception_commande()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.medicament_id IS NOT NULL AND NEW.quantite IS NOT NULL THEN
    UPDATE public.medicaments SET stock_actuel = stock_actuel + NEW.quantite WHERE id = NEW.medicament_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_increment_stock_reception ON public.commandes;
CREATE TRIGGER trg_increment_stock_reception
  AFTER UPDATE OF statut ON public.commandes
  FOR EACH ROW
  WHEN (NEW.statut = 'livree' AND OLD.statut IS DISTINCT FROM NEW.statut)
  EXECUTE FUNCTION public.increment_stock_reception_commande();
