import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

const AuthContext = createContext(null);

// Chemins autorisés par role_interne. Absent = compte principal → tout est visible.
// /parametres est toujours inclus pour tous les rôles internes.
const NAV_INTERNE = {
  pharmacie: {
    gerant: null, // accès complet
    pharmacien: [
      "/pharmacie/dashboard",
      "/pharmacie/inventaire",
      "/pharmacie/ordonnances",
      "/pharmacie/patients",
      "/pharmacie/scanner",
    ],
    caissier: ["/pharmacie/caisse", "/pharmacie/scanner"],
  },
  hopital: {
    directeur: null,
    medecin: [
      "/hopital/dashboard",
      "/hopital/mes-consultations",
      "/hopital/patients",
      "/hopital/examens",
      "/hopital/renouvellements",
      "/hopital/transmission-garde",
      "/hopital/assistant",
      "/hopital/alertes",
    ],
    infirmiere: [
      "/hopital/dashboard",
      "/hopital/mon-service",
      "/hopital/patients",
      "/hopital/lits",
      "/hopital/alertes",
    ],
    "Secrétaire médicale": [
      "/hopital/dashboard",
      "/hopital/consultations",
      "/hopital/agenda",
      "/hopital/patients",
      "/hopital/facturation",
      "/hopital/caisse",
    ],
    pharmacien_hospitalier: [
      "/hopital/dashboard",
      "/hopital/stock",
      "/hopital/patients",
      "/hopital/scanner",
      "/hopital/alertes",
    ],
    laborantin: [
      "/hopital/dashboard",
      "/hopital/examens",
      "/hopital/alertes",
    ],
    caissier: [
      "/hopital/dashboard",
      "/hopital/caisse",
      "/hopital/facturation",
    ],
    "Aide-soignant": [
      "/hopital/dashboard",
      "/hopital/mon-service",
      "/hopital/lits",
      "/hopital/alertes",
    ],
  },
  distributeur: {
    directeur: null,
    commercial: [
      "/distributeur/dashboard",
      "/distributeur/reseau-clients",
      "/distributeur/clients",
      "/distributeur/previsions",
    ],
    logistique: [
      "/distributeur/entrepot",
      "/distributeur/livraisons",
      "/distributeur/tracabilite",
    ],
  },
  autorite: {
    ministre: null,
    inspecteur: null,
    analyste: null,
  },
};

