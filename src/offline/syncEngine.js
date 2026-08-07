/**
 * syncEngine.js — Rejoue la file d'attente locale au retour de connexion.
 *
 * Ordre : FIFO par date de création (getQueue trie déjà par createdAt).
 * Un échec ou un conflit sur une action n'empêche pas le rejeu des suivantes
 * (chaque action est indépendante) — l'action concernée reste visible dans la
 * file avec un statut "error"/"conflict" tant qu'elle n'est pas résolue, jamais
 * supprimée silencieusement.
 */
import { getQueue, updateQueueItem, removeQueueItem } from "./syncQueue";
import { getMutation, isConditionalMutation } from "./mutationRegistry";

let syncInFlight = null;

export async function runSync(callbacks = {}) {
  // Évite deux rejeux concurrents (ex. event "online" + appel manuel "Synchroniser")
  if (syncInFlight) return syncInFlight;
  syncInFlight = doRunSync(callbacks);
  try {
    return await syncInFlight;
  } finally {
    syncInFlight = null;
  }
}

async function doRunSync({ onItemStart, onItemSynced, onItemError, onItemConflict } = {}) {
  const queue = await getQueue();
  const toReplay = queue.filter((item) => item.status === "pending" || item.status === "error");
  const summary = { synced: 0, failed: 0, conflicts: 0, total: toReplay.length };

  for (const item of toReplay) {
    await updateQueueItem(item.id, { status: "syncing", error: null });
    onItemStart?.(item);
    try {
      const fn = getMutation(item.name);
      const result = await fn(...item.args);

      if (isConditionalMutation(item.name) && Array.isArray(result) && result.length === 0) {
        await updateQueueItem(item.id, { status: "conflict", conflictData: result });
        summary.conflicts += 1;
        onItemConflict?.(item);
        continue;
      }

      await removeQueueItem(item.id);
      summary.synced += 1;
      onItemSynced?.(item, result);
    } catch (e) {
      await updateQueueItem(item.id, { status: "error", error: e?.message ?? String(e) });
      summary.failed += 1;
      onItemError?.(item, e);
    }
  }

  return summary;
}

// Résolution d'un conflit détecté au rejeu — même principe que la modal
// "écraser / recharger" déjà en place sur Hospitalisation (Patients.jsx) :
//  - discardQueuedConflict : l'utilisateur choisit de recharger les valeurs
//    serveur les plus récentes → l'action locale en attente est abandonnée.
//  - retryQueuedConflict : l'utilisateur choisit d'écraser quand même → l'action
//    est remise en "pending" avec de nouveaux arguments (ex. upsert non
//    conditionnel, ou nouvel updated_at récupéré) pour être rejouée.
export async function discardQueuedConflict(id) {
  await removeQueueItem(id);
}

export async function retryQueuedConflict(id, newArgs) {
  await updateQueueItem(id, { status: "pending", args: newArgs, conflictData: null, error: null });
}
