-- Audit exhaustif hôpital — parcours patient bout en bout (Urgences)
--
-- ModalOrientation.handleSave (src/pages/hopital/Urgences.jsx) met à jour
-- consultations avec un champ "orientation" qui n'a jamais existé en base
-- (jamais créé par aucune migration). Conséquence réelle, testée en direct :
-- CHAQUE clic sur "Orienter" (hospitaliser / retour à domicile / transfert /
-- décès) échoue silencieusement après avoir déjà créé/mis à jour
-- l'hospitalisation dans le cas "hospitaliser" — la consultation reste
-- bloquée en statut "en_cours" pour toujours, le patient n'apparaît jamais
-- dans "Orientés / Sortis", et le tableau des urgences se remplit
-- indéfiniment de patients qui ont pourtant déjà quitté le service dans les
-- faits.

alter table public.consultations add column if not exists orientation text;
