import { dbClear, STORE_QUEUE, STORE_CACHE } from "../db";
import { setCached, getCached, cacheFirstOrNetwork } from "../cache";

beforeEach(async () => {
  await dbClear(STORE_QUEUE);
  await dbClear(STORE_CACHE);
});

test("setCached puis getCached retourne la valeur avec un horodatage", async () => {
  await setCached("medicaments:etab-1", [{ id: 1, nom: "Paracétamol" }]);
  const row = await getCached("medicaments:etab-1");
  expect(row.value).toEqual([{ id: 1, nom: "Paracétamol" }]);
  expect(row.cachedAt).toBeDefined();
});

test("getCached retourne null si jamais mis en cache", async () => {
  expect(await getCached("inconnu")).toBeNull();
});

test("cacheFirstOrNetwork en ligne : lit le réseau et écrit en cache", async () => {
  const fetchFn = jest.fn().mockResolvedValue([{ id: 1 }]);
  const res = await cacheFirstOrNetwork("stock:etab-1", true, fetchFn);
  expect(fetchFn).toHaveBeenCalledTimes(1);
  expect(res.fromCache).toBe(false);
  expect(res.value).toEqual([{ id: 1 }]);
  const cached = await getCached("stock:etab-1");
  expect(cached.value).toEqual([{ id: 1 }]);
});

test("cacheFirstOrNetwork hors-ligne : retourne la dernière copie en cache sans appeler le réseau", async () => {
  await setCached("stock:etab-1", [{ id: 2, nom: "Amoxicilline" }]);
  const fetchFn = jest.fn();
  const res = await cacheFirstOrNetwork("stock:etab-1", false, fetchFn);
  expect(fetchFn).not.toHaveBeenCalled();
  expect(res.fromCache).toBe(true);
  expect(res.value).toEqual([{ id: 2, nom: "Amoxicilline" }]);
});

test("cacheFirstOrNetwork hors-ligne sans cache existant : signale 'empty' sans planter", async () => {
  const res = await cacheFirstOrNetwork("jamais-vu", false, jest.fn());
  expect(res.empty).toBe(true);
  expect(res.value).toBeNull();
});
