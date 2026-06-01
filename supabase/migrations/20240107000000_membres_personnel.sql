-- Table membres du personnel par établissement
create table if not exists public.membres_personnel (
  id                   uuid primary key default gen_random_uuid(),
  etablissement_id     uuid references public.etablissements(id) on delete cascade,
  email                text not null,
  role_interne         text not null,
  actif                boolean not null default true,
  invitation_acceptee  boolean not null default false,
  created_at           timestamptz not null default now(),
  unique (etablissement_id, email)
);

-- RLS
alter table public.membres_personnel enable row level security;

-- Les membres d'un établissement voient leur propre liste
create policy "membres_select" on public.membres_personnel
  for select using (
    etablissement_id in (
      select id from public.etablissements where email = auth.jwt() ->> 'email'
    )
  );

-- Seul le responsable (email de l'établissement) peut gérer le personnel
create policy "membres_insert" on public.membres_personnel
  for insert with check (
    etablissement_id in (
      select id from public.etablissements where email = auth.jwt() ->> 'email'
    )
  );

create policy "membres_update" on public.membres_personnel
  for update using (
    etablissement_id in (
      select id from public.etablissements where email = auth.jwt() ->> 'email'
    )
  );
