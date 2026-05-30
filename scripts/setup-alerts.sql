-- ============================================================
-- MedOS — Configuration des alertes email (à exécuter APRÈS
-- avoir déployé l'Edge Function check-stock-alert)
-- ============================================================

-- Remplacez les valeurs entre <> par les vôtres

-- 1. URL de l'Edge Function (Supabase Dashboard > Edge Functions > check-stock-alert > URL)
ALTER DATABASE postgres
  SET app.edge_function_url = 'https://yehqmvwmosskumbegzty.supabase.co/functions/v1/check-stock-alert';

-- 2. Secret webhook optionnel (inventez une chaîne aléatoire)
ALTER DATABASE postgres
  SET app.webhook_secret = 'medos_wh_secret_2024';

-- 3. Vérification — cette requête doit retourner vos valeurs
SELECT
  current_setting('app.edge_function_url') as edge_url,
  current_setting('app.webhook_secret')    as webhook_secret;
