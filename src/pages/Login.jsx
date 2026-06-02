import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, roleConfig } from "../context/AuthContext";
import PublicFooter from "../components/PublicFooter";
import { useIsMobile } from "../hooks/useWindowSize";

/**
 * Traduit les erreurs techniques Supabase/Auth en messages utilisateur lisibles.
 * Les messages metier utiles (compte en attente, refuse) sont conserves tels quels.
 */
function translateAuthError(message = "") {
  const m = message.toLowerCase();

  // Messages metier — conserves directement (viennent de login() dans AuthContext)
  if (m.includes("en cours de validation")) return message;
  if (m.includes("refus")) return message;

  // Erreurs d'identifiants — message clair sans reveler si l'email existe
  if (m.includes("invalid login credentials") || m.includes("invalid credentials")) {
    return "Email ou mot de passe incorrect.";
  }
  if (m.includes("email not confirmed")) {
    return "Votre adresse email n'a pas encore été confirmée. Vérifiez votre boite de reception.";
  }
  if (m.includes("user not found")) {
    return "Aucun compte associé à cet email.";
  }
  if (m.includes("too many requests") || m.includes("rate limit")) {
    return "Trop de tentatives de connexion. Veuillez patienter quelques minutes avant de réessayer.";
  }
  if (m.includes("network") || m.includes("fetch")) {
    return "Impossible de contacter le serveur. Vérifiez votre connexion internet.";
  }

  // Erreur generique — log technique en console, message neutre a l'utilisateur
  console.error("[MedOS] Erreur d'authentification:", message);
  return "Une erreur s'est produite lors de la connexion. Veuillez réessayer.";
}

const roles = [
  { value: "pharmacie", label: "Pharmacie" },
  { value: "hopital", label: "Hôpital" },
  { value: "distributeur", label: "Distributeur" },
  { value: "autorite", label: "Autorité de Santé" },
];

const features = [
  "Traçabilité totale des médicaments",
  "Prédictions IA de la demande",
  "Dashboards temps réel",
  "Réseau panafricain connecté",
];

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const isMobile = useIsMobile(768);
  const [form, setForm] = useState({ email: "", password: "", role: "pharmacie" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.email || !form.password) {
      setError("Veuillez renseigner votre email et mot de passe.");
      return;
    }
    if (form.password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    setLoading(true);
    try {
      await login(form.role, form.email, form.password);
      navigate(roleConfig[form.role].dashboardPath);
    } catch (err) {
      setError(translateAuthError(err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", flexDirection: isMobile ? "column" : "row" }}>

      {/* Panneau gauche — masqué sur mobile */}
      {!isMobile && (
        <div style={{
          flex: 1,
          backgroundColor: "#0A1628",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: 48,
          color: "white",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 44 }}>
            <div style={{
              width: 52, height: 52,
              backgroundColor: "#3B82F6",
              borderRadius: 14,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: 1 }}>MedOS</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>par le groupe Kela</div>
            </div>
          </div>

          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 10, textAlign: "center" }}>
            Plateforme santé intelligente
          </h2>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, textAlign: "center", maxWidth: 300, lineHeight: 1.8 }}>
            Gérez vos pharmacies, hôpitaux et chaînes de distribution en temps réel avec l'IA au service de la santé africaine.
          </p>

          <div style={{ marginTop: 44, display: "flex", flexDirection: "column", gap: 14, width: "100%", maxWidth: 280 }}>
            {features.map((f) => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#3B82F6", flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Panneau droit — formulaire */}
      <div style={{
        flex: 1,
        backgroundColor: isMobile ? "#0A1628" : "#F0F4FB",
        display: "flex",
        justifyContent: "center",
        alignItems: isMobile ? "flex-start" : "center",
        padding: isMobile ? "32px 20px 40px" : 48,
      }}>
        <div style={{
          backgroundColor: "white",
          borderRadius: 20,
          padding: isMobile ? "32px 24px" : "40px 44px",
          width: "100%",
          maxWidth: 420,
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        }}>
          {/* Logo visible uniquement sur mobile */}
          {isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28, justifyContent: "center" }}>
              <div style={{
                width: 42, height: 42,
                backgroundColor: "#3B82F6",
                borderRadius: 12,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 26, fontWeight: 900, color: "#0A1628", letterSpacing: 0.5 }}>MedOS</div>
                <div style={{ fontSize: 11, color: "#9CA3AF" }}>par le groupe Kela</div>
              </div>
            </div>
          )}

          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0A1628", marginBottom: 4 }}>Connexion</h2>
          <p style={{ color: "#6B7280", fontSize: 13, marginBottom: 28 }}>Accédez à votre espace MedOS</p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                Type de structure
              </label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  border: "1.5px solid #E5E7EB",
                  borderRadius: 10,
                  fontSize: 14,
                  color: "#0A1628",
                  backgroundColor: "white",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              >
                {roles.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                Adresse e-mail
              </label>
              <input
                type="email"
                placeholder="votre@email.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  border: "1.5px solid #E5E7EB",
                  borderRadius: 10,
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                Mot de passe
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  border: "1.5px solid #E5E7EB",
                  borderRadius: 10,
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "#6B7280", cursor: "pointer" }}>
                <input type="checkbox" style={{ accentColor: "#3B82F6" }} />
                Se souvenir de moi
              </label>
              <span
                onClick={() => navigate("/mot-de-passe-oublie")}
                style={{ fontSize: 13, color: "#3B82F6", cursor: "pointer", fontWeight: 500 }}
              >
                Mot de passe oublié ?
              </span>
            </div>

            {error && (
              <div style={{
                backgroundColor: "#FEF2F2",
                border: "1px solid #FECACA",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 13,
                color: "#DC2626",
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                backgroundColor: "#3B82F6",
                color: "white",
                border: "none",
                borderRadius: 10,
                padding: "13px",
                fontSize: 14,
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                marginTop: 4,
                opacity: loading ? 0.8 : 1,
              }}
            >
              {loading ? "Connexion en cours..." : "Accéder à MedOS"}
            </button>
          </form>

          <p style={{ textAlign: "center", marginTop: 16, marginBottom: 0 }}>
            <a href="/inscription" style={{ fontSize: 12, color: "#6B7280", textDecoration: "none" }}
              onMouseEnter={(e) => e.target.style.color = "#3B82F6"}
              onMouseLeave={(e) => e.target.style.color = "#6B7280"}
            >
              Pas encore de compte ? Demander un accès
            </a>
          </p>

          <PublicFooter />
        </div>
      </div>
    </div>
  );
}
