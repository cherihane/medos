-- ============================================================
-- Point 2 (session 13) : évite le "flash" de connexion pour un compte
-- en_attente — voir DEBUG_PROGRESS.md pour le diagnostic complet.
--
-- Login.jsx appelait toujours supabase.auth.signInWithPassword() D'ABORD,
-- ce qui crée une session active et déclenche onAuthStateChange (SIGNED_IN)
-- avant même que AuthContext.jsx ne vérifie statut_inscription et ne se
-- déconnecte (SIGNED_OUT) — le composant Login se démonte/remonte entre les
-- deux, effaçant le message d'erreur avant qu'il ne s'affiche.
--
-- Fix choisi : vérifier statut_inscription AVANT tout appel à
-- signInWithPassword(), directement dans Login.jsx, sans jamais créer de
-- session si le compte est en_attente. Un utilisateur anonyme (pas encore
-- connecté) ne peut pas lire etablissements (RLS réservée à authenticated)
-- — même schéma que email_etablissement_deja_utilise() et
-- rechercher_client_par_email() : une fonction SECURITY DEFINER n'exposant
-- que le strict nécessaire (ici, un seul mot : le statut), jamais les
-- données de l'établissement.
-- ============================================================

CREATE OR REPLACE FUNCTION public.statut_inscription_par_email(p_email text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT statut_inscription FROM public.etablissements
  WHERE lower(trim(email)) = lower(trim(p_email))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.statut_inscription_par_email(text) TO anon, authenticated;
