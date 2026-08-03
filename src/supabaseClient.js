import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://yehqmvwmosskumbegzty.supabase.co";
const supabaseKey =
  "sb_publishable_d0hgwt-SF7pzOswk-JVvZA_CkLm-4nI";

// Identifiant unique par onglet, persistant en sessionStorage (jamais partage entre onglets,
// contrairement a localStorage) — isole la session Supabase Auth de CET onglet. Sans ce scoping,
// tous les onglets partagent la meme session (localStorage) et le meme BroadcastChannel de
// synchronisation multi-onglets d'auth-js : un nouvel onglet herite automatiquement du compte
// actif d'un autre onglet, et une connexion/deconnexion ailleurs bascule silencieusement
// l'identite active de cet onglet sans jamais changer son libelle/nav (voir DEBUG_PROGRESS.md,
// "Phase 0 — diagnostic des 2 failles de session").
const TAB_ID_KEY = "medos_tab_id";
function lireOuCreerTabId() {
  try {
    let id = window.sessionStorage.getItem(TAB_ID_KEY);
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
      window.sessionStorage.setItem(TAB_ID_KEY, id);
    }
    return id;
  } catch {
    return `${Date.now()}-${Math.random()}`;
  }
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storageKey: `sb-yehqmvwmosskumbegzty-auth-token-${lireOuCreerTabId()}`,
  },
});
