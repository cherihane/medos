/**
 * useStockAlert — Hook pour déclencher manuellement un test d'alerte
 * et surveiller les médicaments en rupture en temps réel (polling léger)
 */
import { useState, useCallback } from "react";
import { supabase } from "../supabaseClient";

const EDGE_FUNCTION_URL =
  "https://yehqmvwmosskumbegzty.supabase.co/functions/v1/check-stock-alert";

/**
 * Envoie un test d'alerte pour un médicament donné
 * Utile pour vérifier que la fonction Edge + Resend fonctionnent
 */
export function useTestAlert() {
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);

  const sendTestAlert = useCallback(async (medicament) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Récupérer le token de session pour authentifier l'appel
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(EDGE_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          type: "UPDATE",
          table: "medicaments",
          record: {
            id:            medicament.id,
            nom:           medicament.nom,
            code:          medicament.code,
            categorie:     medicament.categorie,
            stock_actuel:  medicament.stock_actuel ?? 0,
            stock_minimum: medicament.stock_minimum ?? 0,
          },
          old_record: {
            ...medicament,
            stock_actuel: (medicament.stock_actuel ?? 0) + 1,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { sendTestAlert, loading, result, error };
}

/**
 * Met à jour manuellement le stock d'un médicament dans Supabase
 * Le trigger DB enverra automatiquement l'alerte si stock < minimum
 */
export function useUpdateStock() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const updateStock = useCallback(async (medicamentId, newStock) => {
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase
        .from("medicaments")
        .update({ stock_actuel: newStock })
        .eq("id", medicamentId);
      if (err) throw new Error(err.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { updateStock, loading, error };
}
