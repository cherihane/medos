/**
 * networkStatus.js — Détection fiable de la connexion.
 * navigator.onLine seul ne suffit pas : il peut rester `true` sur un réseau
 * connecté mais sans accès internet réel (portail captif, Wi-Fi local sans
 * sortie internet). On le complète par une sonde réseau réelle vers le
 * backend Supabase (HEAD sur /rest/v1/, avec timeout court) : un succès OU un
 * échec HTTP (401/404...) prouve que le réseau fonctionne ; seule une erreur
 * réseau (fetch rejeté) ou un timeout signifie hors-ligne.
 */
import { supabaseUrl, supabaseKey } from "../supabaseClient";

const PROBE_TIMEOUT_MS = 4000;

export async function probeRealConnectivity() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  if (typeof fetch === "undefined") return true; // environnement de test sans fetch
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    await fetch(`${supabaseUrl}/rest/v1/`, {
      method: "HEAD",
      headers: { apikey: supabaseKey },
      cache: "no-store",
      signal: controller.signal,
    });
    return true; // toute réponse HTTP, même une erreur, prouve que le réseau fonctionne
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * subscribeNetworkStatus(onChange) — appelle onChange(boolean) à chaque
 * changement détecté. Retourne une fonction de désabonnement.
 */
export function subscribeNetworkStatus(onChange) {
  let cancelled = false;
  let pollTimer = null;

  const check = async () => {
    const online = await probeRealConnectivity();
    if (!cancelled) onChange(online);
    return online;
  };

  const handleBrowserOnline = () => check();
  const handleBrowserOffline = () => { if (!cancelled) onChange(false); };

  if (typeof window !== "undefined") {
    window.addEventListener("online", handleBrowserOnline);
    window.addEventListener("offline", handleBrowserOffline);
  }

  // Sonde périodique — détecte le cas "Wi-Fi connecté mais internet coupé",
  // que les seuls évènements online/offline du navigateur ne couvrent pas.
  pollTimer = setInterval(check, 30000);
  check();

  return () => {
    cancelled = true;
    if (typeof window !== "undefined") {
      window.removeEventListener("online", handleBrowserOnline);
      window.removeEventListener("offline", handleBrowserOffline);
    }
    clearInterval(pollTimer);
  };
}
