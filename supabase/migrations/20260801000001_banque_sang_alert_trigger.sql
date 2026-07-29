-- Audit exhaustif hôpital — Étape 5 (emails)
--
-- La banque de sang n'avait aucune alerte persistée ni email : un stock bas
-- ou une rupture pour un groupe sanguin donné ne se voyait que dans le
-- bandeau visuel de BanqueSang.jsx, si quelqu'un avait cette page ouverte au
-- bon moment. Ajoute un trigger (même schéma que notify_stock_alert déjà en
-- place pour les médicaments) qui appelle l'Edge Function
-- check-banque-sang-alert à chaque INSERT/UPDATE de poches_sang.

CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

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
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllaHFtdndtb3Nza3VtYmVnenR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMjgxMzYsImV4cCI6MjA5NTcwNDEzNn0.Yy4n7_oOztJF6_SkIbnQI-2FgJbWTWuLZzVUre1Ja3I'
      )
    ) INTO request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[MedOS] Echec envoi alerte banque de sang (non bloquant) : %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_banque_sang_alert ON public.poches_sang;
CREATE TRIGGER trg_banque_sang_alert
  AFTER INSERT OR UPDATE ON public.poches_sang
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_banque_sang_alert();
