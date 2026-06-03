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

// ─── Clôtures de caisse ───────────────────────────────────────────────────────
export async function insertClotureCaisse(fields) {
  return run(supabase.from("clotures_caisse").insert(fields).select().single());
}

// Renvoie la clôture du jour si elle existe, null sinon
export async function fetchClotureCaisse(etablissement_id, dateISO) {
  let q = supabase
    .from("clotures_caisse")
    .select("id, date_journee, total_encaisse, nb_transactions, gerant_email, created_at")
    .eq("date_journee", dateISO);
  if (etablissement_id) q = q.eq("etablissement_id", etablissement_id);
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(`clotures_caisse: ${error.message}`);
  return data ?? null;
}

// ─── Réception livraison → incrément stock destinataire (SECURITY DEFINER) ───
// Le distributeur ne peut pas écrire directement dans le stock d'un autre
// établissement. La RPC tourne côté Supabase avec des droits étendus.
export async function receiveLivraison(medicamentNom, quantite, etablissementDestinataire) {
  const { data, error } = await supabase.rpc("receive_livraison", {
    p_medicament_nom:             medicamentNom,
    p_quantite:                   quantite,
    p_etablissement_destinataire: etablissementDestinataire,
  });
  if (error) throw new Error(`receive_livraison: ${error.message}`);
  return data; // "ok" | "medicament_introuvable"
}

// ─── Fond de caisse ───────────────────────────────────────────────────────────
export async function insertFondCaisse(fields) {
  return run(supabase.from("fond_caisse").insert(fields).select().single());
}

export async function fetchFondJour(etablissement_id, dateISO) {
  let q = supabase
    .from("fond_caisse")
    .select("id, montant, caissier_email, created_at")
    .eq("date_journee", dateISO);
  if (etablissement_id) q = q.eq("etablissement_id", etablissement_id);
  const { data, error } = await q.maybeSingle();
  if (error) return null;
  return data ?? null;
}

// ─── Mouvements de stock ──────────────────────────────────────────────────────
export async function insertMouvementStock(fields) {
  return run(supabase.from("mouvements_stock").insert(fields).select().single());
}

export async function fetchMouvementsStock({ etablissement_id, medicament_id, type, dateDebut, dateFin, limit = 100 }) {
  let q = supabase
    .from("mouvements_stock")
    .select("id, type, quantite, motif, numero_bl, fournisseur, created_at, medicaments(nom, categorie)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (etablissement_id) q = q.eq("etablissement_id", etablissement_id);
  if (medicament_id)    q = q.eq("medicament_id", medicament_id);
  if (type)             q = q.eq("type", type);
  if (dateDebut)        q = q.gte("created_at", `${dateDebut}T00:00:00+00:00`);
  if (dateFin)          q = q.lte("created_at", `${dateFin}T23:59:59+00:00`);
  const { data, error } = await q;
  if (error) throw new Error(`mouvements_stock: ${error.message}`);
  return data ?? [];
}

// ─── Import en masse médicaments ──────────────────────────────────────────────
export async function upsertMedicaments(rows) {
  return run(
    supabase
      .from("medicaments")
      .upsert(rows, { onConflict: "nom,etablissement_id" })
      .select()
  );
}

// ─── Hospitalisations ─────────────────────────────────────────────────────────
export async function upsertHospitalisation(patient_id, fields) {
  const { data: existing } = await supabase
    .from("hospitalisations")
    .select("id")
    .eq("patient_id", patient_id)
    .in("statut", ["hospitalise", "ambulatoire"])
    .maybeSingle();
  if (existing) {
    return run(supabase.from("hospitalisations").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", existing.id).select().single());
  }
  return run(supabase.from("hospitalisations").insert({ patient_id, ...fields }).select().single());
}

export async function fetchHospitalisation(patient_id) {
  const { data } = await supabase
    .from("hospitalisations")
    .select("*")
    .eq("patient_id", patient_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function fetchLitsOccupes(etablissement_id) {
  const { data } = await supabase
    .from("hospitalisations")
    .select("*, patients(prenom, nom, groupe_sanguin, triage)")
    .eq("statut", "hospitalise")
    .order("date_entree", { ascending: false });
  return data ?? [];
}

// ─── Constantes vitales ───────────────────────────────────────────────────────
export async function insertConstante(fields) {
  return run(supabase.from("constantes_vitales").insert(fields).select().single());
}

export async function fetchConstantes(patient_id, limit = 20) {
  const { data } = await supabase
    .from("constantes_vitales")
    .select("*")
    .eq("patient_id", patient_id)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

// ─── Dispensations nominatives ────────────────────────────────────────────────
export async function insertDispensation(fields) {
  return run(supabase.from("dispensations").insert(fields).select().single());
}

export async function fetchDispensationsPatient(patient_id) {
  const { data } = await supabase
    .from("dispensations")
    .select("*, medicaments(nom, forme)")
    .eq("patient_id", patient_id)
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

// ─── Factures hopital ─────────────────────────────────────────────────────────
export async function insertFacture(fields) {
  return run(supabase.from("factures_hopital").insert(fields).select().single());
}

export async function updateFacture(id, fields) {
  return run(supabase.from("factures_hopital").update(fields).eq("id", id).select().single());
}

export async function fetchFactures(etablissement_id) {
  const { data } = await supabase
    .from("factures_hopital")
    .select("*, patients(prenom, nom)")
    .eq("etablissement_id", etablissement_id)
    .order("created_at", { ascending: false })
    .limit(100);
  return data ?? [];
}

// ─── Planning des gardes ──────────────────────────────────────────────────────
export async function insertGarde(fields) {
  return run(supabase.from("planning_gardes").insert(fields).select().single());
}

export async function updateGarde(id, fields) {
  return run(supabase.from("planning_gardes").update(fields).eq("id", id).select().single());
}

export async function deleteGarde(id) {
  return run(supabase.from("planning_gardes").delete().eq("id", id));
}

export async function fetchGardes(etablissement_id, dateDebut, dateFin) {
  let q = supabase
    .from("planning_gardes")
    .select("*")
    .order("date_garde")
    .order("heure_debut");
  if (etablissement_id) q = q.eq("etablissement_id", etablissement_id);
  if (dateDebut) q = q.gte("date_garde", dateDebut);
  if (dateFin)   q = q.lte("date_garde", dateFin);
  const { data } = await q;
  return data ?? [];
}

// ─── Update triage patient ────────────────────────────────────────────────────
export async function updatePatientTriage(id, triage) {
  return run(supabase.from("patients").update({ triage }).eq("id", id).select().single());
}
