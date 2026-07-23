/**
 * Hooks Supabase pour MedOS — données temps réel
 * Chaque hook retourne { data, loading, error }
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient";

// ─── pagination serveur ───────────────────────────────────────────────────────
// buildQuery() doit inclure { count: "exact" } dans le .select() pour que
// Supabase retourne le total. Le hook applique .range(from, to) automatiquement.
export function usePaginated(buildQuery, deps = [], pageSize = 20) {
  const [page, setPage] = useState(0);
  const [state, setState] = useState({ data: [], total: 0, loading: true, error: null });
  const [tick, setTick] = useState(0);
  const refetch = useCallback(() => setTick((t) => t + 1), []);
  const buildRef = useRef(buildQuery);
  useEffect(() => { buildRef.current = buildQuery; });

  // Detecte un changement de filtre (deps) survenu depuis le dernier rendu.
  // Sans ca, un clic sur un filtre relancait le fetch avec l'ancienne page
  // (ex: page=1) ET les nouveaux filtres avant que le reset de page ne
  // prenne effet, demandant un offset hors bornes -> erreur 416 visible.
  const depsRef = useRef(deps);
  const depsChanged = deps.length !== depsRef.current.length || deps.some((d, i) => d !== depsRef.current[i]);

  useEffect(() => {
    if (depsChanged) {
      depsRef.current = deps;
      if (page !== 0) { setPage(0); return; }
    }
    const effectivePage = depsChanged ? 0 : page;
    const from = effectivePage * pageSize;
    const to   = from + pageSize - 1;
    setState((s) => ({ ...s, loading: true }));
    buildRef.current()
      .range(from, to)
      .then(({ data, error, count }) =>
        setState({ data: data ?? [], total: count ?? 0, loading: false, error: error ?? null })
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, tick, ...deps]);

  const totalPages = Math.max(1, Math.ceil(state.total / pageSize));
  return { ...state, page, setPage, totalPages, refetch };
}

// Hooks paginés spécifiques ───────────────────────────────────────────────────

export function useMedicamentsPaginated(search = "", pageSize = 20) {
  return usePaginated(() => {
    let q = supabase.from("medicaments").select("*", { count: "exact" }).order("nom");
    if (search.trim()) q = q.ilike("nom", `%${search.trim()}%`);
    return q;
  }, [search], pageSize);
}

// Counts globaux pour les KPI de l'inventaire (ratio calculé côté JS)
export function useMedicamentStats() {
  return useQuery(() =>
    supabase.from("medicaments").select("stock_actuel, stock_minimum")
  );
}

export function usePatientsPaginated(search = "", pageSize = 20, filtre = "") {
  return usePaginated(() => {
    let q = supabase.from("patients").select("*", { count: "exact" }).order("nom");
    const s = search.trim();
    if (s) q = q.or(`nom.ilike.%${s}%,prenom.ilike.%${s}%`);
    if (filtre === "avec_allergies")    q = q.not("allergies", "is", null).neq("allergies", "{}");
    if (filtre === "avec_mutuelle")     q = q.not("mutuelle", "is", null).neq("mutuelle", "");
    if (filtre === "fidele")            q = q.gte("nb_visites", 5);
    if (filtre === "recurrent")         q = q.gte("nb_visites", 2).lt("nb_visites", 5);
    if (filtre === "occasionnel")       q = q.eq("nb_visites", 1);
    return q;
  }, [search, filtre], pageSize);
}

// Counts globaux patients pour KPI hôpital
export function usePatientsStats() {
  const [stats, setStats] = useState({ total: 0, hospitalise: 0, ambulatoire: 0, avecAllergies: 0, loading: true });
  useEffect(() => {
    Promise.all([
      supabase.from("patients").select("id", { count: "exact", head: true }),
      supabase.from("patients").select("id", { count: "exact", head: true }).eq("statut", "hospitalise"),
      supabase.from("patients").select("id", { count: "exact", head: true }).not("allergies", "is", null).neq("allergies", "{}"),
    ]).then(([tot, hosp, allerg]) => {
      const t = tot.count ?? 0;
      const h = hosp.count ?? 0;
      setStats({ total: t, hospitalise: h, ambulatoire: t - h, avecAllergies: allerg.count ?? 0, loading: false });
    });
  }, []);
  return stats;
}

export function useOrdonnancesPaginated(statut = "", pageSize = 20) {
  return usePaginated(() => {
    let q = supabase.from("ordonnances").select(`
      id, reference, statut, date_emission, date_expiration, medecin_nom, notes,
      patient_id, lignes,
      patients ( prenom, nom )
    `, { count: "exact" }).order("date_emission", { ascending: false });
    if (statut) q = q.eq("statut", statut);
    return q;
  }, [statut], pageSize);
}

export function useFournisseursPaginated(filtre = "actifs", pageSize = 20) {
  return usePaginated(() => {
    let q = supabase.from("fournisseurs").select("*", { count: "exact" }).order("nom");
    if (filtre === "actifs")   q = q.eq("actif", true);
    if (filtre === "inactifs") q = q.eq("actif", false);
    return q;
  }, [filtre], pageSize);
}

export function useCommandesPaginated(etablissement_id = null, pageSize = 20, filtres = {}) {
  const { statut = "", fournisseur_id = "", search = "" } = filtres;
  return usePaginated(() => {
    let q = supabase.from("commandes").select(`
      id, reference, statut, date_commande, date_livraison_prevue, montant_total, notes,
      medicament_id, quantite, email_statut, email_erreur,
      etablissements!commandes_etablissement_id_fkey ( nom, ville ),
      fournisseurs ( id, nom, telephone, email, pays ),
      medicaments ( nom, dosage, forme ),
      commande_lignes ( id, medicament_id, medicament_nom, quantite, prix_unitaire )
    `, { count: "exact" }).order("date_commande", { ascending: false });
    if (etablissement_id) q = q.eq("etablissement_id", etablissement_id);
    if (statut) q = q.eq("statut", statut);
    if (fournisseur_id) q = q.eq("fournisseur_id", fournisseur_id);
    if (search.trim()) q = q.ilike("reference", `%${search.trim()}%`);
    return q;
  }, [etablissement_id, statut, fournisseur_id, search], pageSize);
}

// Commandes REÇUES par un distributeur de la part de ses clients — filtrées
// sur distributeur_id (jamais etablissement_id, qui désigne l'émetteur/client
// ici, pas le distributeur). Utilisé par Facturation.jsx pour le suivi de
// paiement ; distinct de useCommandesFabricantPaginated (commandes PLACÉES
// par le distributeur auprès de ses propres fabricants, relation inverse).
export function useCommandesRecuesPaginated(distributeur_id = null, pageSize = 20, filtres = {}) {
  const { statut_paiement = "" } = filtres;
  return usePaginated(() => {
    let q = supabase.from("commandes").select(`
      id, reference, statut, statut_paiement, date_commande, montant_total, etablissement_id,
      etablissements!commandes_etablissement_id_fkey ( nom, ville )
    `, { count: "exact" }).order("date_commande", { ascending: false });
    if (distributeur_id) q = q.eq("distributeur_id", distributeur_id);
    if (statut_paiement) q = q.eq("statut_paiement", statut_paiement);
    return q;
  }, [distributeur_id, statut_paiement], pageSize);
}

// Commandes passées à des fabricants (module Distributeur) — même table que
// useCommandesPaginated, filtrée sur fabricant_id non nul pour ne jamais
// mélanger avec les commandes fournisseur du module Pharmacie.
export function useCommandesFabricantPaginated(etablissement_id = null, pageSize = 20, filtres = {}) {
  const { statut = "", fabricant_id = "", search = "" } = filtres;
  return usePaginated(() => {
    let q = supabase.from("commandes").select(`
      id, reference, statut, date_commande, date_livraison_prevue, montant_total, notes,
      email_statut, email_erreur,
      fabricants ( id, nom, telephone, email ),
      commande_lignes ( id, medicament_id, medicament_nom, quantite, prix_unitaire )
    `, { count: "exact" }).not("fabricant_id", "is", null).order("date_commande", { ascending: false });
    if (etablissement_id) q = q.eq("etablissement_id", etablissement_id);
    if (statut) q = q.eq("statut", statut);
    if (fabricant_id) q = q.eq("fabricant_id", fabricant_id);
    if (search.trim()) q = q.ilike("reference", `%${search.trim()}%`);
    return q;
  }, [etablissement_id, statut, fabricant_id, search], pageSize);
}

export function useFabricantsPaginated(filtre = "actifs", pageSize = 20) {
  return usePaginated(() => {
    let q = supabase.from("fabricants").select("*", { count: "exact" }).order("nom");
    if (filtre === "actifs")   q = q.eq("actif", true);
    if (filtre === "inactifs") q = q.eq("actif", false);
    return q;
  }, [filtre], pageSize);
}

// Liste simple (non paginée) des fabricants actifs — pour les menus déroulants
export function useFabricants() {
  return useQuery(() =>
    supabase.from("fabricants").select("id, nom, email, telephone").eq("actif", true).order("nom"),
  []);
}

// Historique des changements de statut d'une commande (append-only, voir trigger SQL)
export function useCommandeHistorique(commande_id) {
  return useQuery(() => {
    if (!commande_id) return Promise.resolve({ data: [], error: null });
    return supabase
      .from("commande_statut_historique")
      .select("id, statut, changed_at")
      .eq("commande_id", commande_id)
      .order("changed_at", { ascending: true });
  }, [commande_id]);
}

// Totaux commandes pour les KPI Crédits (montant_total + statut seulement)
export function useCommandesStats(etablissement_id = null) {
  return useQuery(() => {
    let q = supabase.from("commandes").select("statut, montant_total");
    if (etablissement_id) q = q.eq("etablissement_id", etablissement_id);
    return q;
  }, [etablissement_id]);
}

// `distributeur_clients_id` couvre aussi bien un client MedOS qu'un client
// manuel (voir useDistributeurClients) — la jointure `etablissements` reste
// pour l'affichage rapide d'un client MedOS classique, mais un client manuel
// n'a pas de ligne etablissements du tout : le nom est alors résolu côté
// composant à partir de la liste déjà chargée par useDistributeurClients().
export function useLivraisonsPaginated(statut = "", pageSize = 20) {
  return usePaginated(() => {
    let q = supabase.from("livraisons").select(`
      id, statut, date_depart, date_arrivee_prevue, date_arrivee_reelle,
      transporteur, numero_suivi, etablissement_id, distributeur_clients_id, created_at,
      commande_id, email_statut, email_erreur,
      cree_par_email, traite_par_email, expedie_par_email,
      etablissements!livraisons_etablissement_id_fkey ( nom, ville ),
      livraison_lignes ( id, medicament_id, medicament_nom, quantite, disponible )
    `, { count: "exact" }).order("created_at", { ascending: false });
    if (statut && statut !== "tous") q = q.eq("statut", statut);
    return q;
  }, [statut], pageSize);
}

// Lignes d'une livraison — utilisé quand on marque "Livrée" pour incrémenter
// le stock du destinataire d'après le panier fixé à la création (plus de
// re-saisie manuelle des médicaments à ce moment-là), et pour l'édition tant
// que la livraison n'est pas encore livrée.
export function useLivraisonLignes(livraison_id) {
  return useQuery(() => {
    if (!livraison_id) return Promise.resolve({ data: [], error: null });
    return supabase
      .from("livraison_lignes")
      .select("id, medicament_id, medicament_nom, quantite, disponible")
      .eq("livraison_id", livraison_id)
      .order("created_at", { ascending: true });
  }, [livraison_id]);
}

export function useAlertesPaginated(severite = "", pageSize = 20) {
  return usePaginated(() => {
    let q = supabase.from("alertes").select(
      "id, type, severite, titre, message, lu, resolu, created_at, medicament_id",
      { count: "exact" }
    ).eq("resolu", false).order("created_at", { ascending: false });
    if (severite && severite !== "tous") q = q.eq("severite", severite);
    return q;
  }, [severite], pageSize);
}

// Counts globaux alertes pour les KPI (requêtes count uniquement)
export function useAlertesStats() {
  const [stats, setStats] = useState({ critique: 0, alerte: 0, info: 0, total: 0, loading: true });
  useEffect(() => {
    const base = () => supabase.from("alertes").select("id", { count: "exact", head: true }).eq("resolu", false);
    Promise.all([
      base().eq("severite", "critique"),
      base().eq("severite", "alerte"),
      base().eq("severite", "info"),
      base(),
    ]).then(([c, a, i, t]) =>
      setStats({ critique: c.count ?? 0, alerte: a.count ?? 0, info: i.count ?? 0, total: t.count ?? 0, loading: false })
    );
  }, []);
  return stats;
}

// ─── utilitaire générique ────────────────────────────────────────────────────
function useQuery(fn, deps = []) {
  const [state, setState] = useState({ data: [], loading: true, error: null });
  const [tick, setTick] = useState(0);
  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    setState((s) => ({ ...s, loading: true }));
    fn().then(({ data, error }) =>
      setState({ data: data ?? [], loading: false, error: error ?? null })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { ...state, refetch };
}

// ─── médicaments ─────────────────────────────────────────────────────────────
// etablissement_id : filtre explicite optionnel — nécessaire pour un
// distributeur, dont le RLS laisse aussi passer le stock de ses clients
// réels (médicaments) en plus du sien (voir med_select_distributeur_clients) ;
// sans ce filtre, "son" entrepôt afficherait aussi le stock de ses clients.
export function useMedicaments(etablissement_id = null) {
  return useQuery(() => {
    let q = supabase.from("medicaments").select("*").order("nom", { ascending: true }).limit(500);
    if (etablissement_id) q = q.eq("etablissement_id", etablissement_id);
    return q;
  }, [etablissement_id]);
}

export function useMedicamentsCritiques(limit = 8, etablissement_id = null) {
  const all = useMedicaments(etablissement_id);
  return {
    ...all,
    data: all.data
      .filter((m) => m.stock_actuel < m.stock_minimum)
      .sort((a, b) => a.stock_actuel - b.stock_actuel)
      .slice(0, limit),
  };
}

// ─── alertes ─────────────────────────────────────────────────────────────────
export function useAlertes(limit = 20) {
  return useQuery(() =>
    supabase
      .from("alertes")
      .select("id, type, severite, titre, message, lu, resolu, created_at, medicament_id")
      .eq("resolu", false)
      .order("created_at", { ascending: false })
      .limit(limit)
  );
}

// ─── patients ─────────────────────────────────────────────────────────────────
export function usePatients(etablissement_id = null) {
  return useQuery(() => {
    let q = supabase.from("patients").select("*").order("nom", { ascending: true }).limit(500);
    if (etablissement_id) q = q.eq("etablissement_id", etablissement_id);
    return q;
  }, [etablissement_id]);
}

// ─── établissements ──────────────────────────────────────────────────────────
export function useEtablissements(type = null) {
  return useQuery(
    () => {
      let q = supabase.from("etablissements").select("*").eq("actif", true).order("nom");
      if (type) q = q.eq("type", type);
      return q;
    },
    [type]
  );
}

// ─── fournisseurs ─────────────────────────────────────────────────────────────
export function useFournisseurs() {
  return useQuery(() =>
    supabase.from("fournisseurs").select("*").order("nom", { ascending: true }).limit(500)
  );
}

// ─── distributeur : "Mes Clients" (relation réelle, pas la liste brute des
// établissements MedOS) — RLS scope automatiquement à distributeur_id = soi-même.
// Un client "manuel" (hors MedOS, pas de client_etablissement_id) est
// normalisé en un objet `client` de même forme que pour un vrai établissement
// — le reste de l'app (fiche, tableau, historique) n'a pas à distinguer les
// deux cas. `estManuel` reste disponible pour les endroits qui doivent le
// savoir. `relationId` (= id de la ligne distributeur_clients, distinct de
// `client.id` pour un client MedOS) permet de créer une livraison via
// distributeur_clients_id quel que soit le type de client.
export function useDistributeurClients() {
  const result = useQuery(() =>
    supabase
      .from("distributeur_clients")
      .select(`
        id, source, created_at,
        nom_manuel, adresse_manuel, ville_manuel, contact_manuel, telephone_manuel, email_manuel,
        client:client_etablissement_id ( id, nom, ville, type, email, telephone, actif, derniere_connexion )
      `)
      .order("created_at", { ascending: false })
  );
  return {
    ...result,
    data: result.data.map((r) => ({
      ...r,
      client: r.client ? { ...r.client, relationId: r.id } : {
        id: r.id,
        relationId: r.id,
        nom: r.nom_manuel,
        ville: r.ville_manuel,
        adresse: r.adresse_manuel,
        type: "manuel",
        email: r.email_manuel,
        telephone: r.telephone_manuel,
        contact_nom: r.contact_manuel,
        actif: true,
        derniere_connexion: null,
        estManuel: true,
      },
    })),
  };
}

// Un client est considéré "actif" (connecté récemment) s'il a émis un
// heartbeat (voir Layout.jsx / enregistrerConnexion) dans les X dernières
// minutes — jamais un flag statique.
export const CONNEXION_RECENTE_MINUTES = 15;
export function estConnecteRecemment(derniere_connexion) {
  if (!derniere_connexion) return false;
  return Date.now() - new Date(derniere_connexion).getTime() < CONNEXION_RECENTE_MINUTES * 60 * 1000;
}

// Stock bas ("ruptures / besoins récents") d'un client réel — la policy
// med_select_distributeur_clients n'autorise cette lecture que pour un
// établissement réellement présent dans distributeur_clients.
export function useClientStockBas(client_etablissement_id) {
  return useQuery(() => {
    if (!client_etablissement_id) return Promise.resolve({ data: [], error: null });
    return supabase
      .from("medicaments")
      .select("id, nom, dosage, forme, stock_actuel, stock_minimum")
      .eq("etablissement_id", client_etablissement_id)
      .order("stock_actuel", { ascending: true })
      .limit(200);
  }, [client_etablissement_id]);
}

// ─── ordonnances ──────────────────────────────────────────────────────────────
export function useOrdonnances() {
  return useQuery(() =>
    supabase
      .from("ordonnances")
      .select(`
        id, reference, statut, date_emission, date_expiration, medecin_nom, notes,
        patients ( prenom, nom )
      `)
      .order("date_emission", { ascending: false })
      .limit(500)
  );
}

// ─── commandes ────────────────────────────────────────────────────────────────
// etablissement_id = null → voit tout (distributeur), sinon filtre par établissement
export function useCommandes(etablissement_id = null) {
  return useQuery(() => {
    let q = supabase
      .from("commandes")
      .select(`
        id, reference, statut, date_commande, date_livraison_prevue, montant_total, notes,
        etablissements!commandes_etablissement_id_fkey ( nom, ville ),
        fournisseurs ( nom )
      `)
      .order("date_commande", { ascending: false })
      .limit(500);
    if (etablissement_id) q = q.eq("etablissement_id", etablissement_id);
    return q;
  }, [etablissement_id]);
}

// ─── livraisons ───────────────────────────────────────────────────────────────
export function useLivraisons() {
  return useQuery(() =>
    supabase
      .from("livraisons")
      .select(`
        id, statut, date_depart, date_arrivee_prevue, date_arrivee_reelle,
        transporteur, numero_suivi, temperature_min, temperature_max, created_at,
        etablissements!livraisons_etablissement_id_fkey ( nom, ville ),
        fournisseurs ( nom )
      `)
      .order("created_at", { ascending: false })
      .limit(500)
  );
}

// ─── lots ─────────────────────────────────────────────────────────────────────
export function useLots() {
  return useQuery(() =>
    supabase
      .from("lots")
      .select(`
        id, numero_lot, fabricant, date_fabrication, date_expiration, quantite_initiale, qr_code,
        medicaments ( nom, code )
      `)
      .order("date_expiration", { ascending: true })
      .limit(500)
  );
}

// ─── Ventes des 7 derniers jours (chart pharmacie) ───────────────────────────
export function useVentes7Jours() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const NOMS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    const jours = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      jours.push({ iso: d.toISOString().slice(0, 10), label: NOMS[d.getDay()] });
    }
    const debut = jours[0].iso + "T00:00:00";
    Promise.all([
      supabase.from("ventes").select("created_at, montant_total").gte("created_at", debut),
      supabase.from("ordonnances").select("date_emission").gte("date_emission", jours[0].iso),
    ]).then(([vRes, oRes]) => {
      const vm = {};
      (vRes.data ?? []).forEach((v) => {
        const d = v.created_at?.slice(0, 10);
        if (d) vm[d] = (vm[d] ?? 0) + (v.montant_total ?? 0);
      });
      const om = {};
      (oRes.data ?? []).forEach((o) => {
        const d = o.date_emission;
        if (d) om[d] = (om[d] ?? 0) + 1;
      });
      setData(jours.map((j) => ({
        day: j.label,
        ventes: Math.round(vm[j.iso] ?? 0),
        ordonnances: om[j.iso] ?? 0,
      })));
      setLoading(false);
    });
  }, []);
  return { data, loading };
}

// ─── KPI pharmacie ────────────────────────────────────────────────────────────
export function useKpiPharmacie() {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10) + "T00:00:00";
    Promise.all([
      supabase.from("medicaments").select("id, stock_actuel, stock_minimum"),
      supabase.from("patients").select("id", { count: "exact", head: true }),
      supabase.from("alertes").select("id").eq("resolu", false),
      supabase.from("ordonnances").select("id").eq("statut", "en_attente"),
      supabase.from("ventes").select("montant_total").gte("created_at", today),
    ]).then(([meds, pats, alts, ords, ventes]) => {
      const all = meds.data ?? [];
      const ruptures = all.filter((m) => m.stock_actuel < m.stock_minimum).length;
      const ventesJour = (ventes.data ?? []).reduce((s, v) => s + (v.montant_total ?? 0), 0);
      setState({
        data: {
          totalMedicaments: all.length,
          ruptures,
          totalPatients: pats.count ?? 0,
          alertesActives: alts.data?.length ?? 0,
          ordonnancesEnAttente: ords.data?.length ?? 0,
          ventesJour,
        },
        loading: false,
        error: meds.error ?? pats.error ?? alts.error ?? null,
      });
    });
  }, []);
  return state;
}

// ─── KPI hôpital ─────────────────────────────────────────────────────────────
export function useKpiHopital() {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  useEffect(() => {
    Promise.all([
      supabase.from("hospitalisations").select("id", { count: "exact", head: true }).eq("statut", "hospitalise"),
      supabase.from("alertes").select("id, severite").eq("resolu", false),
      supabase.from("medicaments").select("id, stock_actuel"),
      supabase.from("ordonnances").select("id"),
    ]).then(([pats, alts, meds, ords]) => {
      const dispenses = (meds.data ?? []).reduce((s, m) => s + (m.stock_actuel ?? 0), 0);
      const alertesCritiques = (alts.data ?? []).filter((a) => a.severite === "critique").length;
      setState({
        data: {
          patientsHospitalises: pats.count ?? 0,
          alertesCritiques,
          medicamentsDispenses: dispenses,
          totalAlertes: alts.data?.length ?? 0,
          ordonnancesTotal: ords.data?.length ?? 0,
        },
        loading: false,
        error: null,
      });
    });
  }, []);
  return state;
}

// ─── KPI distributeur ─────────────────────────────────────────────────────────
export function useKpiDistributeur() {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  useEffect(() => {
    Promise.all([
      supabase.from("commandes").select("id, statut, montant_total"),
      supabase.from("distributeur_clients").select("id", { count: "exact", head: true }),
      supabase.from("livraisons").select("id, statut"),
    ]).then(([cmds, dc, livs]) => {
      const allCmds = cmds.data ?? [];
      const actives = allCmds.filter((c) => !["livree","annulee"].includes(c.statut)).length;
      const ca = allCmds.reduce((s, c) => s + (c.montant_total ?? 0), 0);
      const clients = dc.count ?? 0;
      const enTransit = (livs.data ?? []).filter((l) => l.statut === "en_transit").length;
      setState({
        data: { commandesActives: actives, clients, ca, livraisonsEnCours: enTransit },
        loading: false, error: null,
      });
    });
  }, []);
  return state;
}

// ─── KPI autorité ─────────────────────────────────────────────────────────────
export function useKpiAutorite() {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  useEffect(() => {
    Promise.all([
      supabase.from("etablissements").select("id, actif").eq("actif", true),
      supabase.from("alertes").select("id, severite").eq("resolu", false),
      supabase.from("medicaments").select("id"),
      supabase.from("lots").select("id"),
    ]).then(([etabs, alts, meds, lots]) => {
      const pharmacovig = (alts.data ?? []).filter((a) => a.severite === "critique").length;
      setState({
        data: {
          structuresActives: etabs.data?.length ?? 0,
          alertesPharmacovig: pharmacovig,
          medicamentsTraces: meds.data?.length ?? 0,
          lots: lots.data?.length ?? 0,
        },
        loading: false, error: null,
      });
    });
  }, []);
  return state;
}

// ─── alertes contrefaçons ─────────────────────────────────────────────────────
export function useContrefacons() {
  return useQuery(() =>
    supabase
      .from("alertes")
      .select("*")
      .eq("type", "contrefacon")
      .order("created_at", { ascending: false })
      .limit(500)
  );
}

// ─── commandes en temps réel (INSERT + UPDATE) ────────────────────────────────
const COMMANDES_SELECT = `
  id, reference, statut, date_commande, date_livraison_prevue, montant_total, notes,
  etablissements!commandes_etablissement_id_fkey ( nom, ville ),
  fournisseurs ( nom )
`.trim();

// etablissement_id = null → distributeur (voit tout), sinon filtre par établissement
export function useCommandesRealtime(etablissement_id = null) {
  const [state, setState] = useState({ data: [], loading: true, error: null });
  const channelRef = useRef(null);
  const etabRef = useRef(etablissement_id);
  useEffect(() => { etabRef.current = etablissement_id; }, [etablissement_id]);

  useEffect(() => {
    // Chargement initial
    let q = supabase
      .from("commandes")
      .select(COMMANDES_SELECT)
      .order("date_commande", { ascending: false });
    if (etablissement_id) q = q.eq("etablissement_id", etablissement_id);
    q.then(({ data, error }) =>
      setState({ data: data ?? [], loading: false, error: error ?? null })
    );

    async function fetchOne(id) {
      const { data } = await supabase
        .from("commandes")
        .select(COMMANDES_SELECT)
        .eq("id", id)
        .single();
      return data;
    }

    const channelName = etablissement_id
      ? `commandes:realtime:${etablissement_id}`
      : "commandes:realtime:full";

    const ch = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "commandes" },
        async (p) => {
          if (etabRef.current && p.new.etablissement_id !== etabRef.current) return;
          const row = await fetchOne(p.new.id);
          if (row) setState((prev) => ({ ...prev, data: [row, ...prev.data] }));
        }
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "commandes" },
        async (p) => {
          if (etabRef.current && p.new.etablissement_id !== etabRef.current) return;
          const row = await fetchOne(p.new.id);
          if (row)
            setState((prev) => ({
              ...prev,
              data: prev.data.map((c) => (c.id === row.id ? row : c)),
            }));
        }
      )
      .subscribe();

    channelRef.current = ch;
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [etablissement_id]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}

// ─── alertes en temps réel (INSERT) ──────────────────────────────────────────
export function useAlertesRealtime(limit = 20) {
  const [state, setState] = useState({ data: [], loading: true, error: null });
  const channelRef = useRef(null);
  // Capture limit dans un ref pour que le callback Realtime ne stale pas
  const limitRef = useRef(limit);
  useEffect(() => { limitRef.current = limit; }, [limit]);

  useEffect(() => {
    supabase
      .from("alertes")
      .select("id, type, severite, titre, message, lu, resolu, created_at, medicament_id")
      .eq("resolu", false)
      .order("created_at", { ascending: false })
      .limit(limit)
      .then(({ data, error }) =>
        setState({ data: data ?? [], loading: false, error: error ?? null })
      );

    const ch = supabase
      .channel("alertes:realtime:full")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alertes" },
        (p) => {
          setState((prev) => ({
            ...prev,
            data: [p.new, ...prev.data].slice(0, limitRef.current),
          }));
        }
      )
      .subscribe();

    channelRef.current = ch;
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [limit]);

  return state;
}
