import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { NotificationsProvider } from "./context/NotificationsContext";
import { DarkModeProvider } from "./context/DarkModeContext";

// ── Chargement différé de toutes les pages ────────────────────────────────────

// Auth / public
const Login = lazy(() => import("./pages/Login"));
const Inscription = lazy(() => import("./pages/Inscription"));
const Parametres = lazy(() => import("./pages/Parametres"));
const MotDePasseOublie = lazy(() => import("./pages/MotDePasseOublie"));
const ReinitialisationMotDePasse = lazy(
  () => import("./pages/ReinitialisationMotDePasse"),
);

// Pages légales
const CGU = lazy(() => import("./pages/CGU"));
const Confidentialite = lazy(() => import("./pages/Confidentialite"));
const APropos = lazy(() => import("./pages/APropos"));

// Pharmacie
const PhDashboard = lazy(() => import("./pages/pharmacie/Dashboard"));
const PhCaisse = lazy(() => import("./pages/pharmacie/Caisse"));
const PhInventaire = lazy(() => import("./pages/pharmacie/Inventaire"));
const PhOrdonnances = lazy(() => import("./pages/pharmacie/Ordonnances"));
const PhPatients = lazy(() => import("./pages/pharmacie/Patients"));
const PhFournisseurs = lazy(() => import("./pages/pharmacie/Fournisseurs"));
const PhCredits = lazy(() => import("./pages/pharmacie/Credits"));
const PhRapports = lazy(() => import("./pages/pharmacie/Rapports"));
const PhScanner = lazy(() => import("./pages/pharmacie/Scanner"));
const PhMouvements = lazy(() => import("./pages/pharmacie/Mouvements"));
const PhPeremptions = lazy(() => import("./pages/pharmacie/Peremptions"));

// Hôpital
const HoDashboard = lazy(() => import("./pages/hopital/Dashboard"));
const HoStock = lazy(() => import("./pages/hopital/Stock"));
const HoFournisseurs = lazy(() => import("./pages/hopital/Fournisseurs"));
const HoPatients = lazy(() => import("./pages/hopital/Patients"));
const HoPredictions = lazy(() => import("./pages/hopital/Predictions"));
const HoAssistant = lazy(() => import("./pages/hopital/AssistantIA"));
const HoReseau = lazy(() => import("./pages/hopital/Reseau"));
const HoAlertes = lazy(() => import("./pages/hopital/Alertes"));
const HoRapports = lazy(() => import("./pages/hopital/Rapports"));
const HoFacturation = lazy(() => import("./pages/hopital/Facturation"));
const HoPlanning = lazy(() => import("./pages/hopital/Planning"));
const HoConsultations = lazy(() => import("./pages/hopital/Consultations"));
const HoExamens = lazy(() => import("./pages/hopital/Examens"));
const HoLits = lazy(() => import("./pages/hopital/Lits"));
const HoMonService = lazy(() => import("./pages/hopital/MonService"));
const HoMesConsult = lazy(() => import("./pages/hopital/MesConsultations"));
const HoAgenda = lazy(() => import("./pages/hopital/Agenda"));
const HoTransmissionGarde = lazy(
  () => import("./pages/hopital/TransmissionGarde"),
);
const HoRenouvellements = lazy(() => import("./pages/hopital/Renouvellements"));
const HoCaissePage = lazy(() => import("./pages/hopital/CaissePage"));
const HoUrgences   = lazy(() => import("./pages/hopital/Urgences"));
const HoMaternite      = lazy(() => import("./pages/hopital/Maternite"));
const HoBlocOperatoire = lazy(() => import("./pages/hopital/BlocOperatoire"));
const HoDietetique     = lazy(() => import("./pages/hopital/Dietetique"));
const HoSterilisation  = lazy(() => import("./pages/hopital/Sterilisation"));
const HoPediatrie      = lazy(() => import("./pages/hopital/Pediatrie"));

// Distributeur
const DiDashboard = lazy(() => import("./pages/distributeur/Dashboard"));
const DiReseauClients = lazy(
  () => import("./pages/distributeur/ReseauClients"),
);
const DiPrevisions = lazy(() => import("./pages/distributeur/Previsions"));
const DiLivraisons = lazy(() => import("./pages/distributeur/Livraisons"));
const DiTracabilite = lazy(() => import("./pages/distributeur/Tracabilite"));
const DiEntrepot = lazy(() => import("./pages/distributeur/Entrepot"));
const DiClients = lazy(() => import("./pages/distributeur/Clients"));
const DiAlertes = lazy(() => import("./pages/distributeur/Alertes"));

