-- Point 3, mission "6 decisions produit" : etend le meme correctif de
-- concurrence deja prouve sur feuilles_reveil/partogrammes (voir
-- 20260803000000_detection_conflit_ecriture_concurrente.sql) a
-- hospitalisations, identifiee dans l'audit precedent comme partageant le
-- meme risque (changement de lit vs changement de motif en parallele,
-- upsertHospitalisation appelee depuis 3 ecrans differents : Patients.jsx,
-- Lits.jsx, Urgences.jsx). La colonne updated_at existait deja mais n'etait
-- jamais mise a jour automatiquement (aucun trigger) - corrige ici.

drop trigger if exists trg_hospitalisations_updated_at on public.hospitalisations;
create trigger trg_hospitalisations_updated_at
  before update on public.hospitalisations
  for each row execute function public.set_updated_at();
