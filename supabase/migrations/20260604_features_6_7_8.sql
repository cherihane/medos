-- ============================================================
-- Migration : Features 6, 7, 8 — Tarifs, Notes evolution
-- ============================================================

-- ── Tarifs des actes ──────────────────────────────────────────────────────────
create table if not exists public.tarifs_actes (
  id               uuid primary key default gen_random_uuid(),
  etablissement_id uuid,
  libelle          text not null,
  categorie        text check (categorie in ('consultation','examen','medicament','chirurgie','soins','autre')),
  prix_defaut      integer not null default 0,
  actif            boolean default true,
  created_at       timestamptz default now()
);

alter table public.tarifs_actes enable row level security;
create policy "tarifs_actes_all" on public.tarifs_actes for all
  using (etablissement_id in (select public.mes_etablissements()) or etablissement_id is null)
  with check (etablissement_id in (select public.mes_etablissements()) or etablissement_id is null);

-- ── Notes d'evolution ─────────────────────────────────────────────────────────
create table if not exists public.notes_evolution (
  id                  uuid primary key default gen_random_uuid(),
  patient_id          uuid references public.patients(id) on delete cascade,
  hospitalisation_id  uuid references public.hospitalisations(id) on delete cascade,
  etablissement_id    uuid,
  auteur              text not null,
  contenu             text not null,
  type                text default 'evolution'
                        check (type in ('evolution','observation','transmission','sortie')),
  created_at          timestamptz default now()
);

alter table public.notes_evolution enable row level security;
create policy "notes_evolution_all" on public.notes_evolution for all
  using (etablissement_id in (select public.mes_etablissements()) or etablissement_id is null)
  with check (etablissement_id in (select public.mes_etablissements()) or etablissement_id is null);

create index if not exists idx_notes_patient on public.notes_evolution(patient_id);
create index if not exists idx_notes_hospi   on public.notes_evolution(hospitalisation_id);
create index if not exists idx_tarifs_etab   on public.tarifs_actes(etablissement_id);
