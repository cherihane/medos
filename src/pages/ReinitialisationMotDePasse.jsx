import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

const inputStyle = {
  width: "100%",
  padding: "11px 14px",
  border: "1.5px solid #E5E7EB",
  borderRadius: 10,
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  color: "#0A1628",
  backgroundColor: "white",
};

export default function ReinitialisationMotDePasse() {
  const navigate = useNavigate();

  const [password, setPassword]     = useState("");
  const [confirm, setConfirm]       = useState("");
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [success, setSuccess]       = useState(false);
  const [tokenReady, setTokenReady] = useState(false);

  // Supabase place le token dans le hash de l'URL lors du clic sur le lien email.
  // Il faut laisser le client Supabase le consommer via onAuthStateChange avant
  // d'afficher le formulaire — sinon updateUser() échoue avec "not authenticated".
  useEffect(() => {
    // Si Supabase a déjà une session active (token hash consommé), on est prêts.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setTokenReady(true);
        return;
      }
      // Sinon, on attend l'événement PASSWORD_RECOVERY ou SIGNED_IN déclenché
      // automatiquement par le client JS quand il lit le hash de l'URL.
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
          setTokenReady(true);
        }
      });
      return () => subscription.unsubscribe();
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      setSuccess(true);
      // Déconnexion propre après la mise à jour pour forcer une reconnexion explicite
      await supabase.auth.signOut();
      setTimeout(() => navigate("/", { state: { message: "Mot de passe mis à jour. Connectez-vous avec votre nouveau mot de passe." } }), 2500);
    } catch (err) {
      if (err.message?.toLowerCase().includes("same password")) {
        setError("Le nouveau mot de passe doit être différent de l'ancien.");
      } else if (err.message?.toLowerCase().includes("weak password")) {
        setError("Mot de passe trop faible. Utilisez au moins 8 caractères avec des lettres et des chiffres.");
      } else {
        setError("Une erreur s'est produite. Le lien a peut-être expiré. Faites une nouvelle demande.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#F0F4FB",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      padding: 20,
    }}>
      <div style={{
        backgroundColor: "white",
        borderRadius: 20,
        padding: "48px 44px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        width: "100%",
        maxWidth: 420,
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, backgroundColor: "#3B82F6",
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0A1628" }}>
            Nouveau mot de passe
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#6B7280" }}>
            Choisissez un mot de passe sécurisé pour votre compte MedOS.
          </p>
        </div>

        {/* Succès */}
        {success && (
          <div style={{
            backgroundColor: "#DCFCE7",
            border: "1px solid #86EFAC",
            borderRadius: 12,
            padding: "20px 24px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#15803D", marginBottom: 6 }}>
              Mot de passe mis à jour
            </div>
            <div style={{ fontSize: 13, color: "#16A34A" }}>
              Redirection vers la connexion en cours…
            </div>
          </div>
        )}

        {/* Lien expiré / token absent */}
        {!success && !tokenReady && (
          <div style={{ textAlign: "center" }}>
            <div style={{
              backgroundColor: "#FEF9C3",
              border: "1px solid #FDE047",
              borderRadius: 12,
              padding: "20px 24px",
              marginBottom: 24,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#854D0E", marginBottom: 6 }}>
                Vérification du lien en cours…
              </div>
              <div style={{ fontSize: 12, color: "#A16207" }}>
                Si cette page ne se charge pas, votre lien a peut-être expiré.
                Faites une nouvelle demande de réinitialisation.
              </div>
            </div>
            <button
              onClick={() => navigate("/mot-de-passe-oublie")}
              style={{
                width: "100%", padding: 12,
                backgroundColor: "#3B82F6", color: "white",
                border: "none", borderRadius: 10,
                fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}
            >
              Faire une nouvelle demande
            </button>
          </div>
        )}

        {/* Formulaire */}
        {!success && tokenReady && (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                Nouveau mot de passe
              </label>
              <input
                type="password"
                placeholder="8 caractères minimum"
                value={password}
                onChange={(e) => { setError(null); setPassword(e.target.value); }}
                autoFocus
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                Confirmer le mot de passe
              </label>
              <input
                type="password"
                placeholder="Répétez le mot de passe"
                value={confirm}
                onChange={(e) => { setError(null); setConfirm(e.target.value); }}
                style={inputStyle}
              />
            </div>

            {/* Indicateur de force */}
            {password.length > 0 && (
              <div>
                <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                  {[1, 2, 3, 4].map((level) => {
                    const strength = password.length >= 12 && /[A-Z]/.test(password) && /[0-9]/.test(password) ? 4
                      : password.length >= 10 ? 3
                      : password.length >= 8 ? 2
                      : 1;
                    const active = level <= strength;
                    const color = strength === 4 ? "#10B981" : strength === 3 ? "#3B82F6" : strength === 2 ? "#F59E0B" : "#EF4444";
                    return (
                      <div key={level} style={{
                        flex: 1, height: 4, borderRadius: 2,
                        backgroundColor: active ? color : "#E5E7EB",
                        transition: "background-color 0.2s",
                      }} />
                    );
                  })}
                </div>
                <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                  {password.length < 8 ? "Trop court" : password.length < 10 ? "Acceptable" : password.length >= 12 && /[A-Z]/.test(password) && /[0-9]/.test(password) ? "Très sécurisé" : "Bon"}
                </div>
              </div>
            )}

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
                backgroundColor: loading ? "#93C5FD" : "#3B82F6",
                color: "white",
                border: "none",
                borderRadius: 10,
                padding: "13px",
                fontSize: 14,
                fontWeight: 700,
                cursor: loading ? "wait" : "pointer",
                marginTop: 4,
              }}
            >
              {loading ? "Mise à jour en cours…" : "Définir le nouveau mot de passe"}
            </button>

            <div style={{ textAlign: "center" }}>
              <button
                type="button"
                onClick={() => navigate("/")}
                style={{
                  background: "none", border: "none",
                  color: "#9CA3AF", fontSize: 12,
                  cursor: "pointer", textDecoration: "underline",
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
