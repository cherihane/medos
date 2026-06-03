-- ============================================================
-- Migration : Features critiques module Hôpital
-- consultations, examens, configuration_lits
-- ============================================================

-- ── Consultations & File d'attente ────────────────────────────────────────────
create table if not exists public.consultations (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid references public.patients(id) on delete cascade,
  etablissement_id uuid,
  service          text not null,
  medecin_nom      text,
  motif            text,
  type             text default 'consultation'
                     check (type in ('consultation', 'urgence', 'rdv')),
  statut           text default 'en_attente'
                     check (statut in ('en_attente', 'en_cours', 'termine', 'annule')),
  triage           text check (triage in ('urgent', 'semi_urgent', 'non_urgent')),
  heure_arrivee    timestamptz default now(),
  heure_debut      timestamptz,
  heure_fin        timestamptz,
  notes            text,
  date_rdv         date,
  heure_rdv        time,
  created_at       timestamptz default now()
);

alter table public.consultations enable row level security;

create policy "consultations_all"
  on public.consultations for all
  using (
    etablissement_id in (select public.mes_etablissements())
    or etablissement_id is null
  )
  with check (
    etablissement_id in (select public.mes_etablissements())
    or etablissement_id is null
  );

create index if not exists idx_consultations_etab   on public.consultations(etablissement_id);
create index if not exists idx_consultations_patient on public.consultations(patient_id);
create index if not exists idx_consultations_statut  on public.consultations(statut);

-- ── Examens / Laboratoire ─────────────────────────────────────────────────────
create table if not exists public.examens (
  id                 uuid primary key default gen_random_uuid(),
  patient_id         uuid references public.patients(id) on delete cascade,
  etablissement_id   uuid,
  type_examen        text not null,
  libelle            text,
  prescripteur       text,
  statut             text default 'prescrit'
                       check (statut in ('prescrit', 'en_cours', 'resultat_disponible', 'annule')),
  urgence            boolean default false,
  date_prescription  timestamptz default now(),
  date_realisation   timestamptz,
  resultat_texte     text,
  interpretation     text check (interpretation in ('normal', 'anormal', 'critique')),
  notes              text,
  created_at         timestamptz default now()
);

alter table public.examens enable row level security;

create policy "examens_all"
  on public.examens for all
  using (
    etablissement_id in (select public.mes_etablissements())
    or etablissement_id is null
  )
  with check (
    etablissement_id in (select public.mes_etablissements())
    or etablissement_id is null
  );

create index if not exists idx_examens_patient on public.examens(patient_id);
create index if not exists idx_examens_statut  on public.examens(statut);

-- ── Configuration des lits ────────────────────────────────────────────────────
create table if not exists public.configuration_lits (
  id               uuid primary key default gen_random_uuid(),
  etablissement_id uuid,
  service          text not null,
  capacite_totale  integer not null default 10,
  updated_at       timestamptz default now(),
  unique(etablissement_id, service)
);

alter table public.configuration_lits enable row level security;

create policy "configuration_lits_all"
  on public.configuration_lits for all
  using (
    etablissement_id in (select public.mes_etablissements())
    or etablissement_id is null
  )
  with check (
    etablissement_id in (select public.mes_etablissements())
    or etablissement_id is null
  );

-- ── Colonne statut sur patients (si absente) ──────────────────────────────────
alter table public.patients add column if not exists statut text
  default 'ambulatoire'
  check (statut in ('hospitalise', 'ambulatoire', 'sorti'));
