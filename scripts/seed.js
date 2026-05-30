#!/usr/bin/env node
/**
 * MedOS — Seed des données de test (Congo RDC)
 * Usage : node scripts/seed.js <SERVICE_ROLE_KEY>
 *
 * Avant la première exécution, assurez-vous d'avoir lancé dans Supabase SQL Editor :
 *   supabase/migrations/20240101000000_medos_schema.sql   (schéma complet)
 *   supabase/migrations/20240101000001_add_stock_columns.sql  (colonnes stock)
 */

const { createClient } = require("@supabase/supabase-js");

const PROJECT_URL = "https://yehqmvwmosskumbegzty.supabase.co";
const SERVICE_KEY = process.argv[2];

if (!SERVICE_KEY) {
  console.error("\n❌  Usage : node scripts/seed.js <SERVICE_ROLE_KEY>");
  console.error("   Clé disponible dans : Supabase > Project Settings > API > service_role\n");
  process.exit(1);
}

const supabase = createClient(PROJECT_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─────────────────────────────────────────────
// 1. ÉTABLISSEMENTS (5)
// ─────────────────────────────────────────────
const etablissements = [
  {
    nom: "Hôpital Général de Référence de Kinshasa",
    type: "hopital",
    ville: "Kinshasa",
    pays: "République Démocratique du Congo",
    adresse: "Avenue de la Démocratie, Gombe, Kinshasa",
    telephone: "+243 81 000 1234",
    email: "hgrk@sante.gouv.cd",
    actif: true,
  },
  {
    nom: "Clinique Ngaliema",
    type: "hopital",
    ville: "Kinshasa",
    pays: "République Démocratique du Congo",
    adresse: "Route de Matadi, Ngaliema, Kinshasa",
    telephone: "+243 82 111 5678",
    email: "info@clinique-ngaliema.cd",
    actif: true,
  },
  {
    nom: "Pharmacie Centrale Kinshasa",
    type: "pharmacie",
    ville: "Kinshasa",
    pays: "République Démocratique du Congo",
    adresse: "Boulevard du 30 Juin, Gombe",
    telephone: "+243 99 222 3344",
    email: "contact@pharmacentrale.cd",
    actif: true,
  },
  {
    nom: "Pharmacie Bonne Santé Lubumbashi",
    type: "pharmacie",
    ville: "Lubumbashi",
    pays: "République Démocratique du Congo",
    adresse: "Avenue Moero, Lubumbashi",
    telephone: "+243 97 333 5566",
    email: "bonnesante@pharma.cd",
    actif: true,
  },
  {
    nom: "MedDistrib Congo SARL",
    type: "distributeur",
    ville: "Kinshasa",
    pays: "République Démocratique du Congo",
    adresse: "Zone Industrielle de Limete, Kinshasa",
    telephone: "+243 81 444 7788",
    email: "logistics@meddistrib.cd",
    actif: true,
  },
];

// ─────────────────────────────────────────────
// 2. FOURNISSEURS (3)
// ─────────────────────────────────────────────
const fournisseurs = [
  {
    nom: "Pharmakina SARL",
    pays: "République Démocratique du Congo",
    contact_nom: "Dr. Pierre Masumbuko",
    email: "commandes@pharmakina.cd",
    telephone: "+243 87 001 0001",
    delai_livraison: "3-5 jours",
    conditions_paiement: "30 jours net",
    actif: true,
  },
  {
    nom: "Vinas RDC",
    pays: "République Démocratique du Congo",
    contact_nom: "Mme. Cécile Lutumba",
    email: "ventes@vinas-rdc.cd",
    telephone: "+243 90 002 0002",
    delai_livraison: "1-3 jours",
    conditions_paiement: "Comptant à la livraison",
    actif: true,
  },
  {
    nom: "Sanofi RDC",
    pays: "République Démocratique du Congo",
    contact_nom: "M. Jacques Banza",
    email: "rdc@sanofi.com",
    telephone: "+243 81 003 0003",
    delai_livraison: "7-10 jours",
    conditions_paiement: "60 jours net",
    actif: true,
  },
];

// ─────────────────────────────────────────────
// 3. MÉDICAMENTS (20)
// Prix en Franc CFA — stock_actuel / stock_minimum
// ─────────────────────────────────────────────
const medicaments = [
  {
    code: "MED-001",
    nom: "Coartem 80/480mg",
    dci: "Artéméther / Luméfantrine",
    categorie: "Antipaludéen",
    forme: "Comprimé",
    dosage: "80/480 mg",
    prix_unitaire: 8500,
    unite: "boîte de 24 cp",
    prescription_requise: true,
    stock_actuel: 45,
    stock_minimum: 100,
  },
  {
    code: "MED-002",
    nom: "Quinine 300mg",
    dci: "Quinine sulfate",
    categorie: "Antipaludéen",
    forme: "Comprimé",
    dosage: "300 mg",
    prix_unitaire: 2500,
    unite: "boîte de 30 cp",
    prescription_requise: true,
    stock_actuel: 8,
    stock_minimum: 50,
  },
  {
    code: "MED-003",
    nom: "Amoxicilline 500mg",
    dci: "Amoxicilline trihydrate",
    categorie: "Antibiotique",
    forme: "Gélule",
    dosage: "500 mg",
    prix_unitaire: 3200,
    unite: "boîte de 21 gél",
    prescription_requise: true,
    stock_actuel: 120,
    stock_minimum: 80,
  },
  {
    code: "MED-004",
    nom: "Paracétamol 500mg",
    dci: "Paracétamol",
    categorie: "Analgésique",
    forme: "Comprimé",
    dosage: "500 mg",
    prix_unitaire: 800,
    unite: "boîte de 24 cp",
    prescription_requise: false,
    stock_actuel: 12,
    stock_minimum: 100,
  },
  {
    code: "MED-005",
    nom: "Metformine 500mg",
    dci: "Chlorhydrate de metformine",
    categorie: "Diabète",
    forme: "Comprimé",
    dosage: "500 mg",
    prix_unitaire: 2100,
    unite: "boîte de 60 cp",
    prescription_requise: true,
    stock_actuel: 65,
    stock_minimum: 50,
  },
  {
    code: "MED-006",
    nom: "Artémether Injectable 80mg",
    dci: "Artémether",
    categorie: "Antipaludéen",
    forme: "Solution injectable",
    dosage: "80 mg/mL",
    prix_unitaire: 12000,
    unite: "ampoule 1 mL",
    prescription_requise: true,
    stock_actuel: 5,
    stock_minimum: 30,
  },
  {
    code: "MED-007",
    nom: "Cotrimoxazole 480mg",
    dci: "Sulfaméthoxazole + Triméthoprime",
    categorie: "Antibiotique",
    forme: "Comprimé",
    dosage: "400/80 mg",
    prix_unitaire: 1500,
    unite: "boîte de 20 cp",
    prescription_requise: true,
    stock_actuel: 200,
    stock_minimum: 80,
  },
  {
    code: "MED-008",
    nom: "Mébendazole 500mg",
    dci: "Mébendazole",
    categorie: "Antiparasitaire",
    forme: "Comprimé à mâcher",
    dosage: "500 mg",
    prix_unitaire: 1800,
    unite: "comprimé",
    prescription_requise: false,
    stock_actuel: 80,
    stock_minimum: 40,
  },
  {
    code: "MED-009",
    nom: "SRO Sachets",
    dci: "Sels de Réhydratation Orale",
    categorie: "Réhydratation",
    forme: "Poudre pour solution orale",
    dosage: "1 sachet / 1L eau",
    prix_unitaire: 500,
    unite: "sachet",
    prescription_requise: false,
    stock_actuel: 300,
    stock_minimum: 150,
  },
  {
    code: "MED-010",
    nom: "Amlodipine 5mg",
    dci: "Amlodipine bésilate",
    categorie: "Cardiovasculaire",
    forme: "Comprimé",
    dosage: "5 mg",
    prix_unitaire: 3500,
    unite: "boîte de 30 cp",
    prescription_requise: true,
    stock_actuel: 90,
    stock_minimum: 40,
  },
  {
    code: "MED-011",
    nom: "Énalapril 10mg",
    dci: "Maléate d'énalapril",
    categorie: "Cardiovasculaire",
    forme: "Comprimé",
    dosage: "10 mg",
    prix_unitaire: 2800,
    unite: "boîte de 28 cp",
    prescription_requise: true,
    stock_actuel: 75,
    stock_minimum: 30,
  },
  {
    code: "MED-012",
    nom: "Furosémide 40mg",
    dci: "Furosémide",
    categorie: "Diurétique",
    forme: "Comprimé",
    dosage: "40 mg",
    prix_unitaire: 1200,
    unite: "boîte de 30 cp",
    prescription_requise: true,
    stock_actuel: 110,
    stock_minimum: 50,
  },
  {
    code: "MED-013",
    nom: "Oméprazole 20mg",
    dci: "Oméprazole",
    categorie: "Gastro-intestinal",
    forme: "Gélule gastro-résistante",
    dosage: "20 mg",
    prix_unitaire: 2500,
    unite: "boîte de 28 gél",
    prescription_requise: false,
    stock_actuel: 180,
    stock_minimum: 60,
  },
  {
    code: "MED-014",
    nom: "Ibuprofène 400mg",
    dci: "Ibuprofène",
    categorie: "AINS",
    forme: "Comprimé enrobé",
    dosage: "400 mg",
    prix_unitaire: 1400,
    unite: "boîte de 20 cp",
    prescription_requise: false,
    stock_actuel: 95,
    stock_minimum: 60,
  },
  {
    code: "MED-015",
    nom: "Chloroquine 250mg",
    dci: "Chloroquine phosphate",
    categorie: "Antipaludéen",
    forme: "Comprimé",
    dosage: "250 mg",
    prix_unitaire: 1800,
    unite: "boîte de 20 cp",
    prescription_requise: true,
    stock_actuel: 3,
    stock_minimum: 40,
  },
  {
    code: "MED-016",
    nom: "Vitamines B Complexe",
    dci: "B1 + B6 + B12",
    categorie: "Vitamines",
    forme: "Comprimé",
    dosage: "B1 100mg / B6 5mg / B12 0.2mg",
    prix_unitaire: 1200,
    unite: "boîte de 30 cp",
    prescription_requise: false,
    stock_actuel: 250,
    stock_minimum: 80,
  },
  {
    code: "MED-017",
    nom: "Fer + Acide Folique",
    dci: "Fumarate ferreux + Acide folique",
    categorie: "Maternité",
    forme: "Comprimé",
    dosage: "200mg + 0.4mg",
    prix_unitaire: 900,
    unite: "boîte de 30 cp",
    prescription_requise: false,
    stock_actuel: 160,
    stock_minimum: 70,
  },
  {
    code: "MED-018",
    nom: "Ciprofloxacine 500mg",
    dci: "Ciprofloxacine chlorhydrate",
    categorie: "Antibiotique",
    forme: "Comprimé pelliculé",
    dosage: "500 mg",
    prix_unitaire: 4200,
    unite: "boîte de 10 cp",
    prescription_requise: true,
    stock_actuel: 55,
    stock_minimum: 40,
  },
  {
    code: "MED-019",
    nom: "Doxycycline 100mg",
    dci: "Hyclate de doxycycline",
    categorie: "Antibiotique",
    forme: "Gélule",
    dosage: "100 mg",
    prix_unitaire: 2600,
    unite: "boîte de 10 gél",
    prescription_requise: true,
    stock_actuel: 7,
    stock_minimum: 35,
  },
  {
    code: "MED-020",
    nom: "Albendazole 400mg",
    dci: "Albendazole",
    categorie: "Antiparasitaire",
    forme: "Comprimé à mâcher",
    dosage: "400 mg",
    prix_unitaire: 2000,
    unite: "comprimé",
    prescription_requise: false,
    stock_actuel: 130,
    stock_minimum: 60,
  },
];

// ─────────────────────────────────────────────
// 4. PATIENTS (10)
// ─────────────────────────────────────────────
const buildPatients = (etablissementId) => [
  {
    etablissement_id: etablissementId,
    prenom: "Jean-Baptiste",
    nom: "Mukendi",
    date_naissance: "1979-03-12",
    genre: "M",
    telephone: "+243 81 123 4567",
    email: "jbmukendi@gmail.com",
    groupe_sanguin: "O+",
    antecedents: ["HTA", "Diabète type 2"],
  },
  {
    etablissement_id: etablissementId,
    prenom: "Marie",
    nom: "Kalinda",
    date_naissance: "1992-07-25",
    genre: "F",
    telephone: "+243 97 234 5678",
    groupe_sanguin: "A+",
    antecedents: ["Paludisme récidivant"],
  },
  {
    etablissement_id: etablissementId,
    prenom: "Emmanuel",
    nom: "Kabila",
    date_naissance: "1957-11-04",
    genre: "M",
    telephone: "+243 82 345 6789",
    groupe_sanguin: "B+",
    antecedents: ["Insuffisance cardiaque", "HTA", "Diabète type 2"],
  },
  {
    etablissement_id: etablissementId,
    prenom: "Alphonsine",
    nom: "Mutombo",
    date_naissance: "1996-02-18",
    genre: "F",
    telephone: "+243 99 456 7890",
    groupe_sanguin: "O-",
    antecedents: ["Grossesse 28 SA", "Anémie ferriprive"],
  },
  {
    etablissement_id: etablissementId,
    prenom: "Célestin",
    nom: "Ngoy",
    date_naissance: "1970-08-30",
    genre: "M",
    telephone: "+243 81 567 8901",
    groupe_sanguin: "A-",
    antecedents: ["HTA"],
  },
  {
    etablissement_id: etablissementId,
    prenom: "Joséphine",
    nom: "Kazadi",
    date_naissance: "1983-05-14",
    genre: "F",
    telephone: "+243 97 678 9012",
    groupe_sanguin: "AB+",
    antecedents: ["Diabète type 2"],
  },
  {
    etablissement_id: etablissementId,
    prenom: "Patrick",
    nom: "Ilunga",
    date_naissance: "2001-12-01",
    genre: "M",
    telephone: "+243 82 789 0123",
    groupe_sanguin: "B-",
    antecedents: [],
  },
  {
    etablissement_id: etablissementId,
    prenom: "Clémentine",
    nom: "Tshisekedi",
    date_naissance: "1986-09-22",
    genre: "F",
    telephone: "+243 90 890 1234",
    groupe_sanguin: "O+",
    antecedents: ["Asthme"],
  },
  {
    etablissement_id: etablissementId,
    prenom: "Albert",
    nom: "Mwamba",
    date_naissance: "1953-04-07",
    genre: "M",
    telephone: "+243 81 901 2345",
    groupe_sanguin: "A+",
    antecedents: ["HTA", "Insuffisance coronarienne", "Dyslipidémie"],
  },
  {
    etablissement_id: etablissementId,
    prenom: "Rosine",
    nom: "Mulumba",
    date_naissance: "2005-01-19",
    genre: "F",
    telephone: "+243 97 012 3456",
    groupe_sanguin: "O+",
    antecedents: [],
  },
];

// ─────────────────────────────────────────────
// 5. ALERTES (5) — stock critique
// ─────────────────────────────────────────────
const buildAlertes = (etablissementId, medMap) => [
  {
    etablissement_id: etablissementId,
    type: "rupture",
    severite: "critique",
    titre: "Stock critique : Quinine 300mg",
    message: "Quinine 300mg — 8 unités restantes (seuil : 50). Commande urgente requise auprès de Pharmakina.",
    medicament_id: medMap["MED-002"],
    lu: false,
    resolu: false,
  },
  {
    etablissement_id: etablissementId,
    type: "rupture",
    severite: "critique",
    titre: "Stock critique : Paracétamol 500mg",
    message: "Paracétamol 500mg — 12 unités restantes (seuil : 100). Produit en forte demande.",
    medicament_id: medMap["MED-004"],
    lu: false,
    resolu: false,
  },
  {
    etablissement_id: etablissementId,
    type: "rupture",
    severite: "critique",
    titre: "Rupture imminente : Artémether Injectable",
    message: "Artémether 80mg injectable — 5 ampoules restantes (seuil : 30). Antipaludéen injectable essentiel.",
    medicament_id: medMap["MED-006"],
    lu: false,
    resolu: false,
  },
  {
    etablissement_id: etablissementId,
    type: "rupture",
    severite: "critique",
    titre: "Stock critique : Chloroquine 250mg",
    message: "Chloroquine 250mg — 3 unités restantes (seuil : 40). Commande à effectuer immédiatement.",
    medicament_id: medMap["MED-015"],
    lu: false,
    resolu: false,
  },
  {
    etablissement_id: etablissementId,
    type: "rupture",
    severite: "alerte",
    titre: "Stock bas : Doxycycline 100mg",
    message: "Doxycycline 100mg — 7 unités restantes (seuil : 35). Antibiotique de 2ème ligne antipaludéenne.",
    medicament_id: medMap["MED-019"],
    lu: false,
    resolu: false,
  },
];

// ─────────────────────────────────────────────
// SEED RUNNER
// ─────────────────────────────────────────────

/** Supprime tous les enregistrements d'une table (pour re-seed propre). */
async function truncate(table) {
  const { error } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw new Error(`[truncate ${table}] ${error.message}`);
}

/** Insert simple + retourne les lignes créées. */
async function insert(table, data) {
  const { data: rows, error } = await supabase.from(table).insert(data).select();
  if (error) throw new Error(`[${table}] ${error.message}`);
  return rows;
}

/** Upsert sur contrainte unique existante (ex: medicaments.code). */
async function upsertOn(table, data, conflictKey) {
  const { data: rows, error } = await supabase
    .from(table)
    .upsert(data, { onConflict: conflictKey, ignoreDuplicates: false })
    .select();
  if (error) throw new Error(`[${table}] ${error.message}`);
  return rows;
}

async function seed() {
  console.log("\n🌱  MedOS Seed — démarrage...\n");

  // ── Nettoyage dans l'ordre inverse des FK
  process.stdout.write("  Nettoyage tables  ");
  for (const t of ["alertes", "patients", "ventes", "ordonnances", "livraisons", "commandes", "lots", "medicaments", "fournisseurs", "etablissements"]) {
    await truncate(t);
  }
  console.log("✓");

  // ── Établissements
  process.stdout.write("  Établissements    ");
  const etabs = await insert("etablissements", etablissements);
  console.log(`✓  ${etabs.length} insérés`);

  const etabMap = Object.fromEntries(etabs.map((e) => [e.nom, e.id]));
  const hopitalId   = etabMap["Hôpital Général de Référence de Kinshasa"];
  const pharmacieId = etabMap["Pharmacie Centrale Kinshasa"];

  // ── Fournisseurs
  process.stdout.write("  Fournisseurs      ");
  const fourns = await insert("fournisseurs", fournisseurs);
  console.log(`✓  ${fourns.length} insérés`);

  // ── Médicaments (code est UNIQUE → upsert sûr)
  process.stdout.write("  Médicaments       ");
  const meds = await upsertOn("medicaments", medicaments, "code");
  console.log(`✓  ${meds.length} insérés`);

  const medMap = Object.fromEntries(meds.map((m) => [m.code, m.id]));

  // ── Patients (rattachés à l'hôpital)
  process.stdout.write("  Patients          ");
  const patientsData = buildPatients(hopitalId);
  const pats = await insert("patients", patientsData);
  console.log(`✓  ${pats.length} insérés`);

  // ── Alertes (rattachées à la pharmacie)
  process.stdout.write("  Alertes           ");
  const alertesData = buildAlertes(pharmacieId, medMap);
  const alts = await insert("alertes", alertesData);
  console.log(`✓  ${alts.length} insérées`);

  console.log("\n✅  Seed terminé avec succès !\n");
  console.log("  Établissements :", etabs.length);
  console.log("  Fournisseurs   :", fourns.length);
  console.log("  Médicaments    :", meds.length);
  console.log("  Patients       :", pats.length);
  console.log("  Alertes        :", alts.length);
  console.log("");
}

seed().catch((err) => {
  console.error("\n❌  Erreur seed :", err.message);
  process.exit(1);
});
