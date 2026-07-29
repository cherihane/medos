-- Audit exhaustif hôpital — Étape 2/3 (banque de sang)
--
-- Le trigger verifier_compatibilite_poche_sang() (20260729b_banque_de_sang.sql)
-- ne se redéclenchait que sur INSERT ou UPDATE OF patient_id, groupe_sanguin.
-- La transfusion réelle (transfuserPocheSang, useMutations.js) ne modifie que
-- statut/transfuse_par/date_transfusion — la vérification de compatibilité
-- n'était donc faite qu'AU MOMENT DE LA RÉSERVATION, jamais re-vérifiée à la
-- transfusion elle-même. Scénario réel possible : le groupe sanguin du
-- patient est corrigé en base (erreur de saisie initiale rectifiée) APRÈS
-- qu'une poche a été réservée pour lui, avant la transfusion — la
-- transfusion incompatible n'aurait alors plus été bloquée.
--
-- De plus, aucune vérification ne portait sur la date de péremption : une
-- poche périmée mais restée au statut "disponible" pouvait être réservée et
-- transfusée sans blocage (seul un bandeau visuel passif existait).
--
-- Corrigé : le trigger se redéclenche aussi sur UPDATE OF statut (couvre donc
-- la transfusion elle-même, pas seulement la réservation), et bloque en plus
-- toute réservation/transfusion d'une poche périmée.

CREATE OR REPLACE FUNCTION public.verifier_compatibilite_poche_sang()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  groupe_patient TEXT;
  abo_patient    TEXT;
  rh_patient     TEXT;
  abo_poche      TEXT;
  rh_poche       TEXT;
BEGIN
  -- Ne s'applique qu'aux transitions vers un état où la poche est engagée
  -- pour un patient précis (réservation ou transfusion).
  IF NEW.statut NOT IN ('reservee', 'transfusee') THEN
    RETURN NEW;
  END IF;

  IF NEW.patient_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.date_peremption < CURRENT_DATE THEN
    RAISE EXCEPTION 'Poche périmée (date de péremption : %) : réservation ou transfusion bloquée.', NEW.date_peremption;
  END IF;

  SELECT groupe_sanguin INTO groupe_patient FROM patients WHERE id = NEW.patient_id;
  IF groupe_patient IS NULL OR groupe_patient = '' THEN
    RAISE EXCEPTION 'Réservation/transfusion bloquée : le groupe sanguin du patient n''est pas renseigné.';
  END IF;

  abo_patient := left(groupe_patient, length(groupe_patient) - 1);
  rh_patient  := right(groupe_patient, 1);
  abo_poche   := left(NEW.groupe_sanguin, length(NEW.groupe_sanguin) - 1);
  rh_poche    := right(NEW.groupe_sanguin, 1);

  IF NOT (
    (abo_poche = 'O' OR abo_poche = abo_patient OR abo_patient = 'AB')
    AND (rh_poche = '-' OR rh_patient = '+')
  ) THEN
    RAISE EXCEPTION 'Groupe incompatible : patient % / poche % — réservation ou transfusion bloquée.', groupe_patient, NEW.groupe_sanguin;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_verifier_compatibilite_poche_sang ON poches_sang;
CREATE TRIGGER trg_verifier_compatibilite_poche_sang
  BEFORE INSERT OR UPDATE OF patient_id, groupe_sanguin, statut ON poches_sang
  FOR EACH ROW
  EXECUTE FUNCTION public.verifier_compatibilite_poche_sang();
