-- ============================================================
-- Clients manuels (hors MedOS) pour le module Distributeur
--
-- Un distributeur doit pouvoir inscrire TOUS ses clients réels, qu'ils
-- utilisent MedOS ou non — beaucoup de clients réels n'ont pas les outils
-- informatiques. Jusqu'ici distributeur_clients.client_etablissement_id
-- était NOT NULL avec une FK vers etablissements : impossible d'enregistrer
-- un client qui n'a pas de compte MedOS.
--
-- On rend client_etablissement_id nullable et on ajoute des colonnes
-- "snapshot" pour un client purement manuel (nom, adresse, ville, contact,
-- téléphone, email) — jamais mêlées à la fiche d'un vrai établissement.
-- ============================================================

ALTER TABLE public.distributeur_clients
  ALTER COLUMN client_etablissement_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS nom_manuel        text,
  ADD COLUMN IF NOT EXISTS adresse_manuel    text,
  ADD COLUMN IF NOT EXISTS ville_manuel      text,
  ADD COLUMN IF NOT EXISTS contact_manuel    text,
  ADD COLUMN IF NOT EXISTS telephone_manuel  text,
  ADD COLUMN IF NOT EXISTS email_manuel      text;

-- Une relation doit toujours avoir une identité : soit un vrai établissement
-- MedOS, soit au moins un nom saisi manuellement.
ALTER TABLE public.distributeur_clients
  DROP CONSTRAINT IF EXISTS distributeur_clients_identite_check;
ALTER TABLE public.distributeur_clients
  ADD CONSTRAINT distributeur_clients_identite_check
  CHECK (client_etablissement_id IS NOT NULL OR nom_manuel IS NOT NULL);

-- dc_insert existant (WITH CHECK distributeur_id = ANY(mes_etablissements())
-- AND source = 'manuel') couvre déjà l'insertion d'un client manuel sans
-- modification — un client manuel est nécessairement source='manuel'
-- puisqu'il ne peut jamais provenir automatiquement d'une commande (qui,
-- elle, référence toujours un etablissement_id réel).
