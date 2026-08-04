-- Mission securite Phase 3, point 8 : RLS lecture/insertion seule (jamais update/delete)
-- sur les tables de journalisation, sans exception meme pour Direction.
--
-- 4 tables designees "immuables" par le code applicatif lui-meme (commentaires explicites
-- dans useMutations.js/Caisse.jsx : "journal_caisse / ventes ... jamais modifiee",
-- "immuables, voir bandeau IMMUABLE") avaient pourtant des policies RLS UPDATE/DELETE
-- jamais utilisees par aucun appel du code (verifie : aucun .update()/.delete() sur ces
-- tables dans tout le frontend), scopees uniquement par etablissement_id sans jamais
-- exclure Direction/Gerant. Supprimees pour faire correspondre la contrainte reelle en
-- base a l'invariant deja affirme par l'application.

drop policy if exists caisse_update on public.journal_caisse;
drop policy if exists ventes_update on public.ventes;
drop policy if exists ventes_delete on public.ventes;
drop policy if exists paiements_facture_update on public.paiements_facture;
drop policy if exists transmissions_garde_update on public.transmissions_garde;
