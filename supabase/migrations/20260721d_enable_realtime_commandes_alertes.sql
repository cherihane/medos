-- La publication supabase_realtime était totalement vide (aucune table) —
-- trouvé en testant le panneau "Commandes reçues (TEMPS RÉEL)" du Dashboard
-- distributeur : le statut passait bien de "confirmee" à "en_transit" en
-- base (updateCommande réussissait), mais l'UI restait figée sur l'ancien
-- statut indéfiniment, car l'abonnement postgres_changes ("UPDATE" sur
-- commandes) ne recevait jamais rien — la table n'était pas publiée.
-- Systémique : useAlertesRealtime souffre du même problème.
ALTER PUBLICATION supabase_realtime ADD TABLE public.commandes, public.alertes;
