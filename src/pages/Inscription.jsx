import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

// ─── constantes ──────────────────────────────────────────────────────────────
const ROLES = [
  {
    key: "pharmacie",
    label: "Pharmacie",
    desc: "Officine, pharmacie communautaire ou hospitalière",
    icon: "💊",
  },
  {
    key: "hopital",
    label: "Hôpital / Clinique",
    desc: "Structure hospitalière publique ou privée",
    icon: "🏥",
  },
  {
    key: "distributeur",
    label: "Distributeur",
    desc: "Grossiste ou distributeur pharmaceutique",
    icon: "🚚",
  },
  {
    key: "autorite",
    label: "Autorité sanitaire",
    desc: "Ministère de la santé, agence de régulation",
    icon: "🏛️",
  },
];

const PAYS = [
  "Côte d'Ivoire", "Sénégal", "Mali", "Burkina Faso", "Niger",
  "Guinée", "Bénin", "Togo", "Cameroun", "Congo", "RD Congo",
  "Gabon", "Tchad", "Centrafrique", "Madagascar", "Autre",
];

const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  border: "1.5px solid #E5E7EB",
  borderRadius: 8,
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  color: "#0A1628",
  backgroundColor: "white",
};

const labelStyle = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#374151",
  marginBottom: 5,
};

