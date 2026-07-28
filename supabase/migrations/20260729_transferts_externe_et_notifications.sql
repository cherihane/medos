-- Transfert vers un établissement hors MedOS (nom/contact/email en texte
-- libre, même pattern que les fournisseurs externes en pharmacie) + journal
-- des notifications email envoyées sur le cycle MedOS-à-MedOS (proposé/
-- accepté/refusé), jusqu'ici absent (seul le temps réel était en place).

-- Un transfert MedOS-à-MedOS garde etablissement_destination_id obligatoire ;
-- un transfert externe n'a pas d'établissement MedOS destinataire (pas de
-- ligne dans `etablissements` à référencer) — la colonne devient nullable et
-- une contrainte CHECK garantit qu'un seul des deux chemins est rempli,
-- jamais les deux, jamais aucun.
ALTER TABLE transferts_patients ALTER COLUMN etablissement_destination_id DROP NOT NULL;

ALTER TABLE transferts_patients ADD COLUMN IF NOT EXISTS est_externe BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE transferts_patients ADD COLUMN IF NOT EXISTS destination_externe_nom TEXT;
ALTER TABLE transferts_patients ADD COLUMN IF NOT EXISTS destination_externe_contact TEXT;
ALTER TABLE transferts_patients ADD COLUMN IF NOT EXISTS destination_externe_email TEXT;

-- Journal des notifications email envoyées sur ce transfert (un événement par
-- entrée : { evenement: 'propose'|'accepte'|'refuse'|'fiche_externe',
-- destinataire, statut: 'envoye'|'echec', erreur, date }) — audit complet,
-- jamais de faux succès silencieux si un envoi échoue.
ALTER TABLE transferts_patients ADD COLUMN IF NOT EXISTS notifications_envoyees JSONB;

ALTER TABLE transferts_patients DROP CONSTRAINT IF EXISTS transferts_patients_destination_check;
ALTER TABLE transferts_patients ADD CONSTRAINT transferts_patients_destination_check
  CHECK (
    (est_externe = false AND etablissement_destination_id IS NOT NULL AND destination_externe_nom IS NULL)
    OR
    (est_externe = true  AND etablissement_destination_id IS NULL AND destination_externe_nom IS NOT NULL)
  );
