-- Patients.jsx propose des filtres de fidélité (Fidèle/Récurrent/Occasionnel,
-- Avec allergies, Avec mutuelle) qui interrogent nb_visites, allergies, mutuelle
-- -- colonnes absentes de patients. Chaque clic sur un de ces filtres échouait
-- en production (42703, column does not exist).
-- Trouvé lors du diagnostic du module Pharmacie (2026-07-19).
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS nb_visites int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allergies text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS mutuelle text;

-- nb_visites est incrémenté à chaque vente rattachée à un patient (dispensation
-- d'ordonnance -- la caisse directe n'associe pas de patient aujourd'hui).
CREATE OR REPLACE FUNCTION public.increment_patient_visites()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.patient_id IS NOT NULL THEN
    UPDATE public.patients SET nb_visites = nb_visites + 1 WHERE id = NEW.patient_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_increment_patient_visites ON public.ventes;
CREATE TRIGGER trg_increment_patient_visites
  AFTER INSERT ON public.ventes
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_patient_visites();
