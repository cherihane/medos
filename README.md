# MedOS — Intelligence Médicale Africaine

Plateforme de gestion médicale multi-rôles conçue pour les établissements de santé d'Afrique centrale. MedOS couvre l'ensemble de la chaîne : pharmacie, hôpital, distributeur et autorité sanitaire, dans une interface unifiée et imprimable.

---

## Fonctionnalités principales

- **Pharmacie** — Inventaire, caisse, ordonnances, fournisseurs, rapports, alertes de stock
- **Hôpital** — Dossiers patients, ordonnances médicales, comptes rendus, fournisseurs, rapports
- **Distributeur** — Entrepôt, prévisions IA, gestion des commandes fabricants
- **Autorité sanitaire** — Tableau de bord ODD, registre des acteurs, rapports réglementaires
- **Documents imprimables** — Moteur MedOSDocument : ordonnances, fiches patients, bons de commande, rapports, journal de caisse
- **Alertes et SMS** — Notifications internes et liens SMS pour rappels patients
- **Paramètres multi-rôles** — Gestion des permissions par rôle et par établissement

---

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend | React 18 (Create React App) |
| Base de données | Supabase (PostgreSQL + Auth + Realtime) |
| IA / Previsions | Groq API (LLaMA) |
| Emails transactionnels | Resend |
| Impression | window.open() + window.print() avec CSS @media print |
| Styles | CSS-in-JS inline |

---

## Installation locale

### Prerequis

- Node.js >= 18
- npm >= 9
- Un projet Supabase actif
- Cles API Groq et Resend

### Etapes

```bash
# 1. Cloner le depot
git clone https://github.com/<votre-username>/medos.git
cd medos

# 2. Installer les dependances
npm install

# 3. Configurer les variables d'environnement
cp .env.example .env
# Remplir .env avec vos valeurs (voir section ci-dessous)

# 4. Lancer en developpement
npm start

# 5. Build de production
npm run build
```

---

## Variables d'environnement

Creer un fichier `.env` a la racine du projet avec les variables suivantes.
**Ne jamais commiter ce fichier — il est dans .gitignore.**

```env
# Supabase
REACT_APP_SUPABASE_URL=
REACT_APP_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=

# Groq (previsions IA)
REACT_APP_GROQ_API_KEY=

# Resend (emails transactionnels)
RESEND_API_KEY=
```

Un fichier `.env.example` avec les noms de variables (sans valeurs) est fourni pour reference.

---

## Structure du projet

```
src/
  components/       Composants partages (Layout, modals, etc.)
  context/          AuthContext (authentification Supabase)
  hooks/            Hooks Supabase (donnees, mutations)
  pages/
    pharmacie/      Pages du role Pharmacie
    hopital/        Pages du role Hopital
    distributeur/   Pages du role Distributeur
    autorite/       Pages du role Autorite sanitaire
  utils/
    MedOSDocument.js  Moteur d'impression unifie
supabase/
  migrations/       Migrations SQL Supabase
```

---

## Roles et acces

| Role | Acces |
|---|---|
| Pharmacien / Gerant | Inventaire, caisse, ordonnances, fournisseurs, rapports |
| Medecin / Infirmiere | Patients, ordonnances, comptes rendus |
| Administrateur hopital | Toutes les pages hopital |
| Distributeur | Entrepot, previsions, commandes |
| Autorite sanitaire | Tableau de bord ODD, acteurs, rapports |

Les permissions par role sont configurables dans **Parametres**.

---

## Licence

Projet prive — tous droits reserves.
