import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { roleConfig } from "../context/AuthContext";

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
  const [form, setForm] = useState({ email: "", password: "", role: "pharmacie" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      login(form.role);
      navigate(roleConfig[form.role].dashboardPath);
    }, 700);
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Left */}
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
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>by Kela Group</div>
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

      {/* Right */}
      <div style={{
        flex: 1,
        backgroundColor: "#F0F4FB",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 48,
      }}>
        <div style={{
          backgroundColor: "white",
          borderRadius: 20,
          padding: "40px 44px",
          width: "100%",
          maxWidth: 420,
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        }}>
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
                Adresse email
              </label>
              <input
                type="email"
                placeholder="votre@email.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
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
              <span style={{ fontSize: 13, color: "#3B82F6", cursor: "pointer", fontWeight: 500 }}>
                Mot de passe oublié ?
              </span>
            </div>

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
              {loading ? "Connexion en cours..." : "Se connecter"}
            </button>
          </form>

          <p style={{ textAlign: "center", fontSize: 11, color: "#9CA3AF", marginTop: 24 }}>
            2024 Kela Group — Tous droits réservés
          </p>
        </div>
      </div>
    </div>
  );
}
