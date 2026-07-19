-- medicaments et fournisseurs étaient conçus comme des catalogues partagés entre
-- TOUTES les pharmacies (RLS: is_membre_actif(), sans filtre par établissement),
-- mais le code applicatif (Inventaire.jsx, Fournisseurs.jsx) insère déjà
-- etablissement_id, colonne qui n'existait pas -> "Ajouter un médicament" et
-- "Ajouter un fournisseur" étaient cassés en production (PGRST204). Chaque
-- pharmacie doit avoir son propre inventaire et ses propres fournisseurs
-- (stocks, prix et contacts n'ont pas de sens partagés entre pharmacies
-- concurrentes). On aligne ces deux tables sur le modèle déjà utilisé par
-- patients/ventes/ordonnances (etablissement_id + mes_etablissements()).
-- Trouvé et corrigé lors du diagnostic du module Pharmacie (2026-07-19).

ALTER TABLE public.medicaments
  ADD COLUMN IF NOT EXISTS etablissement_id uuid REFERENCES public.etablissements(id),
  ADD COLUMN IF NOT EXISTS fabricant text,
  ADD COLUMN IF NOT EXISTS prix_achat numeric(12,2);

ALTER TABLE public.fournisseurs
  ADD COLUMN IF NOT EXISTS etablissement_id uuid REFERENCES public.etablissements(id),
  ADD COLUMN IF NOT EXISTS notes text;

DROP POLICY IF EXISTS "med_select" ON public.medicaments;
DROP POLICY IF EXISTS "med_insert" ON public.medicaments;
DROP POLICY IF EXISTS "med_update" ON public.medicaments;
DROP POLICY IF EXISTS "med_delete" ON public.medicaments;

CREATE POLICY "med_select" ON public.medicaments
  FOR SELECT USING (
    (etablissement_id = ANY (ARRAY(SELECT mes_etablissements()))) OR is_autorite_sanitaire()
  );

CREATE POLICY "med_insert" ON public.medicaments
  FOR INSERT WITH CHECK (
    (etablissement_id = ANY (ARRAY(SELECT mes_etablissements()))) AND (NOT is_autorite_sanitaire())
  );

CREATE POLICY "med_update" ON public.medicaments
  FOR UPDATE USING (
    (etablissement_id = ANY (ARRAY(SELECT mes_etablissements()))) AND (NOT is_autorite_sanitaire())
  ) WITH CHECK (
    (etablissement_id = ANY (ARRAY(SELECT mes_etablissements()))) AND (NOT is_autorite_sanitaire())
  );

CREATE POLICY "med_delete" ON public.medicaments
  FOR DELETE USING (
    (etablissement_id = ANY (ARRAY(SELECT mes_etablissements()))) AND (NOT is_autorite_sanitaire())
  );

DROP POLICY IF EXISTS "fourn_select" ON public.fournisseurs;
DROP POLICY IF EXISTS "fourn_insert" ON public.fournisseurs;
DROP POLICY IF EXISTS "fourn_update" ON public.fournisseurs;
DROP POLICY IF EXISTS "fourn_delete" ON public.fournisseurs;

CREATE POLICY "fourn_select" ON public.fournisseurs
  FOR SELECT USING (
    (etablissement_id = ANY (ARRAY(SELECT mes_etablissements()))) OR is_autorite_sanitaire()
  );

CREATE POLICY "fourn_insert" ON public.fournisseurs
  FOR INSERT WITH CHECK (
    (etablissement_id = ANY (ARRAY(SELECT mes_etablissements()))) AND (NOT is_autorite_sanitaire())
  );

CREATE POLICY "fourn_update" ON public.fournisseurs
  FOR UPDATE USING (
    (etablissement_id = ANY (ARRAY(SELECT mes_etablissements()))) AND (NOT is_autorite_sanitaire())
  ) WITH CHECK (
    (etablissement_id = ANY (ARRAY(SELECT mes_etablissements()))) AND (NOT is_autorite_sanitaire())
  );

CREATE POLICY "fourn_delete" ON public.fournisseurs
  FOR DELETE USING (
    (etablissement_id = ANY (ARRAY(SELECT mes_etablissements()))) AND (NOT is_autorite_sanitaire())
  );
