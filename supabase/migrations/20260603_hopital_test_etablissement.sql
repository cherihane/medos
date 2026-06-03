-- ============================================================
-- Migration : création de l'établissement pour le compte hopital@medos.test
-- + politique RLS de secours pour planning_gardes
--
-- Problème : hopital@medos.test n'a pas de ligne dans etablissements,
-- donc auth.etablissement_id = null et mes_etablissements() = vide.
--
-- À exécuter dans Supabase → SQL Editor
-- ============================================================

-- ── 1. Créer l'établissement de type hôpital si inexistant ───────────────────
-- Remplacer 'hopital@medos.test' par l'email réel du compte si différent.
insert into public.etablissements (nom, email, type, ville, pays)
select
  'Hôpital Central',
  'hopital@medos.test',
  'hopital',
  'Abidjan',
  'Côte d''Ivoire'
where not exists (
  select 1 from public.etablissements where email = 'hopital@medos.test'
);

-- ── 2. Politique de secours sur planning_gardes ────────────────────────────────
-- Couvre les comptes authentifiés dont l'email correspond directement à un
-- établissement de type 'hopital', sans passer par mes_etablissements().
-- Utile si le compte propriétaire n'est pas encore enrichi côté app.
create policy if not exists "planning_gardes_insert_hopital_owner"
  on public.planning_gardes
  for insert
  with check (
    auth.uid() is not null
    and etablissement_id in (
      select e.id
      from public.etablissements e
      join auth.users u on u.email = e.email
      where u.id = auth.uid()
        and e.type = 'hopital'
    )
  );

-- ── 3. Vérification ──────────────────────────────────────────────────────────
-- Exécuter ces requêtes séparément pour valider :
--
-- select id, nom, email, type from public.etablissements where email = 'hopital@medos.test';
-- select public.mes_etablissements();   -- doit renvoyer l'UUID de l'établissement
