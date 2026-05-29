import { createContext, useContext, useState } from "react";

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

  const login = (role) => {
    setAuth({ role, ...roleConfig[role] });
  };

  const logout = () => setAuth(null);

  return (
    <AuthContext.Provider value={{ auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