export const roleConfig = {
  pharmacie: {
    label: "Pharmacie",
    structure: "Votre Pharmacie",
    location: "",
    initial: "P",
    dashboardPath: "/pharmacie/dashboard",
    nav: [
      { path: "/pharmacie/dashboard", label: "Dashboard", icon: "dashboard" },
      { path: "/pharmacie/caisse", label: "Caisse", icon: "caisse" },
      {
        path: "/pharmacie/inventaire",
        label: "Inventaire",
        icon: "inventaire",
      },
      {
        path: "/pharmacie/ordonnances",
        label: "Ordonnances",
        icon: "ordonnances",
      },
      { path: "/pharmacie/patients", label: "Patients", icon: "patients" },
      {
        path: "/pharmacie/fournisseurs",
        label: "Fournisseurs",
        icon: "fournisseurs",
      },
      { path: "/pharmacie/credits", label: "Crédits", icon: "credits" },
      { path: "/pharmacie/rapports", label: "Rapports", icon: "rapports" },
      {
        path: "/pharmacie/mouvements",
        label: "Mouvements",
        icon: "mouvements",
      },
      {
        path: "/pharmacie/peremptions",
        label: "Péremptions",
        icon: "peremptions",
      },
      { path: "/pharmacie/scanner", label: "Scanner", icon: "scanner" },
      { path: "/parametres", label: "Paramètres", icon: "parametres" },
    ],
  },
  hopital: {
    label: "Hôpital",
    structure: "Votre Hôpital",
    location: "",
    initial: "H",
    dashboardPath: "/hopital/dashboard",
    nav: [
      // ── Vue globale
      { type: "separator", label: "Vue globale" },
      { path: "/hopital/dashboard",         label: "Dashboard",          icon: "dashboard"        },
      { path: "/hopital/rapports",           label: "Rapports",           icon: "rapports"         },

      // ── Patients et soins
      { type: "separator", label: "Patients et soins" },
      { path: "/hopital/consultations",      label: "Consultations",      icon: "consultations"    },
      { path: "/hopital/agenda",             label: "Agenda RDV",         icon: "agenda"           },
      { path: "/hopital/patients",           label: "Patients",           icon: "patients"         },
      { path: "/hopital/mes-consultations",  label: "Mes consultations",  icon: "patients"         },
      { path: "/hopital/examens",            label: "Examens / Labo",     icon: "examens"          },
      { path: "/hopital/lits",               label: "Gestion des lits",   icon: "lits"             },
      { path: "/hopital/mon-service",        label: "Mon service",        icon: "mon-service"      },

      // ── Personnel
      { type: "separator", label: "Personnel" },
      { path: "/hopital/planning",           label: "Planning gardes",    icon: "planning"         },
      { path: "/hopital/transmission-garde", label: "Transmission garde", icon: "transmission"     },
      { path: "/hopital/renouvellements",    label: "Renouvellements",    icon: "renouvellements"  },

      // ── Stock
      { type: "separator", label: "Stock" },
      { path: "/hopital/stock",              label: "Stock",              icon: "inventaire"       },
      { path: "/hopital/fournisseurs",       label: "Fournisseurs",       icon: "fournisseurs"     },
      { path: "/hopital/scanner",            label: "Scanner",            icon: "scanner"          },
      { path: "/hopital/predictions",        label: "Prédictions IA",     icon: "predictions"      },

      // ── Finance
      { type: "separator", label: "Finance" },
      { path: "/hopital/caisse",             label: "Caisse",             icon: "caisse"           },
      { path: "/hopital/facturation",        label: "Facturation",        icon: "facturation"      },

      // ── Outils
      { type: "separator", label: "Outils" },
      { path: "/hopital/assistant",          label: "Assistant IA",       icon: "assistant"        },
      { path: "/hopital/reseau",             label: "Réseau",             icon: "reseau"           },
      { path: "/hopital/alertes",            label: "Alertes",            icon: "alertes"          },
      { path: "/parametres",                 label: "Paramètres",         icon: "parametres"       },
    ],
  },
  distributeur: {
    label: "Distributeur",
    structure: "Votre Distributeur",
    location: "",
    initial: "D",
    dashboardPath: "/distributeur/dashboard",
    nav: [
      {
        path: "/distributeur/dashboard",
        label: "Dashboard",
        icon: "dashboard",
      },
      {
        path: "/distributeur/reseau-clients",
        label: "Réseau clients",
        icon: "reseau",
      },
      {
        path: "/distributeur/previsions",
        label: "Prévisions",
        icon: "previsions",
      },
      {
        path: "/distributeur/livraisons",
        label: "Livraisons",
        icon: "livraisons",
      },
      {
        path: "/distributeur/tracabilite",
        label: "Traçabilité",
        icon: "scanner",
      },
      { path: "/distributeur/entrepot", label: "Entrepôt", icon: "entrepot" },
      { path: "/distributeur/clients", label: "Clients", icon: "patients" },
      { path: "/distributeur/alertes", label: "Alertes", icon: "alertes" },
      { path: "/parametres", label: "Paramètres", icon: "parametres" },
    ],
  },
  autorite: {
    label: "Autorité",
    structure: "Votre Autorité Sanitaire",
    location: "",
    initial: "A",
    dashboardPath: "/autorite/vue-nationale",
    nav: [
      {
        path: "/autorite/vue-nationale",
        label: "Vue nationale",
        icon: "dashboard",
      },
      { path: "/autorite/cartographie", label: "Cartographie", icon: "carte" },
      { path: "/autorite/contrefacons", label: "Contrefaçons", icon: "shield" },
      {
        path: "/autorite/epidemiologie",
        label: "Épidémiologie",
        icon: "predictions",
      },
      { path: "/autorite/acteurs", label: "Acteurs", icon: "reseau" },
      {
        path: "/autorite/rapports-odd",
        label: "Rapports ODD",
        icon: "rapports",
      },
      { path: "/autorite/api", label: "API", icon: "api" },
      { path: "/parametres", label: "Paramètres", icon: "parametres" },
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
    const role_interne = user?.user_metadata?.role_interne ?? null;
    const config = roleConfig[role];

    // Filtrer nav selon role_interne (null = compte principal, accès complet)
    const allowedPaths = role_interne
      ? (NAV_INTERNE[role]?.[role_interne] ?? null)
      : null;
    const nav = (() => {
      if (!allowedPaths) return config.nav;
      const result = [];
      let pendingSeparator = null;
      for (const item of config.nav) {
        if (item.type === "separator") {
          pendingSeparator = item;
        } else if (allowedPaths.includes(item.path)) {
          if (pendingSeparator) { result.push(pendingSeparator); pendingSeparator = null; }
          result.push(item);
        }
      }
      return result;
    })();

    // dashboardPath = premier item de nav autorisé (hors /parametres)
    const firstNav = nav.find((item) => item.path !== "/parametres");
    const dashboardPath = firstNav ? firstNav.path : config.dashboardPath;

    return {
      role,
      role_interne,
      ...config,
      nav,
      dashboardPath,
      user,
      etablissement_id: null,
    };
  };

  // Étape 2 — enrichissement en arrière-plan avec etablissement_id + permissions custom
  const enrichWithEtablissement = async (user, mounted) => {
    try {
      const [etabRes, membreRes] = await Promise.all([
        supabase
          .from("etablissements")
          .select("id")
          .eq("email", user.email)
          .maybeSingle(),
        supabase
          .from("membres_personnel")
          .select("permissions_nav, actif")
          .eq("email", user.email)
          .eq("actif", true)
          .maybeSingle(),
      ]);
      if (!mounted?.current) return;
      setAuth((prev) => {
        if (!prev) return prev;
        const patch = {};
        if (etabRes.data?.id) patch.etablissement_id = etabRes.data.id;
        // Si le membre a des permissions custom, on filtre le nav selon celles-ci
        const perms = membreRes.data?.permissions_nav;
        if (Array.isArray(perms) && perms.length > 0) {
          const enrichNav = [];
          let pending = null;
          for (const item of prev.nav) {
            if (item.type === "separator") { pending = item; }
            else if (perms.includes(item.path)) {
              if (pending) { enrichNav.push(pending); pending = null; }
              enrichNav.push(item);
            }
          }
          patch.nav = enrichNav;
          const firstNav = patch.nav.find(
            (item) => item.path !== "/parametres",
          );
          if (firstNav) patch.dashboardPath = firstNav.path;
        }
        return { ...prev, ...patch };
      });
    } catch {
      // réseau indisponible — on continue sans enrichissement
    }
  };

  useEffect(() => {
    const mountedRef = { current: true };

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!mountedRef.current) return;
        const base = session?.user ? buildAuthBase(session.user) : null;
        setAuth(base);
        setLoading(false); // ← immédiat, l'app s'affiche tout de suite
        if (base) enrichWithEtablissement(session.user, mountedRef);
      })
      .catch(() => {
        if (mountedRef.current) setLoading(false);
      });

    // React to auth state changes (token refresh, sign-out, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mountedRef.current) return;
      const base = session?.user ? buildAuthBase(session.user) : null;
      setAuth(base);
      if (base) enrichWithEtablissement(session.user, mountedRef);
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * login(role, email, password)
   * - Tries signInWithPassword first.
   * - If the user doesn't exist yet, signs them up (first-time demo access).
   * - Always stores the chosen role in user_metadata.
   */
  const login = async (role, email, password) => {
    // Attempt sign-in
    let { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

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
          const retry = await supabase.auth.signInWithPassword({
            email,
            password,
          });
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

    // Vérifier le statut d'inscription avant d'autoriser l'accès.
    // Un compte en_attente ou refuse ne doit pas obtenir de session active.
    if (user?.email) {
      const { data: etab } = await supabase
        .from("etablissements")
        .select("statut_inscription")
        .eq("email", user.email)
        .maybeSingle();

      if (etab?.statut_inscription === "en_attente") {
        await supabase.auth.signOut();
        throw new Error(
          "Votre compte est en cours de validation. Vous recevrez un email dès qu'une décision sera prise.",
        );
      }

      if (etab?.statut_inscription === "refuse") {
        await supabase.auth.signOut();
        throw new Error(
          "Votre demande d'accès a été refusée. Contactez contact@kelagroup.org pour plus d'informations.",
        );
      }
    }

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
