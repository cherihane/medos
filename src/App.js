import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";

// Auth
import Login from "./pages/Login";

// Pharmacie
import PhDashboard from "./pages/pharmacie/Dashboard";
import PhCaisse from "./pages/pharmacie/Caisse";
import PhInventaire from "./pages/pharmacie/Inventaire";
import PhOrdonnances from "./pages/pharmacie/Ordonnances";
import PhPatients from "./pages/pharmacie/Patients";
import PhFournisseurs from "./pages/pharmacie/Fournisseurs";
import PhCredits from "./pages/pharmacie/Credits";
import PhRapports from "./pages/pharmacie/Rapports";
import PhScanner from "./pages/pharmacie/Scanner";

// Hôpital
import HoDashboard from "./pages/hopital/Dashboard";
import HoStock from "./pages/hopital/Stock";
import HoPredictions from "./pages/hopital/Predictions";
import HoScanner from "./pages/pharmacie/Scanner";
import HoAssistant from "./pages/hopital/AssistantIA";
import HoReseau from "./pages/hopital/Reseau";
import HoAlertes from "./pages/hopital/Alertes";
import HoRapports from "./pages/hopital/Rapports";

// Distributeur
import DiDashboard from "./pages/distributeur/Dashboard";
import DiReseauClients from "./pages/distributeur/ReseauClients";
import DiPrevisions from "./pages/distributeur/Previsions";
import DiLivraisons from "./pages/distributeur/Livraisons";
import DiTracabilite from "./pages/distributeur/Tracabilite";
import DiClients from "./pages/distributeur/Clients";
import DiAlertes from "./pages/distributeur/Alertes";

// Autorité
import AuVueNationale from "./pages/autorite/VueNationale";
import AuCartographie from "./pages/autorite/Cartographie";
import AuContrefacons from "./pages/autorite/Contrefacons";
import AuEpidemiologie from "./pages/autorite/Epidemiologie";
import AuActeurs from "./pages/autorite/Acteurs";
import AuRapportsODD from "./pages/autorite/RapportsODD";
import AuAPI from "./pages/autorite/API";

function ProtectedRoute({ children, requiredRole }) {
  const { auth } = useAuth();
  if (!auth) return <Navigate to="/" replace />;
  if (requiredRole && auth.role !== requiredRole) return <Navigate to={auth.dashboardPath} replace />;
  return children;
}

function AppRoutes() {
  const { auth } = useAuth();

  return (
    <Routes>
      <Route path="/" element={auth ? <Navigate to={auth.dashboardPath} replace /> : <Login />} />

      {/* Pharmacie */}
      <Route path="/pharmacie/dashboard" element={<ProtectedRoute requiredRole="pharmacie"><PhDashboard /></ProtectedRoute>} />
      <Route path="/pharmacie/caisse" element={<ProtectedRoute requiredRole="pharmacie"><PhCaisse /></ProtectedRoute>} />
      <Route path="/pharmacie/inventaire" element={<ProtectedRoute requiredRole="pharmacie"><PhInventaire /></ProtectedRoute>} />
      <Route path="/pharmacie/ordonnances" element={<ProtectedRoute requiredRole="pharmacie"><PhOrdonnances /></ProtectedRoute>} />
      <Route path="/pharmacie/patients" element={<ProtectedRoute requiredRole="pharmacie"><PhPatients /></ProtectedRoute>} />
      <Route path="/pharmacie/fournisseurs" element={<ProtectedRoute requiredRole="pharmacie"><PhFournisseurs /></ProtectedRoute>} />
      <Route path="/pharmacie/credits" element={<ProtectedRoute requiredRole="pharmacie"><PhCredits /></ProtectedRoute>} />
      <Route path="/pharmacie/rapports" element={<ProtectedRoute requiredRole="pharmacie"><PhRapports /></ProtectedRoute>} />
      <Route path="/pharmacie/scanner" element={<ProtectedRoute requiredRole="pharmacie"><PhScanner /></ProtectedRoute>} />

      {/* Hôpital */}
      <Route path="/hopital/dashboard" element={<ProtectedRoute requiredRole="hopital"><HoDashboard /></ProtectedRoute>} />
      <Route path="/hopital/stock" element={<ProtectedRoute requiredRole="hopital"><HoStock /></ProtectedRoute>} />
      <Route path="/hopital/predictions" element={<ProtectedRoute requiredRole="hopital"><HoPredictions /></ProtectedRoute>} />
      <Route path="/hopital/scanner" element={<ProtectedRoute requiredRole="hopital"><HoScanner /></ProtectedRoute>} />
      <Route path="/hopital/assistant" element={<ProtectedRoute requiredRole="hopital"><HoAssistant /></ProtectedRoute>} />
      <Route path="/hopital/reseau" element={<ProtectedRoute requiredRole="hopital"><HoReseau /></ProtectedRoute>} />
      <Route path="/hopital/alertes" element={<ProtectedRoute requiredRole="hopital"><HoAlertes /></ProtectedRoute>} />
      <Route path="/hopital/rapports" element={<ProtectedRoute requiredRole="hopital"><HoRapports /></ProtectedRoute>} />

      {/* Distributeur */}
      <Route path="/distributeur/dashboard" element={<ProtectedRoute requiredRole="distributeur"><DiDashboard /></ProtectedRoute>} />
      <Route path="/distributeur/reseau-clients" element={<ProtectedRoute requiredRole="distributeur"><DiReseauClients /></ProtectedRoute>} />
      <Route path="/distributeur/previsions" element={<ProtectedRoute requiredRole="distributeur"><DiPrevisions /></ProtectedRoute>} />
      <Route path="/distributeur/livraisons" element={<ProtectedRoute requiredRole="distributeur"><DiLivraisons /></ProtectedRoute>} />
      <Route path="/distributeur/tracabilite" element={<ProtectedRoute requiredRole="distributeur"><DiTracabilite /></ProtectedRoute>} />
      <Route path="/distributeur/clients" element={<ProtectedRoute requiredRole="distributeur"><DiClients /></ProtectedRoute>} />
      <Route path="/distributeur/alertes" element={<ProtectedRoute requiredRole="distributeur"><DiAlertes /></ProtectedRoute>} />

      {/* Autorité */}
      <Route path="/autorite/vue-nationale" element={<ProtectedRoute requiredRole="autorite"><AuVueNationale /></ProtectedRoute>} />
      <Route path="/autorite/cartographie" element={<ProtectedRoute requiredRole="autorite"><AuCartographie /></ProtectedRoute>} />
      <Route path="/autorite/contrefacons" element={<ProtectedRoute requiredRole="autorite"><AuContrefacons /></ProtectedRoute>} />
      <Route path="/autorite/epidemiologie" element={<ProtectedRoute requiredRole="autorite"><AuEpidemiologie /></ProtectedRoute>} />
      <Route path="/autorite/acteurs" element={<ProtectedRoute requiredRole="autorite"><AuActeurs /></ProtectedRoute>} />
      <Route path="/autorite/rapports-odd" element={<ProtectedRoute requiredRole="autorite"><AuRapportsODD /></ProtectedRoute>} />
      <Route path="/autorite/api" element={<ProtectedRoute requiredRole="autorite"><AuAPI /></ProtectedRoute>} />

      <Route path="*" element={auth ? <Navigate to={auth.dashboardPath} replace /> : <Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
