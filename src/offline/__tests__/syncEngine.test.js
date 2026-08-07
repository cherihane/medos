/**
 * Test isolé et rigoureux du moteur de synchronisation (Phase 0, mission
 * hors-ligne) : file d'attente + rejeu à la reconnexion, avec et sans
 * conflit, avant toute application à un écran réel. useMutations.js est
 * mocké (aucun appel réseau réel) pour isoler la logique du moteur.
 */
import { dbClear, STORE_QUEUE, STORE_CACHE } from "../db";
import { enqueueAction, getQueue } from "../syncQueue";
import { runSync, discardQueuedConflict, retryQueuedConflict } from "../syncEngine";

jest.mock("../../hooks/useMutations", () => ({
  insertVentes: jest.fn(),
  decrementStock: jest.fn(),
  updateHospitalisationSiInchangee: jest.fn(),
}));
const mutations = require("../../hooks/useMutations");

beforeEach(async () => {
  await dbClear(STORE_QUEUE);
  await dbClear(STORE_CACHE);
  jest.clearAllMocks();
});

test("une action mise en file hors-ligne est bien en attente avant tout rejeu", async () => {
  mutations.insertVentes.mockResolvedValue([{ id: "v1" }]);
  await enqueueAction({ name: "insertVentes", args: [[{ id: 1 }]], description: "Vente TKT-1" });
  const queue = await getQueue();
  expect(queue).toHaveLength(1);
  expect(queue[0].status).toBe("pending");
  expect(mutations.insertVentes).not.toHaveBeenCalled(); // pas rejouée avant la reconnexion
});

test("au retour de connexion, runSync rejoue les actions dans l'ordre (FIFO) et vide la file en cas de succès", async () => {
  const order = [];
  mutations.insertVentes.mockImplementation(async (rows) => { order.push(rows[0].ref); return [{ id: rows[0].ref }]; });

  await enqueueAction({ name: "insertVentes", args: [[{ ref: "vente-1" }]] });
  await enqueueAction({ name: "insertVentes", args: [[{ ref: "vente-2" }]] });
  await enqueueAction({ name: "insertVentes", args: [[{ ref: "vente-3" }]] });

  const summary = await runSync();

  expect(order).toEqual(["vente-1", "vente-2", "vente-3"]);
  expect(summary).toEqual({ synced: 3, failed: 0, conflicts: 0, total: 3 });
  expect(await getQueue()).toHaveLength(0); // rien perdu, mais rien qui traîne non plus
});

test("une action qui échoue au rejeu (ex. stock insuffisant) reste en file avec statut 'error', ne bloque pas les suivantes", async () => {
  mutations.decrementStock.mockRejectedValueOnce(new Error("Stock insuffisant"));
  mutations.insertVentes.mockResolvedValue([{ id: "v1" }]);

  await enqueueAction({ name: "decrementStock", args: ["med-1", 5], description: "Décrément stock" });
  await enqueueAction({ name: "insertVentes", args: [[{ ref: "vente-1" }]], description: "Vente" });

  const summary = await runSync();
  expect(summary).toEqual({ synced: 1, failed: 1, conflicts: 0, total: 2 });

  const queue = await getQueue();
  expect(queue).toHaveLength(1);
  expect(queue[0].status).toBe("error");
  expect(queue[0].error).toBe("Stock insuffisant");
});

test("conflit détecté au rejeu (écriture conditionnelle SiInchangee) : l'action reste en file, statut 'conflict', jamais perdue silencieusement", async () => {
  mutations.updateHospitalisationSiInchangee.mockResolvedValue([]); // 0 ligne modifiée = quelqu'un d'autre a écrit entre-temps

  await enqueueAction({
    name: "updateHospitalisationSiInchangee",
    args: ["hospi-1", { statut: "hospitalise" }, "2026-08-07T10:00:00Z"],
    description: "Hospitalisation patient X",
  });

  const summary = await runSync();
  expect(summary).toEqual({ synced: 0, failed: 0, conflicts: 1, total: 1 });

  const queue = await getQueue();
  expect(queue).toHaveLength(1);
  expect(queue[0].status).toBe("conflict");
});

test("résolution de conflit — 'recharger' (discard) : l'action locale en attente est abandonnée", async () => {
  mutations.updateHospitalisationSiInchangee.mockResolvedValue([]);
  const item = await enqueueAction({ name: "updateHospitalisationSiInchangee", args: ["h1", {}, "t0"] });
  await runSync();
  await discardQueuedConflict(item.id);
  expect(await getQueue()).toHaveLength(0);
});

test("résolution de conflit — 'écraser quand même' (retry) : remise en pending puis synchronisée avec succès", async () => {
  mutations.updateHospitalisationSiInchangee
    .mockResolvedValueOnce([]) // 1er rejeu : conflit
    .mockResolvedValueOnce([{ id: "h1", statut: "hospitalise" }]); // 2e rejeu (après écrasement) : succès

  const item = await enqueueAction({ name: "updateHospitalisationSiInchangee", args: ["h1", { statut: "ambulatoire" }, "t0"] });
  await runSync();
  expect((await getQueue())[0].status).toBe("conflict");

  await retryQueuedConflict(item.id, ["h1", { statut: "hospitalise" }, "t1"]);
  const summary = await runSync();
  expect(summary.synced).toBe(1);
  expect(await getQueue()).toHaveLength(0);
});

test("deux appels concurrents à runSync ne rejouent pas la file deux fois", async () => {
  mutations.insertVentes.mockResolvedValue([{ id: "v1" }]);
  await enqueueAction({ name: "insertVentes", args: [[{ ref: "vente-1" }]] });

  // runSync() démarre de façon synchrone jusqu'à son premier await : le
  // verrou syncInFlight est donc déjà posé avant que ce 2e appel, lancé dans
  // le même tick, ne teste sa condition — pas besoin de contrôler le timing
  // du mock pour prouver la déduplication.
  const p1 = runSync();
  const p2 = runSync();
  await Promise.all([p1, p2]);

  expect(mutations.insertVentes).toHaveBeenCalledTimes(1);
});