// Autorité
const AuVueNationale = lazy(() => import("./pages/autorite/VueNationale"));
const AuCartographie = lazy(() => import("./pages/autorite/Cartographie"));
const AuContrefacons = lazy(() => import("./pages/autorite/Contrefacons"));
const AuEpidemiologie = lazy(() => import("./pages/autorite/Epidemiologie"));
const AuActeurs = lazy(() => import("./pages/autorite/Acteurs"));
const AuRapportsODD = lazy(() => import("./pages/autorite/RapportsODD"));
const AuAPI = lazy(() => import("./pages/autorite/API"));

// ── Écran de chargement entre les chunks ─────────────────────────────────────
function PageLoader() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F8FAFC",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "3px solid #E5E7EB",
            borderTopColor: "#3B82F6",
            animation: "spin 0.7s linear infinite",
            margin: "0 auto 14px",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ fontSize: 13, color: "#9CA3AF" }}>Chargement…</div>
      </div>
    </div>
  );
}

// ── Route protégée ────────────────────────────────────────────────────────────
function ProtectedRoute({ children, requiredRole }) {
  const { auth } = useAuth();
  if (!auth) return <Navigate to="/" replace />;
  if (requiredRole && auth.role !== requiredRole)
    return <Navigate to={auth.dashboardPath} replace />;
  return children;
}

