/**
 * SyncContext — pont entre l'état réseau, la file d'attente locale (IndexedDB)
 * et le moteur de rejeu. C'est le point d'entrée que les écrans utiliseront
 * (Phase 1+) pour écrire des données de façon transparente qu'on soit en
 * ligne ou non : `enqueueOrRun("insertVentes", [rows], { description, module })`.
 */
import { createContext, useContext, useEffect, useCallback, useState, useRef } from "react";
import { useNetwork } from "./NetworkContext";
import { getQueue, enqueueAction } from "../offline/syncQueue";
import { runSync, discardQueuedConflict, retryQueuedConflict } from "../offline/syncEngine";
import { getMutation } from "../offline/mutationRegistry";

const SyncContext = createContext(null);

export function SyncProvider({ children }) {
  const { online } = useNetwork();
  const [queue, setQueue] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const wasOnline = useRef(online);

  const refreshQueue = useCallback(async () => {
    try {
      setQueue(await getQueue());
    } catch {
      // IndexedDB indisponible (navigation privée stricte, quota...) — la file
      // reste vide en mémoire ; les écritures passeront directement en ligne,
      // et échoueront normalement (avec message d'erreur) si hors-ligne.
    }
  }, []);

  useEffect(() => { refreshQueue(); }, [refreshQueue]);

  const syncNow = useCallback(async () => {
    if (syncing) return null;
    setSyncing(true);
    try {
      const summary = await runSync({
        onItemStart: refreshQueue,
        onItemSynced: refreshQueue,
        onItemError: refreshQueue,
        onItemConflict: refreshQueue,
      });
      await refreshQueue();
      return summary;
    } finally {
      setSyncing(false);
    }
  }, [syncing, refreshQueue]);

  // Retour de connexion → rejeu automatique de la file en attente.
  useEffect(() => {
    if (online && !wasOnline.current) syncNow();
    wasOnline.current = online;
  }, [online, syncNow]);

  const enqueueOrRun = useCallback(async (name, args, meta = {}) => {
    if (online) {
      const fn = getMutation(name);
      return { queued: false, result: await fn(...args) };
    }
    const item = await enqueueAction({ name, args, ...meta });
    await refreshQueue();
    return { queued: true, item };
  }, [online, refreshQueue]);

  const resolveConflictDiscard = useCallback(async (id) => {
    await discardQueuedConflict(id);
    await refreshQueue();
  }, [refreshQueue]);

  const resolveConflictRetry = useCallback(async (id, newArgs) => {
    await retryQueuedConflict(id, newArgs);
    await refreshQueue();
    await syncNow();
  }, [refreshQueue, syncNow]);

  const pendingCount = queue.filter((i) => i.status === "pending" || i.status === "syncing" || i.status === "error").length;
  const conflicts = queue.filter((i) => i.status === "conflict");
  const errors = queue.filter((i) => i.status === "error");

  return (
    <SyncContext.Provider value={{
      online, queue, pendingCount, conflicts, errors, syncing,
      syncNow, enqueueOrRun, resolveConflictDiscard, resolveConflictRetry, refreshQueue,
    }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncQueue() {
  return useContext(SyncContext);
}
