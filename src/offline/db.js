/**
 * db.js — Wrapper minimal autour d'IndexedDB pour le moteur hors-ligne MedOS.
 * Pas de dépendance externe : IndexedDB est disponible nativement dans tous
 * les navigateurs ciblés (voir browserslist). Une seule base, deux stores :
 *   - sync_queue : actions en attente de synchronisation (créations/modifs faites hors-ligne)
 *   - cache      : dernière copie connue des données lues (lecture hors-ligne)
 */

const DB_NAME = "medos_offline";
const DB_VERSION = 1;
export const STORE_QUEUE = "sync_queue";
export const STORE_CACHE = "cache";

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB indisponible dans cet environnement."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const queue = db.createObjectStore(STORE_QUEUE, { keyPath: "id", autoIncrement: true });
        queue.createIndex("status", "status", { unique: false });
        queue.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_CACHE)) {
        db.createObjectStore(STORE_CACHE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(storeName, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let result;
    Promise.resolve(fn(store))
      .then((r) => { result = r; })
      .catch(reject);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Transaction IndexedDB annulée."));
  });
}

export async function dbPut(storeName, value) {
  return withStore(storeName, "readwrite", (store) => reqToPromise(store.put(value)));
}

export async function dbGet(storeName, key) {
  return withStore(storeName, "readonly", (store) => reqToPromise(store.get(key)));
}

export async function dbGetAll(storeName) {
  return withStore(storeName, "readonly", (store) => reqToPromise(store.getAll()));
}

export async function dbDelete(storeName, key) {
  return withStore(storeName, "readwrite", (store) => reqToPromise(store.delete(key)));
}

export async function dbClear(storeName) {
  return withStore(storeName, "readwrite", (store) => reqToPromise(store.clear()));
}

// Réservé aux tests — force la réouverture d'une base fraîche entre les cas.
export function _resetDbConnectionForTests() {
  dbPromise = null;
}
