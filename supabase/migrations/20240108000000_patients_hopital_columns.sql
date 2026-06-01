-- Colonnes supplémentaires pour la fiche patient hôpital
alter table public.patients
  add column if not exists adresse          text,
  add column if not exists allergies        text[],
  add column if not exists medecin_referent text,
  add column if not exists numero_dossier   text,
  add column if not exists statut           text default 'ambulatoire'
    check (statut in ('hospitalise','ambulatoire')),
  add column if not exists derniere_visite  date;

-- Index pour la recherche par dossier
create unique index if not exists idx_patients_numero_dossier
  on public.patients(numero_dossier) where numero_dossier is not null;
