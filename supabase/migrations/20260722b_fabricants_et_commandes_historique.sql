-- Point 4 (module Distributeur, session 9) : historique des commandes fabricant.
--
-- Un "fabricant" est une entité externe (jamais un établissement MedOS) —
-- simple fiche contact nom/email/téléphone appartenant au distributeur, sur
-- le même modèle que `fournisseurs` (mode "externe"). Les commandes passées
-- à un fabricant réutilisent la table `commandes`/`commande_lignes`
-- existante (déjà scopée par etablissement_id via mes_etablissements()) —
-- seule une colonne fabricant_id est ajoutée, en parallèle de fournisseur_id.

CREATE TABLE IF NOT EXISTS public.fabricants (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id  uuid NOT NULL REFERENCES public.etablissements(id),
  nom               text NOT NULL,
  email             text,
  telephone         text,
  notes             text,
  actif             boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fabricants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fab_select ON public.fabricants;
DROP POLICY IF EXISTS fab_insert ON public.fabricants;
DROP POLICY IF EXISTS fab_update ON public.fabricants;
DROP POLICY IF EXISTS fab_delete ON public.fabricants;

CREATE POLICY fab_select ON public.fabricants FOR SELECT
  USING (etablissement_id = ANY (ARRAY(SELECT mes_etablissements())));

CREATE POLICY fab_insert ON public.fabricants FOR INSERT
  WITH CHECK (etablissement_id = ANY (ARRAY(SELECT mes_etablissements())) AND NOT is_autorite_sanitaire());

CREATE POLICY fab_update ON public.fabricants FOR UPDATE
  USING (etablissement_id = ANY (ARRAY(SELECT mes_etablissements())) AND NOT is_autorite_sanitaire())
  WITH CHECK (etablissement_id = ANY (ARRAY(SELECT mes_etablissements())) AND NOT is_autorite_sanitaire());

CREATE POLICY fab_delete ON public.fabricants FOR DELETE
  USING (etablissement_id = ANY (ARRAY(SELECT mes_etablissements())) AND NOT is_autorite_sanitaire());

ALTER TABLE public.commandes ADD COLUMN IF NOT EXISTS fabricant_id uuid REFERENCES public.fabricants(id);
