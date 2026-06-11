import { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import Toast from "../components/Toast";
import { useToast } from "../hooks/useToast";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../supabaseClient";
import { colors, radius, shadow, font } from "../theme";
import { useDarkMode } from "../context/DarkModeContext";

// ─── Pages disponibles par rôle ──────────────────────────────────────────────
// Ces chemins correspondent exactement aux nav dans AuthContext.roleConfig.
const PAGES_PAR_ROLE = {
  pharmacie: [
    { path: "/pharmacie/dashboard",   label: "Dashboard" },
    { path: "/pharmacie/caisse",      label: "Caisse" },
    { path: "/pharmacie/inventaire",  label: "Inventaire" },
    { path: "/pharmacie/ordonnances", label: "Ordonnances" },
    { path: "/pharmacie/patients",    label: "Patients" },
    { path: "/pharmacie/fournisseurs",label: "Fournisseurs" },
    { path: "/pharmacie/credits",     label: "Crédits" },
    { path: "/pharmacie/rapports",    label: "Rapports" },
    { path: "/pharmacie/scanner",     label: "Scanner" },
  ],
  hopital: [
    { path: "/hopital/dashboard",    label: "Dashboard" },
    { path: "/hopital/stock",        label: "Stock" },
    { path: "/hopital/fournisseurs", label: "Fournisseurs" },
    { path: "/hopital/patients",     label: "Patients" },
    { path: "/hopital/predictions",  label: "Prédictions IA" },
    { path: "/hopital/scanner",      label: "Scanner" },
    { path: "/hopital/assistant",    label: "Assistant IA" },
    { path: "/hopital/reseau",       label: "Réseau" },
    { path: "/hopital/alertes",      label: "Alertes" },
    { path: "/hopital/rapports",     label: "Rapports" },
  ],
  distributeur: [
    { path: "/distributeur/dashboard",      label: "Dashboard" },
    { path: "/distributeur/reseau-clients", label: "Réseau clients" },
    { path: "/distributeur/previsions",     label: "Prévisions" },
    { path: "/distributeur/livraisons",     label: "Livraisons" },
    { path: "/distributeur/tracabilite",    label: "Traçabilité" },
    { path: "/distributeur/entrepot",       label: "Entrepôt" },
    { path: "/distributeur/clients",        label: "Clients" },
    { path: "/distributeur/alertes",        label: "Alertes" },
  ],
  autorite: [
    { path: "/autorite/vue-nationale",  label: "Vue nationale" },
    { path: "/autorite/cartographie",   label: "Cartographie" },
    { path: "/autorite/contrefacons",   label: "Contrefaçons" },
    { path: "/autorite/epidemiologie",  label: "Épidémiologie" },
    { path: "/autorite/acteurs",        label: "Acteurs" },
    { path: "/autorite/rapports-odd",   label: "Rapports ODD" },
    { path: "/autorite/api",            label: "API" },
  ],
};

// Permissions suggérées par défaut selon le role_interne
const PERMISSIONS_DEFAUT = {
  pharmacie: {
    Gérant:       null, // accès complet = laisser vide → on utilisera toutes les pages
    Pharmacien:   ["/pharmacie/dashboard", "/pharmacie/inventaire", "/pharmacie/ordonnances", "/pharmacie/patients", "/pharmacie/scanner"],
    Caissier:     ["/pharmacie/caisse", "/pharmacie/scanner"],
  },
  hopital: {
    Directeur:                null,
    "Médecin":                ["/hopital/dashboard", "/hopital/patients", "/hopital/consultations", "/hopital/mes-consultations", "/hopital/examens", "/hopital/assistant", "/hopital/alertes", "/hopital/agenda", "/hopital/transmission", "/hopital/transmission-garde", "/hopital/renouvellements", "/hopital/urgences", "/hopital/maternite", "/hopital/bloc"],
    "Infirmière":             ["/hopital/dashboard", "/hopital/patients", "/hopital/consultations", "/hopital/lits", "/hopital/mon-service", "/hopital/alertes", "/hopital/transmission-garde", "/hopital/urgences", "/hopital/maternite", "/hopital/bloc"],
    "Sage-femme":             ["/hopital/dashboard", "/hopital/maternite", "/hopital/patients", "/hopital/alertes"],
    "Pharmacien hospitalier": ["/hopital/stock", "/hopital/patients", "/hopital/scanner", "/hopital/alertes"],
    "Secrétaire médicale":    ["/hopital/dashboard", "/hopital/consultations", "/hopital/patients", "/hopital/facturation", "/hopital/caisse", "/hopital/agenda"],
    "Laborantin":             ["/hopital/examens", "/hopital/alertes"],
    "Caissier":               ["/hopital/facturation", "/hopital/caisse"],
    "Aide-soignant":          ["/hopital/lits", "/hopital/mon-service", "/hopital/alertes"],
  },
  distributeur: {
    Directeur:  null,
    Commercial: ["/distributeur/dashboard", "/distributeur/reseau-clients", "/distributeur/clients", "/distributeur/previsions"],
    Logistique: ["/distributeur/entrepot", "/distributeur/livraisons", "/distributeur/tracabilite"],
  },
  autorite: {
    Ministre:   null,
    Inspecteur: null,
    Analyste:   null,
  },
};

const ROLES_INTERNES = {
  pharmacie:    ["Gérant", "Pharmacien", "Caissier"],
  hopital:      ["Directeur", "Médecin", "Infirmière", "Sage-femme", "Pharmacien hospitalier", "Secrétaire médicale", "Laborantin", "Caissier", "Aide-soignant"],
  distributeur: ["Directeur", "Commercial", "Logistique"],
  autorite:     ["Ministre", "Inspecteur", "Analyste"],
};

// ─── styles ───────────────────────────────────────────────────────────────────
const inputStyle = {
  width: "100%",
  padding: "9px 13px",
  border: "1.5px solid var(--border)",
  borderRadius: 8,
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
  color: colors.navy,
  backgroundColor: colors.bgCard,
};

const readonlyInputStyle = {
  ...inputStyle,
  backgroundColor: colors.bgSurface,
  color: colors.textSecondary,
  cursor: "default",
};

function Card({ title, children, action }) {
  return (
    <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.navy }}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: colors.text, marginBottom: 5 }}>
        {label}{required && <span style={{ color: "#EF4444", marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function Row({ children }) {
  return <div className="form-row-2" style={{ gap: 14 }}>{children}</div>;
}

// ─── Composant checkboxes de permissions ─────────────────────────────────────
function PermissionsCheckboxes({ role, selected, onChange }) {
  const pages = PAGES_PAR_ROLE[role] ?? [];
  const allPaths = pages.map((p) => p.path);
  const allChecked = allPaths.every((p) => selected.includes(p));

  const toggle = (path) => {
    onChange(selected.includes(path)
      ? selected.filter((p) => p !== path)
      : [...selected, path]
    );
  };

  const toggleAll = () => {
    onChange(allChecked ? [] : allPaths);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, fontWeight: 700, color: colors.text }}>
          <input
            type="checkbox"
            checked={allChecked}
            onChange={toggleAll}
            style={{ width: 14, height: 14, cursor: "pointer" }}
          />
          Tout sélectionner
        </label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
        {pages.map((page) => (
          <label
            key={page.path}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "7px 10px",
              borderRadius: 7,
              border: `1.5px solid ${selected.includes(page.path) ? "#BFDBFE" : "#E5E7EB"}`,
              backgroundColor: selected.includes(page.path) ? "#EFF6FF" : "#F8FAFC",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: selected.includes(page.path) ? 600 : 400,
              color: selected.includes(page.path) ? "#1D4ED8" : "#374151",
            }}
          >
            <input
              type="checkbox"
              checked={selected.includes(page.path)}
              onChange={() => toggle(page.path)}
              style={{ width: 13, height: 13, cursor: "pointer" }}
            />
            {page.label}
          </label>
        ))}
      </div>
      {selected.length === 0 && (
        <div style={{ fontSize: 11, color: "#EF4444", marginTop: 6 }}>
          Aucune page sélectionnée — le membre ne pourra accéder à aucune section.
        </div>
      )}
    </div>
  );
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
      <div style={{ color: colors.textMuted, fontSize: 13 }}>Chargement…</div>
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
            <button onClick={handleCancel} style={{ padding: "8px 18px", backgroundColor: colors.bgCard, border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 13, color: colors.textSecondary, cursor: "pointer" }}>
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

  // État formulaire invitation
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [invitePerms, setInvitePerms] = useState([]);
  const [inviting, setInviting] = useState(false);

  // Édition permissions d'un membre existant
  const [editPermsId, setEditPermsId] = useState(null); // id du membre en cours d'édition
  const [editPermsValues, setEditPermsValues] = useState([]);
  const [savingPermsId, setSavingPermsId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  const rolesDisponibles = ROLES_INTERNES[role] ?? [];
  const pagesDisponibles = PAGES_PAR_ROLE[role] ?? [];

  const loadMembres = useCallback(async () => {
    if (!etablissement_id) return;
    setLoading(true);
    const { data } = await supabase
      .from("membres_personnel")
      .select("id, email, role_interne, actif, created_at, invitation_acceptee, permissions_nav")
      .eq("etablissement_id", etablissement_id)
      .order("created_at", { ascending: false });
    setMembres(data ?? []);
    setLoading(false);
  }, [etablissement_id]);

  useEffect(() => { loadMembres(); }, [loadMembres]);

  // Quand le role d'invitation change, pré-cocher les permissions suggérées
  const handleInviteRoleChange = (r) => {
    setInviteRole(r);
    const defaut = PERMISSIONS_DEFAUT[role]?.[r];
    // null = accès complet → cocher toutes les pages
    setInvitePerms(defaut === null || defaut === undefined
      ? pagesDisponibles.map((p) => p.path)
      : defaut
    );
  };

  const handleInviter = async () => {
    if (!inviteEmail.trim()) return toastError("L'email est obligatoire.");
    if (!inviteRole) return toastError("Veuillez sélectionner un rôle.");
    if (invitePerms.length === 0) return toastError("Veuillez sélectionner au moins une page.");
    setInviting(true);
    try {
      const { error } = await supabase.from("membres_personnel").insert({
        etablissement_id,
        email: inviteEmail.trim().toLowerCase(),
        role_interne: inviteRole,
        permissions_nav: invitePerms,
        actif: true,
        invitation_acceptee: false,
      });
      if (error) throw error;
      success(`Invitation envoyée à ${inviteEmail.trim()}`);
      setInviteEmail("");
      setInviteRole("");
      setInvitePerms([]);
      setShowInvite(false);
      loadMembres();
    } catch (e) {
      toastError("Erreur : " + e.message);
    } finally {
      setInviting(false);
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

  const openEditPerms = (membre) => {
    setEditPermsId(membre.id);
    setEditPermsValues(
      Array.isArray(membre.permissions_nav) && membre.permissions_nav.length > 0
        ? membre.permissions_nav
        : pagesDisponibles.map((p) => p.path)
    );
  };

  const handleSavePerms = async (membre) => {
    if (editPermsValues.length === 0) return toastError("Sélectionnez au moins une page.");
    setSavingPermsId(membre.id);
    try {
      const { error } = await supabase
        .from("membres_personnel")
        .update({ permissions_nav: editPermsValues })
        .eq("id", membre.id);
      if (error) throw error;
      setMembres((prev) => prev.map((m) => m.id === membre.id ? { ...m, permissions_nav: editPermsValues } : m));
      setEditPermsId(null);
      success(`Permissions de ${membre.email} mises à jour.`);
    } catch (e) {
      toastError("Erreur : " + e.message);
    } finally {
      setSavingPermsId(null);
    }
  };

  // Résumé lisible des permissions d'un membre
  const permsSummary = (membre) => {
    const perms = membre.permissions_nav;
    if (!Array.isArray(perms) || perms.length === 0) return "Permissions non définies";
    if (perms.length === pagesDisponibles.length) return "Toutes les pages";
    return pagesDisponibles
      .filter((p) => perms.includes(p.path))
      .map((p) => p.label)
      .join(", ");
  };

  return (
    <>
      <Toast toasts={toasts} />
      <Card
        title={`Personnel — ${membres.length} membre${membres.length !== 1 ? "s" : ""}`}
        action={
          <button
            onClick={() => { setShowInvite((v) => !v); if (showInvite) { setInviteEmail(""); setInviteRole(""); setInvitePerms([]); } }}
            style={{ padding: "7px 16px", backgroundColor: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            {showInvite ? "Annuler" : "Inviter un membre"}
          </button>
        }
      >
        {/* ── Formulaire d'invitation ── */}
        {showInvite && (
          <div style={{ backgroundColor: colors.bgSurface, borderRadius: 10, padding: "18px", marginBottom: 20, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy, marginBottom: 14 }}>Nouvelle invitation</div>

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
              <Field label="Rôle interne" required>
                <select
                  style={{ ...inputStyle, cursor: "pointer" }}
                  value={inviteRole}
                  onChange={(e) => handleInviteRoleChange(e.target.value)}
                >
                  <option value="">— Sélectionner un rôle —</option>
                  {rolesDisponibles.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
            </Row>

            {/* Permissions */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: colors.text, marginBottom: 8 }}>
                Pages accessibles <span style={{ color: "#EF4444" }}>*</span>
                {inviteRole && (
                  <span style={{ marginLeft: 8, fontSize: 11, color: colors.textSecondary, fontWeight: 400 }}>
                    — pré-remplies selon le rôle, modifiables
                  </span>
                )}
              </label>
              {pagesDisponibles.length > 0 ? (
                <PermissionsCheckboxes
                  role={role}
                  selected={invitePerms}
                  onChange={setInvitePerms}
                />
              ) : (
                <div style={{ fontSize: 12, color: colors.textMuted }}>Sélectionnez d'abord un rôle.</div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={handleInviter}
                disabled={inviting}
                style={{
                  padding: "8px 20px",
                  backgroundColor: inviting ? "#E5E7EB" : "#3B82F6",
                  color: inviting ? "#9CA3AF" : "white",
                  border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: inviting ? "not-allowed" : "pointer",
                }}
              >
                {inviting ? "Envoi…" : "Envoyer l'invitation"}
              </button>
            </div>
          </div>
        )}

        {/* ── Liste des membres ── */}
        {loading && <div style={{ color: colors.textMuted, fontSize: 13 }}>Chargement…</div>}
        {!loading && membres.length === 0 && (
          <div style={{ textAlign: "center", color: colors.textMuted, fontSize: 13, padding: "24px 0" }}>
            Aucun membre. Invitez votre premier collaborateur.
          </div>
        )}
        {!loading && membres.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {membres.map((m) => (
              <div key={m.id} style={{ border: "1.5px solid var(--border)", borderRadius: 10, overflow: "hidden", opacity: m.actif ? 1 : 0.65 }}>
                {/* Ligne principale */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 160px auto auto auto", gap: 12, alignItems: "center", padding: "10px 14px", backgroundColor: m.actif ? "#F8FAFC" : "#F3F4F6" }}>
                  {/* Email */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: colors.navy }}>{m.email}</div>
                    <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
                      {m.invitation_acceptee ? "Compte actif" : "Invitation en attente"}
                    </div>
                  </div>

                  {/* Rôle — modifiable */}
                  <select
                    value={m.role_interne || ""}
                    disabled={!m.actif || updatingId === m.id}
                    onChange={(e) => handleChangeRole(m, e.target.value)}
                    style={{ padding: "5px 8px", border: "1.5px solid var(--border)", borderRadius: 6, fontSize: 12, color: colors.text, cursor: m.actif ? "pointer" : "default", backgroundColor: colors.bgCard }}
                  >
                    {rolesDisponibles.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>

                  {/* Badge statut */}
                  <span style={{ padding: "3px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700, backgroundColor: m.actif ? "#DCFCE7" : "#F3F4F6", color: m.actif ? "#16A34A" : "#6B7280", whiteSpace: "nowrap" }}>
                    {m.actif ? "Actif" : "Inactif"}
                  </span>

                  {/* Modifier permissions */}
                  <button
                    onClick={() => editPermsId === m.id ? setEditPermsId(null) : openEditPerms(m)}
                    style={{ padding: "5px 10px", borderRadius: 7, border: "1.5px solid #BFDBFE", fontSize: 11, fontWeight: 600, cursor: "pointer", backgroundColor: editPermsId === m.id ? "#EFF6FF" : "white", color: "#2563EB", whiteSpace: "nowrap" }}
                  >
                    {editPermsId === m.id ? "Fermer" : "Permissions"}
                  </button>

                  {/* Désactiver / Réactiver */}
                  <button
                    disabled={updatingId === m.id}
                    onClick={() => handleToggleActif(m)}
                    style={{ padding: "5px 10px", borderRadius: 7, border: "1.5px solid", fontSize: 11, fontWeight: 600, cursor: updatingId === m.id ? "not-allowed" : "pointer", backgroundColor: colors.bgCard, borderColor: m.actif ? "#FECACA" : "#D1FAE5", color: m.actif ? "#DC2626" : "#16A34A", whiteSpace: "nowrap" }}
                  >
                    {updatingId === m.id ? "…" : m.actif ? "Désactiver" : "Réactiver"}
                  </button>
                </div>

                {/* Résumé permissions (toujours visible) */}
                {editPermsId !== m.id && (
                  <div style={{ padding: "6px 14px 8px", backgroundColor: colors.bgCard, borderTop: "1px solid var(--border-light)", fontSize: 11, color: colors.textSecondary }}>
                    <span style={{ fontWeight: 600 }}>Accès : </span>{permsSummary(m)}
                  </div>
                )}

                {/* Panel édition permissions inline */}
                {editPermsId === m.id && (
                  <div style={{ padding: "14px 16px", backgroundColor: colors.bgCard, borderTop: "1.5px solid #BFDBFE" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#1D4ED8", marginBottom: 10 }}>
                      Modifier les permissions de {m.email}
                    </div>
                    <PermissionsCheckboxes
                      role={role}
                      selected={editPermsValues}
                      onChange={setEditPermsValues}
                    />
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
                      <button
                        onClick={() => setEditPermsId(null)}
                        style={{ padding: "7px 16px", backgroundColor: colors.bgCard, border: "1.5px solid var(--border)", borderRadius: 7, fontSize: 12, color: colors.textSecondary, cursor: "pointer" }}
                      >
                        Annuler
                      </button>
                      <button
                        onClick={() => handleSavePerms(m)}
                        disabled={savingPermsId === m.id}
                        style={{ padding: "7px 16px", backgroundColor: savingPermsId === m.id ? "#E5E7EB" : "#10B981", color: savingPermsId === m.id ? "#9CA3AF" : "white", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: savingPermsId === m.id ? "not-allowed" : "pointer" }}
                      >
                        {savingPermsId === m.id ? "Enregistrement…" : "Enregistrer"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Note explicative */}
        <div style={{ marginTop: 18, padding: "12px 14px", backgroundColor: colors.bg, borderRadius: 10, border: "1px solid #DBEAFE" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1D4ED8", marginBottom: 3 }}>Fonctionnement des permissions</div>
          <div style={{ fontSize: 12, color: colors.text, lineHeight: 1.6 }}>
            Les permissions définissent exactement les pages visibles dans le menu de chaque membre.
            Elles sont appliquées dès la prochaine connexion du membre.
            Le rôle interne sert uniquement de catégorie — ce sont les cases cochées qui déterminent l'accès réel.
          </div>
        </div>
      </Card>
    </>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
function SectionApparence() {
  const { dark, toggleDark } = useDarkMode();
  return (
    <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 24 }}>
      <h2 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: colors.navy }}>Apparence</h2>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>Mode sombre</div>
          <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>Fond #0F172A, cards #1E293B — reposant pour les longues sessions</div>
        </div>
        <button
          onClick={toggleDark}
          style={{
            width: 52, height: 28, borderRadius: 14, border: "none", cursor: "pointer", position: "relative",
            backgroundColor: dark ? "#3B82F6" : "#E5E7EB", transition: "background-color 0.2s",
            flexShrink: 0,
          }}
        >
          <div style={{
            position: "absolute", top: 3, left: dark ? 27 : 3, width: 22, height: 22,
            borderRadius: "50%", backgroundColor: colors.bgCard, boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
            transition: "left 0.2s",
          }} />
        </button>
      </div>
    </div>
  );
}

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
      <SectionApparence />
      <SectionEtablissement etablissement_id={etablissement_id} />
      <SectionPersonnel etablissement_id={etablissement_id} role={role} />
    </Layout>
  );
}
