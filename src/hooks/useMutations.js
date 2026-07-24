/**
 * useMutations — Toutes les opérations d'écriture Supabase pour MedOS
 * Chaque fonction retourne { data } ou lance une Error avec message lisible
 */
import { supabase } from "../supabaseClient";

async function run(promise) {
  const { data, error } = await promise;
  if (error) {
    if (error.message?.includes("row-level security") || error.code === "42501") {
      throw new Error("Acces refuse. Verifiez que vous etes bien connecte a votre etablissement.");
    }
    if (error.message?.includes("duplicate key") || error.code === "23505") {
      throw new Error("Cet element existe deja.");
    }
    if (error.message?.includes("foreign key") || error.code === "23503") {
      throw new Error("Reference invalide. L'element lie n'existe pas.");
    }
    throw new Error(error.message ?? "Une erreur inattendue est survenue.");
  }
  return data;
}

// ─── Médicaments ──────────────────────────────────────────────────────────────
export async function updateMedicament(id, fields) {
  return run(supabase.from("medicaments").update(fields).eq("id", id).select().single());
}

export async function deleteMedicament(id) {
  return run(supabase.from("medicaments").delete().eq("id", id).select().single());
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

// ─── Retours / remboursements ──────────────────────────────────────────────────
// La vente d'origine (journal_caisse / ventes) n'est jamais modifiée ni
// supprimée — ces enregistrements sont purement additifs (voir aussi
// l'absence de policy UPDATE/DELETE côté RLS : un retour, une fois créé, est
// définitif).
export async function insertRetour(fields) {
  return run(supabase.from("retours").insert(fields).select().single());
}

export async function insertRetourLignes(lignes) {
  if (!lignes || lignes.length === 0) return [];
  return run(supabase.from("retours_lignes").insert(lignes).select());
}

export async function fetchRetoursParJournalCaisseId(journalCaisseIds) {
  if (!journalCaisseIds || journalCaisseIds.length === 0) return [];
  const { data, error } = await supabase
    .from("retours")
    .select("id, journal_caisse_id, motif, mode_remboursement, montant_total, created_by_email, created_at, retours_lignes(medicament_nom, quantite, prix_unitaire, montant)")
    .in("journal_caisse_id", journalCaisseIds);
  if (error) throw new Error(`retours: ${error.message}`);
  return data ?? [];
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

// Suppression complète : autorisée uniquement pour les commandes en brouillon
// (appliqué aussi côté RLS, voir cmd_delete — pour tout autre statut,
// utiliser updateCommande(id, { statut: "annulee" }) à la place).
export async function deleteCommande(id) {
  return run(supabase.from("commandes").delete().eq("id", id).select().single());
}

// Lignes d'une commande multi-produits (voir commande_lignes) — insertion en
// lot, une ligne par médicament de la commande.
export async function insertCommandeLignes(lignes) {
  if (!lignes || lignes.length === 0) return [];
  return run(supabase.from("commande_lignes").insert(lignes).select());
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

// Suppression réelle réservée aux livraisons "planifiee" (jamais expédiée) —
// appliqué aussi au niveau RLS (livr_delete), donc la restriction tient même
// via un appel direct à l'API, pas seulement dans l'UI.
export async function deleteLivraison(id) {
  const { error } = await supabase.from("livraisons").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// Lignes d'une livraison multi-produits (voir livraison_lignes).
export async function insertLivraisonLignes(lignes) {
  if (!lignes || lignes.length === 0) return [];
  return run(supabase.from("livraison_lignes").insert(lignes).select());
}

// Ajuste la quantité d'une ligne (tant que la livraison n'est pas "livree") —
// réconcilie le stock entrepôt du distributeur avec la nouvelle quantité,
// atomique et bloquant côté serveur (voir ajuster_ligne_livraison).
// nouvelle_quantite = 0 supprime la ligne.
export async function ajusterLigneLivraison(livraisonId, medicamentId, medicamentNom, nouvelleQuantite, distributeurId) {
  const { data, error } = await supabase.rpc("ajuster_ligne_livraison", {
    p_livraison_id:       livraisonId,
    p_medicament_id:      medicamentId,
    p_medicament_nom:     medicamentNom,
    p_nouvelle_quantite:  nouvelleQuantite,
    p_distributeur_id:    distributeurId,
  });
  if (error) throw new Error(`ajuster_ligne_livraison: ${error.message}`);
  return data; // "ok" | "stock_insuffisant" | "medicament_introuvable" | "livraison_introuvable" | "livraison_deja_livree"
}

// Annule une livraison non encore livrée — restitue le stock entrepôt sans
// supprimer les lignes (trace d'audit conservée), voir annuler_livraison.
export async function annulerLivraison(livraisonId, distributeurId) {
  const { data, error } = await supabase.rpc("annuler_livraison", {
    p_livraison_id:    livraisonId,
    p_distributeur_id: distributeurId,
  });
  if (error) throw new Error(`annuler_livraison: ${error.message}`);
  return data; // "ok" | "livraison_introuvable" | "livraison_deja_livree"
}

// Disponibilité d'une ligne ("disponible" / "en rupture, à reporter") —
// visible du côté client, aucun impact sur le stock (contrairement à la
// quantité, gérée par ajuster_ligne_livraison).
export async function updateLivraisonLigneDisponibilite(livraisonId, medicamentId, disponible) {
  const { error } = await supabase
    .from("livraison_lignes")
    .update({ disponible })
    .eq("livraison_id", livraisonId)
    .eq("medicament_id", medicamentId);
  if (error) throw new Error(error.message);
}

// ─── Distributeur : "Mes Clients" (relation réelle) ────────────────────────────
export async function insertDistributeurClient(fields) {
  return run(supabase.from("distributeur_clients").insert({ ...fields, source: "manuel" }).select().single());
}

export async function updateDistributeurClient(id, fields) {
  return run(supabase.from("distributeur_clients").update(fields).eq("id", id).select().single());
}

// Recherche exacte par email (pas un annuaire parcourable) — ne renvoie un
// résultat que pour un établissement pharmacie/hôpital/clinique existant.
export async function rechercherClientParEmail(email) {
  const { data, error } = await supabase.rpc("rechercher_client_par_email", { p_email: email });
  if (error) throw new Error(error.message ?? "Une erreur inattendue est survenue.");
  return data?.[0] ?? null;
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

// ─── Fabricants (contacts externes du distributeur) ────────────────────────────
export async function insertFabricant(fields) {
  return run(supabase.from("fabricants").insert(fields).select().single());
}

export async function updateFabricant(id, fields) {
  return run(supabase.from("fabricants").update(fields).eq("id", id).select().single());
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

// Décrémente le stock ENTREPÔT du distributeur qui expédie une livraison —
// bloquant : renvoie "stock_insuffisant" sans rien modifier si la quantité
// demandée dépasse le stock actuel (vérifié et appliqué atomiquement côté
// serveur, verrou de ligne inclus, pour rester correct en cas de double-clic
// ou d'expéditions concurrentes du même produit).
export async function expedierLigneLivraison(medicamentId, quantite, distributeurId) {
  const { data, error } = await supabase.rpc("expedier_ligne_livraison", {
    p_medicament_id:   medicamentId,
    p_quantite:        quantite,
    p_distributeur_id: distributeurId,
  });
  if (error) throw new Error(`expedier_ligne_livraison: ${error.message}`);
  return data; // "ok" | "stock_insuffisant" | "medicament_introuvable"
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
    .select("id, type, quantite, motif, numero_bl, fournisseur, created_by_email, created_at, medicaments(nom, categorie)")
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

export async function fetchFacturesEnAttente(etablissement_id) {
  let q = supabase
    .from("factures_hopital")
    .select("*, patients(prenom, nom)")
    .eq("statut", "emise")
    .order("date_facture", { ascending: false });
  if (etablissement_id) q = q.eq("etablissement_id", etablissement_id);
  const { data } = await q;
  return data ?? [];
}

export async function fetchJournalCaisse(etablissement_id, dateISO) {
  let q = supabase
    .from("factures_hopital")
    .select("*, patients(prenom, nom)")
    .eq("statut", "payee")
    .gte("date_paiement", dateISO + "T00:00:00.000Z")
    .lte("date_paiement", dateISO + "T23:59:59.999Z")
    .order("date_paiement", { ascending: false });
  if (etablissement_id) q = q.eq("etablissement_id", etablissement_id);
  const { data } = await q;
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

// ─── Consultations ────────────────────────────────────────────────────────────
export async function insertConsultation(fields) {
  return run(supabase.from("consultations").insert(fields).select().single());
}

export async function updateConsultation(id, fields) {
  return run(supabase.from("consultations").update(fields).eq("id", id).select().single());
}

export async function fetchConsultationsJour(etablissement_id, dateISO) {
  const debut = dateISO + "T00:00:00.000Z";
  const fin   = dateISO + "T23:59:59.999Z";
  let q = supabase
    .from("consultations")
    .select("*, patients(id, prenom, nom, groupe_sanguin, antecedents)")
    .gte("heure_arrivee", debut)
    .lte("heure_arrivee", fin)
    .order("heure_arrivee", { ascending: true });
  if (etablissement_id) q = q.eq("etablissement_id", etablissement_id);
  const { data } = await q;
  return data ?? [];
}

// ─── Examens ──────────────────────────────────────────────────────────────────
export async function insertExamen(fields) {
  return run(supabase.from("examens").insert(fields).select().single());
}

export async function updateExamen(id, fields) {
  return run(supabase.from("examens").update(fields).eq("id", id).select().single());
}

export async function fetchExamensPatient(patient_id) {
  const { data } = await supabase
    .from("examens").select("*").eq("patient_id", patient_id)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function fetchExamens(etablissement_id) {
  let q = supabase
    .from("examens")
    .select("*, patients(id, prenom, nom)")
    .order("created_at", { ascending: false });
  if (etablissement_id) q = q.eq("etablissement_id", etablissement_id);
  const { data } = await q;
  return data ?? [];
}

// ─── Configuration lits ───────────────────────────────────────────────────────
export async function fetchConfigurationLits(etablissement_id) {
  let q = supabase.from("configuration_lits").select("*");
  if (etablissement_id) q = q.eq("etablissement_id", etablissement_id);
  const { data } = await q;
  return data ?? [];
}

export async function upsertConfigurationLit(etablissement_id, service, capacite_totale) {
  return run(
    supabase.from("configuration_lits")
      .upsert({ etablissement_id, service, capacite_totale, updated_at: new Date().toISOString() },
               { onConflict: "etablissement_id,service" })
      .select().single()
  );
}

export async function libererLit(hospitalisation_id, patient_id, date_sortie_reelle, notes) {
  await run(supabase.from("hospitalisations")
    .update({ statut: "sorti", date_sortie_reelle, notes })
    .eq("id", hospitalisation_id));
  await run(supabase.from("patients")
    .update({ statut: "ambulatoire" })
    .eq("id", patient_id));
}

// ─── Membres du personnel ─────────────────────────────────────────────────────
export async function fetchMembresPersonnel(etablissement_id) {
  let q = supabase
    .from("membres_personnel")
    .select("id, email, role_interne, actif")
    .eq("actif", true)
    .order("email");
  if (etablissement_id) q = q.eq("etablissement_id", etablissement_id);
  const { data } = await q;
  return data ?? [];
}

// ─── Tarifs des actes ─────────────────────────────────────────────────────────
export async function fetchTarifsActes(etablissement_id) {
  let q = supabase.from("tarifs_actes").select("*").eq("actif", true).order("categorie").order("libelle");
  if (etablissement_id) q = q.eq("etablissement_id", etablissement_id);
  const { data } = await q;
  return data ?? [];
}

export async function fetchTarifsActesTous(etablissement_id) {
  let q = supabase.from("tarifs_actes").select("*").order("categorie").order("libelle");
  if (etablissement_id) q = q.eq("etablissement_id", etablissement_id);
  const { data } = await q;
  return data ?? [];
}

export async function insertTarifActe(fields) {
  return run(supabase.from("tarifs_actes").insert(fields).select().single());
}

export async function updateTarifActe(id, fields) {
  return run(supabase.from("tarifs_actes").update(fields).eq("id", id).select().single());
}

export async function deleteTarifActe(id) {
  return run(supabase.from("tarifs_actes").delete().eq("id", id));
}

// ─── Notes d'evolution ────────────────────────────────────────────────────────
export async function insertNoteEvolution(fields) {
  return run(supabase.from("notes_evolution").insert(fields).select().single());
}

export async function fetchNotesEvolution(patient_id) {
  const { data } = await supabase
    .from("notes_evolution")
    .select("*")
    .eq("patient_id", patient_id)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function fetchNotesHospitalisation(hospitalisation_id) {
  const { data } = await supabase
    .from("notes_evolution")
    .select("*")
    .eq("hospitalisation_id", hospitalisation_id)
    .order("created_at", { ascending: false });
  return data ?? [];
}

// ─── Transferts de stock inter-établissements ──────────────────────────────────
export async function insertTransfertStock(fields) {
  return run(supabase.from("transferts_stock").insert(fields).select().single());
}

export async function fetchTransfertsStock(etablissement_id) {
  if (!etablissement_id) return [];
  const { data } = await supabase
    .from("transferts_stock")
    .select("*, medicaments(nom)")
    .or(`etablissement_source_id.eq.${etablissement_id},etablissement_dest_id.eq.${etablissement_id}`)
    .order("created_at", { ascending: false });
  return data ?? [];
}

// ─── Sessions caisse ──────────────────────────────────────────────────────────
export async function ouvrirSessionCaisse(fields) {
  return run(supabase.from("sessions_caisse").insert(fields).select().single());
}

export async function fetchSessionActive(etablissement_id, caissier_email) {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("sessions_caisse")
    .select("*")
    .eq("etablissement_id", etablissement_id)
    .eq("caissier_email", caissier_email)
    .eq("date_session", today)
    .eq("statut", "ouverte")
    .maybeSingle();
  return data ?? null;
}

export async function fermerSessionCaisse(id, fields) {
  return run(
    supabase.from("sessions_caisse")
      .update({ ...fields, statut: "fermee", heure_fermeture: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single()
  );
}

export async function fetchSessionsHistorique(etablissement_id, limit = 30) {
  const { data } = await supabase
    .from("sessions_caisse")
    .select("*")
    .eq("etablissement_id", etablissement_id)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

// ─── Paiements ────────────────────────────────────────────────────────────────
export async function insertPaiement(fields) {
  return run(supabase.from("paiements_facture").insert(fields).select().single());
}

export async function fetchPaiementsFacture(facture_id) {
  const { data } = await supabase
    .from("paiements_facture")
    .select("*")
    .eq("facture_id", facture_id)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function fetchPaiementsSession(session_id) {
  const { data } = await supabase
    .from("paiements_facture")
    .select("*, factures_hopital(numero_facture, sous_total, patients(prenom, nom))")
    .eq("session_id", session_id)
    .order("created_at", { ascending: false });
  return data ?? [];
}

// ─── Numerotation recus ───────────────────────────────────────────────────────
export async function genererNumeroRecu(etablissement_id) {
  const annee = new Date().getFullYear();
  const { data, error } = await supabase.rpc("incrementer_compteur_recu", {
    p_etablissement_id: etablissement_id,
    p_annee: annee,
  });
  if (error) {
    return `REC-${annee}-${Date.now().toString().slice(-5)}`;
  }
  return `REC-${annee}-${String(data).padStart(5, "0")}`;
}

// ─── Config caisse ─────────────────────────────────────────────────────────────
export async function fetchConfigCaisse(etablissement_id) {
  const { data } = await supabase
    .from("config_caisse")
    .select("*")
    .eq("etablissement_id", etablissement_id)
    .maybeSingle();
  return data ?? { tva_taux: 0, tva_active: false, assureurs: [], mention_legale: "" };
}

export async function upsertConfigCaisse(etablissement_id, fields) {
  return run(
    supabase.from("config_caisse")
      .upsert(
        { etablissement_id, ...fields, updated_at: new Date().toISOString() },
        { onConflict: "etablissement_id" }
      )
      .select()
      .single()
  );
}

// ─── Factures enrichies ────────────────────────────────────────────────────────
export async function fetchFacturesAvecPaiements(etablissement_id) {
  const { data } = await supabase
    .from("factures_hopital")
    .select("*, patients(prenom, nom, telephone), paiements_facture(montant, mode_paiement, created_at, numero_recu)")
    .eq("etablissement_id", etablissement_id)
    .order("created_at", { ascending: false })
    .limit(200);
  return data ?? [];
}

// ─── RDV / Agenda ─────────────────────────────────────────────────────────────
export async function fetchRdvSemaine(etablissement_id, dateDebut, dateFin) {
  const { data } = await supabase
    .from("consultations")
    .select("*, patients(prenom, nom, telephone)")
    .eq("etablissement_id", etablissement_id)
    .eq("type", "rdv")
    .gte("date_rdv", dateDebut)
    .lte("date_rdv", dateFin)
    .order("date_rdv", { ascending: true })
    .order("heure_rdv", { ascending: true });
  return data ?? [];
}

// ─── Transmissions de garde ───────────────────────────────────────────────────
export async function insertTransmissionGarde(fields) {
  return run(supabase.from("transmissions_garde").insert(fields).select().single());
}

export async function fetchTransmissionsGarde(etablissement_id) {
  const { data } = await supabase
    .from("transmissions_garde")
    .select("*")
    .eq("etablissement_id", etablissement_id)
    .order("created_at", { ascending: false })
    .limit(20);
  return data ?? [];
}

export async function fetchDerniereTransmission(etablissement_id, service) {
  let q = supabase
    .from("transmissions_garde")
    .select("*")
    .eq("etablissement_id", etablissement_id)
    .order("created_at", { ascending: false })
    .limit(1);
  if (service) q = q.eq("service", service);
  const { data } = await q;
  return data?.[0] ?? null;
}

// ─── Bloc opératoire ──────────────────────────────────────────────────────────
export async function fetchSallesOperation(etablissement_id) {
  const { data } = await supabase.from("salles_operation").select("*")
    .eq("etablissement_id", etablissement_id).order("nom");
  return data ?? [];
}
export async function upsertSalleOperation(fields) {
  return run(supabase.from("salles_operation").upsert(fields).select().single());
}
export async function updateSalleStatut(id, statut) {
  return run(supabase.from("salles_operation").update({ statut }).eq("id", id).select().single());
}
export async function insertIntervention(fields) {
  return run(supabase.from("interventions").insert(fields).select().single());
}
export async function updateIntervention(id, fields) {
  return run(supabase.from("interventions").update(fields).eq("id", id).select().single());
}
export async function fetchInterventionsJour(etablissement_id, dateISO) {
  const { data } = await supabase.from("interventions")
    .select("*, patients(prenom, nom, date_naissance, groupe_sanguin, allergies), salles_operation(nom)")
    .eq("etablissement_id", etablissement_id)
    .eq("date_prevue", dateISO)
    .order("heure_prevue", { ascending: true });
  return data ?? [];
}
export async function fetchInterventionsSemaine(etablissement_id, dateDebut, dateFin) {
  const { data } = await supabase.from("interventions")
    .select("*, patients(prenom, nom), salles_operation(nom)")
    .eq("etablissement_id", etablissement_id)
    .gte("date_prevue", dateDebut).lte("date_prevue", dateFin)
    .order("date_prevue").order("heure_prevue");
  return data ?? [];
}
export async function genererNumeroIntervention(etablissement_id) {
  const annee = new Date().getFullYear();
  const { data, error } = await supabase.rpc("incrementer_compteur_bloc",
    { p_etablissement_id: etablissement_id, p_annee: annee });
  if (error) return `INT-${annee}-${Date.now().toString().slice(-5)}`;
  return `INT-${annee}-${String(data).padStart(5, "0")}`;
}
export async function insertChecklist(fields) {
  return run(supabase.from("checklists_preop").insert(fields).select().single());
}
export async function updateChecklist(id, fields) {
  return run(supabase.from("checklists_preop").update(fields).eq("id", id).select().single());
}
export async function fetchChecklistIntervention(intervention_id) {
  const { data } = await supabase.from("checklists_preop").select("*")
    .eq("intervention_id", intervention_id).maybeSingle();
  return data ?? null;
}
export async function insertCRO(fields) {
  return run(supabase.from("comptes_rendus_operatoires").insert(fields).select().single());
}
export async function updateCRO(id, fields) {
  return run(supabase.from("comptes_rendus_operatoires").update(fields).eq("id", id).select().single());
}
export async function fetchCROIntervention(intervention_id) {
  const { data } = await supabase.from("comptes_rendus_operatoires").select("*")
    .eq("intervention_id", intervention_id).maybeSingle();
  return data ?? null;
}
export async function insertFeuilleReveil(fields) {
  return run(supabase.from("feuilles_reveil").insert(fields).select().single());
}
export async function updateFeuilleReveil(id, fields) {
  return run(supabase.from("feuilles_reveil").update(fields).eq("id", id).select().single());
}
export async function fetchFeuilleReveilIntervention(intervention_id) {
  const { data } = await supabase.from("feuilles_reveil").select("*")
    .eq("intervention_id", intervention_id).maybeSingle();
  return data ?? null;
}

// ─── Maternité ────────────────────────────────────────────────────────────────
export async function insertGrossesse(fields) {
  return run(supabase.from("grossesses").insert(fields).select().single());
}
export async function updateGrossesse(id, fields) {
  return run(supabase.from("grossesses").update(fields).eq("id", id).select().single());
}
export async function fetchGrossessesActives(etablissement_id) {
  const { data } = await supabase
    .from("grossesses")
    .select("*, patients(prenom, nom, date_naissance, telephone)")
    .eq("etablissement_id", etablissement_id)
    .eq("statut", "en_cours")
    .order("date_accouchement_prevue", { ascending: true });
  return data ?? [];
}
export async function fetchGrossessesEtablissement(etablissement_id) {
  const { data } = await supabase
    .from("grossesses")
    .select("*, patients(prenom, nom, date_naissance, telephone)")
    .eq("etablissement_id", etablissement_id)
    .order("created_at", { ascending: false });
  return data ?? [];
}
export async function fetchGrossessePatient(patient_id) {
  const { data } = await supabase
    .from("grossesses")
    .select("*, consultations_prenatales(*), accouchements(*)")
    .eq("patient_id", patient_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}
export async function insertCPN(fields) {
  return run(supabase.from("consultations_prenatales").insert(fields).select().single());
}
export async function fetchCPNGrossesse(grossesse_id) {
  const { data } = await supabase
    .from("consultations_prenatales")
    .select("*")
    .eq("grossesse_id", grossesse_id)
    .order("date_cpn", { ascending: true });
  return data ?? [];
}
export async function insertPartogramme(fields) {
  return run(supabase.from("partogrammes").insert(fields).select().single());
}
export async function updatePartogramme(id, fields) {
  return run(supabase.from("partogrammes").update(fields).eq("id", id).select().single());
}
export async function fetchPartogrammesActifs(etablissement_id) {
  const { data } = await supabase
    .from("partogrammes")
    .select("*, patients(prenom, nom), grossesses(numero_grossesse)")
    .eq("etablissement_id", etablissement_id)
    .eq("statut", "en_cours")
    .order("heure_debut_travail", { ascending: true });
  return data ?? [];
}
export async function fetchPartogrammeActif(patient_id) {
  const { data } = await supabase
    .from("partogrammes")
    .select("*")
    .eq("patient_id", patient_id)
    .eq("statut", "en_cours")
    .maybeSingle();
  return data ?? null;
}
export async function insertAccouchement(fields) {
  return run(supabase.from("accouchements").insert(fields).select().single());
}
export async function fetchAccouchementsEtablissement(etablissement_id, limit = 100) {
  const { data } = await supabase
    .from("accouchements")
    .select("*, patients(prenom, nom, date_naissance), nouveau_nes(*)")
    .eq("etablissement_id", etablissement_id)
    .order("date_heure_accouchement", { ascending: false })
    .limit(limit);
  return data ?? [];
}
export async function insertNouveauNe(fields) {
  return run(supabase.from("nouveau_nes").insert(fields).select().single());
}
export async function fetchNouveauNesEtablissement(etablissement_id, limit = 100) {
  const { data } = await supabase
    .from("nouveau_nes")
    .select("*, accouchements(date_heure_accouchement, sage_femme, type_accouchement), patients!nouveau_nes_mere_patient_id_fkey(prenom, nom)")
    .eq("etablissement_id", etablissement_id)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
export async function genererNumeroMaternite(etablissement_id, type) {
  const annee = new Date().getFullYear();
  const { data, error } = await supabase.rpc("incrementer_compteur_maternite", {
    p_etablissement_id: etablissement_id,
    p_annee: annee,
    p_type: type,
  });
  const prefixes = { grossesse: "GR", accouchement: "ACC", naissance: "NAIS" };
  if (error) return `${prefixes[type] ?? "MAT"}-${annee}-${Date.now().toString().slice(-5)}`;
  return `${prefixes[type] ?? "MAT"}-${annee}-${String(data).padStart(5, "0")}`;
}

// ─── Décès ────────────────────────────────────────────────────────────────────
export async function insertDeces(fields) {
  return run(supabase.from("deces").insert(fields).select().single());
}

export async function fetchDecesByPatient(patient_id) {
  const { data } = await supabase
    .from("deces")
    .select("*")
    .eq("patient_id", patient_id)
    .maybeSingle();
  return data ?? null;
}

export async function fetchDecesEtablissement(etablissement_id) {
  const { data } = await supabase
    .from("deces")
    .select("*, patients(prenom, nom, date_naissance, genre, numero_dossier)")
    .eq("etablissement_id", etablissement_id)
    .order("date_heure_deces", { ascending: false });
  return data ?? [];
}

export async function genererNumeroCertificat(etablissement_id) {
  const annee = new Date().getFullYear();
  const { data, error } = await supabase.rpc("incrementer_compteur_certificat", {
    p_etablissement_id: etablissement_id,
    p_annee: annee,
  });
  if (error) return `CERT-${annee}-${Date.now().toString().slice(-5)}`;
  return `CERT-${annee}-${String(data).padStart(5, "0")}`;
}

// ─── File de dispensation ─────────────────────────────────────────────────────
export async function fetchOrdonnancesADispenser(etablissement_id) {
  const { data } = await supabase
    .from("ordonnances")
    .select("*, patients(prenom, nom, date_naissance, triage, numero_dossier)")
    .eq("etablissement_id", etablissement_id)
    .eq("statut", "en_attente")
    .order("date_emission", { ascending: true });
  return data ?? [];
}

// ─── Commandes internes ───────────────────────────────────────────────────────
export async function insertCommandeInterne(fields) {
  return run(supabase.from("commandes_internes").insert(fields).select().single());
}

export async function fetchCommandesInternes(etablissement_id) {
  const { data } = await supabase
    .from("commandes_internes")
    .select("*")
    .eq("etablissement_id", etablissement_id)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function updateCommandeInterne(id, fields) {
  return run(supabase.from("commandes_internes").update(fields).eq("id", id).select().single());
}

// ─── Ordonnances expirant bientôt ─────────────────────────────────────────────
export async function fetchOrdonnancesExpirantBientot(etablissement_id, jours = 7) {
  const today = new Date().toISOString().slice(0, 10);
  const dateLimite = new Date(Date.now() + jours * 86400000).toISOString().slice(0, 10);
  const { data } = await supabase
    .from("ordonnances")
    .select("*, patients(prenom, nom, telephone, numero_dossier)")
    .eq("etablissement_id", etablissement_id)
    .lte("date_expiration", dateLimite)
    .neq("statut", "annulee")
    .order("date_expiration", { ascending: true });
  return data ?? [];
}

// ─── Perfusions ───────────────────────────────────────────────────────────────
export async function insertPerfusion(fields) {
  return run(supabase.from("perfusions").insert(fields).select().single());
}

export async function fetchPerfusionsActives(etablissement_id) {
  const { data } = await supabase
    .from("perfusions")
    .select("*, patients(prenom, nom, triage)")
    .eq("etablissement_id", etablissement_id)
    .eq("statut", "en_cours")
    .order("heure_debut", { ascending: true });
  return data ?? [];
}

export async function fetchPerfusionsPatient(patient_id) {
  const { data } = await supabase
    .from("perfusions")
    .select("*")
    .eq("patient_id", patient_id)
    .order("created_at", { ascending: false })
    .limit(10);
  return data ?? [];
}

export async function updatePerfusion(id, fields) {
  return run(supabase.from("perfusions").update(fields).eq("id", id).select().single());
}

// ─── Plan de soins ────────────────────────────────────────────────────────────
export async function insertPlanSoins(fields) {
  return run(supabase.from("plan_soins").insert(fields).select().single());
}

export async function fetchPlanSoinsPatient(patient_id) {
  const { data } = await supabase
    .from("plan_soins")
    .select("*")
    .eq("patient_id", patient_id)
    .eq("actif", true)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function fetchPlanSoinsJour(etablissement_id) {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("plan_soins")
    .select("*, patients(prenom, nom, triage), administrations_medicament(*)")
    .eq("etablissement_id", etablissement_id)
    .eq("actif", true)
    .or(`date_fin.is.null,date_fin.gte.${today}`)
    .order("created_at", { ascending: false });
  return data ?? [];
}

// ─── Administrations ──────────────────────────────────────────────────────────
export async function insertAdministration(fields) {
  return run(supabase.from("administrations_medicament").insert(fields).select().single());
}

export async function fetchAdministrationsJour(etablissement_id, dateISO) {
  const { data } = await supabase
    .from("administrations_medicament")
    .select("*, patients(prenom, nom)")
    .eq("etablissement_id", etablissement_id)
    .gte("heure_reelle", dateISO + "T00:00:00")
    .lte("heure_reelle", dateISO + "T23:59:59")
    .order("heure_reelle", { ascending: false });
  return data ?? [];
}

// ─── Diététique ───────────────────────────────────────────────────────────────
export async function insertPrescriptionDietetique(fields) {
  return run(supabase.from("prescriptions_dietetiques").insert(fields).select().single());
}
export async function updatePrescriptionDietetique(id, fields) {
  return run(supabase.from("prescriptions_dietetiques").update(fields).eq("id", id).select().single());
}
export async function fetchRegimesActifs(etablissement_id) {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("prescriptions_dietetiques")
    .select("*, patients(prenom, nom, date_naissance), hospitalisations(service, lit, chambre, statut)")
    .eq("etablissement_id", etablissement_id)
    .eq("actif", true)
    .or(`date_fin.is.null,date_fin.gte.${today}`);
  return data ?? [];
}
export async function fetchRegimePatient(patient_id) {
  const { data } = await supabase
    .from("prescriptions_dietetiques")
    .select("*")
    .eq("patient_id", patient_id)
    .eq("actif", true)
    .maybeSingle();
  return data ?? null;
}
export async function insertPlateauRepas(fields) {
  return run(supabase.from("plateaux_repas").insert(fields).select().single());
}
export async function updatePlateauRepas(id, fields) {
  return run(supabase.from("plateaux_repas").update(fields).eq("id", id).select().single());
}
export async function fetchPlateauxJour(etablissement_id, dateISO) {
  const { data } = await supabase
    .from("plateaux_repas")
    .select("*, patients(prenom, nom)")
    .eq("etablissement_id", etablissement_id)
    .eq("date_repas", dateISO)
    .order("moment").order("created_at");
  return data ?? [];
}

// ─── Stérilisation ────────────────────────────────────────────────────────────
export async function fetchEquipementsSterilistion(etablissement_id) {
  const { data } = await supabase.from("equipements_sterilisation")
    .select("*").eq("etablissement_id", etablissement_id).order("nom");
  return data ?? [];
}
export async function upsertEquipementSterilisation(fields) {
  return run(supabase.from("equipements_sterilisation").upsert(fields).select().single());
}
export async function insertLotSterilisation(fields) {
  return run(supabase.from("lots_sterilisation").insert(fields).select().single());
}
export async function updateLotSterilisation(id, fields) {
  return run(supabase.from("lots_sterilisation").update(fields).eq("id", id).select().single());
}
export async function fetchLotsRecents(etablissement_id, limit = 50) {
  const { data } = await supabase
    .from("lots_sterilisation")
    .select("*, equipements_sterilisation(nom, type)")
    .eq("etablissement_id", etablissement_id)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
export async function genererNumeroLot(etablissement_id) {
  const annee = new Date().getFullYear();
  const { data, error } = await supabase.rpc("incrementer_compteur_sterilisation",
    { p_etablissement_id: etablissement_id, p_annee: annee });
  if (error) return `LOT-${annee}-${Date.now().toString().slice(-5)}`;
  return `LOT-${annee}-${String(data).padStart(5, "0")}`;
}

// ─── Vaccinations ─────────────────────────────────────────────────────────────
export async function insertVaccination(fields) {
  return run(supabase.from("vaccinations").insert(fields).select().single());
}
export async function fetchVaccinationsPatient(patient_id) {
  const { data } = await supabase.from("vaccinations").select("*").eq("patient_id", patient_id).order("created_at");
  return data ?? [];
}

// ─── Imagerie ─────────────────────────────────────────────────────────────────
export async function insertImagerie(fields) {
  return run(supabase.from("imagerie").insert(fields).select().single());
}
export async function fetchImageriePatient(patient_id) {
  const { data } = await supabase.from("imagerie").select("*").eq("patient_id", patient_id).order("date_demande", { ascending: false });
  return data ?? [];
}

// ─── Présence / heartbeat ───────────────────────────────────────────────────────
// Pas de gestion d'erreur exposée : un heartbeat manqué ne doit jamais
// perturber l'utilisateur, seulement retarder la mise à jour du statut "actif".
export async function enregistrerConnexion() {
  await supabase.rpc("enregistrer_connexion");
}
