-- Phase 2 (audit sécurité plateforme), point 7 — les 2 derniers triggers Postgres appelant des
-- Edge Functions (notify_stock_alert, notify_banque_sang_alert) envoyaient encore le JWT "anon"
-- legacy codé en dur comme Authorization Bearer, alors que les Edge Functions elles-mêmes
-- (check-stock-alert, check-banque-sang-alert) ont déjà été migrées vers le nouveau système de
-- clés API lors de l'audit sécurité précédent (rotation de clés). Remplace le JWT legacy par la
-- nouvelle clé "publishable" (même clé que src/supabaseClient.js), seule requise par la
-- passerelle Supabase pour atteindre ces fonctions (aucune vérification applicative
-- supplémentaire côté fonction, voir commentaire dans check-stock-alert/index.ts).

CREATE OR REPLACE FUNCTION public.notify_stock_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  payload     jsonb;
  request_id  bigint;
BEGIN
  payload := jsonb_build_object(
    'type',       TG_OP,
    'table',      TG_TABLE_NAME,
    'schema',     TG_TABLE_SCHEMA,
    'record',     row_to_json(NEW)::jsonb,
    'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD)::jsonb ELSE NULL END
  );
  BEGIN
    SELECT net.http_post(
      url     := 'https://yehqmvwmosskumbegzty.supabase.co/functions/v1/check-stock-alert',
      body    := payload,
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer sb_publishable_d0hgwt-SF7pzOswk-JVvZA_CkLm-4nI'
      )
    ) INTO request_id;
    RAISE NOTICE '[MedOS] Alerte stock envoyee (request_id: %)', request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[MedOS] Echec envoi alerte stock (non bloquant) : %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_banque_sang_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  payload     jsonb;
  request_id  bigint;
BEGIN
  payload := jsonb_build_object(
    'type',   TG_OP,
    'record', row_to_json(NEW)::jsonb
  );
  BEGIN
    SELECT net.http_post(
      url     := 'https://yehqmvwmosskumbegzty.supabase.co/functions/v1/check-banque-sang-alert',
      body    := payload,
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer sb_publishable_d0hgwt-SF7pzOswk-JVvZA_CkLm-4nI'
      )
    ) INTO request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[MedOS] Echec envoi alerte banque de sang (non bloquant) : %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;
