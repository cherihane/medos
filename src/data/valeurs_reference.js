export const VALEURS_REFERENCE = {
  "NFS": [
    { champ: "hemoglobine",    label: "Hemoglobine",      unite: "g/dL",    min_homme: 13,   max_homme: 17,   min_femme: 12,   max_femme: 16,   min_enfant: 11,  max_enfant: 16  },
    { champ: "globules_blancs",label: "Globules blancs",  unite: "x10³/µL", min_adulte: 4,   max_adulte: 10,  min_enfant: 5,   max_enfant: 13  },
    { champ: "plaquettes",     label: "Plaquettes",       unite: "x10³/µL", min_adulte: 150, max_adulte: 400 },
    { champ: "hematocrite",    label: "Hematocrite",      unite: "%",       min_homme: 40,   max_homme: 52,   min_femme: 36,   max_femme: 46   },
  ],
  "Glycemie": [
    { champ: "glycemie",       label: "Glycemie",         unite: "g/L",     min_adulte: 0.7, max_adulte: 1.1 },
    { champ: "glycemie_mmol",  label: "Glycemie",         unite: "mmol/L",  min_adulte: 3.9, max_adulte: 6.1 },
  ],
  "Uree / Creatinine": [
    { champ: "uree",           label: "Uree",             unite: "mmol/L",  min_adulte: 2.5, max_adulte: 7.5 },
    { champ: "creatinine",     label: "Creatinine",       unite: "µmol/L",  min_homme: 62,   max_homme: 115,  min_femme: 44,   max_femme: 97   },
  ],
  "Bilan hepatique": [
    { champ: "alat",           label: "ALAT (TGP)",       unite: "UI/L",    min_adulte: 7,   max_adulte: 56  },
    { champ: "asat",           label: "ASAT (TGO)",       unite: "UI/L",    min_adulte: 10,  max_adulte: 40  },
    { champ: "bilirubine_t",   label: "Bilirubine totale",unite: "µmol/L",  min_adulte: 5,   max_adulte: 21  },
  ],
  "ECG": [
    { champ: "fc",             label: "Frequence cardiaque", unite: "bpm",  min_adulte: 60,  max_adulte: 100 },
    { champ: "pr",             label: "Espace PR",           unite: "ms",   min_adulte: 120, max_adulte: 200 },
    { champ: "qrs",            label: "Complexe QRS",        unite: "ms",   min_adulte: 60,  max_adulte: 100 },
    { champ: "qt",             label: "Espace QT",           unite: "ms",   min_adulte: 350, max_adulte: 450 },
  ],
};

export function evaluerValeur(valeur, ref, genre = "adulte", age = 30) {
  const v = Number(valeur);
  if (isNaN(v)) return null;
  const estEnfant = age < 15;
  let min, max;
  if (estEnfant && ref.min_enfant !== undefined) {
    min = ref.min_enfant; max = ref.max_enfant;
  } else if (genre === "F" && ref.min_femme !== undefined) {
    min = ref.min_femme; max = ref.max_femme;
  } else if (genre === "M" && ref.min_homme !== undefined) {
    min = ref.min_homme; max = ref.max_homme;
  } else {
    min = ref.min_adulte; max = ref.max_adulte;
  }
  if (min === undefined || max === undefined) return null;
  if (v < min) return { statut: "bas",    label: `Bas (ref: ${min}–${max} ${ref.unite})`,    color: "#EF4444" };
  if (v > max) return { statut: "haut",   label: `Eleve (ref: ${min}–${max} ${ref.unite})`,  color: "#F59E0B" };
  return       { statut: "normal", label: `Normal (ref: ${min}–${max} ${ref.unite})`, color: "#10B981" };
}
