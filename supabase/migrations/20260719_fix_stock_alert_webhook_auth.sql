-- notify_stock_alert() appelait net.http_post(...) avec
-- Authorization: Bearer <current_setting('app.service_role_key')>, mais ce
-- parametre Postgres personnalise n'a jamais ete configure (unrecognized
-- configuration parameter) -- ALTER DATABASE ... SET sur un GUC custom exige
-- un privilege superuser que Supabase hebergee n'accorde pas aux projets.
-- Consequence : la passerelle Supabase rejetait la requete en 401 AVANT meme
-- d'executer le code de l'Edge Function check-stock-alert (qui gere deja
-- correctement ses propres secrets internes via Deno.env.get). Le probleme
-- etait donc cote appelant (le trigger Postgres), pas cote fonction.
--
-- Fix : le trigger embarque directement la cle "anon" du projet en
-- Authorization, ce qui suffit a passer la verification JWT de la passerelle.
-- Cette cle est publique par conception (deja presente en clair dans le
-- bundle JS frontend, sa securite repose sur RLS et non sur le secret) --
-- l'embarquer ici dans une fonction SECURITY DEFINER ne constitue donc pas
-- une nouvelle exposition.
-- Trouve/corrige lors du diagnostic du module Pharmacie (2026-07-19).
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
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllaHFtdndtb3Nza3VtYmVnenR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMjgxMzYsImV4cCI6MjA5NTcwNDEzNn0.Yy4n7_oOztJF6_SkIbnQI-2FgJbWTWuLZzVUre1Ja3I'
      )
    ) INTO request_id;
    RAISE NOTICE '[MedOS] Alerte stock envoyee (request_id: %)', request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[MedOS] Echec envoi alerte stock (non bloquant) : %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;
