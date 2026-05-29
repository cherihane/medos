export const kpiPharmacy = [
  { label: "Ventes du jour", value: "847 500 FCFA", change: "+12%", color: "#10B981" },
  { label: "Ordonnances traitées", value: "43", change: "+5", color: "#3B82F6" },
  { label: "Produits en rupture", value: "7", change: "-2", color: "#EF4444" },
  { label: "Clients du jour", value: "128", change: "+18%", color: "#8B5CF6" },
];

export const kpiHospital = [
  { label: "Patients hospitalisés", value: "312", change: "+8", color: "#10B981" },
  { label: "Consultations", value: "89", change: "+14%", color: "#3B82F6" },
  { label: "Médicaments dispensés", value: "1 240", change: "+3%", color: "#8B5CF6" },
  { label: "Alertes critiques", value: "3", change: "-1", color: "#EF4444" },
];

export const kpiDistributor = [
  { label: "Commandes actives", value: "156", change: "+22%", color: "#10B981" },
  { label: "Clients actifs", value: "84", change: "+7", color: "#3B82F6" },
  { label: "Chiffre d'affaires", value: "24.8M FCFA", change: "+9%", color: "#F59E0B" },
  { label: "Livraisons en cours", value: "31", change: "+4", color: "#8B5CF6" },
];

export const kpiAuthority = [
  { label: "Structures actives", value: "1 248", change: "+34", color: "#10B981" },
  { label: "Alertes pharmacovigilance", value: "12", change: "-3", color: "#EF4444" },
  { label: "Taux de couverture", value: "78%", change: "+2%", color: "#3B82F6" },
  { label: "Médicaments tracés", value: "4 521", change: "+120", color: "#8B5CF6" },
];

export const salesData = [
  { day: "Lun", ventes: 420000, ordonnances: 28 },
  { day: "Mar", ventes: 680000, ordonnances: 35 },
  { day: "Mer", ventes: 520000, ordonnances: 31 },
  { day: "Jeu", ventes: 750000, ordonnances: 42 },
  { day: "Ven", ventes: 847500, ordonnances: 43 },
  { day: "Sam", ventes: 960000, ordonnances: 52 },
  { day: "Dim", ventes: 320000, ordonnances: 18 },
];

export const criticalStock = [
  { name: "Amoxicilline 500mg", stock: 12, min: 50, fournisseur: "PharmaCongo" },
  { name: "Paracétamol 1g", stock: 8, min: 100, fournisseur: "MedDistrib" },
  { name: "Metformine 850mg", stock: 3, min: 30, fournisseur: "SantéPlus" },
  { name: "Atorvastatine 20mg", stock: 5, min: 25, fournisseur: "PharmaCongo" },
  { name: "Salbutamol inhaler", stock: 2, min: 20, fournisseur: "MedDistrib" },
];

export const products = [
  { id: "P001", name: "Amoxicilline 500mg", categorie: "Antibiotique", stock: 12, prix: 2500, fournisseur: "PharmaCongo", expiry: "2025-08", status: "critique" },
  { id: "P002", name: "Paracétamol 1g", categorie: "Analgésique", stock: 8, prix: 800, fournisseur: "MedDistrib", expiry: "2026-02", status: "critique" },
  { id: "P003", name: "Ibuprofène 400mg", categorie: "AINS", stock: 145, prix: 1200, fournisseur: "SantéPlus", expiry: "2026-06", status: "normal" },
  { id: "P004", name: "Metformine 850mg", categorie: "Diabète", stock: 3, prix: 1800, fournisseur: "PharmaCongo", expiry: "2025-12", status: "critique" },
  { id: "P005", name: "Amlodipine 5mg", categorie: "Cardio", stock: 78, prix: 3200, fournisseur: "MedDistrib", expiry: "2026-09", status: "normal" },
  { id: "P006", name: "Oméprazole 20mg", categorie: "Gastro", stock: 203, prix: 2100, fournisseur: "SantéPlus", expiry: "2026-11", status: "normal" },
  { id: "P007", name: "Salbutamol inhaler", categorie: "Respiratoire", stock: 2, prix: 8500, fournisseur: "PharmaCongo", expiry: "2025-10", status: "critique" },
  { id: "P008", name: "Atorvastatine 20mg", categorie: "Cardio", stock: 5, prix: 4200, fournisseur: "MedDistrib", expiry: "2026-04", status: "alerte" },
  { id: "P009", name: "Ciprofloxacine 500mg", categorie: "Antibiotique", stock: 89, prix: 3500, fournisseur: "SantéPlus", expiry: "2026-07", status: "normal" },
  { id: "P010", name: "Vitamine C 500mg", categorie: "Vitamines", stock: 412, prix: 500, fournisseur: "PharmaCongo", expiry: "2027-01", status: "normal" },
];

