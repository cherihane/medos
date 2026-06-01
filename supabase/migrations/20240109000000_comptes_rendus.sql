-- Colonne service sur patients
alter table public.patients
  add column if not exists service text default 'Médecine générale'
    check (service in (
      'Médecine générale','Maternité','Pédiatrie','Cardiologie',
      'Chirurgie','Urgences','Neurologie','Ophtalmologie'
    ));

-- Table comptes rendus médicaux
create table if not exists public.comptes_rendus (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid not null references public.patients(id) on delete cascade,
  etablissement_id uuid references public.etablissements(id),
  medecin          text not null,
  date_consultation date not null default current_date,
  motif            text,
  examen_clinique  text,
  diagnostic       text,
  traitement       text,
  prochain_rdv     date,
  created_at       timestamptz default now()
);

alter table public.comptes_rendus enable row level security;

create policy "comptes_rendus_select" on public.comptes_rendus
  for select using (true);

create policy "comptes_rendus_insert" on public.comptes_rendus
  for insert with check (auth.role() = 'authenticated');

create policy "comptes_rendus_update" on public.comptes_rendus
  for update using (auth.role() = 'authenticated');

create index if not exists idx_comptes_rendus_patient
  on public.comptes_rendus(patient_id, date_consultation desc);
