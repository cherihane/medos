// Source unique de vérité pour toutes les constantes du module hôpital

export const SERVICES_HOPITAL = [
  "Médecine générale",
  "Urgences",
  "Maternité",
  "Pédiatrie",
  "Chirurgie",
  "Cardiologie",
  "Neurologie",
  "Ophtalmologie",
];

export const SERVICE_COLORS = {
  "Médecine générale": "#3B82F6",
  "Urgences":          "#DC2626",
  "Maternité":         "#EC4899",
  "Pédiatrie":         "#F59E0B",
  "Chirurgie":         "#8B5CF6",
  "Cardiologie":       "#EF4444",
  "Neurologie":        "#06B6D4",
  "Ophtalmologie":     "#10B981",
};

export const CRENEAUX_GARDE = [
  { key: "matin", label: "Matin",       debut: "06:00", fin: "14:00" },
  { key: "aprem", label: "Après-midi",  debut: "14:00", fin: "22:00" },
  { key: "nuit",  label: "Nuit",        debut: "22:00", fin: "06:00" },
];

// Rôles internes opérationnels pouvant être assignés comme "rôle de secours"
// ou demandés en accès élargi — Directeur en est volontairement exclu (voir
// migration 20260730_acces_elargi.sql : l'élévation ne mène jamais à un accès
// d'administration complète de l'établissement).
export const ROLES_SECOURS_HOPITAL = [
  "Médecin", "Infirmière", "Sage-femme", "Pharmacien hospitalier",
  "Secrétaire médicale", "Laborantin", "Caissier", "Aide-soignant",
  "Dieteticien", "Cuisiniere", "Agent de sterilisation", "Radiologue",
];

export const ROLES_PLANNING = [
  { value: "Médecin",               label: "Médecin",               color: "#16A34A", bg: "#DCFCE7" },
  { value: "Infirmier",             label: "Infirmier",             color: "#2563EB", bg: "#DBEAFE" },
  { value: "Aide-soignant",         label: "Aide-soignant",         color: "#D97706", bg: "#FEF3C7" },
  { value: "Sage-femme",            label: "Sage-femme",            color: "#7C3AED", bg: "#EDE9FE" },
  { value: "Laborantin",            label: "Laborantin",            color: "#0891B2", bg: "#CFFAFE" },
  { value: "Radiologue",            label: "Radiologue",            color: "#DB2777", bg: "#FCE7F3" },
  { value: "Secrétaire médicale",   label: "Secrétaire médicale",   color: "#64748B", bg: "#F1F5F9" },
  { value: "Pharmacien hospitalier", label: "Pharmacien hospitalier", color: "#059669", bg: "#D1FAE5" },
  { value: "Caissier",              label: "Caissier",              color: "#CA8A04", bg: "#FEF9C3" },
];

// role_interne (tel que stocké sur membres_personnel/auth) -> valeur ROLES_PLANNING
// (les deux nomenclatures divergent legerement, ex. "Infirmière" -> "Infirmier").
// Utilisé pour l'auto-inscription : le rôle est déduit du compte connecté, jamais
// choisi manuellement par le membre lui-même.
export const ROLE_INTERNE_VERS_PLANNING = {
  "Médecin": "Médecin",
  "Infirmière": "Infirmier",
  "Aide-soignant": "Aide-soignant",
  "Sage-femme": "Sage-femme",
  "Laborantin": "Laborantin",
  "Radiologue": "Radiologue",
  "Secrétaire médicale": "Secrétaire médicale",
  "Pharmacien hospitalier": "Pharmacien hospitalier",
  "Caissier": "Caissier",
};
