-- Patch : ajout des colonnes de stock sur la table medicaments
-- À exécuter si la table medicaments existe déjà sans ces colonnes
alter table public.medicaments
  add column if not exists stock_actuel  int default 0,
  add column if not exists stock_minimum int default 0;
