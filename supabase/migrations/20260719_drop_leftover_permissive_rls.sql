-- Supprime les anciennes politiques RLS permissives ("auth_users_*", USING true)
-- laissées par 20240103000000_fix_rls_explicit.sql. Elles coexistaient en prod avec
-- les politiques restreintes par établissement (med_select, patients_select, etc.
-- issues de 20240110000000_rls_by_etablissement.sql), et comme les politiques RLS
-- permissives s'additionnent en OR, elles annulaient complètement la restriction :
-- n'importe quel utilisateur authentifié pouvait lire/modifier/supprimer les
-- données de N'IMPORTE QUEL établissement (patients, ventes, ordonnances compris).
-- Trouvé et corrigé lors du diagnostic du module Pharmacie (2026-07-19).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'etablissements','medicaments','lots','fournisseurs',
    'patients','ordonnances','ventes','commandes','livraisons','alertes'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "auth_users_select_%s" ON public.%s', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "auth_users_insert_%s" ON public.%s', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "auth_users_update_%s" ON public.%s', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "auth_users_delete_%s" ON public.%s', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "auth_users_all_%s"    ON public.%s', t, t);
  END LOOP;
END $$;
