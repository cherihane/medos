-- Banque de sang — rattachée au rôle Laborantin (accès existant, pas de
-- nouveau rôle). Stock suivi par POCHE INDIVIDUELLE (pas un compteur agrégé)
-- pour garder une traçabilité complète : numéro de poche, péremption,
-- réservation nominative, transfusion réelle.
--
-- Rigueur non négociable : la compatibilité ABO/Rhésus est vérifiée et
-- BLOQUÉE côté application avant toute réservation (voir
-- src/utils/compatibiliteSanguine.js) — cette migration pose uniquement le
-- modèle de données et les garde-fous structurels (statuts valides, groupes
-- valides), la logique de blocage vit côté frontend car elle a besoin du
-- groupe sanguin du PATIENT au moment de la réservation, qui n'est pas une
-- donnée de cette table.

CREATE TABLE IF NOT EXISTS poches_sang (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id   UUID NOT NULL REFERENCES etablissements(id),
  groupe_sanguin     TEXT NOT NULL CHECK (groupe_sanguin IN ('O+','O-','A+','A-','B+','B-','AB+','AB-')),
  numero_poche       TEXT NOT NULL,
  date_reception     DATE NOT NULL DEFAULT current_date,
  date_peremption    DATE NOT NULL,
  volume_ml          INTEGER,
  origine            TEXT, -- ex : "Don du sang", "Banque nationale"

  -- disponible -> reservee -> transfusee, ou disponible/reservee -> ecartee
  -- (péremption, contrôle qualité) — jamais de suppression, trace conservée.
  statut             TEXT NOT NULL DEFAULT 'disponible'
                       CHECK (statut IN ('disponible','reservee','transfusee','ecartee')),

  patient_id         UUID REFERENCES patients(id),
  reserve_par        TEXT,
  date_reservation   TIMESTAMPTZ,
  transfuse_par      TEXT,
  date_transfusion   TIMESTAMPTZ,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poches_sang_etablissement ON poches_sang (etablissement_id);
CREATE INDEX IF NOT EXISTS idx_poches_sang_groupe         ON poches_sang (groupe_sanguin);
CREATE INDEX IF NOT EXISTS idx_poches_sang_statut         ON poches_sang (statut);
CREATE INDEX IF NOT EXISTS idx_poches_sang_patient         ON poches_sang (patient_id);

ALTER TABLE poches_sang ENABLE ROW LEVEL SECURITY;

CREATE POLICY "poches_sang_select" ON poches_sang FOR SELECT
  USING (etablissement_id = ANY(ARRAY(SELECT mes_etablissements())));
CREATE POLICY "poches_sang_insert" ON poches_sang FOR INSERT
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT mes_etablissements())));
CREATE POLICY "poches_sang_update" ON poches_sang FOR UPDATE
  USING (etablissement_id = ANY(ARRAY(SELECT mes_etablissements())))
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT mes_etablissements())));

-- ── Garde-fou de compatibilité ABO/Rhésus, en base ──────────────────────────
-- Exigence non négociable : le système doit BLOQUER, pas juste avertir, toute
-- réservation/transfusion incompatible. La vérification vit déjà côté
-- frontend (src/utils/compatibiliteSanguine.js, même règle) pour un retour
-- immédiat à l'utilisateur, MAIS ce trigger est la vraie ligne de défense :
-- même un bug d'interface ou un appel API direct ne peut pas contourner la
-- règle de compatibilité, car elle est appliquée au niveau de la donnée
-- elle-même, pas seulement de l'écran qui la produit.
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
  IF NEW.patient_id IS NULL THEN
    RETURN NEW;
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
  BEFORE INSERT OR UPDATE OF patient_id, groupe_sanguin ON poches_sang
  FOR EACH ROW
  EXECUTE FUNCTION public.verifier_compatibilite_poche_sang();

-- ── Journal des transfusions (dossier patient) ──────────────────────────────
-- Table dédiée plutôt qu'un simple statut sur poches_sang : une transfusion
-- est un acte clinique qui doit apparaître dans le dossier chronologique du
-- patient (fetchDossierMedical) au même titre qu'une consultation ou un
-- examen, indépendamment du cycle de vie de la poche elle-même. Capture
-- explicitement les DEUX groupes sanguins (patient et poche) au moment de
-- l'acte — preuve de la double confirmation exigée, jamais à reconstituer a
-- posteriori depuis des tables qui peuvent changer.
CREATE TABLE IF NOT EXISTS transfusions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id             UUID NOT NULL REFERENCES patients(id),
  etablissement_id       UUID NOT NULL REFERENCES etablissements(id),
  poche_id               UUID REFERENCES poches_sang(id),
  numero_poche           TEXT,
  groupe_sanguin_patient TEXT NOT NULL,
  groupe_sanguin_poche   TEXT NOT NULL,
  effectue_par           TEXT,
  date_transfusion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes                  TEXT
);

CREATE INDEX IF NOT EXISTS idx_transfusions_patient       ON transfusions (patient_id);
CREATE INDEX IF NOT EXISTS idx_transfusions_etablissement ON transfusions (etablissement_id);

ALTER TABLE transfusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transfusions_select" ON transfusions FOR SELECT
  USING (etablissement_id = ANY(ARRAY(SELECT mes_etablissements())));
CREATE POLICY "transfusions_insert" ON transfusions FOR INSERT
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT mes_etablissements())));
-- Pas de policy UPDATE/DELETE : acte clinique immuable une fois enregistré.
