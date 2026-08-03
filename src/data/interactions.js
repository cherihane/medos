// Retire les accents avant comparaison — les regles ci-dessous sont ecrites
// sans accent, mais les allergies/antecedents sont saisis en texte libre par
// l'utilisateur (ex. "Pénicilline") et doivent quand meme matcher.
export function normaliserTexte(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Paires de medicaments incompatibles
// niveau: 'contre-indication' | 'precaution'
export const INTERACTIONS_MEDICAMENTEUSES = [
  { meds: ["aspirine", "ibuprofene"],      niveau: "contre-indication", message: "Association AINS + AINS : risque hemorragique majeur." },
  { meds: ["aspirine", "diclofenac"],      niveau: "contre-indication", message: "Association AINS + AINS : risque hemorragique majeur." },
  { meds: ["metronidazole", "alcool"],     niveau: "contre-indication", message: "Reaction antabuse severe. Eviter toute prise d alcool." },
  { meds: ["warfarine", "aspirine"],       niveau: "contre-indication", message: "Risque hemorragique majeur. Ne pas associer sans surveillance INR." },
  { meds: ["warfarine", "ibuprofene"],     niveau: "contre-indication", message: "Risque hemorragique majeur." },
  { meds: ["amoxicilline", "methotrexate"],niveau: "contre-indication", message: "Augmentation toxicite methotrexate." },
  { meds: ["ciprofloxacine", "theophylline"], niveau: "precaution",    message: "Augmentation taux theophylline — surveillance clinique." },
  { meds: ["amiodarone", "digoxine"],      niveau: "precaution",        message: "Risque bradycardie et troubles du rythme." },
  { meds: ["tramadol", "ssri"],            niveau: "contre-indication", message: "Risque syndrome serotoninergique." },
  { meds: ["codeine", "benzodiazepine"],   niveau: "precaution",        message: "Risque de depression respiratoire. Surveiller." },
  { meds: ["artemether", "halofantrine"],  niveau: "contre-indication", message: "Risque QT long fatal. Ne pas associer." },
  { meds: ["efavirenz", "rifampicine"],    niveau: "precaution",        message: "Rifampicine reduit les taux d efavirenz. Ajuster la dose." },
  { meds: ["lopinavir", "rifampicine"],    niveau: "contre-indication", message: "Rifampicine reduit drastiquement les taux de lopinavir." },
  { meds: ["isoniazide", "phenytoine"],    niveau: "precaution",        message: "Isoniazide inhibe le metabolisme de phenytoine — toxicite." },
  { meds: ["quinine", "mefloquine"],       niveau: "contre-indication", message: "Risque de convulsions et cardiotoxicite." },
];

// Contre-indications selon antecedents patient
export const CONTRE_INDICATIONS_ANTECEDENTS = [
  { antecedent: "insuffisance renale", medicaments: ["ibuprofene", "diclofenac", "naproxene"], message: "AINS contre-indiques en insuffisance renale." },
  { antecedent: "insuffisance renale", medicaments: ["metformine"], message: "Metformine contre-indiquee en insuffisance renale severe — risque acidose lactique." },
  { antecedent: "diabete",    medicaments: ["corticoides", "prednisolone", "dexamethasone"], message: "Corticoides hyperglycemiants — surveiller glycemie." },
  { antecedent: "hypertension", medicaments: ["ibuprofene", "diclofenac"], message: "AINS peuvent aggraver l hypertension." },
  { antecedent: "epilepsie",  medicaments: ["tramadol", "mefloquine"], message: "Risque de convulsions — utiliser avec extreme precaution." },
  { antecedent: "grossesse",  medicaments: ["ibuprofene", "aspirine", "tetracycline", "doxycycline", "methotrexate", "warfarine"], message: "Medicament contre-indique pendant la grossesse." },
  { antecedent: "asthme",     medicaments: ["aspirine", "ibuprofene", "propranolol"], message: "Risque de bronchospasme severe." },
  { antecedent: "cirrhose",   medicaments: ["paracetamol", "metronidazole"], message: "Reduire les doses — metabolisme hepatique altere." },
  { antecedent: "hemophilie", medicaments: ["aspirine", "ibuprofene"], message: "AINS contre-indiques — risque hemorragique majeur." },
];

// Contre-indications selon allergies connues du patient — niveau le plus grave
// (risque de reaction allergique directe, potentiellement fatale), toujours
// remonte comme niveau 'allergie' quel que soit le medicament associe.
export const ALLERGIES_MEDICAMENTS = [
  { allergie: "penicilline", medicaments: ["penicilline", "amoxicilline", "ampicilline", "cloxacilline", "oxacilline"], message: "Allergie connue a la penicilline — risque de choc anaphylactique." },
  { allergie: "aspirine",    medicaments: ["aspirine"], message: "Allergie connue a l aspirine." },
  { allergie: "ains",        medicaments: ["ibuprofene", "diclofenac", "naproxene", "aspirine"], message: "Allergie connue aux anti-inflammatoires non steroidiens (AINS)." },
  { allergie: "sulfamide",   medicaments: ["cotrimoxazole", "sulfamethoxazole"], message: "Allergie connue aux sulfamides." },
  { allergie: "codeine",     medicaments: ["codeine"], message: "Allergie connue a la codeine." },
  { allergie: "quinine",     medicaments: ["quinine", "mefloquine"], message: "Allergie connue a la quinine et antipaludeens apparentes." },
  { allergie: "iode",        medicaments: ["amiodarone"], message: "Allergie connue a l iode — l amiodarone en contient." },
];
