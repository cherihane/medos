-- ============================================================
-- Migration : correction des politiques RLS sur planning_gardes
-- Probleme  : INSERT refuse avec "permission denied" car :
--   1. La politique FOR ALL avec USING sans WITH CHECK explicite
--      echoue sur INSERT quand la sous-requete ne correspond pas
--   2. La jointure ne couvre que le proprietaire de l'etablissement,
--      pas les membres du personnel (membres_personnel) ayant leur
--      propre compte auth.users
--
-- Solution  : politiques separees SELECT / INSERT / UPDATE / DELETE
--   avec deux chemins d'acces :
--     a) Proprietaire de l'etablissement (etablissements.email = user.email)
--     b) Membre actif de l'etablissement (membres_personnel)
-- ============================================================

-- Helper : renvoie les etablissement_id accessibles pour l'utilisateur courant
-- (proprietaire OU membre actif)
create or replace function public.mes_etablissements()
returns setof uuid
language sql
security definer
stable
as $$
  -- Proprietaire : l'etablissement dont l'email correspond a l'utilisateur
  select e.id
  from public.etablissements e
  join auth.users u on u.email = e.email
  where u.id = auth.uid()

  union

  -- Membre du personnel actif de cet etablissement
  select m.etablissement_id
  from public.membres_personnel m
  join auth.users u on u.email = m.email
  where u.id = auth.uid()
    and m.actif = true
    and m.etablissement_id is not null;
$$;

-- ── Suppression de l'ancienne politique unique (trop restrictive) ─────────────
drop policy if exists "Etablissement propre — planning_gardes" on public.planning_gardes;

-- S'assurer que RLS est bien active
alter table public.planning_gardes enable row level security;

-- ── SELECT : lire les gardes de son etablissement ────────────────────────────
create policy "planning_gardes_select"
  on public.planning_gardes
  for select
  using (etablissement_id in (select public.mes_etablissements()));

-- ── INSERT : creer une garde pour son etablissement ──────────────────────────
-- WITH CHECK s'applique a la ligne a inserer
create policy "planning_gardes_insert"
  on public.planning_gardes
  for insert
  with check (etablissement_id in (select public.mes_etablissements()));

-- ── UPDATE : modifier une garde de son etablissement ─────────────────────────
-- USING filtre les lignes existantes, WITH CHECK valide la ligne apres update
create policy "planning_gardes_update"
  on public.planning_gardes
  for update
  using  (etablissement_id in (select public.mes_etablissements()))
  with check (etablissement_id in (select public.mes_etablissements()));

-- ── DELETE : supprimer une garde de son etablissement ────────────────────────
create policy "planning_gardes_delete"
  on public.planning_gardes
  for delete
  using (etablissement_id in (select public.mes_etablissements()));

-- ── Verification rapide (a executer dans l'editeur SQL Supabase) ─────────────
-- select public.mes_etablissements();          -- doit renvoyer votre etab_id
-- select count(*) from public.planning_gardes; -- doit renvoyer 0 ou N sans erreur
