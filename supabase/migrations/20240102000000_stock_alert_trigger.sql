-- ============================================================
-- MedOS — Trigger + Webhook pour alertes stock temps réel
-- À exécuter dans Supabase > SQL Editor
-- ============================================================

-- 1. Activer l'extension pg_net (HTTP depuis PostgreSQL)
create extension if not exists pg_net schema extensions;

-- 2. Fonction PL/pgSQL qui appelle l'Edge Function via HTTP
create or replace function public.notify_stock_alert()
returns trigger
language plpgsql
security definer
as $$
declare
  payload     jsonb;
  request_id  bigint;
  edge_url    text;
  secret      text;
begin
  -- URL de l'Edge Function — à remplacer par votre URL Supabase réelle
  -- Format: https://<project-ref>.supabase.co/functions/v1/check-stock-alert
  edge_url := current_setting('app.edge_function_url', true);

  if edge_url is null or edge_url = '' then
    raise notice '[MedOS] app.edge_function_url non configuré — alerte stock ignorée';
    return new;
  end if;

  -- Construire le payload webhook (format Supabase Database Webhooks)
  payload := jsonb_build_object(
    'type',       TG_OP,
    'table',      TG_TABLE_NAME,
    'schema',     TG_TABLE_SCHEMA,
    'record',     row_to_json(new)::jsonb,
    'old_record', case when TG_OP = 'UPDATE' then row_to_json(old)::jsonb else null end
  );

  -- Récupérer le secret webhook (optionnel)
  secret := current_setting('app.webhook_secret', true);

  -- Appel HTTP asynchrone via pg_net
  select net.http_post(
    url     := edge_url,
    body    := payload::text,
    headers := jsonb_build_object(
      'Content-Type',      'application/json',
      'x-webhook-secret',  coalesce(secret, ''),
      'Authorization',     'Bearer ' || coalesce(current_setting('app.service_role_key', true), '')
    )
  ) into request_id;

  raise notice '[MedOS] Alerte stock envoyée (request_id: %)', request_id;

  return new;
end;
$$;

-- 3. Trigger sur la table medicaments
--    Se déclenche sur INSERT et UPDATE du stock_actuel
drop trigger if exists trg_stock_alert on public.medicaments;

create trigger trg_stock_alert
  after insert or update of stock_actuel
  on public.medicaments
  for each row
  when (
    new.stock_minimum is not null
    and new.stock_minimum > 0
    and new.stock_actuel < new.stock_minimum
  )
  execute function public.notify_stock_alert();

-- 4. Configurer l'URL de l'Edge Function
--    Remplacez <PROJECT_REF> par votre référence Supabase
--    Exécutez cette ligne séparément après avoir déployé la fonction :
--
--    ALTER DATABASE postgres SET app.edge_function_url = 'https://<PROJECT_REF>.supabase.co/functions/v1/check-stock-alert';
--    ALTER DATABASE postgres SET app.webhook_secret = 'votre_secret_ici';
--
--    Ou utilisez le script setup-alerts.sql ci-dessous.

comment on function public.notify_stock_alert() is
  'Déclenché quand stock_actuel < stock_minimum. Appelle Edge Function check-stock-alert via pg_net pour créer une alerte et envoyer un email Resend.';
