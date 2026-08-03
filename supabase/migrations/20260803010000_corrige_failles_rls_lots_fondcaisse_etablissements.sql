-- Phase 2 (audit sécurité plateforme) — 3 failles RLS confirmées et corrigées :
--
-- 1. etablissements : les policies SELECT "annuaire public" (hôpitaux/distributeurs validés)
--    étaient accordées au rôle {public}, qui couvre AUSSI le rôle anon (aucune connexion
--    requise). Vérifié en direct via curl avec uniquement la clé publique du frontend :
--    n'importe qui sur internet pouvait lire email, téléphone, dernière connexion, numéro de
--    licence de CHAQUE hôpital/distributeur validé. Aucun usage anon légitime trouvé dans le
--    code (Inscription.jsx ne fait qu'un INSERT). Restreint à {authenticated} uniquement —
--    aucun changement de comportement pour les utilisateurs connectés.
--
-- 2. fond_caisse : policies INSERT/SELECT ne vérifiaient que "auth.uid() IS NOT NULL", sans
--    jamais comparer etablissement_id (colonne pourtant présente) à mes_etablissements().
--    N'importe quel compte authentifié, de n'importe quel établissement, pouvait lire le fond
--    de caisse de TOUS les établissements et en insérer pour n'importe quel etablissement_id.
--    Alignée sur le pattern etablissement_id = ANY(mes_etablissements()) utilisé partout
--    ailleurs.
--
-- 3. lots : policies INSERT/UPDATE/DELETE basées uniquement sur is_membre_actif() (membre actif
--    de N'IMPORTE QUEL établissement), sans jamais vérifier que le medicament_id référencé
--    appartient à un établissement de l'appelant. N'importe quel compte pouvait donc modifier
--    ou supprimer les lots d'un autre établissement, ou créer un lot pointant vers le
--    medicament_id d'un tiers. SELECT reste volontairement large (vérification d'authenticité
--    inter-établissements via le Scanner, fonctionnalité voulue) ; seules les écritures sont
--    désormais scopées via une jointure sur medicaments.etablissement_id.

-- 1. etablissements — annuaire public réservé aux utilisateurs connectés
alter policy etab_select_hopitaux_publics on public.etablissements to authenticated;
alter policy etab_select_distributeurs_publics on public.etablissements to authenticated;
alter policy etab_select_distributeur_clients on public.etablissements to authenticated;

-- 2. fond_caisse — scope par établissement
drop policy if exists fond_caisse_select on public.fond_caisse;
create policy fond_caisse_select on public.fond_caisse
  for select
  using (etablissement_id = any (array(select mes_etablissements())));

drop policy if exists fond_caisse_insert on public.fond_caisse;
create policy fond_caisse_insert on public.fond_caisse
  for insert
  with check (etablissement_id = any (array(select mes_etablissements())));

-- 3. lots — écritures scopées via le medicament référencé
drop policy if exists lots_insert on public.lots;
create policy lots_insert on public.lots
  for insert
  with check (
    exists (
      select 1 from public.medicaments m
      where m.id = lots.medicament_id
        and m.etablissement_id = any (array(select mes_etablissements()))
    )
  );

drop policy if exists lots_update on public.lots;
create policy lots_update on public.lots
  for update
  using (
    exists (
      select 1 from public.medicaments m
      where m.id = lots.medicament_id
        and m.etablissement_id = any (array(select mes_etablissements()))
    )
  )
  with check (
    exists (
      select 1 from public.medicaments m
      where m.id = lots.medicament_id
        and m.etablissement_id = any (array(select mes_etablissements()))
    )
  );

drop policy if exists lots_delete on public.lots;
create policy lots_delete on public.lots
  for delete
  using (
    exists (
      select 1 from public.medicaments m
      where m.id = lots.medicament_id
        and m.etablissement_id = any (array(select mes_etablissements()))
    )
  );
