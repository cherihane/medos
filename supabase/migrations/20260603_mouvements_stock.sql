-- Migration MedOS — Table mouvements_stock
-- Historique complet des entrées et sorties de stock médicaments

create table if not exists public.mouvements_stock (
  id               uuid primary key default gen_random_uuid(),
  etablissement_id uuid references public.etablissements(id) on delete set null,
  medicament_id    uuid references public.medicaments(id)    on delete set null,
  type             text not null check (type in ('entree', 'sortie')),
  quantite         integer not null check (quantite > 0),
  motif            text,
  numero_bl        text,
  fournisseur      text,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now()
);

-- Index pour filtres courants
create index if not exists mouvements_stock_etablissement_idx on public.mouvements_stock(etablissement_id);
create index if not exists mouvements_stock_medicament_idx    on public.mouvements_stock(medicament_id);
create index if not exists mouvements_stock_created_at_idx    on public.mouvements_stock(created_at desc);
create index if not exists mouvements_stock_type_idx          on public.mouvements_stock(type);

-- RLS
alter table public.mouvements_stock enable row level security;

create policy "mouvements_stock_select" on public.mouvements_stock
  for select using (auth.uid() is not null);

create policy "mouvements_stock_insert" on public.mouvements_stock
  for insert with check (auth.uid() is not null);

-- Table fond_caisse — fond de départ par journée et établissement
create table if not exists public.fond_caisse (
  id               uuid primary key default gen_random_uuid(),
  etablissement_id uuid references public.etablissements(id) on delete cascade,
  caissier_id      uuid references auth.users(id) on delete set null,
  caissier_email   text,
  montant          numeric(14,0) not null default 0,
  date_journee     date not null,
  created_at       timestamptz not null default now(),
  unique (etablissement_id, date_journee)
);

alter table public.fond_caisse enable row level security;

create policy "fond_caisse_select" on public.fond_caisse
  for select using (auth.uid() is not null);

create policy "fond_caisse_insert" on public.fond_caisse
  for insert with check (auth.uid() is not null);
