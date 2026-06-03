import { colors } from "../theme";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function MotDePasseOublie() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("Veuillez saisir votre adresse email.");
      return;
    }
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reinitialisation`,
      });
      if (err) throw err;
      setSent(true);
    } catch (err) {
      setError(err.message ?? "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", backgroundColor: colors.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      <div style={{
        backgroundColor: colors.bgCard, borderRadius: 20, padding: "48px 44px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.08)", width: "100%", maxWidth: 420,
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, backgroundColor: "#EFF6FF",
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px",
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: colors.navy }}>Mot de passe oublié</h1>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: colors.textSecondary }}>
            Saisissez votre email pour recevoir un lien de réinitialisation.
          </p>
        </div>

        {sent ? (
          <div style={{ textAlign: "center" }}>
            <div style={{
              backgroundColor: "#DCFCE7", borderRadius: 12, padding: "20px 24px", marginBottom: 24,
            }}>
              <div style={{ fontSize: 13, color: "#16A34A", fontWeight: 600 }}>
                Un email de réinitialisation a été envoyé à <strong>{email}</strong>.
              </div>
              <div style={{ fontSize: 12, color: "#4ADE80", marginTop: 6 }}>
                Vérifiez votre boite de réception et suivez le lien.
              </div>
            </div>
            <button
              onClick={() => navigate("/")}
              style={{
                width: "100%", padding: "12px", backgroundColor: "#3B82F6",
                color: "white", border: "none", borderRadius: 10,
                fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}
            >
              Retour à la connexion
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: colors.text, marginBottom: 6 }}>
                Adresse email
              </label>
              <input
                type="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                style={{
                  width: "100%", padding: "11px 14px", border: "1.5px solid var(--border)",
                  borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box",
                  color: colors.navy,
                }}
              />
            </div>

            {error && (
              <div style={{
                backgroundColor: "#FEF2F2", border: "1px solid #FECACA",
                borderRadius: 8, padding: "10px 14px", marginBottom: 16,
                fontSize: 13, color: "#DC2626",
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", padding: "12px", marginBottom: 16,
                backgroundColor: loading ? "#93C5FD" : "#3B82F6",
                color: "white", border: "none", borderRadius: 10,
                fontSize: 14, fontWeight: 700,
                cursor: loading ? "wait" : "pointer",
              }}
            >
              {loading ? "Envoi en cours…" : "Envoyer le lien"}
            </button>

            <div style={{ textAlign: "center" }}>
              <button
                type="button"
                onClick={() => navigate("/")}
                style={{
                  background: "none", border: "none", color: colors.textSecondary,
                  fontSize: 13, cursor: "pointer", textDecoration: "underline",
                }}
              >
                Retour à la connexion
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
