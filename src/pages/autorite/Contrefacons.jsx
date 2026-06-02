import { useState } from "react";
import Layout from "../../components/Layout";
import Modal, { Field, Row, ModalFooter, inputStyle, selectStyle } from "../../components/Modal";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useContrefacons } from "../../hooks/useSupabaseData";
import { insertAlerte, updateAlerte } from "../../hooks/useMutations";

const graviteStyle = {
  critique:     { bg: "#FEF2F2", color: "#EF4444" },
  alerte:       { bg: "#FFFBEB", color: "#D97706" },
  surveillance: { bg: "#EFF6FF", color: "#2563EB" },
  info:         { bg: "#F0FDF4", color: "#16A34A" },
};

function fmt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

// ── Modal Ouvrir enquête ──────────────────────────────────────────────────────
function EnqueteModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    titre: "",
    produit: "",
    region: "",
    severite: "critique",
    message: "",
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const set = (k) => (e) => { setFormError(null); setForm((f) => ({ ...f, [k]: e.target.value })); };

  const handleSave = async () => {
    if (!form.titre.trim()) { setFormError("Le titre de l'enquête est obligatoire."); return; }
    setSaving(true);
    setFormError(null);
    try {
      await insertAlerte({
        type: "contrefacon",
        severite: form.severite,
        titre: form.titre,
        message: form.message || `Produit: ${form.produit} — Région: ${form.region}`,
        lu: false,
        resolu: false,
      });
      onSaved();
      onClose();
    } catch (e) {
      setFormError("Erreur : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Ouvrir une enquête contrefaçon" onClose={onClose}>
      <Field label="Titre de l'enquête *">
        <input style={inputStyle} value={form.titre} onChange={set("titre")} placeholder="Ex: Amoxicilline contrefaite — lot inconnu" />
      </Field>
      <Row>
        <Field label="Produit concerné">
          <input style={inputStyle} value={form.produit} onChange={set("produit")} placeholder="Nom du médicament" />
        </Field>
        <Field label="Région">
          <input style={inputStyle} value={form.region} onChange={set("region")} placeholder="Ex: Abidjan" />
        </Field>
      </Row>
      <Field label="Niveau de gravité">
        <select style={selectStyle} value={form.severite} onChange={set("severite")}>
          <option value="critique">Critique</option>
          <option value="alerte">Alerte</option>
          <option value="info">Information</option>
        </select>
      </Field>
      <Field label="Description / contexte">
        <textarea
          style={{ ...inputStyle, height: 80, resize: "vertical" }}
          value={form.message}
          onChange={set("message")}
          placeholder="Détails de l'incident, signalements reçus…"
        />
      </Field>
      {formError && (
        <div style={{ padding: "10px 14px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 13, color: "#DC2626" }}>
          {formError}
        </div>
      )}
      <ModalFooter onCancel={onClose} onSubmit={handleSave} submitLabel="Ouvrir l'enquête" saving={saving} />
    </Modal>
  );
}

export default function Contrefacons() {
  const { data: incidents, loading, error, refetch } = useContrefacons();
  const { toasts, success, error: toastError } = useToast();
  const [showEnquete, setShowEnquete] = useState(false);
  const [actioning, setActioning] = useState(null);

  const handleMarquerTraite = async (id) => {
    setActioning(id);
    try {
      await updateAlerte(id, { resolu: true });
      refetch();
      success("Incident marqué comme traité");
    } catch (e) {
      toastError("Erreur : " + e.message);
    } finally {
      setActioning(null);
    }
  };

  return (
    <Layout title="Contrefaçons" subtitle="Détection et lutte contre les médicaments falsifiés">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <Toast toasts={toasts} />

      {showEnquete && (
        <EnqueteModal
          onClose={() => setShowEnquete(false)}
          onSaved={() => { refetch(); success("Enquête ouverte et enregistrée"); }}
        />
      )}

      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Incidents actifs",   value: loading ? "…" : incidents.length,                                        color: "#EF4444" },
          { label: "Critiques",          value: loading ? "…" : incidents.filter(i => i.severite === "critique").length,  color: "#F59E0B" },
          { label: "Alertes",            value: loading ? "…" : incidents.filter(i => i.severite === "alerte").length,    color: "#8B5CF6" },
          { label: "Informations",       value: loading ? "…" : incidents.filter(i => i.severite === "info").length,      color: "#10B981" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: "white", borderRadius: 14, padding: "18px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{k.label}</div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ backgroundColor: "#FEF2F2", padding: "14px 18px", borderRadius: 12, marginBottom: 16, fontSize: 13, color: "#DC2626" }}>
          Une erreur s'est produite. Veuillez réessayer.
        </div>
      )}

      <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0A1628" }}>
            Incidents enregistrés ({loading ? "…" : incidents.length})
          </h3>
          <button
            onClick={() => setShowEnquete(true)}
            style={{ padding: "7px 16px", backgroundColor: "#EF4444", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            + Ouvrir enquête
          </button>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: "#F8FAFC" }}>
              {["Date", "Titre", "Type", "Gravité", "Actions"].map((h) => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6B7280", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && [1,2,3].map((i) => (
              <tr key={i} style={{ borderBottom: "1px solid #F3F4F6", animation: "pulse 1.5s ease-in-out infinite" }}>
                {[80,200,100,80,120].map((w, j) => (
                  <td key={j} style={{ padding: "12px 14px" }}><div style={{ height: 13, width: w, backgroundColor: "#F3F4F6", borderRadius: 6 }} /></td>
                ))}
              </tr>
            ))}
            {!loading && incidents.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Aucun incident de contrefaçon enregistré</td></tr>
            )}
            {!loading && incidents.map((inc) => {
              const g = graviteStyle[inc.severite] ?? graviteStyle.info;
              const isActioning = actioning === inc.id;
              return (
                <tr key={inc.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "12px 14px", color: "#9CA3AF", fontSize: 12 }}>{fmt(inc.created_at)}</td>
                  <td style={{ padding: "12px 14px", fontWeight: 600, color: "#0A1628" }}>
                    {inc.titre}
                    {inc.message && <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2, fontWeight: 400 }}>{inc.message.slice(0, 80)}{inc.message.length > 80 ? "…" : ""}</div>}
                  </td>
                  <td style={{ padding: "12px 14px", color: "#6B7280" }}>{inc.type}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ padding: "3px 10px", backgroundColor: g.bg, color: g.color, borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{inc.severite}</span>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <button
                      onClick={() => handleMarquerTraite(inc.id)}
                      disabled={isActioning}
                      style={{ padding: "4px 12px", backgroundColor: isActioning ? "#F3F4F6" : "#DCFCE7", color: isActioning ? "#9CA3AF" : "#16A34A", border: "none", borderRadius: 6, fontSize: 11, cursor: isActioning ? "wait" : "pointer", fontWeight: 600 }}>
                      {isActioning ? "…" : "Marquer traité"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
