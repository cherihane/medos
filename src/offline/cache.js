/**
 * cache.js — Cache local (lecture) pour l'usage hors-ligne.
 * Clé conseillée : `${ressource}:${etablissement_id ?? "global"}` (ex: "medicaments:abc-123")
 * afin qu'un poste ne voie jamais les données en cache d'un autre établissement.
 */
import { dbGet, dbPut, dbDelete, dbGetAll, STORE_CACHE } from "./db";

export async function setCached(key, value) {
  await dbPut(STORE_CACHE, { key, value, cachedAt: new Date().toISOString() });
}

export async function getCached(key) {
  const row = await dbGet(STORE_CACHE, key);
  return row ?? null; // { key, value, cachedAt } ou null si jamais mis en cache
}

export async function deleteCached(key) {
  await dbDelete(STORE_CACHE, key);
}

export async function listCacheKeys() {
  const rows = await dbGetAll(STORE_CACHE);
  return rows.map((r) => r.key);
}

/**
 * cacheFirstOrNetwork — lit le réseau si `online`, écrit le résultat en cache,
 * sinon retourne la dernière copie en cache (avec son horodatage pour l'affichage
 * "données du DD/MM à HH:mm" côté écran). Ne lance jamais si le réseau échoue
 * en étant "online" (laisse l'appelant gérer l'erreur) : la bascule offline se
 * fait sur l'état réseau détecté, pas sur l'échec d'un fetch isolé.
 */
export async function cacheFirstOrNetwork(key, online, fetchFn) {
  if (online) {
    const value = await fetchFn();
    await setCached(key, value);
    return { value, fromCache: false, cachedAt: null };
  }
  const cached = await getCached(key);
  if (!cached) return { value: null, fromCache: true, cachedAt: null, empty: true };
  return { value: cached.value, fromCache: true, cachedAt: cached.cachedAt };
}
