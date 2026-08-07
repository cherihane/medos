import { dbClear, STORE_QUEUE, STORE_CACHE } from "../db";
import { enqueueAction, getQueue, getPendingCount, updateQueueItem, removeQueueItem } from "../syncQueue";

beforeEach(async () => {
  await dbClear(STORE_QUEUE);
  await dbClear(STORE_CACHE);
});

test("enqueueAction stocke une action en attente avec un statut initial 'pending'", async () => {
  const item = await enqueueAction({ name: "insertVentes", args: [[{ id: 1 }]], description: "Vente TKT-1" });
  expect(item.status).toBe("pending");
  expect(item.id).toBeDefined();
  expect(item.createdAt).toBeDefined();
});

test("getQueue retourne les actions dans l'ordre de création (FIFO)", async () => {
  await enqueueAction({ name: "a", args: [], description: "1er" });
  await enqueueAction({ name: "b", args: [], description: "2e" });
  await enqueueAction({ name: "c", args: [], description: "3e" });
  const queue = await getQueue();
  expect(queue.map((i) => i.description)).toEqual(["1er", "2e", "3e"]);
});

test("getPendingCount compte pending/syncing/error mais pas conflict", async () => {
  const a = await enqueueAction({ name: "a", args: [] });
  const b = await enqueueAction({ name: "b", args: [] });
  await updateQueueItem(b.id, { status: "conflict" });
  expect(await getPendingCount()).toBe(1);
});

test("updateQueueItem modifie un champ sans perdre les autres", async () => {
  const item = await enqueueAction({ name: "a", args: [1, 2] });
  const updated = await updateQueueItem(item.id, { status: "error", error: "boom" });
  expect(updated.status).toBe("error");
  expect(updated.error).toBe("boom");
  expect(updated.args).toEqual([1, 2]);
});

test("removeQueueItem retire l'action de la file", async () => {
  const item = await enqueueAction({ name: "a", args: [] });
  await removeQueueItem(item.id);
  const queue = await getQueue();
  expect(queue.find((i) => i.id === item.id)).toBeUndefined();
});
