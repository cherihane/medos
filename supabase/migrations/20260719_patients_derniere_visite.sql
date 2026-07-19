-- "Dernière visite" du Registre patients (Rapports.jsx) est toujours vide :
-- patients.derniere_visite n'existe pas. Le code du module Hôpital
-- (hopital/Patients.jsx) l'utilise déjà à la création d'un patient, donc
-- l'insert patient cote hopital echoue aussi actuellement pour la meme raison
-- (colonne absente) -- corrige par la meme occasion, sans toucher au code
-- hopital lui-meme.
-- Trouve/corrige lors du diagnostic du module Pharmacie (2026-07-19).
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS derniere_visite date;

-- Etend le trigger deja pose sur ventes (increment_patient_visites, ajoute
-- lors du diagnostic precedent pour nb_visites) pour aussi mettre a jour
-- derniere_visite a chaque vente rattachee a un patient (dispensation
-- d'ordonnance -- la caisse directe n'associe pas de patient aujourd'hui).
CREATE OR REPLACE FUNCTION public.increment_patient_visites()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.patient_id IS NOT NULL THEN
    UPDATE public.patients
    SET nb_visites = nb_visites + 1,
        derniere_visite = COALESCE(NEW.date_vente, NEW.created_at, now())::date
    WHERE id = NEW.patient_id;
  END IF;
  RETURN NEW;
END;
$$;
