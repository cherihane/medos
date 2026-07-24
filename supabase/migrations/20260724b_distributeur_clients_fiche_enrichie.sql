-- Point 8 (session 11) : fiches clients trop pauvres — enrichit
-- distributeur_clients avec des champs concrets par relation (contact,
-- horaires, licence/agrément, notes internes, type précis), applicables aux
-- clients MedOS ET manuels. `contact_manuel` existant reste pour les fiches
-- manuelles créées avant ce correctif ; le nouveau `contact_nom` est
-- générique et prioritaire à l'affichage quand renseigné.
ALTER TABLE public.distributeur_clients
  ADD COLUMN IF NOT EXISTS contact_nom text,
  ADD COLUMN IF NOT EXISTS horaires_ouverture text,
  ADD COLUMN IF NOT EXISTS numero_licence text,
  ADD COLUMN IF NOT EXISTS notes_internes text,
  ADD COLUMN IF NOT EXISTS type_etablissement_precis text;

-- Aucune policy UPDATE n'existait sur cette table (relation posée une fois,
-- jamais réassignée) — nécessaire maintenant pour éditer ces annotations,
-- scopée au distributeur propriétaire de la relation comme partout ailleurs.
DROP POLICY IF EXISTS "dc_update" ON public.distributeur_clients;
CREATE POLICY "dc_update" ON public.distributeur_clients FOR UPDATE
  USING (distributeur_id = ANY (ARRAY(SELECT public.mes_etablissements())))
  WITH CHECK (distributeur_id = ANY (ARRAY(SELECT public.mes_etablissements())));
