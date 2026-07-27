/**
 * Configuration par spécialité médecin — pilote le dashboard et le formulaire
 * de consultation SANS dupliquer de code par spécialité (voir DEBUG_PROGRESS.md,
 * "Espace configurable par spécialité médecin").
 *
 * Ajouter une spécialité = ajouter une entrée ici, rien d'autre à modifier dans
 * Dashboard.jsx ni Patients.jsx.
 *
 * Ne concerne PAS les modules déjà distincts (Maternité, Bloc opératoire,
 * Urgences, Pédiatrie hospitalière) — uniquement le dashboard générique
 * "Médecin" et le formulaire de compte rendu de consultation.
 */

export const SPECIALITES_MEDECIN = [
  "Généraliste",
  "Cardiologue",
  "Gynécologue",
  "Pédiatre-consultant",
];

// champsConsultation : champs additionnels affichés dans "Nouveau compte rendu"
// (Patients.jsx), stockés dans comptes_rendus.champs_specifiques (jsonb).
// suivi : critère de priorité affiché sur le dashboard Médecin — motsCles est
// recherché dans patients.antecedents ; label=null désactive la carte.
const CONFIG = {
  "Généraliste": {
    champsConsultation: [],
    suivi: { label: null, motsCles: [] },
  },
  "Cardiologue": {
    champsConsultation: [
      { key: "tension_arterielle", label: "Tension artérielle", type: "text", placeholder: "Ex : 130/85 mmHg" },
      { key: "frequence_cardiaque", label: "Fréquence cardiaque (bpm)", type: "number", placeholder: "Ex : 78" },
      { key: "resultat_ecg", label: "Résultat ECG", type: "textarea", placeholder: "Rythme, anomalies observées…" },
    ],
    suivi: {
      label: "Patients en suivi chronique",
      motsCles: ["hypertension", "cardiopathie", "insuffisance cardiaque", "arythmie", "infarctus"],
    },
  },
  "Gynécologue": {
    // Consultation gynéco standard (hors grossesse) : couverte par le module
    // Maternité (voir onglet "Consultations gynéco"), pas de champs
    // additionnels ici pour cette première version.
    champsConsultation: [],
    suivi: { label: null, motsCles: [] },
  },
  "Pédiatre-consultant": {
    // Hors hospitalisation pédiatrique, qui reste dans le module Pédiatrie dédié.
    champsConsultation: [],
    suivi: { label: null, motsCles: [] },
  },
};

const DEFAUT = CONFIG["Généraliste"];

export function getSpecialiteConfig(specialite) {
  return CONFIG[specialite] ?? DEFAUT;
}

// Lookup clé → libellé toutes spécialités confondues, pour ré-afficher un
// compte rendu passé sans avoir à connaître la spécialité de son auteur.
export const CHAMP_LABEL_PAR_CLE = Object.values(CONFIG).reduce((acc, cfg) => {
  cfg.champsConsultation.forEach((c) => { acc[c.key] = c.label; });
  return acc;
}, {});
