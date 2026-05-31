import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

const AuthContext = createContext(null);

export const roleConfig = {
  pharmacie: {
    label: "Pharmacie",
    structure: "Pharmacie Lumière",
    location: "Abidjan, CI",
    initial: "P",
    dashboardPath: "/pharmacie/dashboard",
    nav: [
      { path: "/pharmacie/dashboard", label: "Dashboard", icon: "dashboard" },
      { path: "/pharmacie/caisse", label: "Caisse", icon: "caisse" },
      { path: "/pharmacie/inventaire", label: "Inventaire", icon: "inventaire" },
      { path: "/pharmacie/ordonnances", label: "Ordonnances", icon: "ordonnances" },
      { path: "/pharmacie/patients", label: "Patients", icon: "patients" },
      { path: "/pharmacie/fournisseurs", label: "Fournisseurs", icon: "fournisseurs" },
      { path: "/pharmacie/credits", label: "Crédits", icon: "credits" },
      { path: "/pharmacie/rapports", label: "Rapports", icon: "rapports" },
      { path: "/pharmacie/scanner", label: "Scanner", icon: "scanner" },
    ],
  },
  hopital: {
    label: "Hôpital",
    structure: "Hôpital Central Abidjan",
    location: "Abidjan, CI",
    initial: "H",
    dashboardPath: "/hopital/dashboard",
    nav: [
      { path: "/hopital/dashboard", label: "Dashboard", icon: "dashboard" },
      { path: "/hopital/stock", label: "Stock", icon: "inventaire" },
      { path: "/hopital/fournisseurs", label: "Fournisseurs", icon: "fournisseurs" },
      { path: "/hopital/predictions", label: "Prédictions IA", icon: "predictions" },
      { path: "/hopital/scanner", label: "Scanner", icon: "scanner" },
      { path: "/hopital/assistant", label: "Assistant IA", icon: "assistant" },
      { path: "/hopital/reseau", label: "Réseau", icon: "reseau" },
      { path: "/hopital/alertes", label: "Alertes", icon: "alertes" },
      { path: "/hopital/rapports", label: "Rapports", icon: "rapports" },
    ],
  },
  distributeur: {
    label: "Distributeur",
    structure: "MedDistrib International",
    location: "Abidjan, CI",
    initial: "D",
    dashboardPath: "/distributeur/dashboard",
    nav: [
      { path: "/distributeur/dashboard", label: "Dashboard", icon: "dashboard" },
      { path: "/distributeur/reseau-clients", label: "Réseau clients", icon: "reseau" },
      { path: "/distributeur/previsions", label: "Prévisions", icon: "previsions" },
      { path: "/distributeur/livraisons", label: "Livraisons", icon: "livraisons" },
      { path: "/distributeur/tracabilite", label: "Traçabilité", icon: "scanner" },
      { path: "/distributeur/entrepot", label: "Entrepôt", icon: "entrepot" },
      { path: "/distributeur/clients", label: "Clients", icon: "patients" },
      { path: "/distributeur/alertes", label: "Alertes", icon: "alertes" },
    ],
  },
  autorite: {
    label: "Autorité",
    structure: "Ministère de la Santé",
    location: "Yamoussoukro, CI",
    initial: "A",
    dashboardPath: "/autorite/vue-nationale",
    nav: [
      { path: "/autorite/vue-nationale", label: "Vue nationale", icon: "dashboard" },
      { path: "/autorite/cartographie", label: "Cartographie", icon: "carte" },
      { path: "/autorite/contrefacons", label: "Contrefaçons", icon: "shield" },
      { path: "/autorite/epidemiologie", label: "Épidémiologie", icon: "predictions" },
      { path: "/autorite/acteurs", label: "Acteurs", icon: "reseau" },
      { path: "/autorite/rapports-odd", label: "Rapports ODD", icon: "rapports" },
      { path: "/autorite/api", label: "API", icon: "api" },
    ],
  },
};

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(null);
  const [loading, setLoading] = useState(true);

  // Étape 1 — auth de base depuis user_metadata (synchrone, pas de réseau)
  const buildAuthBase = (user) => {
    const role = user?.user_metadata?.role;
    if (!role || !roleConfig[role]) return null;
    return { role, ...roleConfig[role], user, etablissement_id: null };
  };

  // Étape 2 — enrichissement en arrière-plan avec etablissement_id
  const enrichWithEtablissement = async (user, mounted) => {
    try {
      const { data } = await supabase
        .from("etablissements")
        .select("id")
        .eq("email", user.email)
        .maybeSingle();
      if (mounted?.current && data?.id) {
        setAuth((prev) => prev ? { ...prev, etablissement_id: data.id } : prev);
      }
    } catch {
      // réseau indisponible — on continue sans etablissement_id
    }
  };

  useEffect(() => {
    const mountedRef = { current: true };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mountedRef.current) return;
      const base = session?.user ? buildAuthBase(session.user) : null;
      setAuth(base);
      setLoading(false); // ← immédiat, l'app s'affiche tout de suite
      if (base) enrichWithEtablissement(session.user, mountedRef);
    }).catch(() => {
      if (mountedRef.current) setLoading(false);
    });

    // React to auth state changes (token refresh, sign-out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mountedRef.current) return;
        const base = session?.user ? buildAuthBase(session.user) : null;
        setAuth(base);
        if (base) enrichWithEtablissement(session.user, mountedRef);
      }
    );

    return () => { mountedRef.current = false; subscription.unsubscribe(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * login(role, email, password)
   * - Tries signInWithPassword first.
   * - If the user doesn't exist yet, signs them up (first-time demo access).
   * - Always stores the chosen role in user_metadata.
   */
  const login = async (role, email, password) => {
    // Attempt sign-in
    let { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (
        error.message.toLowerCase().includes("invalid login credentials") ||
        error.message.toLowerCase().includes("user not found") ||
        error.message.toLowerCase().includes("email not confirmed")
      ) {
        // First-time: create the account then sign in
        const signUpResult = await supabase.auth.signUp({
          email,
          password,
          options: { data: { role } },
        });
        if (signUpResult.error) throw signUpResult.error;
        data = signUpResult.data;

        // If email confirmation is required, signInWithPassword may still fail.
        // Try once more (works when email confirmation is disabled).
        if (!signUpResult.data.session) {
          const retry = await supabase.auth.signInWithPassword({ email, password });
          if (retry.error) throw retry.error;
          data = retry.data;
        }
      } else {
        throw error;
      }
    } else {
      // User exists — update role in metadata in case they switch roles
      await supabase.auth.updateUser({ data: { role } });
    }

    const user = data?.user ?? data?.session?.user;
    const base = buildAuthBase(user);
    setAuth(base);
    if (base) enrichWithEtablissement(user, { current: true });
    return data;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setAuth(null);
  };

  return (
    <AuthContext.Provider value={{ auth, login, logout, loading }}>
      {loading ? null : children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
