/**
 * syncQueue.js — File d'attente locale des actions écrites hors-ligne.
 * Chaque action en attente est un enregistrement autonome et rejouable :
 * { id, name, args, description, module, etablissementId, createdAt, status, error, conflictData }
 *
 * status : "pending" (jamais tentée ou à retenter) | "syncing" (en cours de rejeu)
 *        | "conflict" (rejetée par une écriture conditionnelle SiInchangee — nécessite
 *          une décision de l'utilisateur, écraser/recharger) | "error" (échec définitif,
 *          ex. stock insuffisant constaté au rejeu — nécessite une action humaine)
 *
 * `name` référence une fonction dans mutationRegistry.js — jamais la fonction elle-même
 * (non sérialisable dans IndexedDB).
 */
import { dbPut, dbGetAll, dbDelete, STORE_QUEUE } from "./db";

export async function enqueueAction({ name, args, description, module, etablissementId }) {
  const item = {
    name,
    args,
    description: description ?? name,
    module: module ?? null,
    etablissementId: etablissementId ?? null,
    createdAt: new Date().toISOString(),
    status: "pending",
    error: null,
    conflictData: null,
  };
  const id = await dbPut(STORE_QUEUE, item);
  return { ...item, id };
}

export async function getQueue() {
  const rows = await dbGetAll(STORE_QUEUE);
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getPendingCount() {
  const rows = await getQueue();
  return rows.filter((r) => r.status === "pending" || r.status === "syncing").length;
}

export async function updateQueueItem(id, patch) {
  const rows = await dbGetAll(STORE_QUEUE);
  const existing = rows.find((r) => r.id === id);
  if (!existing) return null;
  const updated = { ...existing, ...patch, id };
  await dbPut(STORE_QUEUE, updated);
  return updated;
}

export async function removeQueueItem(id) {
  await dbDelete(STORE_QUEUE, id);
}
