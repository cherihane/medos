import { useState } from "react";
import Layout from "../../components/Layout";
import Modal, { Field, Row, ModalFooter, inputStyle, selectStyle } from "../../components/Modal";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useEtablissements, useFournisseurs } from "../../hooks/useSupabaseData";
import { insertLivraison } from "../../hooks/useMutations";

// ── Modal Fiche client ─────────────────────────────────────────────────────────
function FicheModal({ client, onClose }) {
  return (
    <Modal title={client.nom} onClose={onClose} width={460}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[
          { label: "Type",      value: client.type || "—" },
          { label: "Ville",     value: client.ville || "—" },
          { label: "Statut",    value: client.actif ? "Actif" : "Inactif" },
          { label: "Téléphone", value: client.telephone || "—" },
          { label: "Email",     value: client.email || "—" },
          { label: "Adresse",   value: client.adresse || "—" },
        ].map((item) => (
          <div key={item.label} style={{ padding: "10px 14px", backgroundColor: "#F8FAFC", borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 3 }}>{item.label}</div>
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

// ── Modal Créer livraison ─────────────────────────────────────────────────────
function LivraisonModal({ client, onClose, onSaved }) {
  const [form, setForm] = useState({
    transporteur: "",
    numero_suivi: "",
    date_depart: new Date().toISOString().slice(0, 10),
    date_arrivee_prevue: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await insertLivraison({
        etablissement_id: client.id,
        statut: "planifiee",
        transporteur: form.transporteur || null,
        numero_suivi: form.numero_suivi || "LIV-" + Date.now().toString().slice(-8),
        date_depart: form.date_depart || null,
        date_arrivee_prevue: form.date_arrivee_prevue || null,
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
    <Modal title={`Nouvelle livraison → ${client.nom}`} onClose={onClose}>
      <Field label="Transporteur">
        <input style={inputStyle} value={form.transporteur} onChange={set("transporteur")} placeholder="Ex: DHL, Transport Koné…" />
      </Field>
      <Field label="Numéro de suivi">
        <input style={inputStyle} value={form.numero_suivi} onChange={set("numero_suivi")} placeholder="Généré auto si vide" />
      </Field>
      <Row>
        <Field label="Date de départ">
          <input style={inputStyle} type="date" value={form.date_depart} onChange={set("date_depart")} />
        </Field>
        <Field label="Arrivée prévue">
          <input style={inputStyle} type="date" value={form.date_arrivee_prevue} onChange={set("date_arrivee_prevue")} />
        </Field>
      </Row>
      <ModalFooter onCancel={onClose} onSubmit={handleSave} submitLabel="Créer la livraison" saving={saving} />
    </Modal>
  );
}

export default function Clients() {
  const { data: etabs, loading, error } = useEtablissements();
  const { toasts, success } = useToast();
  const [ficheModal, setFicheModal] = useState(null);
  const [livraisonModal, setLivraisonModal] = useState(null);

  return (
    <Layout title="Clients" subtitle="Gestion et suivi des comptes clients">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <Toast toasts={toasts} />

      {ficheModal && <FicheModal client={ficheModal} onClose={() => setFicheModal(null)} />}
      {livraisonModal && (
        <LivraisonModal
          client={livraisonModal}
          onClose={() => setLivraisonModal(null)}
          onSaved={() => success(`Livraison créée pour ${livraisonModal.nom}`)}
        />
      )}

      {error && (
        <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "14px 18px", marginBottom: 16, fontSize: 13, color: "#DC2626" }}>
          Erreur : {error.message}
        </div>
      )}

      <div style={{ backgroundColor: "white", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #E5E7EB" }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0A1628" }}>
            Établissements clients ({loading ? "…" : etabs.length})
          </h3>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: "#F8FAFC" }}>
              {["Client", "Ville", "Type", "Email", "Statut", "Actions"].map((h) => (
                <th key={h} style={{ padding: "12px 18px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6B7280", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && [1,2,3,4].map((i) => (
              <tr key={i} style={{ borderBottom: "1px solid #F3F4F6", animation: "pulse 1.5s ease-in-out infinite" }}>
                {[180,100,80,140,60,100].map((w, j) => (
                  <td key={j} style={{ padding: "14px 18px" }}><div style={{ height: 13, width: w, backgroundColor: "#F3F4F6", borderRadius: 6 }} /></td>
                ))}
              </tr>
            ))}
            {!loading && etabs.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Aucun établissement</td></tr>
            )}
            {!loading && etabs.map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                <td style={{ padding: "14px 18px", fontWeight: 600, color: "#0A1628" }}>{c.nom}</td>
                <td style={{ padding: "14px 18px", color: "#6B7280" }}>{c.ville}</td>
                <td style={{ padding: "14px 18px", color: "#6B7280", textTransform: "capitalize" }}>{c.type}</td>
                <td style={{ padding: "14px 18px", color: "#6B7280", fontSize: 12 }}>{c.email ?? "—"}</td>
                <td style={{ padding: "14px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: c.actif ? "#10B981" : "#9CA3AF" }} />
                    <span style={{ fontSize: 12, color: c.actif ? "#16A34A" : "#9CA3AF", fontWeight: 600 }}>{c.actif ? "actif" : "inactif"}</span>
                  </div>
                </td>
                <td style={{ padding: "14px 18px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => setLivraisonModal(c)}
                      style={{ padding: "4px 12px", backgroundColor: "#FFFBEB", color: "#D97706", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                      Livraison
                    </button>
                    <button
                      onClick={() => setFicheModal(c)}
                      style={{ padding: "4px 12px", backgroundColor: "#F8FAFC", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>
                      Fiche
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
