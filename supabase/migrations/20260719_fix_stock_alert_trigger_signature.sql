-- notify_stock_alert() appelait net.http_post(..., body := payload::text, ...), mais
-- la fonction pg_net installée attend body en jsonb (net.http_post(url text, body jsonb,
-- params jsonb, headers jsonb, timeout_milliseconds int)). Le cast ::text en trop faisait
-- échouer la résolution de surcharge ("function net.http_post(...) does not exist"),
-- ce qui bloquait purement et simplement tout INSERT/UPDATE d'un médicament passant
-- sous le seuil de stock minimum (le trigger est AFTER INSERT/UPDATE, son échec annule
-- l'opération). Trouvé lors du diagnostic du module Pharmacie (2026-07-19).
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
  payload := jsonb_build_object(
    'type',       TG_OP,
    'table',      TG_TABLE_NAME,
    'schema',     TG_TABLE_SCHEMA,
    'record',     row_to_json(NEW)::jsonb,
    'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD)::jsonb ELSE NULL END
  );

  secret := current_setting('app.webhook_secret', true);

  BEGIN
    SELECT net.http_post(
      url     := 'https://yehqmvwmosskumbegzty.supabase.co/functions/v1/check-stock-alert',
      body    := payload,
      headers := jsonb_build_object(
        'Content-Type',      'application/json',
        'x-webhook-secret',  COALESCE(secret, ''),
        'Authorization',     'Bearer ' || COALESCE(current_setting('app.service_role_key', true), '')
      )
    ) INTO request_id;
    RAISE NOTICE '[MedOS] Alerte stock envoyee (request_id: %)', request_id;
  EXCEPTION WHEN OTHERS THEN
    -- Une panne du webhook de notification ne doit jamais faire echouer
    -- la vente/mise a jour de stock qui a declenche ce trigger.
    RAISE WARNING '[MedOS] Echec envoi alerte stock (non bloquant) : %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;
