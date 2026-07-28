-- Remplace l'octroi automatique "paresseux" (évalué uniquement quand un
-- client hôpital rechargeait son contexte, voir commentaire retiré de
-- AccesElargiContext.jsx) par une vraie tâche planifiée pg_cron, exécutée
-- côté serveur toutes les minutes — l'accès s'active désormais exactement
-- au bout du délai configuré, sans dépendre qu'un utilisateur charge une
-- page entre-temps.
--
-- La logique de décision (durée accordée, fenêtre de détection d'abus,
-- contenu des alertes) est reprise à l'identique de l'ancienne fonction
-- JS `verifierEtAccorderAutomatique` (src/hooks/useMutations.js, désormais
-- supprimée) — seul le déclenchement change. Les constantes ci-dessous
-- doivent rester synchronisées avec DUREE_ACCES_ELARGI_HEURES et
-- FENETRE_ABUS_HEURES côté client (celles-ci restent utilisées pour la
-- durée par défaut d'une approbation MANUELLE, voir approuverDemandeAcces).

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.executer_verification_acces_elargi()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d RECORD;
  v_jusqu_a TIMESTAMPTZ;
  v_date_limite_revue TIMESTAMPTZ;
  v_octrois_recents INTEGER;
  v_abus BOOLEAN;
  v_row_count INTEGER;
BEGIN
  FOR d IN
    SELECT dae.*
    FROM demandes_acces_elargi dae
    JOIN etablissements e ON e.id = dae.etablissement_id
    WHERE dae.statut = 'en_attente'
      AND dae.created_at < now() - (e.delai_acces_elargi_minutes || ' minutes')::interval
  LOOP
    v_jusqu_a := now() + interval '4 hours';          -- DUREE_ACCES_ELARGI_HEURES
    v_date_limite_revue := now() + interval '24 hours';

    UPDATE demandes_acces_elargi
    SET statut = 'auto_accorde',
        accorde_jusqu_a = v_jusqu_a,
        revue_requise = true,
        date_limite_revue = v_date_limite_revue
    WHERE id = d.id AND statut = 'en_attente';
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    IF v_row_count = 0 THEN
      CONTINUE; -- déjà traitée entre-temps (concurrence entre deux exécutions)
    END IF;

    SELECT count(*) INTO v_octrois_recents
    FROM demandes_acces_elargi
    WHERE etablissement_id = d.etablissement_id
      AND demandeur_email = d.demandeur_email
      AND statut = 'auto_accorde'
      AND created_at > now() - interval '24 hours';    -- FENETRE_ABUS_HEURES

    v_abus := v_octrois_recents > 1; -- celle-ci incluse = au moins la 2e

    INSERT INTO alertes (etablissement_id, titre, message, type, lu, severite, resolu)
    VALUES (
      d.etablissement_id,
      CASE WHEN v_abus THEN 'ABUS POTENTIEL — accès élargi auto-accordé plusieurs fois'
           ELSE 'Accès élargi accordé automatiquement — revue requise' END,
      CASE WHEN v_abus THEN
        d.demandeur_email || ' a déclenché plusieurs octrois automatiques d''accès élargi (' ||
        v_octrois_recents || ' en 24h) — à examiner en priorité. Motif le plus récent : ' || d.motif
      ELSE
        d.demandeur_email || ' → ' || d.role_demande ||
        ' accordé automatiquement (Direction n''a pas répondu à temps). Motif : ' || d.motif ||
        '. Revue obligatoire sous 24h.'
      END,
      'acces_elargi',
      false,
      CASE WHEN v_abus THEN 'critique' ELSE 'alerte' END,
      false
    );
  END LOOP;
END;
$$;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'acces-elargi-auto-octroi';
SELECT cron.schedule(
  'acces-elargi-auto-octroi',
  '* * * * *',
  $$ SELECT public.executer_verification_acces_elargi(); $$
);
