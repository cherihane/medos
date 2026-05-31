import { useState } from "react";
import Layout from "../../components/Layout";
import Modal, { Field, Row, ModalFooter, inputStyle, selectStyle } from "../../components/Modal";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useEtablissements, useMedicaments } from "../../hooks/useSupabaseData";
import { insertCommande } from "../../hooks/useMutations";

// ── Modal Détails établissement ───────────────────────────────────────────────
function EtabModal({ etab, onClose }) {
  return (
    <Modal title={etab.nom} onClose={onClose} width={460}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[
          { label: "Type",    value: etab.type || "—" },
          { label: "Ville",   value: etab.ville || "—" },
          { label: "Statut",  value: etab.actif ? "Actif" : "Inactif" },
          { label: "Téléphone", value: etab.telephone || "—" },
          { label: "Email",   value: etab.email || "—" },
          { label: "Adresse", value: etab.adresse || "—" },
        ].map((item) => (
          <div key={item.label} style={{ padding: "10px 14px", backgroundColor: "#F8FAFC", borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 3, textTransform: "capitalize" }}>{item.label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0A1628" }}>{item.value}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16 }}>
        <button onClick={onClose} style={{ width: "100%", padding: "10px", backgroundColor: "#F8FAFC", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, cursor: "pointer" }}>Fermer</button>
      </div>
    </Modal>
  );
}

// ── Modal Proposer redistribution ─────────────────────────────────────────────
function RedistribModal({ etab, medicaments, onClose, onSaved }) {
  const [form, setForm] = useState({ medicament_id: "", quantite: 10, notes: "" });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const selectedMed = medicaments.find((m) => m.id === form.medicament_id);

  const handleSave = async () => {
    if (!form.medicament_id) return alert("Sélectionnez un médicament.");
    setSaving(true);
    try {
      await insertCommande({
        statut: "envoyee",
        date_commande: new Date().toISOString(),
        montant_total: 0,
        notes: `Redistribution → ${etab.nom} : ${selectedMed?.nom} — Qté: ${form.quantite}${form.notes ? " — " + form.notes : ""}`,
      });
      onSaved();
      onClose();
    } catch (e) {
      alert("Erreur : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Redistribution → ${etab.nom}`} onClose={onClose}>
      <Field label="Médicament à transférer">
        <select style={selectStyle} value={form.medicament_id} onChange={set("medicament_id")}>
          <option value="">— Sélectionner —</option>
          {medicaments.map((m) => <option key={m.id} value={m.id}>{m.nom} (stock: {m.stock_actuel ?? 0})</option>)}
        </select>
      </Field>
      <Field label="Quantité proposée">
        <input style={inputStyle} type="number" min="1" value={form.quantite} onChange={set("quantite")} />
      </Field>
      <Field label="Message / justification">
        <input style={inputStyle} value={form.notes} onChange={set("notes")} placeholder="Ex: Surplus de stock, urgence…" />
      </Field>
      <ModalFooter onCancel={onClose} onSubmit={handleSave} submitLabel="Envoyer la proposition" saving={saving} />
    </Modal>
  );
}

export default function Reseau() {
  const { data: etablissements, loading } = useEtablissements();
  const { data: medicaments } = useMedicaments();
  const { toasts, success } = useToast();
  const [etabModal, setEtabModal] = useState(null);
  const [redistribModal, setRedistribModal] = useState(null);

  return (
    <Layout title="Réseau Hospitalier" subtitle="Connexions inter-établissements et partage de ressources">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <Toast toasts={toasts} />

      {etabModal && <EtabModal etab={etabModal} onClose={() => setEtabModal(null)} />}
      {redistribModal && (
        <RedistribModal
          etab={redistribModal}
          medicaments={medicaments}
          onClose={() => setRedistribModal(null)}
          onSaved={() => success("Proposition de redistribution envoyée")}
        />
      )}

      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Établissements connectés", value: loading ? "…" : etablissements.length, color: "#10B981" },
          { label: "Hôpitaux",   value: loading ? "…" : etablissements.filter(e => e.type === "hopital").length, color: "#3B82F6" },
          { label: "Pharmacies", value: loading ? "…" : etablissements.filter(e => e.type === "pharmacie").length, color: "#8B5CF6" },
          { label: "Distributeurs", value: loading ? "…" : etablissements.filter(e => e.type === "distributeur").length, color: "#F59E0B" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: "white", borderRadius: 14, padding: "18px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Établissements du réseau</h3>
        {loading && [1,2,3].map((i) => (
          <div key={i} style={{ height: 60, backgroundColor: "#F8FAFC", borderRadius: 10, marginBottom: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
        ))}
        {!loading && etablissements.map((e) => (
          <div key={e.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", backgroundColor: "#F8FAFC", borderRadius: 10, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#10B981" }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#0A1628" }}>{e.nom}</div>
                <div style={{ fontSize: 11, color: "#9CA3AF", textTransform: "capitalize" }}>{e.type} · {e.ville}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setEtabModal(e)}
                style={{ padding: "4px 10px", backgroundColor: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                Voir fiche
              </button>
              <button
                onClick={() => setRedistribModal(e)}
                style={{ padding: "4px 10px", backgroundColor: "#DCFCE7", color: "#16A34A", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                Redistribuer
              </button>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
