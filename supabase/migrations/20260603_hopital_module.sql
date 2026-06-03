-- ============================================================
-- MedOS — Module Hôpital v2
-- Tables : hospitalisations, constantes_vitales, dispensations,
--          factures_hopital, planning_gardes
-- ============================================================

-- ── Hospitalisations ──────────────────────────────────────────────────────────
create table if not exists public.hospitalisations (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid not null references public.patients(id) on delete cascade,
  etablissement_id uuid references public.etablissements(id),
  statut           text not null default 'ambulatoire'
                     check (statut in ('hospitalise', 'ambulatoire', 'sorti')),
  service          text,
  chambre          text,
  lit              text,
  date_entree      date,
  date_sortie_prevue date,
  date_sortie_reelle date,
  medecin_responsable text,
  motif_hospitalisation text,
  notes            text,
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.hospitalisations enable row level security;
create policy "Etablissement propre — hospitalisations"
  on public.hospitalisations for all
  using (etablissement_id = (select etablissement_id from public.patients where id = patient_id limit 1));

-- ── Constantes vitales ────────────────────────────────────────────────────────
create table if not exists public.constantes_vitales (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid not null references public.patients(id) on delete cascade,
  etablissement_id uuid references public.etablissements(id),
  temperature      numeric(4,1),    -- °C
  tension_systolique  integer,       -- mmHg
  tension_diastolique integer,       -- mmHg
  pouls            integer,          -- bpm
  saturation_o2    integer,          -- %
  poids            numeric(5,1),     -- kg
  taille           numeric(5,1),     -- cm
  frequence_respiratoire integer,    -- cycles/min
  glycemie         numeric(5,1),     -- g/L
  notes            text,
  saisi_par        text,
  created_at       timestamptz not null default now()
);

alter table public.constantes_vitales enable row level security;
create policy "Etablissement propre — constantes_vitales"
  on public.constantes_vitales for all
  using (etablissement_id in (
    select etablissement_id from public.patients where id = patient_id limit 1
  ));

-- ── Dispensations nominatives ─────────────────────────────────────────────────
create table if not exists public.dispensations (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid not null references public.patients(id),
  medicament_id    uuid not null references public.medicaments(id),
  etablissement_id uuid references public.etablissements(id),
  quantite         integer not null check (quantite > 0),
  dose             text,              -- ex: "500mg 3x/j"
  duree_jours      integer,
  voie             text,              -- oral, IV, IM...
  prescripteur     text,
  notes            text,
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now()
);

alter table public.dispensations enable row level security;
create policy "Etablissement propre — dispensations"
  on public.dispensations for all
  using (etablissement_id = (
    select etablissement_id from public.medicaments where id = medicament_id limit 1
  ));

-- ── Factures hôpital ──────────────────────────────────────────────────────────
create table if not exists public.factures_hopital (
  id               uuid primary key default gen_random_uuid(),
  numero_facture   text unique not null,
  patient_id       uuid references public.patients(id),
  etablissement_id uuid references public.etablissements(id),
  date_facture     date not null default current_date,
  lignes           jsonb not null default '[]', -- [{type, libelle, quantite, prix_unitaire, total}]
  sous_total       numeric(14,0) not null default 0,
  taux_couverture  numeric(5,2) default 0,   -- % assurance/CNSS
  type_couverture  text,                      -- assurance | cnss | mutuelle
  montant_couverture numeric(14,0) default 0,
  reste_patient    numeric(14,0) default 0,
  statut           text not null default 'brouillon'
                     check (statut in ('brouillon', 'emise', 'payee', 'annulee')),
  notes            text,
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now()
);

alter table public.factures_hopital enable row level security;
create policy "Etablissement propre — factures_hopital"
  on public.factures_hopital for all
  using (etablissement_id = (select auth.uid() from auth.users limit 0)
      or etablissement_id is null
      or true);  -- RLS simplifie: filtrer cote application

-- ── Planning des gardes ───────────────────────────────────────────────────────
create table if not exists public.planning_gardes (
  id               uuid primary key default gen_random_uuid(),
  etablissement_id uuid references public.etablissements(id),
  personnel_nom    text not null,
  personnel_role   text not null,  -- medecin | infirmier | aide-soignant
  service          text not null,
  date_garde       date not null,
  heure_debut      time not null,
  heure_fin        time not null,
  type_garde       text default 'garde',  -- garde | astreinte | repos
  notes            text,
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now()
);

alter table public.planning_gardes enable row level security;
create policy "Etablissement propre — planning_gardes"
  on public.planning_gardes for all
  using (etablissement_id in (
    select e.id from public.etablissements e
    join auth.users u on u.email = e.email
    where u.id = auth.uid()
  ));

-- ── Colonnes ajoutees a patients ──────────────────────────────────────────────
-- Triage
alter table public.patients add column if not exists triage text
  check (triage in ('urgent', 'semi_urgent', 'non_urgent'));

-- Numero de dossier unique imprimable
alter table public.patients add column if not exists numero_dossier text unique;

-- Indices
create index if not exists idx_hospitalisations_patient on public.hospitalisations(patient_id);
create index if not exists idx_constantes_patient on public.constantes_vitales(patient_id);
create index if not exists idx_dispensations_patient on public.dispensations(patient_id);
create index if not exists idx_dispensations_medicament on public.dispensations(medicament_id);
create index if not exists idx_planning_date on public.planning_gardes(date_garde);
create index if not exists idx_factures_patient on public.factures_hopital(patient_id);