// ── Routes de l'application ───────────────────────────────────────────────────
function AppRoutes() {
  const { auth } = useAuth();

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route
          path="/"
          element={
            auth ? <Navigate to={auth.dashboardPath} replace /> : <Login />
          }
        />
        <Route path="/mot-de-passe-oublie" element={<MotDePasseOublie />} />
        <Route
          path="/reinitialisation"
          element={<ReinitialisationMotDePasse />}
        />
        <Route path="/inscription" element={<Inscription />} />
        <Route path="/cgu" element={<CGU />} />
        <Route path="/confidentialite" element={<Confidentialite />} />
        <Route path="/a-propos" element={<APropos />} />
        <Route
          path="/parametres"
          element={
            <ProtectedRoute>
              <Parametres />
            </ProtectedRoute>
          }
        />

        {/* Pharmacie */}
        <Route
          path="/pharmacie/dashboard"
          element={
            <ProtectedRoute requiredRole="pharmacie">
              <PhDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pharmacie/caisse"
          element={
            <ProtectedRoute requiredRole="pharmacie">
              <PhCaisse />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pharmacie/inventaire"
          element={
            <ProtectedRoute requiredRole="pharmacie">
              <PhInventaire />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pharmacie/ordonnances"
          element={
            <ProtectedRoute requiredRole="pharmacie">
              <PhOrdonnances />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pharmacie/patients"
          element={
            <ProtectedRoute requiredRole="pharmacie">
              <PhPatients />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pharmacie/fournisseurs"
          element={
            <ProtectedRoute requiredRole="pharmacie">
              <PhFournisseurs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pharmacie/credits"
          element={
            <ProtectedRoute requiredRole="pharmacie">
              <PhCredits />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pharmacie/rapports"
          element={
            <ProtectedRoute requiredRole="pharmacie">
              <PhRapports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pharmacie/scanner"
          element={
            <ProtectedRoute requiredRole="pharmacie">
              <PhScanner />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pharmacie/mouvements"
          element={
            <ProtectedRoute requiredRole="pharmacie">
              <PhMouvements />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pharmacie/peremptions"
          element={
            <ProtectedRoute requiredRole="pharmacie">
              <PhPeremptions />
            </ProtectedRoute>
          }
        />

        {/* Hôpital */}
        <Route
          path="/hopital/dashboard"
          element={
            <ProtectedRoute requiredRole="hopital">
              <HoDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hopital/stock"
          element={
            <ProtectedRoute requiredRole="hopital">
              <HoStock />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hopital/fournisseurs"
          element={
            <ProtectedRoute requiredRole="hopital">
              <HoFournisseurs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hopital/patients"
          element={
            <ProtectedRoute requiredRole="hopital">
              <HoPatients />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hopital/predictions"
          element={
            <ProtectedRoute requiredRole="hopital">
              <HoPredictions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hopital/scanner"
          element={
            <ProtectedRoute requiredRole="hopital">
              <PhScanner />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hopital/assistant"
          element={
            <ProtectedRoute requiredRole="hopital">
              <HoAssistant />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hopital/reseau"
          element={
            <ProtectedRoute requiredRole="hopital">
              <HoReseau />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hopital/alertes"
          element={
            <ProtectedRoute requiredRole="hopital">
              <HoAlertes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hopital/rapports"
          element={
            <ProtectedRoute requiredRole="hopital">
              <HoRapports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hopital/facturation"
          element={
            <ProtectedRoute requiredRole="hopital">
              <HoFacturation />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hopital/planning"
          element={
            <ProtectedRoute requiredRole="hopital">
              <HoPlanning />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hopital/consultations"
          element={
            <ProtectedRoute requiredRole="hopital">
              <HoConsultations />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hopital/examens"
          element={
            <ProtectedRoute requiredRole="hopital">
              <HoExamens />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hopital/lits"
          element={
            <ProtectedRoute requiredRole="hopital">
              <HoLits />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hopital/mon-service"
          element={
            <ProtectedRoute requiredRole="hopital">
              <HoMonService />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hopital/mes-consultations"
          element={
            <ProtectedRoute requiredRole="hopital">
              <HoMesConsult />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hopital/caisse"
          element={
            <ProtectedRoute requiredRole="hopital">
              <HoCaissePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hopital/agenda"
          element={
            <ProtectedRoute requiredRole="hopital">
              <HoAgenda />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hopital/transmission-garde"
          element={
            <ProtectedRoute requiredRole="hopital">
              <HoTransmissionGarde />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hopital/renouvellements"
          element={
            <ProtectedRoute requiredRole="hopital">
              <HoRenouvellements />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hopital/urgences"
          element={
            <ProtectedRoute requiredRole="hopital">
              <HoUrgences />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hopital/maternite"
          element={
            <ProtectedRoute requiredRole="hopital">
              <HoMaternite />
            </ProtectedRoute>
          }
        />

        <Route
          path="/hopital/bloc"
          element={
            <ProtectedRoute requiredRole="hopital">
              <HoBlocOperatoire />
            </ProtectedRoute>
          }
        />

        <Route
          path="/hopital/dietetique"
          element={
            <ProtectedRoute requiredRole="hopital">
              <HoDietetique />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hopital/sterilisation"
          element={
            <ProtectedRoute requiredRole="hopital">
              <HoSterilisation />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hopital/pediatrie"
          element={
            <ProtectedRoute requiredRole="hopital">
              <HoPediatrie />
            </ProtectedRoute>
          }
        />

        {/* Distributeur */}
        <Route
          path="/distributeur/dashboard"
          element={
            <ProtectedRoute requiredRole="distributeur">
              <DiDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/distributeur/reseau-clients"
          element={
            <ProtectedRoute requiredRole="distributeur">
              <DiReseauClients />
            </ProtectedRoute>
          }
        />
        <Route
          path="/distributeur/previsions"
          element={
            <ProtectedRoute requiredRole="distributeur">
              <DiPrevisions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/distributeur/livraisons"
          element={
            <ProtectedRoute requiredRole="distributeur">
              <DiLivraisons />
            </ProtectedRoute>
          }
        />
        <Route
          path="/distributeur/tracabilite"
          element={
            <ProtectedRoute requiredRole="distributeur">
              <DiTracabilite />
            </ProtectedRoute>
          }
        />
        <Route
          path="/distributeur/entrepot"
          element={
            <ProtectedRoute requiredRole="distributeur">
              <DiEntrepot />
            </ProtectedRoute>
          }
        />
        <Route
          path="/distributeur/clients"
          element={
            <ProtectedRoute requiredRole="distributeur">
              <DiClients />
            </ProtectedRoute>
          }
        />
        <Route
          path="/distributeur/alertes"
          element={
            <ProtectedRoute requiredRole="distributeur">
              <DiAlertes />
            </ProtectedRoute>
          }
        />

        {/* Autorité */}
        <Route
          path="/autorite/vue-nationale"
          element={
            <ProtectedRoute requiredRole="autorite">
              <AuVueNationale />
            </ProtectedRoute>
          }
        />
        <Route
          path="/autorite/cartographie"
          element={
            <ProtectedRoute requiredRole="autorite">
              <AuCartographie />
            </ProtectedRoute>
          }
        />
        <Route
          path="/autorite/contrefacons"
          element={
            <ProtectedRoute requiredRole="autorite">
              <AuContrefacons />
            </ProtectedRoute>
          }
        />
        <Route
          path="/autorite/epidemiologie"
          element={
            <ProtectedRoute requiredRole="autorite">
              <AuEpidemiologie />
            </ProtectedRoute>
          }
        />
        <Route
          path="/autorite/acteurs"
          element={
            <ProtectedRoute requiredRole="autorite">
              <AuActeurs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/autorite/rapports-odd"
          element={
            <ProtectedRoute requiredRole="autorite">
              <AuRapportsODD />
            </ProtectedRoute>
          }
        />
        <Route
          path="/autorite/api"
          element={
            <ProtectedRoute requiredRole="autorite">
              <AuAPI />
            </ProtectedRoute>
          }
        />

        <Route
          path="*"
          element={
            auth ? (
              <Navigate to={auth.dashboardPath} replace />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <DarkModeProvider>
        <AuthProvider>
          <NotificationsProvider>
            <AppRoutes />
          </NotificationsProvider>
        </AuthProvider>
      </DarkModeProvider>
    </BrowserRouter>
  );
}
