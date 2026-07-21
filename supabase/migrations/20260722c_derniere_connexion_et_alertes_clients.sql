-- Point 2 (module Distributeur, session 10) : le widget "établissements actifs"
-- affichait un badge "actif" statique, jamais recalculé. Ajoute une colonne
-- de dernière connexion, mise à jour par un heartbeat applicatif (Layout.jsx),
-- pour dériver un vrai statut "actif dans les X dernières minutes".

ALTER TABLE public.etablissements ADD COLUMN IF NOT EXISTS derniere_connexion timestamptz;

CREATE OR REPLACE FUNCTION public.enregistrer_connexion()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.etablissements
  SET derniere_connexion = now()
  WHERE id = ANY (ARRAY(SELECT mes_etablissements()));
END;
$$;

GRANT EXECUTE ON FUNCTION public.enregistrer_connexion() TO authenticated;
