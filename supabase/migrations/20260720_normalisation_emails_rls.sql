-- Normalise la comparaison d'emails utilisée par mes_etablissements() (base de
-- toute l'isolation RLS par établissement) et les colonnes email de
-- etablissements/membres_personnel. Sans ça, un email stocké avec une casse ou
-- des espaces différents de auth.jwt()->>'email' (ex: "Pharmacie@X.com" vs
-- "pharmacie@x.com") ferait perdre silencieusement l'accès à un établissement
-- entier -- pas d'erreur, juste 0 ligne visible partout.
-- Vérifié avant application : aucune ligne existante n'est actuellement
-- affectée (email = LOWER(TRIM(email)) déjà vrai pour toutes les lignes de
-- etablissements, membres_personnel et auth.users) -- ce correctif est
-- préventif pour les données futures.

-- 1. mes_etablissements() compare désormais LOWER(TRIM(...)) des deux côtés.
CREATE OR REPLACE FUNCTION public.mes_etablissements()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  -- Propriétaire de l'établissement
  SELECT e.id
  FROM public.etablissements e
  JOIN auth.users u ON LOWER(TRIM(u.email)) = LOWER(TRIM(e.email))
  WHERE u.id = auth.uid()
  UNION
  -- Membre actif de l'établissement
  SELECT m.etablissement_id
  FROM public.membres_personnel m
  JOIN auth.users u ON LOWER(TRIM(u.email)) = LOWER(TRIM(m.email))
  WHERE u.id = auth.uid() AND m.actif = true AND m.etablissement_id IS NOT NULL;
$function$;

-- 2. Trigger : normalise automatiquement la colonne email à chaque
--    insert/update, pour que les données stockées restent toujours propres
--    (défense en profondeur, en plus de la normalisation dans la comparaison
--    ci-dessus).
CREATE OR REPLACE FUNCTION public.normalize_email()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email := LOWER(TRIM(NEW.email));
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_normalize_email ON public.etablissements;
CREATE TRIGGER trg_normalize_email
  BEFORE INSERT OR UPDATE OF email ON public.etablissements
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_email();

DROP TRIGGER IF EXISTS trg_normalize_email ON public.membres_personnel;
CREATE TRIGGER trg_normalize_email
  BEFORE INSERT OR UPDATE OF email ON public.membres_personnel
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_email();

-- 3. Backfill ponctuel des lignes existantes (no-op actuellement, vérifié
--    ci-dessus, mais exécuté pour rester correct si ce script est rejoué sur
--    un autre environnement).
UPDATE public.etablissements
  SET email = LOWER(TRIM(email))
  WHERE email IS NOT NULL AND email <> LOWER(TRIM(email));

UPDATE public.membres_personnel
  SET email = LOWER(TRIM(email))
  WHERE email IS NOT NULL AND email <> LOWER(TRIM(email));
