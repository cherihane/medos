/**
 * useMutations — Toutes les opérations d'écriture Supabase pour MedOS
 * Chaque fonction retourne { data } ou lance une Error avec message lisible
 */
import { supabase } from "../supabaseClient";

async function run(promise) {
  const { data, error } = await promise;
  if (error) throw new Error(error.message);
  return data;
}

// ─── Médicaments ──────────────────────────────────────────────────────────────
export async function updateMedicament(id, fields) {
  return run(supabase.from("medicaments").update(fields).eq("id", id).select().single());
}

export async function insertMedicament(fields) {
  return run(supabase.from("medicaments").insert(fields).select().single());
}

// ─── Stock (décrémentation après vente) ───────────────────────────────────────
export async function decrementStock(medicamentId, quantite) {
  const { data: med, error } = await supabase
    .from("medicaments").select("stock_actuel").eq("id", medicamentId).single();
  if (error) throw new Error(error.message);
  const newStock = Math.max(0, (med.stock_actuel ?? 0) - quantite);
  return run(supabase.from("medicaments").update({ stock_actuel: newStock }).eq("id", medicamentId));
}

// ─── Ventes ───────────────────────────────────────────────────────────────────
export async function insertVentes(rows) {
  return run(supabase.from("ventes").insert(rows).select());
}

// ─── Journal de caisse ────────────────────────────────────────────────────────
// Colonnes : id, etablissement_id, caissier_id, caissier_email,
//            montant_total, montant_recu, monnaie_rendue,
//            mode_paiement, nb_articles, detail (jsonb), created_at
export async function insertJournalCaisse(entry) {
  const payload = Object.fromEntries(
    Object.entries(entry).filter(([, v]) => v !== undefined && v !== null)
  );
  const { data, error } = await supabase
    .from("journal_caisse")
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(`journal_caisse: ${error.message}`);
  return data;
}

export async function fetchJournalJour(etablissement_id, dateISO) {
  const debut = `${dateISO}T00:00:00+00:00`;
  const fin   = `${dateISO}T23:59:59+00:00`;
  let q = supabase
    .from("journal_caisse")
    .select("id, etablissement_id, caissier_email, montant_total, montant_recu, monnaie_rendue, mode_paiement, nb_articles, detail, created_at")
    .gte("created_at", debut)
    .lte("created_at", fin)
    .order("created_at", { ascending: false });
  if (etablissement_id) q = q.eq("etablissement_id", etablissement_id);
  const { data, error } = await q;
  if (error) throw new Error(`journal_caisse select: ${error.message}`);
  return data ?? [];
}

// ─── Commandes ────────────────────────────────────────────────────────────────
export async function insertCommande(fields) {
  return run(supabase.from("commandes").insert(fields).select().single());
}

export async function updateCommande(id, fields) {
  return run(supabase.from("commandes").update(fields).eq("id", id).select().single());
}

// ─── Patients ─────────────────────────────────────────────────────────────────
export async function insertPatient(fields) {
  return run(supabase.from("patients").insert(fields).select().single());
}

export async function updatePatient(id, fields) {
  return run(supabase.from("patients").update(fields).eq("id", id).select().single());
}

// ─── Ordonnances ──────────────────────────────────────────────────────────────
export async function insertOrdonnance(fields) {
  return run(supabase.from("ordonnances").insert(fields).select().single());
}

export async function updateOrdonnance(id, fields) {
  return run(supabase.from("ordonnances").update(fields).eq("id", id).select().single());
}

// ─── Alertes ──────────────────────────────────────────────────────────────────
export async function updateAlerte(id, fields) {
  return run(supabase.from("alertes").update(fields).eq("id", id).select().single());
}

export async function insertAlerte(fields) {
  return run(supabase.from("alertes").insert(fields).select().single());
}

// ─── Livraisons ───────────────────────────────────────────────────────────────
export async function insertLivraison(fields) {
  return run(supabase.from("livraisons").insert(fields).select().single());
}

export async function updateLivraison(id, fields) {
  return run(supabase.from("livraisons").update(fields).eq("id", id).select().single());
}

// ─── Lots (entrepôt distributeur) ─────────────────────────────────────────────
export async function insertLot(fields) {
  return run(supabase.from("lots").insert(fields).select().single());
}

export async function incrementStock(medicamentId, quantite) {
  const { data: med, error } = await supabase
    .from("medicaments").select("stock_actuel").eq("id", medicamentId).single();
  if (error) throw new Error(error.message);
  const newStock = (med.stock_actuel ?? 0) + quantite;
  return run(supabase.from("medicaments").update({ stock_actuel: newStock }).eq("id", medicamentId));
}

// ─── Fournisseurs ─────────────────────────────────────────────────────────────
export async function insertFournisseur(fields) {
  return run(supabase.from("fournisseurs").insert(fields).select().single());
}

export async function updateFournisseur(id, fields) {
  return run(supabase.from("fournisseurs").update(fields).eq("id", id).select().single());
}
