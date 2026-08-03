-- Audit exhaustif hopital -- correctif faille clinique n2 (2026-08-03)
--
-- Perte silencieuse en cas de modification concurrente : feuilles_reveil et
-- partogrammes reecrivent le tableau complet des releves depuis l'etat local
-- du composant plutot qu'un append atomique cote serveur. Deux postes ouvrant
-- le meme dossier peuvent s'ecraser mutuellement un releve sans aucun
-- avertissement -- reproduit empiriquement lors de l'audit (deux sessions
-- concurrentes sur la meme feuille de reveil, un releve clinique reel perdu).
--
-- Ajoute updated_at + trigger d'auto-maj, utilise cote client pour detecter
-- un conflit (UPDATE conditionnel WHERE updated_at = <valeur chargee>) avant
-- d'ecrire -- si 0 ligne affectee, quelqu'un d'autre a modifie la ligne
-- entre-temps, et l'utilisateur est explicitement averti au lieu d'ecraser.

alter table public.feuilles_reveil add column if not exists updated_at timestamptz not null default now();
alter table public.partogrammes    add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_feuilles_reveil_updated_at on public.feuilles_reveil;
create trigger trg_feuilles_reveil_updated_at
  before update on public.feuilles_reveil
  for each row execute function public.set_updated_at();

drop trigger if exists trg_partogrammes_updated_at on public.partogrammes;
create trigger trg_partogrammes_updated_at
  before update on public.partogrammes
  for each row execute function public.set_updated_at();
