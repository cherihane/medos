-- Phase 2 (audit sécurité plateforme), point 5 — complétude des alertes/journaux cliniques.
--
-- Après avoir ajouté patient_id et corrigé statut→lu (migration précédente), les inserts
-- "alertes" du module Hôpital échouaient TOUJOURS : la contrainte alertes_type_check ne liste
-- que le vocabulaire historique pharmacie/distributeur ('rupture', 'expiration', 'credit',
-- 'commande', 'ordonnance', 'temperature', 'livraison', 'pharmacovigilance', 'contrefacon',
-- 'acces_elargi'), jamais mise à jour quand le code hôpital a introduit ses propres types
-- ('consultation', 'examen', 'soins', 'constante_critique', 'recommandation_ia', 'dispensation',
-- 'urgence'). Confirmé en base : AUCUNE alerte de ces 7 types n'existe jamais, malgré du code
-- appelant l'insert depuis 6 écrans différents depuis longtemps.
--
-- Ajoute aussi 3 types pour les alertes cliniques auto-générées (genererAlertesCliniques,
-- Alertes.jsx) qui n'envoyaient jusqu'ici AUCUNE valeur de type — violation NOT NULL, même
-- symptôme (échec silencieux, jamais créées) : 'constante_manquante', 'perfusion',
-- 'sortie_hospitalisation'.

alter table public.alertes drop constraint alertes_type_check;

alter table public.alertes add constraint alertes_type_check check (
  type = any (array[
    'rupture', 'expiration', 'credit', 'commande', 'ordonnance', 'temperature', 'livraison',
    'pharmacovigilance', 'contrefacon', 'acces_elargi',
    'consultation', 'examen', 'soins', 'constante_critique', 'recommandation_ia',
    'dispensation', 'urgence', 'constante_manquante', 'perfusion', 'sortie_hospitalisation'
  ])
);
