/**
 * usePrevisionsDistributeur — tendances réelles internes à MedOS pour le
 * distributeur : volume de commandes passées aux fabricants (12 derniers
 * mois, par médicament et par mois) + ruptures récurrentes chez les clients
 * connectés (stock bas actuel + fréquence de leurs commandes vers ce
 * distributeur). Aucun appel externe, aucune donnée inventée — uniquement
 * des agrégations sur `commandes`/`commande_lignes`/`distributeur_clients`/
 * `medicaments` déjà en base.
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";

export const MOIS_LABELS_COURT = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

function ilyA12Mois() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString();
}

// Regroupe une liste de lignes {medicament_nom, quantite, date} par médicament,
// avec le volume par mois calendaire (0-11) sur la fenêtre glissante de 12 mois —
// pas d'agrégation entre années puisque la fenêtre ne couvre jamais deux fois le
// même mois.
function regrouperParMedicamentEtMois(lignes) {
  const parMedicament = new Map();
  for (const l of lignes) {
    const d = new Date(l.date);
    if (isNaN(d) || !l.medicament_nom) continue;
    const nom = l.medicament_nom;
    if (!parMedicament.has(nom)) {
      parMedicament.set(nom, { nom, parMois: Array(12).fill(0), moisDistincts: new Set(), total: 0 });
    }
    const entry = parMedicament.get(nom);
    const qte = Number(l.quantite) || 0;
    entry.parMois[d.getMonth()] += qte;
    entry.moisDistincts.add(`${d.getFullYear()}-${d.getMonth()}`);
    entry.total += qte;
  }
  return Array.from(parMedicament.values()).map((m) => {
    const moisAvecVolume = m.parMois.filter((q) => q > 0).length;
    const moyenneMensuelle = m.total / 12;
    // Un pic saisonnier = un mois nettement au-dessus de la moyenne (>= 1.5x),
    // et il faut au moins 2 mois distincts de commandes pour parler de "tendance"
    // plutôt que d'un simple point isolé.
    const pics = m.parMois
      .map((qte, mois) => ({ mois, qte }))
      .filter((x) => x.qte > 0 && x.qte >= moyenneMensuelle * 1.5)
      .sort((a, b) => b.qte - a.qte);
    return {
      nom: m.nom,
      total: m.total,
      parMois: m.parMois,
      moisDistincts: m.moisDistincts.size,
      moisAvecVolume,
      pics,
      tendanceFiable: m.moisDistincts.size >= 3 && pics.length > 0,
    };
  }).sort((a, b) => b.total - a.total);
}

async function fetchLignesCommandesFabricants(etablissement_id) {
  const { data: commandes, error } = await supabase
    .from("commandes")
    .select("id, date_commande")
    .eq("etablissement_id", etablissement_id)
    .not("fabricant_id", "is", null)
    .gte("date_commande", ilyA12Mois());
  if (error || !commandes?.length) return { lignes: [], nbCommandes: 0 };

  const dateParCommande = Object.fromEntries(commandes.map((c) => [c.id, c.date_commande]));
  const { data: lignes } = await supabase
    .from("commande_lignes")
    .select("commande_id, medicament_nom, quantite")
    .in("commande_id", commandes.map((c) => c.id));

  return {
    nbCommandes: commandes.length,
    lignes: (lignes ?? []).map((l) => ({
      medicament_nom: l.medicament_nom,
      quantite: l.quantite,
      date: dateParCommande[l.commande_id],
    })),
  };
}

async function fetchLignesCommandesClients(etablissement_id) {
  const { data: commandes, error } = await supabase
    .from("commandes")
    .select("id, date_commande, etablissement_id")
    .eq("distributeur_id", etablissement_id)
    .gte("date_commande", ilyA12Mois());
  if (error || !commandes?.length) return { lignes: [], nbCommandes: 0, nbClientsDistincts: 0 };

  const dateParCommande = Object.fromEntries(commandes.map((c) => [c.id, c.date_commande]));
  const { data: lignes } = await supabase
    .from("commande_lignes")
    .select("commande_id, medicament_nom, quantite")
    .in("commande_id", commandes.map((c) => c.id));

  return {
    nbCommandes: commandes.length,
    nbClientsDistincts: new Set(commandes.map((c) => c.etablissement_id)).size,
    lignes: (lignes ?? []).map((l) => ({
      medicament_nom: l.medicament_nom,
      quantite: l.quantite,
      date: dateParCommande[l.commande_id],
    })),
  };
}

// Stock actuel des clients réellement liés (distributeur_clients) — combien
// de clients distincts sont sous leur propre seuil minimum, par médicament.
// C'est le même mécanisme déjà utilisé pour la fiche client individuelle
// (policy `med_select_distributeur_clients`), agrégé ici sur tous les clients.
async function fetchRuptureBasseClients(etablissement_id) {
  const { data: clients } = await supabase
    .from("distributeur_clients")
    .select("client_etablissement_id")
    .eq("distributeur_id", etablissement_id);
  const clientIds = (clients ?? []).map((c) => c.client_etablissement_id);
  if (clientIds.length === 0) return { parMedicament: [], nbClients: 0 };

  const { data: meds } = await supabase
    .from("medicaments")
    .select("nom, stock_actuel, stock_minimum, etablissement_id")
    .in("etablissement_id", clientIds);

  const parNom = new Map();
  for (const m of meds ?? []) {
    if ((m.stock_actuel ?? 0) >= (m.stock_minimum ?? 0)) continue; // pas en rupture
    if (!parNom.has(m.nom)) parNom.set(m.nom, { nom: m.nom, clientsEnRupture: new Set() });
    parNom.get(m.nom).clientsEnRupture.add(m.etablissement_id);
  }
  return {
    nbClients: clientIds.length,
    parMedicament: Array.from(parNom.values())
      .map((x) => ({ nom: x.nom, nbClientsEnRupture: x.clientsEnRupture.size }))
      .sort((a, b) => b.nbClientsEnRupture - a.nbClientsEnRupture),
  };
}

/**
 * Hook principal — usage : const { data, loading, error } = usePrevisionsDistributeur(etablissement_id)
 * data = {
 *   tendancesFabricants: [...],   // vos commandes vers vos fabricants, par médicament/mois
 *   nbCommandesFabricants,
 *   tendancesClients: [...],      // commandes de vos clients vers vous, par médicament/mois
 *   nbCommandesClients, nbClientsAvecCommande,
 *   ruptureClients: { nbClients, parMedicament },  // stock bas actuel chez vos clients
 * }
 */
export function usePrevisionsDistributeur(etablissement_id) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  const charger = useCallback(async () => {
    if (!etablissement_id) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [fab, cli, rupture] = await Promise.all([
        fetchLignesCommandesFabricants(etablissement_id),
        fetchLignesCommandesClients(etablissement_id),
        fetchRuptureBasseClients(etablissement_id),
      ]);
      setState({
        data: {
          tendancesFabricants: regrouperParMedicamentEtMois(fab.lignes),
          nbCommandesFabricants: fab.nbCommandes,
          tendancesClients: regrouperParMedicamentEtMois(cli.lignes),
          nbCommandesClients: cli.nbCommandes,
          nbClientsAvecCommande: cli.nbClientsDistincts ?? 0,
          ruptureClients: rupture,
        },
        loading: false,
        error: null,
      });
    } catch (err) {
      setState({ data: null, loading: false, error: err.message });
    }
  }, [etablissement_id]);

  useEffect(() => { charger(); }, [charger]);

  return { ...state, refetch: charger };
}
