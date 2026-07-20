-- La suppression complète d'une commande ne doit être possible que pour les
-- commandes en brouillon -- pour tout autre statut (envoyee, confirmee,
-- en_transit, livree, annulee), seule l'action "Annuler" (changement de
-- statut) doit rester disponible, pour garder une trace d'audit complète.
-- La policy cmd_delete existante ne vérifiait que l'établissement, pas le
-- statut : n'importe quelle commande pouvait être supprimée par un appel
-- direct à l'API, contournant la restriction si elle n'était appliquée que
-- côté frontend. Appliqué ici au niveau RLS pour une vraie garantie.
DROP POLICY IF EXISTS "cmd_delete" ON public.commandes;
CREATE POLICY "cmd_delete" ON public.commandes
  FOR DELETE USING (
    (etablissement_id = ANY (ARRAY(SELECT mes_etablissements())))
    AND (NOT is_autorite_sanitaire())
    AND (NOT is_distributeur())
    AND statut = 'brouillon'
  );
