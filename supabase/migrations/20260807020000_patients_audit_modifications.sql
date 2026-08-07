-- Point 2, mission "6 decisions produit" : nouvel ecran d'edition de patient
-- (Patients.jsx). Ces donnees sont sensibles (identite, allergies,
-- antecedents) -> tracabilite obligatoire de qui a modifie quoi et quand.
-- Meme convention deja etablie dans ce projet pour les journaux
-- sensibles/financiers (journal_caisse, ventes, paiements_facture,
-- transmissions_garde, cf. 20260804020000_journalisation_append_only.sql) :
-- table append-only, ecriture uniquement via trigger SECURITY DEFINER, aucune
-- policy RLS update/delete, jamais modifiable ni supprimable depuis le client.

create table if not exists public.patients_modifications_historique (
  id                uuid primary key default gen_random_uuid(),
  patient_id        uuid not null references public.patients(id) on delete cascade,
  etablissement_id  uuid,
  modifie_par       uuid references auth.users(id),
  modifie_par_email text,
  champs_modifies   jsonb not null,
  created_at        timestamptz not null default now()
);

create index if not exists idx_patients_modifications_historique_patient
  on public.patients_modifications_historique(patient_id, created_at desc);

alter table public.patients_modifications_historique enable row level security;

drop policy if exists "select_own_etablissement" on public.patients_modifications_historique;
create policy "select_own_etablissement" on public.patients_modifications_historique
  for select using (etablissement_id = any (array(select mes_etablissements())));

-- Volontairement aucune policy insert/update/delete pour "authenticated" :
-- seul le trigger SECURITY DEFINER ci-dessous (execute avec les privileges du
-- proprietaire de la fonction) peut ecrire dans cette table.

create or replace function public.log_patient_modification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  diff jsonb;
begin
  select jsonb_object_agg(o.key, jsonb_build_object('avant', o.value, 'apres', n.value))
  into diff
  from jsonb_each_text(to_jsonb(old)) o
  join jsonb_each_text(to_jsonb(new)) n using (key)
  where o.value is distinct from n.value
    and o.key = any (array[
      'prenom', 'nom', 'date_naissance', 'genre', 'telephone', 'email',
      'groupe_sanguin', 'antecedents', 'allergies', 'adresse',
      'medecin_referent', 'service', 'assurance', 'numero_assurance', 'mutuelle'
    ]);

  if diff is not null and diff <> '{}'::jsonb then
    insert into public.patients_modifications_historique
      (patient_id, etablissement_id, modifie_par, modifie_par_email, champs_modifies)
    values
      (new.id, new.etablissement_id, auth.uid(),
       (select email from auth.users where id = auth.uid()),
       diff);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_log_patient_modification on public.patients;
create trigger trg_log_patient_modification
  after update on public.patients
  for each row execute function public.log_patient_modification();
