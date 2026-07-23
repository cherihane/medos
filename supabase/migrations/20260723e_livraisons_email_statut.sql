-- Traçabilité honnête de l'envoi du bon de livraison par email (même pattern
-- que commandes.email_statut/email_erreur) — la livraison reste valide même
-- si l'email échoue (client manuel sans email, Resend en panne, etc.), mais
-- le statut réel est toujours tracé plutôt que supposé réussi.
ALTER TABLE public.livraisons
  ADD COLUMN IF NOT EXISTS email_statut text NOT NULL DEFAULT 'non_envoye',
  ADD COLUMN IF NOT EXISTS email_erreur text;
