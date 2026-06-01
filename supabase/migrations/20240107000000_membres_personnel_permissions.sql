-- Ajoute la colonne permissions_nav sur membres_personnel
-- Stocke le tableau de chemins autorisés pour chaque membre du personnel.
-- NULL = utiliser le nav par défaut du role_interne.
alter table public.membres_personnel
  add column if not exists permissions_nav jsonb default null;
