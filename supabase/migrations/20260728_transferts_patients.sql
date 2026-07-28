-- Transfert de patient entre établissements hospitaliers (référé d'un hôpital
-- vers un autre — pas la redistribution de stock, voir transferts_stock déjà
-- existant et non modifié ici).
--
-- Le dossier patient complet reste scopé à un seul établissement (patients.
-- etablissement_id) : plutôt que d'ouvrir une RLS cross-établissement risquée
-- sur `patients`/`comptes_rendus`, le contexte clinique nécessaire à la prise
-- en charge (antécédents, allergies, groupe sanguin, dernier compte rendu) est
-- capturé en clair sur la ligne de transfert au moment de la demande —
-- l'établissement destination ne voit jamais que ce qui a été explicitement
-- transmis, jamais le dossier complet.

CREATE TABLE IF NOT EXISTS transferts_patients (
  id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Patient côté origine (traçabilité) — pas de FK exploitable côté
  -- destination puisque RLS patients reste scopée à mes_etablissements().
  patient_id                     UUID REFERENCES patients(id),
  patient_nom                    TEXT NOT NULL,
  patient_prenom                 TEXT NOT NULL,
  patient_date_naissance         DATE,
  patient_genre                  TEXT,

  etablissement_origine_id       UUID NOT NULL REFERENCES etablissements(id),
  etablissement_origine_nom      TEXT,
  etablissement_destination_id   UUID NOT NULL REFERENCES etablissements(id),
  etablissement_destination_nom  TEXT,

  medecin_demandeur               TEXT,
  motif                            TEXT NOT NULL,
  urgence                          TEXT NOT NULL DEFAULT 'normale', -- 'normale' | 'urgente'
  statut                           TEXT NOT NULL DEFAULT 'propose', -- 'propose'|'accepte'|'refuse'|'en_cours'|'termine'|'annule'
  notes_cliniques                  TEXT,

  -- Snapshot du contexte clinique nécessaire à la décision + à la prise en
  -- charge, capturé une fois à la création (pas de dérive si le dossier
  -- d'origine change ensuite — cohérent avec l'état du patient au moment du
  -- transfert) :
  -- { antecedents: [...], allergies: [...], groupe_sanguin: "...",
  --   dernier_compte_rendu: { date_consultation, motif, diagnostic, traitement } }
  contexte_clinique                JSONB,

  -- Rempli une fois le patient admis côté destination (nouvelle ligne
  -- `patients` créée en continuité, pas de ressaisie).
  patient_id_destination           UUID REFERENCES patients(id),

  date_demande                     TIMESTAMPTZ NOT NULL DEFAULT now(),
  date_reponse                     TIMESTAMPTZ,
  created_at                       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transferts_patients_origine      ON transferts_patients (etablissement_origine_id);
CREATE INDEX IF NOT EXISTS idx_transferts_patients_destination  ON transferts_patients (etablissement_destination_id);
CREATE INDEX IF NOT EXISTS idx_transferts_patients_patient      ON transferts_patients (patient_id);

ALTER TABLE transferts_patients ENABLE ROW LEVEL SECURITY;

-- Accès volontaire à DEUX établissements précis (origine ET destination) —
-- pas un accès large : chaque ligne ne s'ouvre qu'aux deux parties qu'elle
-- nomme explicitement, contrairement aux fuites etablissement_id déjà
-- corrigées ailleurs dans l'app.
CREATE POLICY "transferts_patients_select" ON transferts_patients
  FOR SELECT
  USING (
    etablissement_origine_id      = ANY(ARRAY(SELECT mes_etablissements()))
    OR etablissement_destination_id = ANY(ARRAY(SELECT mes_etablissements()))
  );

-- Seule l'origine peut initier un transfert (elle doit être son propre
-- établissement).
CREATE POLICY "transferts_patients_insert" ON transferts_patients
  FOR INSERT
  WITH CHECK (etablissement_origine_id = ANY(ARRAY(SELECT mes_etablissements())));

-- Origine (annuler) ET destination (accepter/refuser/admettre/clôturer)
-- peuvent modifier le statut du transfert qui les concerne.
CREATE POLICY "transferts_patients_update" ON transferts_patients
  FOR UPDATE
  USING (
    etablissement_origine_id      = ANY(ARRAY(SELECT mes_etablissements()))
    OR etablissement_destination_id = ANY(ARRAY(SELECT mes_etablissements()))
  )
  WITH CHECK (
    etablissement_origine_id      = ANY(ARRAY(SELECT mes_etablissements()))
    OR etablissement_destination_id = ANY(ARRAY(SELECT mes_etablissements()))
  );

-- Recherche de l'établissement destination : un hôpital doit pouvoir trouver
-- les AUTRES hôpitaux réels inscrits sur MedOS pour proposer un transfert.
-- Sans cette policy, etab_select (mes_etablissements() uniquement) empêche
-- toute recherche cross-hôpital — même précédent que
-- etab_select_distributeurs_publics (visibilité publique restreinte au type
-- concerné, hôpitaux actifs et validés uniquement).
CREATE POLICY "etab_select_hopitaux_publics" ON public.etablissements
  FOR SELECT
  USING (type = 'hopital' AND actif = true AND statut_inscription = 'validee');

-- Temps réel : les deux établissements voient l'évolution du statut sans
-- recharger (même mécanisme que les alertes stock partagées avec un
-- distributeur, voir 20260721d_enable_realtime_commandes_alertes.sql).
ALTER PUBLICATION supabase_realtime ADD TABLE public.transferts_patients;
