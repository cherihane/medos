/**
 * useCachedQuery — lecture "cache-first" pour un écran câblé sur le moteur
 * hors-ligne (Phase 1+). Contrairement aux hooks de src/hooks/useSupabaseData.js
 * (toujours réseau), celui-ci relit la dernière copie connue en IndexedDB quand
 * `online` est faux, et rafraîchit le cache automatiquement dès que la connexion
 * revient (comportement demandé par la mission hors-ligne, point 2 de la Phase 0).
 *
 * `key` doit inclure l'établissement (ex: `medicaments:${etablissement_id}`) pour
 * ne jamais mélanger le cache de deux établissements sur le même poste.
 * `fetchFn` est un async () => tableau (pas un query builder Supabase brut) — à
 * l'appelant de faire `.select(...)` et de lancer en cas d'erreur.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useNetwork } from "../context/NetworkContext";
import { cacheFirstOrNetwork, setCached } from "./cache";

export function useCachedQuery(key, fetchFn, deps = []) {
  const { online } = useNetwork();
  const [state, setState] = useState({ data: [], loading: true, error: null, fromCache: false, cachedAt: null });
  const [tick, setTick] = useState(0);
  const refetch = useCallback(() => setTick((t) => t + 1), []);
  const fetchRef = useRef(fetchFn);
  useEffect(() => { fetchRef.current = fetchFn; });

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    cacheFirstOrNetwork(key, online, () => fetchRef.current())
      .then((res) => {
        if (cancelled) return;
        setState({ data: res.value ?? [], loading: false, error: null, fromCache: res.fromCache, cachedAt: res.cachedAt ?? null });
      })
      .catch((error) => {
        if (cancelled) return;
        setState((s) => ({ ...s, loading: false, error }));
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, online, tick, ...deps]);

  // Applique une modification optimiste locale (ex: décrément de stock après une
  // vente hors-ligne) — met à jour l'état ET le cache IndexedDB, pour qu'un
  // rechargement de page pendant la même coupure garde la valeur ajustée.
  const mutateLocalCache = useCallback((updater) => {
    setState((s) => {
      const nextData = updater(s.data);
      setCached(key, nextData);
      return { ...s, data: nextData };
    });
  }, [key]);

  return { ...state, refetch, mutateLocalCache };
}
