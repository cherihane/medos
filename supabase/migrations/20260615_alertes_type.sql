-- Ajout colonnes type, produit, region sur la table alertes

ALTER TABLE public.alertes ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.alertes ADD COLUMN IF NOT EXISTS produit TEXT;
ALTER TABLE public.alertes ADD COLUMN IF NOT EXISTS region TEXT;

CREATE INDEX IF NOT EXISTS idx_alertes_type ON public.alertes(type);
