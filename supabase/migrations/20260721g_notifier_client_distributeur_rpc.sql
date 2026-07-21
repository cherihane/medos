-- Après un long diagnostic (voir 20260721e/f) : une simple policy INSERT
-- permissive sur alertes, même réduite à WITH CHECK(true) sans aucune autre
-- condition ni aucune autre policy INSERT concurrente, continue de refuser
-- systématiquement l'écriture pour un etablissement_id qui n'est pas celui
-- du distributeur connecté — reproduit de façon identique via SQL direct
-- (SET ROLE authenticated) et via l'API REST réelle, alors que le SELECT
-- équivalent fonctionne. Cause exacte non identifiée malgré des tests
-- exhaustifs (grants, contraintes, policies restrictives, cache PostgREST
-- tous écartés). Plutôt que de continuer à démonter un comportement RLS
-- opaque, la voie robuste : ne plus faire écrire le CLIENT depuis le
-- navigateur du distributeur — passer par une fonction SECURITY DEFINER
-- qui vérifie explicitement l'autorisation puis écrit elle-même (contourne
-- RLS proprement, au lieu de dépendre d'une policy INSERT peu fiable ici).
CREATE OR REPLACE FUNCTION public.notifier_client_distributeur(
  p_etablissement_id uuid,
  p_type text,
  p_titre text,
  p_message text,
  p_severite text DEFAULT 'info'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.est_client_de_distributeur(p_etablissement_id) THEN
    RAISE EXCEPTION 'Cet établissement n''est pas un client de votre réseau.';
  END IF;

  INSERT INTO public.alertes (etablissement_id, type, titre, message, severite, resolu)
  VALUES (p_etablissement_id, p_type, p_titre, p_message, p_severite, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.notifier_client_distributeur(uuid, text, text, text, text) TO authenticated;
