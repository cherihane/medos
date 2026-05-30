-- ============================================================
-- MedOS — Fix RLS : politiques explicites SELECT/INSERT/UPDATE/DELETE
-- À exécuter dans Supabase > SQL Editor
-- ============================================================

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'etablissements','medicaments','lots','fournisseurs',
    'patients','ordonnances','ventes','commandes','livraisons','alertes'
  ]
  LOOP
    -- Supprimer toutes les politiques existantes
    EXECUTE format('DROP POLICY IF EXISTS "auth_users_all_%s"    ON public.%s', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "auth_users_select_%s" ON public.%s', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "auth_users_insert_%s" ON public.%s', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "auth_users_update_%s" ON public.%s', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "auth_users_delete_%s" ON public.%s', t, t);

    -- Recréer avec opérations explicites (certaines versions Supabase gèrent mieux)
    EXECUTE format(
      'CREATE POLICY "auth_users_select_%s" ON public.%s
       FOR SELECT TO authenticated USING (true)', t, t);

    EXECUTE format(
      'CREATE POLICY "auth_users_insert_%s" ON public.%s
       FOR INSERT TO authenticated WITH CHECK (true)', t, t);

    EXECUTE format(
      'CREATE POLICY "auth_users_update_%s" ON public.%s
       FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', t, t);

    EXECUTE format(
      'CREATE POLICY "auth_users_delete_%s" ON public.%s
       FOR DELETE TO authenticated USING (true)', t, t);
  END LOOP;
END $$;

-- Vérification
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
