-- Point 6, mission "6 decisions produit" : races financieres identifiees dans
-- l'audit precedent (CaissePage.jsx/Stock.jsx) — meme famille de probleme que
-- les correctifs deja apportes ailleurs (banque de sang, transferts de stock
-- entrepot via receive_livraison/expedier_ligne_livraison, hospitalisations
-- point 3). Deux mecanismes distincts selon la nature de la race :
--
-- 1) Decrement de stock (dispensations/ventes concurrentes, quantite
--    demandee non verifiee contre le stock reel) -> UPDATE conditionnel
--    atomique en un seul aller-retour (le motif "verrou optimiste + modal de
--    resolution" ne s'applique pas ici : on ne demande pas a l'utilisateur
--    s'il veut "ecraser" un stock, on rejette simplement l'operation si la
--    quantite n'est plus disponible au moment precis de l'ecriture).
--
-- 2) Encaissement (deux encaissements concurrents sur la meme facture) ->
--    RPC SECURITY DEFINER avec verrou de ligne (SELECT ... FOR UPDATE), meme
--    principe que expedier_ligne_livraison() deja en place — impossible a
--    resoudre avec un simple UPDATE conditionnel cote client car l'operation
--    combine plusieurs ecritures (paiements_facture + factures_hopital) qui
--    doivent rester atomiques ensemble.
--
-- 3) Double cloture de caisse (fermerSessionCaisse sans garde de statut) ->
--    meme motif que point 3 : UPDATE conditionnel simple (garde sur le
--    statut, cote client dans useMutations.js, pas besoin de RPC pour une
--    seule table).

-- ── 1) Decrement de stock atomique ──────────────────────────────────────────
create or replace function public.decrementer_stock_atomique(
  p_medicament_id uuid,
  p_quantite numeric
)
returns public.medicaments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.medicaments;
begin
  if p_quantite is null or p_quantite <= 0 then
    raise exception 'quantite_invalide';
  end if;

  update public.medicaments
  set stock_actuel = stock_actuel - p_quantite
  where id = p_medicament_id
    and stock_actuel >= p_quantite
    and etablissement_id = any (array(select mes_etablissements()))
  returning * into v_row;

  if v_row.id is null then
    -- Distingue "stock insuffisant" de "medicament introuvable/non autorise"
    -- pour un message d'erreur utile cote UI.
    if exists (
      select 1 from public.medicaments
      where id = p_medicament_id and etablissement_id = any (array(select mes_etablissements()))
    ) then
      raise exception 'stock_insuffisant';
    else
      raise exception 'medicament_introuvable_ou_non_autorise';
    end if;
  end if;

  return v_row;
end;
$$;

grant execute on function public.decrementer_stock_atomique(uuid, numeric) to authenticated;

-- ── 2) Encaissement atomique (verrou de ligne sur la facture) ──────────────
create or replace function public.encaisser_facture(
  p_facture_id uuid,
  p_montant integer,
  p_montant_recu integer,
  p_monnaie_rendue integer,
  p_mode_paiement text,
  p_reference text,
  p_numero_recu text,
  p_caissier_email text,
  p_session_id uuid,
  p_taux_couverture numeric,
  p_type_couverture text,
  p_montant_couverture integer,
  p_total_a_payer integer
)
returns table (paiement_id uuid, facture_statut text, reste_patient integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_etab uuid;
  v_deja_paye integer;
  v_reste_avant integer;
  v_montant_effectif integer;
  v_nouveau_reste integer;
  v_nouveau_statut text;
  v_paiement_id uuid;
begin
  -- Verrou de ligne : toute autre transaction qui tente d'encaisser la meme
  -- facture attend ici jusqu'au commit de celle-ci, puis relit un etat a jour
  -- — empeche deux encaissements simultanes de se baser sur le meme "reste
  -- du" perime et de tous les deux reussir integralement.
  select etablissement_id into v_etab
  from public.factures_hopital
  where id = p_facture_id
  for update;

  if v_etab is null then
    raise exception 'facture_introuvable';
  end if;

  if not (v_etab = any (array(select mes_etablissements()))) then
    raise exception 'non_autorise';
  end if;

  select coalesce(sum(montant), 0) into v_deja_paye
  from public.paiements_facture
  where facture_id = p_facture_id;

  v_reste_avant := greatest(0, p_total_a_payer - v_deja_paye);

  if v_reste_avant <= 0 then
    raise exception 'facture_deja_payee';
  end if;

  v_montant_effectif := least(coalesce(p_montant, 0), v_reste_avant);
  if v_montant_effectif <= 0 then
    raise exception 'montant_invalide';
  end if;

  insert into public.paiements_facture
    (facture_id, etablissement_id, session_id, caissier_email, montant,
     montant_recu, monnaie_rendue, mode_paiement, reference_paiement, numero_recu)
  values
    (p_facture_id, v_etab, p_session_id, p_caissier_email, v_montant_effectif,
     p_montant_recu, p_monnaie_rendue, p_mode_paiement, p_reference, p_numero_recu)
  returning id into v_paiement_id;

  v_nouveau_reste := v_reste_avant - v_montant_effectif;
  v_nouveau_statut := case when v_nouveau_reste <= 0 then 'payee' else 'acompte' end;

  update public.factures_hopital set
    statut = v_nouveau_statut,
    taux_couverture = p_taux_couverture,
    type_couverture = p_type_couverture,
    montant_couverture = p_montant_couverture,
    reste_patient = v_nouveau_reste,
    mode_paiement = case when v_nouveau_statut = 'payee' then p_mode_paiement else mode_paiement end,
    date_paiement = case when v_nouveau_statut = 'payee' then now() else date_paiement end
  where id = p_facture_id;

  return query select v_paiement_id, v_nouveau_statut, v_nouveau_reste;
end;
$$;

grant execute on function public.encaisser_facture(
  uuid, integer, integer, integer, text, text, text, text, uuid, numeric, text, integer, integer
) to authenticated;
