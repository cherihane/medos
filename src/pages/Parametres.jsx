import { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import Toast from "../components/Toast";
import { useToast } from "../hooks/useToast";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../supabaseClient";

// ─── Rôles internes par type d'établissement ──────────────────────────────────
const ROLES_INTERNES = {
  pharmacie:   ["Gérant", "Pharmacien", "Caissier"],
  hopital:     ["Directeur", "Médecin", "Infirmière", "Pharmacien hospitalier"],
  distributeur:["Directeur", "Commercial", "Logistique"],
  autorite:    ["Ministre", "Inspecteur", "Analyste"],
};

// ─── styles ───────────────────────────────────────────────────────────────────
const inputStyle = {
  width: "100%",
  padding: "9px 13px",
  border: "1.5px solid #E5E7EB",
  borderRadius: 8,
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
  color: "#0A1628",
  backgroundColor: "white",
};

const readonlyInputStyle = {
  ...inputStyle,
  backgroundColor: "#F8FAFC",
  color: "#6B7280",
  cursor: "default",
};

function Card({ title, children, action }) {
  return (
    <div style={{ backgroundColor: "white", borderRadius: 14, padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0A1628" }}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>
        {label}{required && <span style={{ color: "#EF4444", marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function Row({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>{children}</div>;
}

// ─── Section Informations établissement ──────────────────────────────────────
function SectionEtablissement({ etablissement_id }) {
  const { toasts, success, error: toastError } = useToast();
  const [etab, setEtab] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!etablissement_id) return;
    supabase
      .from("etablissements")
      .select("id, nom, type, ville, pays, adresse, email, licence_numero, notes_inscription")
      .eq("id", etablissement_id)
      .single()
      .then(({ data }) => {
        if (data) { setEtab(data); setForm(data); }
      });
  }, [etablissement_id]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.nom?.trim()) return toastError("Le nom est obligatoire.");
    setSaving(true);
    try {
      const { error } = await supabase
        .from("etablissements")
        .update({
          nom: form.nom.trim(),
          adresse: form.adresse?.trim() || null,
          ville: form.ville?.trim() || null,
          pays: form.pays?.trim() || null,
          licence_numero: form.licence_numero?.trim() || null,
        })
        .eq("id", etablissement_id);
      if (error) throw error;
      setEtab(form);
      setEditing(false);
      success("Informations mises à jour.");
    } catch (e) {
      toastError("Erreur : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => { setForm(etab); setEditing(false); };

  if (!etab) return (
    <Card title="Informations de l'établissement">
      <div style={{ color: "#9CA3AF", fontSize: 13 }}>Chargement…</div>
    </Card>
  );

  const s = editing ? inputStyle : readonlyInputStyle;

  return (
    <>
      <Toast toasts={toasts} />
      <Card
        title="Informations de l'établissement"
        action={
          !editing ? (
            <button onClick={() => setEditing(true)} style={{ padding: "7px 16px", backgroundColor: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Modifier
            </button>
          ) : null
        }
      >
        <Row>
          <Field label="Nom de l'établissement" required>
            <input style={s} value={form.nom || ""} onChange={set("nom")} readOnly={!editing} />
          </Field>
          <Field label="Type">
            <input style={readonlyInputStyle} value={form.type || ""} readOnly />
          </Field>
        </Row>
        <Field label="Adresse">
          <input style={s} value={form.adresse || ""} onChange={set("adresse")} readOnly={!editing} placeholder="Rue, quartier" />
        </Field>
        <Row>
          <Field label="Ville">
            <input style={s} value={form.ville || ""} onChange={set("ville")} readOnly={!editing} />
          </Field>
          <Field label="Pays">
            <input style={s} value={form.pays || ""} onChange={set("pays")} readOnly={!editing} />
          </Field>
        </Row>
        <Row>
          <Field label="Email de l'établissement">
            <input style={readonlyInputStyle} value={form.email || ""} readOnly />
          </Field>
          <Field label="Numéro de licence">
            <input style={s} value={form.licence_numero || ""} onChange={set("licence_numero")} readOnly={!editing} placeholder="Ex: MSP-LIC-2024-00123" />
          </Field>
        </Row>

        {editing && (
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <button onClick={handleCancel} style={{ padding: "8px 18px", backgroundColor: "white", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 13, color: "#6B7280", cursor: "pointer" }}>
              Annuler
            </button>
            <button onClick={handleSave} disabled={saving} style={{ padding: "8px 18px", backgroundColor: saving ? "#E5E7EB" : "#10B981", color: saving ? "#9CA3AF" : "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        )}
      </Card>
    </>
  );
}

// ─── Section Gestion du personnel ────────────────────────────────────────────
function SectionPersonnel({ etablissement_id, role }) {
  const { toasts, success, error: toastError } = useToast();
  const [membres, setMembres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [inviting, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const rolesDisponibles = ROLES_INTERNES[role] ?? [];

  const loadMembres = useCallback(async () => {
    if (!etablissement_id) return;
    setLoading(true);
    const { data } = await supabase
      .from("membres_personnel")
      .select("id, email, role_interne, actif, created_at, invitation_acceptee")
      .eq("etablissement_id", etablissement_id)
      .order("created_at", { ascending: false });
    setMembres(data ?? []);
    setLoading(false);
  }, [etablissement_id]);

  useEffect(() => { loadMembres(); }, [loadMembres]);

  const handleInviter = async () => {
    if (!inviteEmail.trim()) return toastError("L'email est obligatoire.");
    if (!inviteRole) return toastError("Veuillez sélectionner un rôle.");
    setSaving(true);
    try {
      // Insérer l'invitation en base
      const { error } = await supabase.from("membres_personnel").insert({
        etablissement_id,
        email: inviteEmail.trim().toLowerCase(),
        role_interne: inviteRole,
        actif: true,
        invitation_acceptee: false,
      });
      if (error) throw error;
      success(`Invitation envoyée à ${inviteEmail.trim()}`);
      setInviteEmail("");
      setInviteRole("");
      setShowInvite(false);
      loadMembres();
    } catch (e) {
      toastError("Erreur : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActif = async (membre) => {
    setUpdatingId(membre.id);
    try {
      const { error } = await supabase
        .from("membres_personnel")
        .update({ actif: !membre.actif })
        .eq("id", membre.id);
      if (error) throw error;
      setMembres((prev) => prev.map((m) => m.id === membre.id ? { ...m, actif: !m.actif } : m));
      success(membre.actif ? `${membre.email} désactivé.` : `${membre.email} réactivé.`);
    } catch (e) {
      toastError("Erreur : " + e.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleChangeRole = async (membre, nouveauRole) => {
    setUpdatingId(membre.id);
    try {
      const { error } = await supabase
        .from("membres_personnel")
        .update({ role_interne: nouveauRole })
        .eq("id", membre.id);
      if (error) throw error;
      setMembres((prev) => prev.map((m) => m.id === membre.id ? { ...m, role_interne: nouveauRole } : m));
      success(`Rôle de ${membre.email} modifié.`);
    } catch (e) {
      toastError("Erreur : " + e.message);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <>
      <Toast toasts={toasts} />
      <Card
        title={`Personnel — ${membres.length} membre${membres.length !== 1 ? "s" : ""}`}
        action={
          <button
            onClick={() => setShowInvite((v) => !v)}
            style={{ padding: "7px 16px", backgroundColor: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            {showInvite ? "Annuler" : "Inviter un membre"}
          </button>
        }
      >
        {/* Formulaire d'invitation */}
        {showInvite && (
          <div style={{ backgroundColor: "#F8FAFC", borderRadius: 10, padding: "16px", marginBottom: 18, border: "1px solid #E5E7EB" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0A1628", marginBottom: 12 }}>Nouvelle invitation</div>
            <Row>
              <Field label="Email professionnel" required>
                <input
                  style={inputStyle}
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="membre@etablissement.com"
                />
              </Field>
              <Field label="Rôle" required>
                <select
                  style={{ ...inputStyle, cursor: "pointer" }}
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                >
                  <option value="">— Sélectionner un rôle —</option>
                  {rolesDisponibles.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
            </Row>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={handleInviter}
                disabled={inviting}
                style={{ padding: "8px 20px", backgroundColor: inviting ? "#E5E7EB" : "#3B82F6", color: inviting ? "#9CA3AF" : "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: inviting ? "not-allowed" : "pointer" }}
              >
                {inviting ? "Envoi…" : "Envoyer l'invitation"}
              </button>
            </div>
          </div>
        )}

        {/* Liste des membres */}
        {loading && <div style={{ color: "#9CA3AF", fontSize: 13 }}>Chargement…</div>}
        {!loading && membres.length === 0 && (
          <div style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, padding: "24px 0" }}>
            Aucun membre. Invitez votre premier collaborateur.
          </div>
        )}
        {!loading && membres.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {/* En-tête */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 180px 100px 100px", gap: 12, padding: "0 12px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <span>Email</span>
              <span>Rôle</span>
              <span>Statut</span>
              <span></span>
            </div>
            {membres.map((m) => (
              <div
                key={m.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 180px 100px 100px",
                  gap: 12,
                  alignItems: "center",
                  padding: "10px 12px",
                  backgroundColor: m.actif ? "#F8FAFC" : "#F9FAFB",
                  borderRadius: 10,
                  opacity: m.actif ? 1 : 0.6,
                }}
              >
                {/* Email + invitation */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0A1628" }}>{m.email}</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>
                    {m.invitation_acceptee ? "Compte actif" : "Invitation en attente"}
                  </div>
                </div>

                {/* Rôle — modifiable */}
                <select
                  value={m.role_interne || ""}
                  disabled={!m.actif || updatingId === m.id}
                  onChange={(e) => handleChangeRole(m, e.target.value)}
                  style={{
                    padding: "5px 8px",
                    border: "1.5px solid #E5E7EB",
                    borderRadius: 6,
                    fontSize: 12,
                    color: "#374151",
                    cursor: m.actif ? "pointer" : "default",
                    backgroundColor: "white",
                  }}
                >
                  {rolesDisponibles.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>

                {/* Badge statut */}
                <span style={{
                  display: "inline-block",
                  padding: "3px 10px",
                  borderRadius: 10,
                  fontSize: 11,
                  fontWeight: 700,
                  backgroundColor: m.actif ? "#DCFCE7" : "#F3F4F6",
                  color: m.actif ? "#16A34A" : "#6B7280",
                }}>
                  {m.actif ? "Actif" : "Inactif"}
                </span>

                {/* Action désactiver / réactiver */}
                <button
                  disabled={updatingId === m.id}
                  onClick={() => handleToggleActif(m)}
                  style={{
                    padding: "5px 10px",
                    borderRadius: 7,
                    border: "1.5px solid",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: updatingId === m.id ? "not-allowed" : "pointer",
                    backgroundColor: "white",
                    borderColor: m.actif ? "#FECACA" : "#D1FAE5",
                    color: m.actif ? "#DC2626" : "#16A34A",
                  }}
                >
                  {updatingId === m.id ? "…" : m.actif ? "Désactiver" : "Réactiver"}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Note explicative */}
        <div style={{ marginTop: 18, padding: "12px 14px", backgroundColor: "#F0F4FB", borderRadius: 10, border: "1px solid #DBEAFE" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1D4ED8", marginBottom: 3 }}>Fonctionnement des invitations</div>
          <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.6 }}>
            Le membre invité reçoit un email avec un lien pour créer son mot de passe.
            Une fois son compte activé, il accède à MedOS avec les droits correspondant à son rôle interne uniquement.
            Vous pouvez modifier son rôle ou désactiver son accès à tout moment.
          </div>
        </div>
      </Card>
    </>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function Parametres() {
  const { auth } = useAuth();
  const etablissement_id = auth?.etablissement_id ?? null;
  const role = auth?.role ?? null;

  return (
    <Layout title="Paramètres" subtitle="Gestion de l'établissement et du personnel">
      {!etablissement_id && (
        <div style={{ backgroundColor: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 10, padding: "14px 18px", fontSize: 13, color: "#92400E", marginBottom: 20 }}>
          Votre compte n'est pas encore associé à un établissement enregistré.
          Contactez l'administrateur MedOS si vous pensez qu'il s'agit d'une erreur.
        </div>
      )}
      <SectionEtablissement etablissement_id={etablissement_id} />
      <SectionPersonnel etablissement_id={etablissement_id} role={role} />
    </Layout>
  );
}
