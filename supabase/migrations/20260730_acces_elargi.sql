-- Rôles de secours + accès élargi en urgence — module hôpital.
--
-- Contexte : ce module gère l'élévation TEMPORAIRE de privilèges d'un membre
-- du personnel au-delà de son role_interne habituel. Enjeu de sécurité direct
-- (un accès mal accordé ou invisible est un risque), donc :
--   - Le rôle "Directeur" n'est JAMAIS une cible d'accès élargi (voir contrainte
--     CHECK plus bas) — l'élévation reste toujours un rôle opérationnel, jamais
--     une élévation vers l'administration complète de l'établissement.
--   - L'octroi automatique après délai est une DÉGRADATION acceptée du contrôle
--     humain (Direction n'a pas répondu), jamais un accès silencieux : il doit
--     toujours déclencher une revue obligatoire et rester visible en permanence
--     à l'écran pour la personne concernée (bandeau, voir composants React).
--   - L'octroi automatique après délai est déclenché par une vraie tâche
--     planifiée pg_cron, exécutée chaque minute côté serveur — voir
--     `executer_verification_acces_elargi()` dans la migration
--     20260731_acces_elargi_cron.sql. Il ne dépend d'aucun client connecté.

-- ── Rôles de secours pré-assignés par Direction ─────────────────────────────
ALTER TABLE membres_personnel ADD COLUMN IF NOT EXISTS roles_secours TEXT[];

-- ── Délai avant octroi automatique, réglable par établissement ──────────────
ALTER TABLE etablissements ADD COLUMN IF NOT EXISTS delai_acces_elargi_minutes INTEGER NOT NULL DEFAULT 15;

-- ── Demandes d'accès élargi ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS demandes_acces_elargi (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id    UUID NOT NULL REFERENCES etablissements(id),
  demandeur_email     TEXT NOT NULL,
  role_actuel         TEXT,
  role_demande        TEXT NOT NULL CHECK (role_demande <> 'Directeur'),
  motif               TEXT NOT NULL,

  statut              TEXT NOT NULL DEFAULT 'en_attente'
                        CHECK (statut IN ('en_attente','approuve','refuse','auto_accorde','expire')),
  decide_par          TEXT,
  decide_le           TIMESTAMPTZ,

  accorde_jusqu_a     TIMESTAMPTZ,

  -- Revue obligatoire : uniquement quand l'octroi est automatique (Direction
  -- n'a pas répondu à temps), jamais pour une approbation humaine explicite.
  revue_requise       BOOLEAN NOT NULL DEFAULT false,
  revue_faite         BOOLEAN NOT NULL DEFAULT false,
  revue_par           TEXT,
  revue_le            TIMESTAMPTZ,
  date_limite_revue   TIMESTAMPTZ,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demandes_acces_elargi_etablissement ON demandes_acces_elargi (etablissement_id);
CREATE INDEX IF NOT EXISTS idx_demandes_acces_elargi_demandeur     ON demandes_acces_elargi (demandeur_email);
CREATE INDEX IF NOT EXISTS idx_demandes_acces_elargi_statut        ON demandes_acces_elargi (statut);

ALTER TABLE demandes_acces_elargi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demandes_acces_elargi_select" ON demandes_acces_elargi FOR SELECT
  USING (etablissement_id = ANY(ARRAY(SELECT mes_etablissements())));
CREATE POLICY "demandes_acces_elargi_insert" ON demandes_acces_elargi FOR INSERT
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT mes_etablissements())));
-- UPDATE (approbation/refus/octroi auto/revue) : restreint côté application à
-- Direction ou au mécanisme d'octroi automatique — même approche que le reste
-- du module hôpital (pas de sous-rôle distingué au niveau RLS, cohérent avec
-- Sterilisation/BanqueSang/Fournisseurs où le contrôle par role_interne est
-- appliqué au niveau composant, pas au niveau base).
CREATE POLICY "demandes_acces_elargi_update" ON demandes_acces_elargi FOR UPDATE
  USING (etablissement_id = ANY(ARRAY(SELECT mes_etablissements())))
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT mes_etablissements())));

-- ── Journal d'accès élargi ───────────────────────────────────────────────────
-- Trace chaque accès à une page normalement hors du rôle habituel, effectué
-- grâce à un accès élargi actif — pour qu'une telle action ne soit JAMAIS
-- indiscernable d'un accès normal après coup. Immuable (pas d'update/delete).
CREATE TABLE IF NOT EXISTS journal_acces_elargi (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id  UUID NOT NULL REFERENCES etablissements(id),
  demande_id        UUID REFERENCES demandes_acces_elargi(id),
  utilisateur_email TEXT NOT NULL,
  page_accedee      TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journal_acces_elargi_etablissement ON journal_acces_elargi (etablissement_id);
CREATE INDEX IF NOT EXISTS idx_journal_acces_elargi_demande       ON journal_acces_elargi (demande_id);

ALTER TABLE journal_acces_elargi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "journal_acces_elargi_select" ON journal_acces_elargi FOR SELECT
  USING (etablissement_id = ANY(ARRAY(SELECT mes_etablissements())));
CREATE POLICY "journal_acces_elargi_insert" ON journal_acces_elargi FOR INSERT
  WITH CHECK (etablissement_id = ANY(ARRAY(SELECT mes_etablissements())));

-- ── Nouvelle catégorie d'alerte pour l'octroi automatique / l'abus potentiel ─
-- Le CHECK existant sur alertes.type est une liste fermée qui ne couvre pas
-- ce nouveau cas d'usage — on l'étend plutôt que de réutiliser à tort une
-- catégorie existante (qui ferait échouer silencieusement l'insertion, comme
-- observé ailleurs dans le code avec des valeurs de "type"/"statut" absentes
-- du schéma réel).
ALTER TABLE alertes DROP CONSTRAINT IF EXISTS alertes_type_check;
ALTER TABLE alertes ADD CONSTRAINT alertes_type_check
  CHECK (type = ANY (ARRAY['rupture','expiration','credit','commande','ordonnance','temperature','livraison','pharmacovigilance','contrefacon','acces_elargi']::text[]));
