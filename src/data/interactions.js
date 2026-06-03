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
