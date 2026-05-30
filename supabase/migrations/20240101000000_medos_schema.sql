-- ============================================================
-- MedOS — Schéma complet des 10 tables
-- À exécuter dans Supabase > SQL Editor
-- ============================================================

-- 1. etablissements (structures de santé)
create table if not exists public.etablissements (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null,
  type        text not null check (type in ('pharmacie','hopital','distributeur','autorite')),
  ville       text,
  pays        text default 'Côte d''Ivoire',
  adresse     text,
  telephone   text,
  email       text,
  actif       boolean default true,
  created_at  timestamptz default now()
);

-- 2. medicaments
create table if not exists public.medicaments (
  id              uuid primary key default gen_random_uuid(),
  code            text unique,
  nom             text not null,
  dci             text,
  categorie       text,
  forme           text,
  dosage          text,
  prix_unitaire   numeric(12,2),
  unite           text default 'boîte',
  prescription_requise boolean default false,
  stock_actuel    int default 0,
  stock_minimum   int default 0,
  created_at      timestamptz default now()
);

-- 3. lots (traçabilité des lots de médicaments)
create table if not exists public.lots (
  id              uuid primary key default gen_random_uuid(),
  medicament_id   uuid references public.medicaments(id) on delete cascade,
  numero_lot      text not null,
  fabricant       text,
  date_fabrication date,
  date_expiration  date,
  quantite_initiale int default 0,
  qr_code         text,
  created_at      timestamptz default now()
);

-- 4. fournisseurs
create table if not exists public.fournisseurs (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null,
  pays        text,
  contact_nom text,
  email       text,
  telephone   text,
  delai_livraison text,
  conditions_paiement text,
  actif       boolean default true,
  created_at  timestamptz default now()
);

-- 5. patients
create table if not exists public.patients (
  id              uuid primary key default gen_random_uuid(),
  etablissement_id uuid references public.etablissements(id),
  prenom          text not null,
  nom             text not null,
  date_naissance  date,
  genre           text check (genre in ('M','F','Autre')),
  telephone       text,
  email           text,
  groupe_sanguin  text,
  antecedents     text[],
  created_at      timestamptz default now()
);

-- 6. ordonnances
create table if not exists public.ordonnances (
  id              uuid primary key default gen_random_uuid(),
  reference       text unique default ('ORD-' || to_char(now(),'YYYY') || '-' || floor(random()*90000+10000)::text),
  patient_id      uuid references public.patients(id),
  etablissement_id uuid references public.etablissements(id),
  medecin_nom     text,
  date_emission   date default current_date,
  date_expiration date,
  statut          text default 'en_attente' check (statut in ('en_attente','validee','traitee','refusee','expiree')),
  notes           text,
  created_at      timestamptz default now()
);

-- 7. ventes (lignes de caisse)
create table if not exists public.ventes (
  id              uuid primary key default gen_random_uuid(),
  etablissement_id uuid references public.etablissements(id),
  ordonnance_id   uuid references public.ordonnances(id),
  patient_id      uuid references public.patients(id),
  medicament_id   uuid references public.medicaments(id),
  lot_id          uuid references public.lots(id),
  quantite        int not null,
  prix_unitaire   numeric(12,2),
  montant_total   numeric(12,2),
  mode_paiement   text check (mode_paiement in ('especes','carte','mobile_money','credit','assurance')),
  vendu_par       uuid references auth.users(id),
  created_at      timestamptz default now()
);

-- 8. commandes (entre établissements et fournisseurs)
create table if not exists public.commandes (
  id              uuid primary key default gen_random_uuid(),
  reference       text unique default ('CMD-' || to_char(now(),'YYYY') || '-' || floor(random()*90000+10000)::text),
  etablissement_id uuid references public.etablissements(id),
  fournisseur_id  uuid references public.fournisseurs(id),
  statut          text default 'brouillon' check (statut in ('brouillon','envoyee','confirmee','en_transit','livree','annulee')),
  date_commande   timestamptz default now(),
  date_livraison_prevue date,
  montant_total   numeric(14,2),
  notes           text,
  created_at      timestamptz default now()
);

-- 9. livraisons
create table if not exists public.livraisons (
  id              uuid primary key default gen_random_uuid(),
  commande_id     uuid references public.commandes(id),
  fournisseur_id  uuid references public.fournisseurs(id),
  etablissement_id uuid references public.etablissements(id),
  statut          text default 'planifiee' check (statut in ('planifiee','en_transit','livree','incident')),
  date_depart     timestamptz,
  date_arrivee_prevue timestamptz,
  date_arrivee_reelle timestamptz,
  transporteur    text,
  numero_suivi    text,
  temperature_min numeric(4,1),
  temperature_max numeric(4,1),
  created_at      timestamptz default now()
);

-- 10. alertes
create table if not exists public.alertes (
  id              uuid primary key default gen_random_uuid(),
  etablissement_id uuid references public.etablissements(id),
  type            text not null check (type in ('rupture','expiration','credit','commande','ordonnance','temperature','livraison','pharmacovigilance','contrefacon')),
  severite        text default 'info' check (severite in ('info','alerte','critique')),
  titre           text not null,
  message         text,
  medicament_id   uuid references public.medicaments(id),
  lu              boolean default false,
  resolu          boolean default false,
  created_at      timestamptz default now()
);

-- ============================================================
-- RLS : activer la sécurité ligne par ligne
-- ============================================================
alter table public.etablissements  enable row level security;
alter table public.medicaments     enable row level security;
alter table public.lots            enable row level security;
alter table public.fournisseurs    enable row level security;
alter table public.patients        enable row level security;
alter table public.ordonnances     enable row level security;
alter table public.ventes          enable row level security;
alter table public.commandes       enable row level security;
alter table public.livraisons      enable row level security;
alter table public.alertes         enable row level security;

-- Politiques permissives pour les utilisateurs authentifiés (à affiner par rôle)
do $$
declare
  t text;
begin
  foreach t in array array[
    'etablissements','medicaments','lots','fournisseurs',
    'patients','ordonnances','ventes','commandes','livraisons','alertes'
  ] loop
    execute format(
      'drop policy if exists "auth_users_all_%s" on public.%s', t, t
    );
    execute format(
      'create policy "auth_users_all_%s" on public.%s
       for all to authenticated using (true) with check (true)',
      t, t
    );
  end loop;
end
$$;

-- ============================================================
-- Index utiles
-- ============================================================
create index if not exists idx_medicaments_nom      on public.medicaments(nom);
create index if not exists idx_lots_numero          on public.lots(numero_lot);
create index if not exists idx_patients_nom         on public.patients(nom, prenom);
create index if not exists idx_ventes_date          on public.ventes(created_at);
create index if not exists idx_alertes_non_lues     on public.alertes(lu) where lu = false;
create index if not exists idx_commandes_statut     on public.commandes(statut);
create index if not exists idx_livraisons_statut    on public.livraisons(statut);

select 'Schema MedOS créé avec succès — 10 tables.' as resultat;
