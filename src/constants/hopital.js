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

export const ROLES_PLANNING = [
  { value: "Médecin",       label: "Médecin",       color: "#16A34A", bg: "#DCFCE7" },
  { value: "Infirmier",     label: "Infirmier",     color: "#2563EB", bg: "#DBEAFE" },
  { value: "Aide-soignant", label: "Aide-soignant", color: "#D97706", bg: "#FEF3C7" },
  { value: "Sage-femme",    label: "Sage-femme",    color: "#7C3AED", bg: "#EDE9FE" },
  { value: "Laborantin",    label: "Laborantin",    color: "#0891B2", bg: "#CFFAFE" },
];