function Field({ label, required, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>
        {label}
        {required && <span style={{ color: "#EF4444", marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

// ─── Étape 1 — Choix du rôle ─────────────────────────────────────────────────
function EtapeRole({ value, onChange }) {
  return (
    <div>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>
        Sélectionnez le type de votre structure de santé.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {ROLES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => onChange(r.key)}
            style={{
              padding: "18px 16px",
              borderRadius: 12,
              border: value === r.key ? "2px solid #3B82F6" : "1.5px solid #E5E7EB",
              backgroundColor: value === r.key ? "#EFF6FF" : "white",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s",
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 6 }}>{r.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: value === r.key ? "#2563EB" : "#0A1628" }}>
              {r.label}
            </div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 3 }}>{r.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Étape 2 — Formulaire ─────────────────────────────────────────────────────
function EtapeFormulaire({ form, onChange }) {
  const set = (k) => (e) => onChange({ ...form, [k]: e.target.value });
  return (
    <div>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>
        Renseignez les informations de votre établissement et de votre compte.
      </p>

      <div style={{ marginBottom: 8, padding: "10px 14px", backgroundColor: "#F0F4FB", borderRadius: 8, fontSize: 12, color: "#374151", fontWeight: 600 }}>
        Etablissement — {ROLES.find((r) => r.key === form.role)?.label}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Nom de l'établissement" required>
          <input style={inputStyle} value={form.nom} onChange={set("nom")} placeholder="Ex: Pharmacie Centrale" />
        </Field>
        <Field label="Numéro de licence / agrément">
          <input style={inputStyle} value={form.licence} onChange={set("licence")} placeholder="Ex: LIC-2024-00123" />
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Ville" required>
          <input style={inputStyle} value={form.ville} onChange={set("ville")} placeholder="Ex: Abidjan" />
        </Field>
        <Field label="Pays" required>
          <select style={{ ...inputStyle, cursor: "pointer" }} value={form.pays} onChange={set("pays")}>
            <option value="">— Sélectionner —</option>
            {PAYS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
      </div>

      <hr style={{ border: "none", borderTop: "1px solid #F3F4F6", margin: "12px 0 16px" }} />
      <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 14 }}>Compte administrateur</div>

      <Field label="Adresse email professionnelle" required>
        <input style={inputStyle} type="email" value={form.email} onChange={set("email")} placeholder="admin@etablissement.com" />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Mot de passe" required>
          <input style={inputStyle} type="password" value={form.password} onChange={set("password")} placeholder="Min. 8 caractères" />
        </Field>
        <Field label="Confirmer le mot de passe" required>
          <input style={inputStyle} type="password" value={form.passwordConfirm} onChange={set("passwordConfirm")} placeholder="Identique au mot de passe" />
        </Field>
      </div>
    </div>
  );
}

// ─── Étape 3 — Confirmation ───────────────────────────────────────────────────
function EtapeConfirmation({ email }) {
  const navigate = useNavigate();
  return (
    <div style={{ textAlign: "center", padding: "20px 0" }}>
      <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0A1628", marginBottom: 8 }}>
        Demande envoyée
      </h2>
      <p style={{ fontSize: 14, color: "#6B7280", maxWidth: 380, margin: "0 auto 20px" }}>
        Votre demande d'accès à MedOS a bien été reçue. Elle est en cours d'examen par notre équipe.
        Vous recevrez une confirmation à <strong>{email}</strong> sous 24–48 h.
      </p>
      <div style={{ backgroundColor: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 10, padding: "12px 18px", fontSize: 12, color: "#92400E", marginBottom: 24, textAlign: "left", maxWidth: 380, margin: "0 auto 24px" }}>
        <strong>Prochaine étape :</strong> une fois votre compte validé, vous pourrez vous connecter
        sur la page de connexion avec votre email et mot de passe.
      </div>
      <button
        onClick={() => navigate("/")}
        style={{ padding: "11px 28px", backgroundColor: "#3B82F6", color: "white", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
      >
        Retour à la connexion
      </button>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
const EMPTY_FORM = {
  role: "",
  nom: "", licence: "", ville: "", pays: "",
  email: "", password: "", passwordConfirm: "",
};

const ETAPES = ["Type de structure", "Informations", "Confirmation"];

export default function Inscription() {
  const navigate = useNavigate();
  const [etape, setEtape] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [emailConfirme, setEmailConfirme] = useState("");

  const validerEtape0 = () => {
    if (!form.role) { setErreur("Veuillez choisir un type de structure."); return false; }
    return true;
  };

  const validerEtape1 = () => {
    if (!form.nom.trim()) { setErreur("Le nom de l'établissement est obligatoire."); return false; }
    if (!form.ville.trim()) { setErreur("La ville est obligatoire."); return false; }
    if (!form.pays) { setErreur("Le pays est obligatoire."); return false; }
    if (!form.email.trim()) { setErreur("L'email est obligatoire."); return false; }
    if (form.password.length < 8) { setErreur("Le mot de passe doit contenir au moins 8 caractères."); return false; }
    if (form.password !== form.passwordConfirm) { setErreur("Les mots de passe ne correspondent pas."); return false; }
    return true;
  };

  const handleSuivant = () => {
    setErreur(null);
    if (etape === 0 && !validerEtape0()) return;
    if (etape === 1 && !validerEtape1()) return;
    setEtape((e) => e + 1);
  };

  const handleSoumettre = async () => {
    setErreur(null);
    if (!validerEtape1()) return;
    setSaving(true);
    try {
      // 1. Créer le compte Supabase Auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: { data: { role: form.role } },
      });
      if (signUpError) throw new Error(signUpError.message);

      // 2. Insérer dans etablissements avec statut en_attente
      const { error: insertError } = await supabase.from("etablissements").insert({
        nom: form.nom.trim(),
        type: form.role,
        ville: form.ville.trim(),
        pays: form.pays,
        email: form.email.trim(),
        ...(form.licence.trim() ? { licence_numero: form.licence.trim() } : {}),
        statut_inscription: "en_attente",
        actif: false,
      });
      if (insertError) throw new Error(insertError.message);

      // 3. Déconnecter immédiatement (le compte n'est pas encore validé)
      await supabase.auth.signOut();

      setEmailConfirme(form.email.trim());
      setEtape(2);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#F8FAFC",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    }}>
      <div style={{ width: "100%", maxWidth: 540 }}>
        {/* En-tête */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#0A1628", letterSpacing: "-0.5px", marginBottom: 4 }}>
            Med<span style={{ color: "#3B82F6" }}>OS</span>
          </div>
          <div style={{ fontSize: 13, color: "#9CA3AF" }}>Demander un accès</div>
        </div>

        {/* Carte */}
        <div style={{ backgroundColor: "white", borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", padding: "28px 32px" }}>

          {/* Stepper */}
          {etape < 2 && (
            <div style={{ display: "flex", alignItems: "center", marginBottom: 28 }}>
              {ETAPES.slice(0, 2).map((label, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", flex: i < 1 ? 1 : "initial" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%",
                      backgroundColor: i < etape ? "#10B981" : i === etape ? "#3B82F6" : "#E5E7EB",
                      color: i <= etape ? "white" : "#9CA3AF",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700, flexShrink: 0,
                    }}>
                      {i < etape ? "✓" : i + 1}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: i === etape ? 700 : 400, color: i === etape ? "#0A1628" : "#9CA3AF", whiteSpace: "nowrap" }}>
                      {label}
                    </span>
                  </div>
                  {i < 1 && <div style={{ flex: 1, height: 1, backgroundColor: i < etape ? "#10B981" : "#E5E7EB", margin: "0 10px" }} />}
                </div>
              ))}
            </div>
          )}

          {/* Titre de l'étape */}
          {etape < 2 && (
            <h2 style={{ fontSize: 17, fontWeight: 800, color: "#0A1628", marginBottom: 18 }}>
              {etape === 0 ? "Quel type de structure représentez-vous ?" : "Informations de votre établissement"}
            </h2>
          )}

          {/* Contenu */}
          {etape === 0 && <EtapeRole value={form.role} onChange={(r) => setForm((f) => ({ ...f, role: r }))} />}
          {etape === 1 && <EtapeFormulaire form={form} onChange={setForm} />}
          {etape === 2 && <EtapeConfirmation email={emailConfirme} />}

          {/* Message d'erreur */}
          {erreur && (
            <div style={{ marginTop: 14, padding: "10px 14px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 13, color: "#DC2626" }}>
              {erreur}
            </div>
          )}

          {/* Boutons de navigation */}
          {etape < 2 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 22 }}>
              <button
                type="button"
                onClick={() => etape === 0 ? navigate("/") : setEtape((e) => e - 1)}
                style={{ padding: "10px 20px", backgroundColor: "white", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 13, color: "#6B7280", cursor: "pointer", fontWeight: 600 }}
              >
                {etape === 0 ? "Retour à la connexion" : "Précédent"}
              </button>

              {etape === 0 && (
                <button
                  type="button"
                  onClick={handleSuivant}
                  disabled={!form.role}
                  style={{
                    padding: "10px 24px", backgroundColor: form.role ? "#3B82F6" : "#E5E7EB",
                    color: form.role ? "white" : "#9CA3AF",
                    border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700,
                    cursor: form.role ? "pointer" : "not-allowed",
                  }}
                >
                  Suivant
                </button>
              )}

              {etape === 1 && (
                <button
                  type="button"
                  onClick={handleSoumettre}
                  disabled={saving}
                  style={{
                    padding: "10px 24px", backgroundColor: saving ? "#E5E7EB" : "#10B981",
                    color: saving ? "#9CA3AF" : "white",
                    border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700,
                    cursor: saving ? "not-allowed" : "pointer",
                  }}
                >
                  {saving ? "Envoi en cours…" : "Soumettre la demande"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
