-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 20240113000000 — Politique RLS pour l'inscription anonyme
--
-- Probleme : apres supabase.auth.signUp() avec confirmation email activee,
-- l'utilisateur n'est pas encore authentifie (role anon). La politique
-- existante "auth_users_insert_etablissements" couvre uniquement le role
-- "authenticated", donc l'INSERT echoue avec "row-level security policy".
--
-- Solution : ajouter une politique INSERT limitee au role anon avec deux
-- contraintes strictes qui empechent tout abus :
--   - statut_inscription doit etre exactement 'en_attente'
--   - actif doit etre false
--
-- Un visiteur anonyme ne peut donc qu'enregistrer un dossier en attente,
-- jamais activer un compte ni changer le statut en autre chose.
-- ─────────────────────────────────────────────────────────────────────────────

-- Supprimer si elle existe deja (idempotent)
DROP POLICY IF EXISTS "anon_insert_inscription_etablissements" ON public.etablissements;

CREATE POLICY "anon_insert_inscription_etablissements"
  ON public.etablissements
  FOR INSERT
  TO anon
  WITH CHECK (
    statut_inscription = 'en_attente'
    AND actif = false
  );

-- Verification
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename  = 'etablissements'
ORDER BY cmd, policyname;
