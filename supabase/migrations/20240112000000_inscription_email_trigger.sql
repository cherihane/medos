-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 20240112000000 — Trigger email activation/refus inscription
--
-- Declenche l'Edge Function send-activation-email via pg_net quand :
--   - actif passe de false a true (validation)
--   - statut_inscription passe a "refuse"
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. S'assurer que pg_net est disponible
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- 2. Fonction trigger
CREATE OR REPLACE FUNCTION public.notify_inscription_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  payload     jsonb;
  edge_url    text;
  secret      text;
BEGIN
  -- Lire l'URL de l'Edge Function depuis la config de la base
  edge_url := current_setting('app.activation_email_url', true);

  IF edge_url IS NULL OR edge_url = '' THEN
    RAISE NOTICE '[MedOS] app.activation_email_url non configure — notification ignoree';
    RETURN NEW;
  END IF;

  -- Verifier qu'il y a bien un changement pertinent
  IF NOT (
    (NEW.actif = true  AND OLD.actif = false) OR
    (NEW.statut_inscription = 'refuse' AND (OLD.statut_inscription IS DISTINCT FROM 'refuse'))
  ) THEN
    RETURN NEW;
  END IF;

  -- Construire le payload webhook (format Supabase Database Webhooks)
  payload := jsonb_build_object(
    'type',       'UPDATE',
    'table',      TG_TABLE_NAME,
    'schema',     TG_TABLE_SCHEMA,
    'record',     row_to_json(NEW)::jsonb,
    'old_record', row_to_json(OLD)::jsonb
  );

  secret := current_setting('app.webhook_secret', true);

  PERFORM net.http_post(
    url     := edge_url,
    body    := payload::text,
    headers := jsonb_build_object(
      'Content-Type',      'application/json',
      'x-webhook-secret',  COALESCE(secret, ''),
      'Authorization',     'Bearer ' || COALESCE(current_setting('app.service_role_key', true), '')
    )
  );

  RAISE NOTICE '[MedOS] Notification activation/refus envoyee pour %', NEW.email;
  RETURN NEW;
END;
$$;

-- 3. Trigger sur etablissements (UPDATE uniquement)
DROP TRIGGER IF EXISTS trg_inscription_email ON public.etablissements;

CREATE TRIGGER trg_inscription_email
  AFTER UPDATE OF actif, statut_inscription
  ON public.etablissements
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_inscription_status();

-- 4. Configuration requise apres deploiement de l'Edge Function
--    Remplacez <PROJECT_REF> par votre reference Supabase reelle.
--    Executez ces commandes dans le SQL Editor Supabase :
--
--    ALTER DATABASE postgres
--      SET app.activation_email_url = 'https://<PROJECT_REF>.supabase.co/functions/v1/send-activation-email';
--
--    (app.webhook_secret et app.service_role_key sont deja configures si vous
--     avez execute la migration 20240102000000_stock_alert_trigger.sql)

COMMENT ON FUNCTION public.notify_inscription_status() IS
  'Declenche par UPDATE sur etablissements.actif ou statut_inscription.
   Appelle Edge Function send-activation-email via pg_net pour envoyer
   un email Resend de validation ou de refus a l''organisme.';