export const prescriptions = [
  { id: "ORD-2024-001", patient: "Kouassi Amlan", medecin: "Dr. Mbeki", date: "2024-01-15", status: "traitée", items: ["Amoxicilline 500mg x2", "Paracétamol 1g x30"], total: "6 300 FCFA" },
  { id: "ORD-2024-002", patient: "Fatou Diallo", medecin: "Dr. Nkosi", date: "2024-01-15", status: "en attente", items: ["Metformine 850mg x60", "Amlodipine 5mg x30"], total: "204 600 FCFA" },
  { id: "ORD-2024-003", patient: "Jean-Paul Mbo", medecin: "Dr. Coulibaly", date: "2024-01-14", status: "traitée", items: ["Oméprazole 20mg x30", "Ibuprofène 400mg x20"], total: "87 000 FCFA" },
  { id: "ORD-2024-004", patient: "Awa Traoré", medecin: "Dr. Mbeki", date: "2024-01-14", status: "refusée", items: ["Salbutamol inhaler x1"], total: "8 500 FCFA" },
  { id: "ORD-2024-005", patient: "Emmanuel Kasongo", medecin: "Dr. Nkosi", date: "2024-01-13", status: "traitée", items: ["Ciprofloxacine 500mg x14", "Vitamine C 500mg x30"], total: "64 000 FCFA" },
];

export const patients = [
  { id: "PAT-001", name: "Kouassi Amlan", age: 34, genre: "M", tel: "+225 07 12 34 56", groupe: "B+", maladies: ["HTA", "Diabète"], derniereVisite: "2024-01-15", ordonnances: 8 },
  { id: "PAT-002", name: "Fatou Diallo", age: 52, genre: "F", tel: "+225 05 98 76 54", groupe: "O-", maladies: ["Diabète type 2"], derniereVisite: "2024-01-15", ordonnances: 12 },
  { id: "PAT-003", name: "Jean-Paul Mbo", age: 28, genre: "M", tel: "+225 01 45 67 89", groupe: "A+", maladies: [], derniereVisite: "2024-01-14", ordonnances: 3 },
  { id: "PAT-004", name: "Awa Traoré", age: 41, genre: "F", tel: "+225 07 23 45 67", groupe: "AB+", maladies: ["Asthme"], derniereVisite: "2024-01-14", ordonnances: 5 },
  { id: "PAT-005", name: "Emmanuel Kasongo", age: 67, genre: "M", tel: "+225 05 34 56 78", groupe: "B-", maladies: ["HTA", "Insuffisance cardiaque"], derniereVisite: "2024-01-13", ordonnances: 24 },
  { id: "PAT-006", name: "Marie-Claire Bamba", age: 23, genre: "F", tel: "+225 01 56 78 90", groupe: "O+", maladies: [], derniereVisite: "2024-01-12", ordonnances: 2 },
];

export const suppliers = [
  { id: "F001", name: "PharmaCongo SA", pays: "Congo", contact: "pharma@pharmcongo.cd", tel: "+243 81 234 5678", produits: 342, delai: "3-5 jours", status: "actif", ca: "8.2M FCFA" },
  { id: "F002", name: "MedDistrib International", pays: "Côte d'Ivoire", contact: "orders@meddistrib.ci", tel: "+225 27 22 33 44", produits: 218, delai: "1-2 jours", status: "actif", ca: "12.4M FCFA" },
  { id: "F003", name: "SantéPlus Africa", pays: "Cameroun", contact: "info@santeplus.cm", tel: "+237 6 90 12 34", produits: 187, delai: "5-7 jours", status: "actif", ca: "5.7M FCFA" },
  { id: "F004", name: "Global Pharma Ltd", pays: "Ghana", contact: "global@gpharma.gh", tel: "+233 24 567 890", produits: 95, delai: "7-10 jours", status: "inactif", ca: "1.1M FCFA" },
];

