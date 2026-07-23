-- Suivi de paiement simple par commande (payé / en attente / en retard) —
-- même logique que Credits.jsx en pharmacie (suivi manuel, pas de moteur de
-- facturation), adapté au contexte distributeur-client : c'est le
-- distributeur qui reçoit le paiement de ses clients pour les commandes
-- qu'ils lui passent (distributeur_id = lui-même), pas l'inverse. Les
-- livraisons n'ont pas de montant propre (voir livraisons.montant — colonne
-- inexistante), donc pas de statut de paiement dessus : la commande associée
-- porte déjà le montant réel.
ALTER TABLE public.commandes
  ADD COLUMN IF NOT EXISTS statut_paiement text NOT NULL DEFAULT 'en_attente';

ALTER TABLE public.commandes DROP CONSTRAINT IF EXISTS commandes_statut_paiement_check;
ALTER TABLE public.commandes ADD CONSTRAINT commandes_statut_paiement_check
  CHECK (statut_paiement = ANY (ARRAY['en_attente', 'paye', 'en_retard']));
