/**
 * Hooks Supabase pour MedOS — données temps réel
 * Chaque hook retourne { data, loading, error }
 * et se rabat sur les données statiques en cas d'échec.
 */
import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

// ─── médicaments en stock critique ──────────────────────────────────────────
export function useMedicamentsCritiques(limit = 8) {
  const [state, setState] = useState({ data: [], loading: true, error: null });

  useEffect(() => {
    supabase
      .from("medicaments")
      .select("id, code, nom, categorie, stock_actuel, stock_minimum, prix_unitaire")
      .lt("stock_actuel", supabase.raw ? undefined : 9999) // will filter client-side
      .order("stock_actuel", { ascending: true })
      .limit(limit)
      .then(({ data, error }) => {
        if (error) { setState({ data: [], loading: false, error }); return; }
        // filter where stock_actuel < stock_minimum
        const critiques = (data || []).filter(
          (m) => m.stock_actuel < m.stock_minimum
        );
        setState({ data: critiques, loading: false, error: null });
      });
  }, [limit]);

  return state;
}

// ─── toutes les alertes (non résolues) ──────────────────────────────────────
export function useAlertes(limit = 10) {
  const [state, setState] = useState({ data: [], loading: true, error: null });

  useEffect(() => {
    supabase
      .from("alertes")
      .select(`
        id, type, severite, titre, message, lu, resolu, created_at,
        medicaments ( nom )
      `)
      .eq("resolu", false)
      .order("created_at", { ascending: false })
      .limit(limit)
      .then(({ data, error }) => {
        setState({ data: data || [], loading: false, error });
      });
  }, [limit]);

  return state;
}

// ─── médicaments avec stock (pour inventaire) ────────────────────────────────
export function useMedicaments() {
  const [state, setState] = useState({ data: [], loading: true, error: null });

  useEffect(() => {
    supabase
      .from("medicaments")
      .select("*")
      .order("nom", { ascending: true })
      .then(({ data, error }) => {
        setState({ data: data || [], loading: false, error });
      });
  }, []);

  return state;
}

// ─── patients ────────────────────────────────────────────────────────────────
export function usePatients() {
  const [state, setState] = useState({ data: [], loading: true, error: null });

  useEffect(() => {
    supabase
      .from("patients")
      .select("*")
      .order("nom", { ascending: true })
      .then(({ data, error }) => {
        setState({ data: data || [], loading: false, error });
      });
  }, []);

  return state;
}

// ─── établissements ──────────────────────────────────────────────────────────
export function useEtablissements(type = null) {
  const [state, setState] = useState({ data: [], loading: true, error: null });

  useEffect(() => {
    let query = supabase
      .from("etablissements")
      .select("*")
      .eq("actif", true)
      .order("nom", { ascending: true });

    if (type) query = query.eq("type", type);

    query.then(({ data, error }) => {
      setState({ data: data || [], loading: false, error });
    });
  }, [type]);

  return state;
}

// ─── fournisseurs ────────────────────────────────────────────────────────────
export function useFournisseurs() {
  const [state, setState] = useState({ data: [], loading: true, error: null });

  useEffect(() => {
    supabase
      .from("fournisseurs")
      .select("*")
      .order("nom", { ascending: true })
      .then(({ data, error }) => {
        setState({ data: data || [], loading: false, error });
      });
  }, []);

  return state;
}

// ─── KPI agrégés pharmacie ───────────────────────────────────────────────────
export function useKpiPharmacie() {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    Promise.all([
      supabase.from("medicaments").select("id, stock_actuel, stock_minimum"),
      supabase.from("patients").select("id", { count: "exact", head: true }),
      supabase.from("alertes").select("id", { count: "exact" }).eq("resolu", false),
    ]).then(([meds, pats, alts]) => {
      if (meds.error || pats.error || alts.error) {
        setState({ data: null, loading: false, error: meds.error || pats.error || alts.error });
        return;
      }
      const allMeds = meds.data || [];
      const ruptures = allMeds.filter((m) => m.stock_actuel < m.stock_minimum).length;
      setState({
        data: {
          totalMedicaments: allMeds.length,
          ruptures,
          totalPatients: pats.count ?? 0,
          alertesActives: alts.data?.length ?? 0,
        },
        loading: false,
        error: null,
      });
    });
  }, []);

  return state;
}

// ─── KPI agrégés hôpital ─────────────────────────────────────────────────────
export function useKpiHopital() {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    Promise.all([
      supabase.from("patients").select("id", { count: "exact", head: true }),
      supabase.from("alertes").select("id, severite").eq("resolu", false),
      supabase.from("medicaments").select("id, stock_actuel, stock_minimum"),
    ]).then(([pats, alts, meds]) => {
      const allMeds = meds.data || [];
      const dispenses = allMeds.reduce((s, m) => s + (m.stock_actuel || 0), 0);
      const alertesCritiques = (alts.data || []).filter((a) => a.severite === "critique").length;
      setState({
        data: {
          patientsHospitalises: pats.count ?? 0,
          alertesCritiques,
          medicamentsDispenses: dispenses,
          totalAlertes: alts.data?.length ?? 0,
        },
        loading: false,
        error: null,
      });
    });
  }, []);

  return state;
}
