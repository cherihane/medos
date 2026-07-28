import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

const AuthContext = createContext(null);

// Rôle "actif" de CET onglet — sessionStorage n'est jamais partagé entre onglets
// (contrairement à localStorage), donc prioritaire sur user_metadata.role qui, lui,
// est un champ unique partagé par tout le compte Supabase Auth et peut être écrasé
// par une connexion faite dans un AUTRE onglet/session (voir DEBUG_PROGRESS.md,
// "changement de rôle involontaire au rafraîchissement").
const ROLE_SESSION_KEY = "medos_role_actif";
function lireRoleSession() {
  try { return window.sessionStorage.getItem(ROLE_SESSION_KEY); } catch { return null; }
}
function ecrireRoleSession(role) {
  try { window.sessionStorage.setItem(ROLE_SESSION_KEY, role); } catch { /* ignore */ }
}
function effacerRoleSession() {
  try { window.sessionStorage.removeItem(ROLE_SESSION_KEY); } catch { /* ignore */ }
}

// Chemins autorisés par role_interne. Absent = compte principal → tout est visible.
// /parametres est toujours inclus pour tous les rôles internes.
const NAV_INTERNE = {
  pharmacie: {
    "Gérant": null, // accès complet
    "Pharmacien": [
      "/pharmacie/dashboard",
      "/pharmacie/inventaire",
      "/pharmacie/ordonnances",
      "/pharmacie/patients",
      "/pharmacie/scanner",
    ],
    "Caissier": ["/pharmacie/caisse", "/pharmacie/scanner"],
  },
  hopital: {
    "Directeur": null,
    "Médecin": [
      "/hopital/dashboard",
      "/hopital/mes-consultations",
      "/hopital/patients",
      "/hopital/examens",
      "/hopital/renouvellements",
      "/hopital/transmission-garde",
      "/hopital/assistant",
      "/hopital/alertes",
      "/hopital/urgences",
      "/hopital/maternite",
      "/hopital/bloc",
      "/hopital/dietetique",
      "/hopital/transferts",
      "/hopital/planning",
    ],
    "Infirmière": [
      "/hopital/dashboard",
      "/hopital/mon-service",
      "/hopital/patients",
      "/hopital/lits",
      "/hopital/alertes",
      "/hopital/urgences",
      "/hopital/maternite",
      "/hopital/bloc",
      "/hopital/sterilisation",
      "/hopital/planning",
    ],
    "Sage-femme": [
      "/hopital/dashboard",
      "/hopital/maternite",
      "/hopital/patients",
      "/hopital/alertes",
      "/hopital/planning",
    ],
    "Secrétaire médicale": [
      "/hopital/dashboard",
      "/hopital/consultations",
      "/hopital/agenda",
      "/hopital/patients",
      "/hopital/facturation",
      "/hopital/caisse",
      "/hopital/planning",
    ],
    "Pharmacien hospitalier": [
      "/hopital/dashboard",
      "/hopital/stock",
      "/hopital/patients",
      "/hopital/scanner",
      "/hopital/alertes",
      "/hopital/fournisseurs",
      "/hopital/planning",
    ],
    "Laborantin": ["/hopital/dashboard", "/hopital/examens", "/hopital/alertes", "/hopital/planning"],
    "Radiologue": ["/hopital/dashboard", "/hopital/examens", "/hopital/alertes", "/hopital/planning"],
    "Caissier": ["/hopital/dashboard", "/hopital/caisse", "/hopital/facturation", "/hopital/planning"],
    "Aide-soignant": [
      "/hopital/dashboard",
      "/hopital/mon-service",
      "/hopital/lits",
      "/hopital/alertes",
      "/hopital/planning",
    ],
    Dieteticien: [
      "/hopital/dashboard",
      "/hopital/dietetique",
      "/hopital/alertes",
    ],
    Cuisiniere: [
      "/hopital/dashboard",
      "/hopital/dietetique",
      "/hopital/alertes",
    ],
    "Agent de sterilisation": [
      "/hopital/dashboard",
      "/hopital/sterilisation",
      "/hopital/alertes",
    ],
  },
  distributeur: {
    "Directeur": null,
    "Commercial": [
      "/distributeur/dashboard",
      "/distributeur/reseau-clients",
      "/distributeur/clients",
      "/distributeur/previsions",
    ],
    "Logistique": [
      "/distributeur/entrepot",
      "/distributeur/livraisons",
      "/distributeur/tracabilite",
    ],
  },
  autorite: {
    "Ministre": null,
    "Inspecteur": null,
    "Analyste": null,
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
      { path: "/pharmacie/alertes", label: "Alertes", icon: "alertes" },
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
      { path: "/hopital/dashboard", label: "Dashboard", icon: "dashboard" },
      { path: "/hopital/rapports", label: "Rapports", icon: "rapports" },

      // ── Patients et soins
      { type: "separator", label: "Patients et soins" },
      {
        path: "/hopital/consultations",
        label: "Consultations",
        icon: "consultations",
      },
      { path: "/hopital/agenda", label: "Agenda RDV", icon: "agenda" },
      { path: "/hopital/patients", label: "Patients", icon: "patients" },
      {
        path: "/hopital/mes-consultations",
        label: "Mes consultations",
        icon: "patients",
      },
      { path: "/hopital/examens", label: "Examens / Labo", icon: "examens" },
      { path: "/hopital/lits", label: "Gestion des lits", icon: "lits" },
      {
        path: "/hopital/mon-service",
        label: "Mon service",
        icon: "mon-service",
      },
      { path: "/hopital/urgences", label: "Urgences", icon: "urgences" },
      { path: "/hopital/maternite", label: "Maternité", icon: "maternite" },
      { path: "/hopital/pediatrie", label: "Pédiatrie", icon: "pediatrie" },
      { path: "/hopital/bloc", label: "Bloc opératoire", icon: "bloc" },
      { path: "/hopital/dietetique", label: "Diététique", icon: "dietetique" },
      {
        path: "/hopital/sterilisation",
        label: "Stérilisation",
        icon: "sterilisation",
      },

      // ── Personnel
      { type: "separator", label: "Personnel" },
      { path: "/hopital/planning", label: "Planning gardes", icon: "planning" },
      {
        path: "/hopital/transmission-garde",
        label: "Transmission garde",
        icon: "transmission",
      },
      {
        path: "/hopital/renouvellements",
        label: "Renouvellements",
        icon: "renouvellements",
      },

      // ── Stock
      { type: "separator", label: "Stock" },
      { path: "/hopital/stock", label: "Stock", icon: "inventaire" },
      {
        path: "/hopital/fournisseurs",
        label: "Fournisseurs",
        icon: "fournisseurs",
      },
      { path: "/hopital/scanner", label: "Scanner", icon: "scanner" },
      {
        path: "/hopital/predictions",
        label: "Prédictions IA",
        icon: "predictions",
      },

      // ── Finance
      { type: "separator", label: "Finance" },
      { path: "/hopital/caisse", label: "Caisse", icon: "caisse" },
      {
        path: "/hopital/facturation",
        label: "Facturation",
        icon: "facturation",
      },

      // ── Outils
      { type: "separator", label: "Outils" },
      { path: "/hopital/assistant", label: "Assistant IA", icon: "assistant" },
      { path: "/hopital/reseau", label: "Réseau", icon: "reseau" },
      { path: "/hopital/transferts", label: "Transferts patients", icon: "reseau" },
      { path: "/hopital/alertes", label: "Alertes", icon: "alertes" },
      { path: "/parametres", label: "Paramètres", icon: "parametres" },
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
      { path: "/distributeur/rapports", label: "Rapports", icon: "rapports" },
      { path: "/distributeur/facturation", label: "Facturation", icon: "facturation" },
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
    const roleSession = lireRoleSession();
    const role = (roleSession && roleConfig[roleSession]) ? roleSession : user?.user_metadata?.role;
    if (!role || !roleConfig[role]) return null;
    if (!roleSession) ecrireRoleSession(role); // première résolution pour cet onglet — la fige
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
          if (pendingSeparator) {
            result.push(pendingSeparator);
            pendingSeparator = null;
          }
          result.push(item);
        }
      }
      return result;
    })();

    // dashboardPath = premier item de nav autorisé (hors séparateurs et /parametres)
    const firstNav = nav.find((item) => item.type !== "separator" && item.path !== "/parametres");
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
          .select("etablissement_id, permissions_nav, actif")
          .eq("email", user.email)
          .eq("actif", true)
          .maybeSingle(),
      ]);
      if (!mounted?.current) return;
      setAuth((prev) => {
        if (!prev) return prev;
        const patch = {};
        // Propriétaire de l'établissement (email = etablissements.email) en priorité,
        // sinon membre du personnel invité (email = membres_personnel.email) — sans ce
        // repli, tout compte invité gardait etablissement_id à null pour toute la
        // session, bloquant en écriture (RLS) sans jamais pouvoir créer le moindre
        // enregistrement. Trouvé et corrigé en session 15 (audit Hôpital).
        if (etabRes.data?.id) patch.etablissement_id = etabRes.data.id;
        else if (membreRes.data?.etablissement_id) patch.etablissement_id = membreRes.data.etablissement_id;
        // Si le membre a des permissions custom, on filtre le nav selon celles-ci
        const perms = membreRes.data?.permissions_nav;
        if (Array.isArray(perms) && perms.length > 0) {
          const enrichNav = [];
          let pending = null;
          for (const item of prev.nav) {
            if (item.type === "separator") {
              pending = item;
            } else if (perms.includes(item.path)) {
              if (pending) {
                enrichNav.push(pending);
                pending = null;
              }
              enrichNav.push(item);
            }
          }
          patch.nav = enrichNav;
          const firstNav = patch.nav.find(
            (item) => item.type !== "separator" && item.path !== "/parametres",
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

    // Filet de sécurité : getSession() ne doit jamais bloquer l'affichage
    // indéfiniment. Fixé à 10s (et non 5s) car le public cible utilise parfois
    // des connexions lentes/instables — un délai trop court expulserait à
    // tort des sessions valides simplement lentes à confirmer.
    const timeout = new Promise((resolve) =>
      setTimeout(() => resolve({ timedOut: true }), 10000),
    );

    Promise.race([
      supabase.auth.getSession().then(({ data: { session } }) => ({ session })),
      timeout,
    ])
      .then((result) => {
        if (!mountedRef.current) return;
        if (result.timedOut) {
          setAuth(null);
          setLoading(false);
          return;
        }
        const base = result.session?.user ? buildAuthBase(result.session.user) : null;
        setAuth(base);
        setLoading(false); // ← immédiat, l'app s'affiche tout de suite
        if (base) enrichWithEtablissement(result.session.user, mountedRef);
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

      if (etab?.statut_inscription === "refusee") {
        await supabase.auth.signOut();
        throw new Error(
          "Votre demande d'accès a été refusée. Contactez contact@kelagroup.org pour plus d'informations.",
        );
      }
    }

    // Le rôle choisi explicitement dans ce formulaire fait toujours foi pour CET
    // onglet, quel que soit ce que porte encore user_metadata.role (voir buildAuthBase).
    ecrireRoleSession(role);
    const base = buildAuthBase(user);
    setAuth(base);
    if (base) enrichWithEtablissement(user, { current: true });
    return data;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    effacerRoleSession();
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