export const credits = [
  { id: "CR-001", client: "Hôpital Central Abidjan", encours: 2450000, limite: 5000000, echeance: "2024-01-31", status: "normal", transactions: 12 },
  { id: "CR-002", client: "Clinique Sainte-Marie", encours: 1820000, limite: 2000000, echeance: "2024-01-25", status: "alerte", transactions: 8 },
  { id: "CR-003", client: "Pharmacie du Centre", encours: 450000, limite: 1000000, echeance: "2024-02-15", status: "normal", transactions: 5 },
  { id: "CR-004", client: "CHU de Cocody", encours: 4950000, limite: 5000000, echeance: "2024-01-20", status: "critique", transactions: 23 },
];

export const alerts = [
  { id: "ALT-001", type: "rupture", severity: "critique", message: "Stock critique : Salbutamol inhaler (2 unités restantes)", time: "Il y a 5 min", read: false },
  { id: "ALT-002", type: "expiration", severity: "alerte", message: "Expiration proche : Amoxicilline 500mg (expire en août 2025)", time: "Il y a 23 min", read: false },
  { id: "ALT-003", type: "credit", severity: "critique", message: "Limite de crédit atteinte : CHU de Cocody (99% utilisé)", time: "Il y a 1h", read: false },
  { id: "ALT-004", type: "commande", severity: "info", message: "Nouvelle commande reçue de MedDistrib International", time: "Il y a 2h", read: true },
  { id: "ALT-005", type: "ordonnance", severity: "alerte", message: "Ordonnance suspecte détectée : ORD-2024-004", time: "Il y a 3h", read: true },
  { id: "ALT-006", type: "temperature", severity: "alerte", message: "Alerte température chambre froide : 6.8°C (max 6°C)", time: "Il y a 4h", read: true },
  { id: "ALT-007", type: "livraison", severity: "info", message: "Livraison PharmaCongo confirmée pour demain", time: "Il y a 5h", read: true },
];

export const cashierFavorites = [
  { id: "F1", name: "Paracétamol 1g", prix: 800, unite: "comprimé" },
  { id: "F2", name: "Amoxicilline 500mg", prix: 2500, unite: "boîte" },
  { id: "F3", name: "Vitamine C 500mg", prix: 500, unite: "comprimé" },
  { id: "F4", name: "Ibuprofène 400mg", prix: 1200, unite: "boîte" },
  { id: "F5", name: "Oméprazole 20mg", prix: 2100, unite: "boîte" },
  { id: "F6", name: "Ciprofloxacine 500mg", prix: 3500, unite: "boîte" },
  { id: "F7", name: "Amlodipine 5mg", prix: 3200, unite: "boîte" },
  { id: "F8", name: "Salbutamol inhaler", prix: 8500, unite: "unité" },
];

export const aiPredictions = [
  { medicament: "Paracétamol 1g", demandePrevue: 1800, stock: 8, risque: "élevé", recommendation: "Commander 2000 unités" },
  { medicament: "Amoxicilline 500mg", demandePrevue: 450, stock: 12, risque: "élevé", recommendation: "Commander 500 unités" },
  { medicament: "Ibuprofène 400mg", demandePrevue: 320, stock: 145, risque: "faible", recommendation: "Stock suffisant" },
  { medicament: "Metformine 850mg", demandePrevue: 280, stock: 3, risque: "critique", recommendation: "Commande urgente : 300 unités" },
];

export const networkClients = [
  { name: "Pharmacie Lumière", ville: "Abidjan", commandes: 45, ca: "3.2M", status: "actif" },
  { name: "Hôpital Central", ville: "Yamoussoukro", commandes: 23, ca: "8.1M", status: "actif" },
  { name: "Clinique du Nord", ville: "Bouaké", commandes: 12, ca: "1.4M", status: "actif" },
  { name: "Pharmacie Espoir", ville: "San Pédro", commandes: 8, ca: "0.9M", status: "inactif" },
  { name: "Centre de Santé", ville: "Daloa", commandes: 19, ca: "2.3M", status: "actif" },
];
