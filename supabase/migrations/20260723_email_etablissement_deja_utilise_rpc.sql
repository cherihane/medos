-- ============================================================
-- Vérification d'unicité d'email à l'inscription (Inscription.jsx)
--
-- etablissements.email n'a aucune contrainte unique (voir schéma initial),
-- et l'ancienne page d'inscription ne vérifiait jamais si l'email saisi
-- correspondait déjà à un établissement existant avant de créer le compte
-- Supabase Auth + la ligne etablissements — un même email pouvait donc
-- s'inscrire deux fois avec des rôles différents (ex: pharmacie ET
-- distributeur), causant le bug de changement de rôle involontaire au
-- rafraîchissement documenté dans DEBUG_PROGRESS.md.
--
-- L'utilisateur anonyme (page d'inscription, pas encore authentifié) ne
-- peut pas lire la table etablissements (RLS "etab_select" réservée à
-- authenticated) — cette fonction SECURITY DEFINER expose donc uniquement
-- un booléen d'existence, jamais les données de l'établissement trouvé,
-- même schéma que rechercher_client_par_email() (session distributeur).
-- ============================================================

CREATE OR REPLACE FUNCTION public.email_etablissement_deja_utilise(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.etablissements
    WHERE lower(trim(email)) = lower(trim(p_email))
  );
$$;

GRANT EXECUTE ON FUNCTION public.email_etablissement_deja_utilise(text) TO anon, authenticated;
