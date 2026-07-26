-- Bug bloquant trouvé en session 15 (audit Hôpital, parcours live Direction) :
-- Patients.jsx (formulaire "Nouveau patient") envoie un champ `medecin_referent`
-- qui n'a jamais existé en base — chaque création de patient échouait avec
-- "Could not find the 'medecin_referent' column of 'patients' in the schema
-- cache", sur TOUT établissement hôpital, pas seulement le nouveau compte de
-- test. Colonne nullable, purement additive, aucun risque pour les données
-- existantes.
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS medecin_referent text;
