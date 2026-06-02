-- ============================================================
-- MedOS — Trigger + Webhook pour alertes stock temps reel
-- A executer dans Supabase > SQL Editor
-- ============================================================

-- 1. Activer l'extension pg_net (HTTP depuis PostgreSQL)
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- 2. Fonction PL/pgSQL qui appelle l'Edge Function via HTTP
CREATE OR REPLACE FUNCTION public.notify_stock_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  payload     jsonb;
  request_id  bigint;
  secret      text;
BEGIN
  -- Construire le payload webhook (format Supabase Database Webhooks)
  payload := jsonb_build_object(
    'type',       TG_OP,
    'table',      TG_TABLE_NAME,
    'schema',     TG_TABLE_SCHEMA,
    'record',     row_to_json(NEW)::jsonb,
    'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD)::jsonb ELSE NULL END
  );

  -- Secret webhook (optionnel — configure dans les secrets Supabase)
  secret := current_setting('app.webhook_secret', true);

  -- Appel HTTP asynchrone via pg_net
  SELECT net.http_post(
    url     := 'https://yehqmvwmosskumbegzty.supabase.co/functions/v1/check-stock-alert',
    body    := payload::text,
    headers := jsonb_build_object(
      'Content-Type',      'application/json',
      'x-webhook-secret',  COALESCE(secret, ''),
      'Authorization',     'Bearer ' || COALESCE(current_setting('app.service_role_key', true), '')
    )
  ) INTO request_id;

  RAISE NOTICE '[MedOS] Alerte stock envoyee (request_id: %)', request_id;

  RETURN NEW;
END;
$$;

-- 3. Trigger sur la table medicaments
--    Se declenche sur INSERT et UPDATE du stock_actuel
DROP TRIGGER IF EXISTS trg_stock_alert ON public.medicaments;

CREATE TRIGGER trg_stock_alert
  AFTER INSERT OR UPDATE OF stock_actuel
  ON public.medicaments
  FOR EACH ROW
  WHEN (
    NEW.stock_minimum IS NOT NULL
    AND NEW.stock_minimum > 0
    AND NEW.stock_actuel < NEW.stock_minimum
  )
  EXECUTE FUNCTION public.notify_stock_alert();

COMMENT ON FUNCTION public.notify_stock_alert() IS
  'Declenche quand stock_actuel < stock_minimum. Appelle Edge Function check-stock-alert via pg_net pour creer une alerte et envoyer un email Resend.';
