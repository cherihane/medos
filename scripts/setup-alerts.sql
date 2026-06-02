-- ============================================================
-- MedOS — Configuration des alertes email (a executer APRES
-- avoir deploye l'Edge Function check-stock-alert)
--
-- Supabase n'accorde pas le droit ALTER DATABASE aux utilisateurs
-- normaux (permission denied to set parameter).
-- On utilise ALTER ROLE postgres SET ... qui fonctionne avec les
-- permissions accordees dans le SQL Editor Supabase.
-- ============================================================

-- 1. URL de l'Edge Function
ALTER ROLE postgres
  SET app.edge_function_url = 'https://yehqmvwmosskumbegzty.supabase.co/functions/v1/check-stock-alert';

-- 2. Secret webhook (doit correspondre a WEBHOOK_SECRET dans les secrets Supabase)
ALTER ROLE postgres
  SET app.webhook_secret = 'medos_wh_secret_2024';

-- 3. URL de l'Edge Function d'activation/refus inscription
ALTER ROLE postgres
  SET app.activation_email_url = 'https://yehqmvwmosskumbegzty.supabase.co/functions/v1/send-activation-email';

-- 4. Recharger la configuration sans redemarrer (facultatif, prend effet a la prochaine connexion)
SELECT pg_reload_conf();

-- 5. Verification — ouvrir une nouvelle connexion SQL puis executer :
--    SELECT current_setting('app.edge_function_url'),
--           current_setting('app.webhook_secret'),
--           current_setting('app.activation_email_url');
--
--    Note : current_setting() ne reflete les changements ALTER ROLE
--    que dans les connexions ouvertes APRES l'execution de ce script.
