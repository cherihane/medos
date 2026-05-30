import { useState } from "react";
import Layout from "../../components/Layout";
import Modal, { Field, Row, ModalFooter, inputStyle, selectStyle } from "../../components/Modal";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useLivraisons, useEtablissements } from "../../hooks/useSupabaseData";
import { insertLivraison, updateLivraison } from "../../hooks/useMutations";

const statusStyle = {
  preparation: { bg: "#F3F4F6",  color: "#6B7280",  label: "Préparation" },
  en_transit:  { bg: "#DBEAFE",  color: "#2563EB",  label: "En transit" },
  livree:      { bg: "#DCFCE7",  color: "#16A34A",  label: "Livrée" },
  annulee:     { bg: "#FEF2F2",  color: "#EF4444",  label: "Annulée" },
};

function fmt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

// ── Modal Nouvelle livraison ───────────────────────────────────────────────────
function NouvelleModal({ etablissements, onClose, onSaved }) {
  const [form, setForm] = useState({
    etablissement_id: "", transporteur: "",
    date_depart: new Date().toISOString().slice(0, 10), date_arrivee_prevue: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.etablissement_id) return alert("Sélectionnez un établissement destinataire.");
    setSaving(true);
    try {
      await insertLivraison({
        etablissement_id: form.etablissement_id,
        statut: "preparation",
        transporteur: form.transporteur || null,
        numero_suivi: "LIV-" + Date.now().toString().slice(-8),
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
    <Modal title="Nouvelle livraison" onClose={onClose}>
      <Field label="Destinataire *">
        <select style={selectStyle} value={form.etablissement_id} onChange={set("etablissement_id")}>
          <option value="">— Sélectionner un établissement —</option>
          {etablissements.map((e) => <option key={e.id} value={e.id}>{e.nom} ({e.ville})</option>)}
        </select>
      </Field>
      <Field label="Transporteur">
        <input style={inputStyle} value={form.transporteur} onChange={set("transporteur")} placeholder="Ex: DHL, Transport Koné…" />
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

// ── Modal Update statut ───────────────────────────────────────────────────────
function StatutModal({ livraison, onClose, onSaved }) {
  const [statut, setStatut] = useState(livraison.statut);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const update = { statut };
      if (statut === "livree") update.date_arrivee_reelle = new Date().toISOString();
      await updateLivraison(livraison.id, update);
      onSaved(statut);
      onClose();
    } catch (e) {
      alert("Erreur : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Modifier le statut" onClose={onClose} width={380}>
      <Field label="Nouveau statut">
        <select style={selectStyle} value={statut} onChange={(e) => setStatut(e.target.value)}>
          {Object.entries(statusStyle).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
      </Field>
      <ModalFooter onCancel={onClose} onSubmit={handleSave} submitLabel="Mettre à jour" saving={saving} />
    </Modal>
  );
}

export default function Livraisons() {
  const { data: livraisons, loading, error, refetch } = useLivraisons();
  const { data: etablissements } = useEtablissements();
  const { toasts, success, error: toastError } = useToast();
  const [filter, setFilter] = useState("tous");
  const [showNouvelle, setShowNouvelle] = useState(false);
  const [statutModal, setStatutModal] = useState(null);

  const filtered = livraisons.filter((l) => filter === "tous" || l.statut === filter);

  return (
    <Layout title="Livraisons" subtitle="Suivi des livraisons en temps réel">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <Toast toasts={toasts} />

      {showNouvelle && (
        <NouvelleModal
          etablissements={etablissements}
          onClose={() => setShowNouvelle(false)}
          onSaved={() => { refetch(); success("Livraison créée avec succès"); }}
        />
      )}
      {statutModal && (
        <StatutModal
          livraison={statutModal}
          onClose={() => setStatutModal(null)}
          onSaved={(newStatut) => {
            refetch();
            success(`Livraison mise à jour : ${statusStyle[newStatut]?.label ?? newStatut}`);
          }}
        />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 16 }}>
          {[
            { label: "En transit",  value: loading ? "…" : livraisons.filter(l => l.statut === "en_transit").length,  color: "#3B82F6" },
            { label: "Livrées",     value: loading ? "…" : livraisons.filter(l => l.statut === "livree").length,       color: "#10B981" },
            { label: "Préparation", value: loading ? "…" : livraisons.filter(l => l.statut === "preparation").length,  color: "#F59E0B" },
            { label: "Annulées",    value: loading ? "…" : livraisons.filter(l => l.statut === "annulee").length,      color: "#EF4444" },
          ].map((k) => (
            <div key={k.label} style={{ backgroundColor: "white", padding: "14px 18px", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderLeft: `4px solid ${k.color}` }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 11, color: "#6B7280" }}>{k.label}</div>
            </div>
          ))}
        </div>
        <button
          onClick={() => setShowNouvelle(true)}
          style={{ padding: "9px 18px", backgroundColor: "#F59E0B", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + Nouvelle livraison
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["tous", ...Object.keys(statusStyle)].map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", textTransform: "capitalize",
            border: filter === f ? "2px solid #F59E0B" : "1.5px solid #E5E7EB",
            backgroundColor: filter === f ? "#FFFBEB" : "white",
            color: filter === f ? "#D97706" : "#6B7280",
          }}>
            {f === "tous" ? "Toutes" : statusStyle[f]?.label ?? f}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ backgroundColor: "#FEF2F2", padding: "14px 18px", borderRadius: 12, marginBottom: 16, fontSize: 13, color: "#DC2626" }}>
          Erreur : {error.message}
        </div>
      )}

      <div style={{ backgroundColor: "white", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: "#F8FAFC" }}>
              {["N° Suivi", "Destinataire", "Transporteur", "Départ", "Arrivée prévue", "Statut", "Actions"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6B7280", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && [1,2,3].map((i) => (
              <tr key={i} style={{ borderBottom: "1px solid #F3F4F6", animation: "pulse 1.5s ease-in-out infinite" }}>
                {[120,160,120,80,90,80,100].map((w, j) => (
                  <td key={j} style={{ padding: "14px 16px" }}><div style={{ height: 13, width: w, backgroundColor: "#F3F4F6", borderRadius: 6 }} /></td>
                ))}
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Aucune livraison trouvée</td></tr>
            )}
            {!loading && filtered.map((l) => {
              const s = statusStyle[l.statut] ?? statusStyle.preparation;
              const dest = l.etablissements?.nom ?? "—";
              return (
                <tr key={l.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "14px 16px", fontFamily: "monospace", color: "#6B7280", fontSize: 12 }}>{l.numero_suivi ?? "—"}</td>
                  <td style={{ padding: "14px 16px", fontWeight: 600, color: "#0A1628" }}>
                    {dest}
                    {l.etablissements?.ville && <div style={{ fontSize: 11, color: "#9CA3AF" }}>{l.etablissements.ville}</div>}
                  </td>
                  <td style={{ padding: "14px 16px", color: "#6B7280" }}>{l.transporteur ?? "—"}</td>
                  <td style={{ padding: "14px 16px", color: "#6B7280", fontSize: 12 }}>{fmt(l.date_depart)}</td>
                  <td style={{ padding: "14px 16px", color: "#6B7280", fontSize: 12 }}>{fmt(l.date_arrivee_prevue)}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ padding: "3px 10px", backgroundColor: s.bg, color: s.color, borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{s.label}</span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    {l.statut !== "livree" && l.statut !== "annulee" && (
                      <button
                        onClick={() => setStatutModal(l)}
                        style={{ padding: "4px 12px", backgroundColor: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                        Mettre à jour
                      </button>
                    )}
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
