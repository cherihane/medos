import { colors } from "../../theme";
import { useState } from "react";
import Layout from "../../components/Layout";
import Modal, { Field, Row, ModalFooter, inputStyle, selectStyle } from "../../components/Modal";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useAuth } from "../../context/AuthContext";
import { useMedicaments, useFournisseurs, usePatients } from "../../hooks/useSupabaseData";
import { updateMedicament, insertMedicament, insertCommande, insertDispensation, decrementStock } from "../../hooks/useMutations";

const statusStyle = {
  critique: { bg: "#FEF2F2", color: "#EF4444", label: "Critique" },
  alerte:   { bg: "#FFFBEB", color: "#F59E0B", label: "Alerte" },
  normal:   { bg: "#DCFCE7", color: "#16A34A", label: "Normal" },
};

function getStatut(m) {
  if (!m.stock_minimum || m.stock_minimum === 0) return "normal";
  const ratio = m.stock_actuel / m.stock_minimum;
  if (ratio <= 0.2) return "critique";
  if (ratio <= 0.5) return "alerte";
  return "normal";
}

const InlineError = ({ msg }) => msg ? (
  <div style={{ padding: "10px 14px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 13, color: "#DC2626", marginBottom: 4 }}>
    {msg}
  </div>
) : null;

function EditModal({ med, onClose, onSaved }) {
  const [form, setForm] = useState({
    nom: med.nom ?? "", stock_actuel: med.stock_actuel ?? 0,
    stock_minimum: med.stock_minimum ?? 0, prix_unitaire: med.prix_unitaire ?? 0,
    categorie: med.categorie ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const set = (k) => (e) => { setFormError(null); setForm((f) => ({ ...f, [k]: e.target.value })); };
  const handleSave = async () => {
    if (!form.nom.trim()) { setFormError("Le nom est obligatoire."); return; }
    setSaving(true);
    try {
      await updateMedicament(med.id, { ...form, stock_actuel: Number(form.stock_actuel), stock_minimum: Number(form.stock_minimum), prix_unitaire: Number(form.prix_unitaire) });
      onSaved(); onClose();
    } catch (e) { setFormError("Erreur : " + e.message); } finally { setSaving(false); }
  };
  return (
    <Modal title={`Éditer — ${med.nom}`} onClose={onClose}>
      <Field label="Nom *"><input style={inputStyle} value={form.nom} onChange={set("nom")} /></Field>
      <Row>
        <Field label="Stock actuel"><input style={inputStyle} type="number" min="0" value={form.stock_actuel} onChange={set("stock_actuel")} /></Field>
        <Field label="Seuil minimum"><input style={inputStyle} type="number" min="0" value={form.stock_minimum} onChange={set("stock_minimum")} /></Field>
      </Row>
      <Row>
        <Field label="Prix (FCFA)"><input style={inputStyle} type="number" min="0" value={form.prix_unitaire} onChange={set("prix_unitaire")} /></Field>
        <Field label="Catégorie"><input style={inputStyle} value={form.categorie} onChange={set("categorie")} /></Field>
      </Row>
      <InlineError msg={formError} />
      <ModalFooter onCancel={onClose} onSubmit={handleSave} submitLabel="Sauvegarder" saving={saving} />
    </Modal>
  );
}

function CommanderModal({ med, fournisseurs, onClose, onSaved }) {
  const [form, setForm] = useState({ fournisseur_id: fournisseurs[0]?.id ?? "", quantite: med.stock_minimum ?? 50, date_livraison_prevue: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const set = (k) => (e) => { setFormError(null); setForm((f) => ({ ...f, [k]: e.target.value })); };
  const handleSave = async () => {
    if (!form.fournisseur_id) { setFormError("Sélectionnez un fournisseur."); return; }
    setSaving(true);
    try {
      await insertCommande({ fournisseur_id: form.fournisseur_id, statut: "envoyee", date_commande: new Date().toISOString(), date_livraison_prevue: form.date_livraison_prevue || null, montant_total: 0, notes: `${med.nom} — Qté : ${form.quantite}` });
      onSaved(); onClose();
    } catch (e) { setFormError("Erreur : " + e.message); } finally { setSaving(false); }
  };
  return (
    <Modal title={`Commander — ${med.nom}`} onClose={onClose}>
      <Field label="Fournisseur">
        <select style={selectStyle} value={form.fournisseur_id} onChange={set("fournisseur_id")}>
          <option value="">— Sélectionner —</option>
          {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
        </select>
      </Field>
      <Row>
        <Field label="Quantité"><input style={inputStyle} type="number" min="1" value={form.quantite} onChange={set("quantite")} /></Field>
        <Field label="Livraison souhaitée"><input style={inputStyle} type="date" value={form.date_livraison_prevue} onChange={set("date_livraison_prevue")} /></Field>
      </Row>
      <InlineError msg={formError} />
      <ModalFooter onCancel={onClose} onSubmit={handleSave} submitLabel="Passer la commande" saving={saving} />
    </Modal>
  );
}

function NouveauModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ nom: "", code: "", categorie: "", stock_actuel: 0, stock_minimum: 0, prix_unitaire: 0 });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const set = (k) => (e) => { setFormError(null); setForm((f) => ({ ...f, [k]: e.target.value })); };
  const handleSave = async () => {
    if (!form.nom.trim()) { setFormError("Le nom est obligatoire."); return; }
    setSaving(true);
    try {
      await insertMedicament({ ...form, stock_actuel: Number(form.stock_actuel), stock_minimum: Number(form.stock_minimum), prix_unitaire: Number(form.prix_unitaire) });
      onSaved(); onClose();
    } catch (e) { setFormError("Erreur : " + e.message); } finally { setSaving(false); }
  };
  return (
    <Modal title="Nouveau médicament" onClose={onClose}>
      <Row>
        <Field label="Nom *"><input style={inputStyle} value={form.nom} onChange={set("nom")} /></Field>
        <Field label="Code"><input style={inputStyle} value={form.code} onChange={set("code")} /></Field>
      </Row>
      <Field label="Catégorie"><input style={inputStyle} value={form.categorie} onChange={set("categorie")} /></Field>
      <Row>
        <Field label="Stock initial"><input style={inputStyle} type="number" min="0" value={form.stock_actuel} onChange={set("stock_actuel")} /></Field>
        <Field label="Seuil minimum"><input style={inputStyle} type="number" min="0" value={form.stock_minimum} onChange={set("stock_minimum")} /></Field>
      </Row>
      <Field label="Prix unitaire (FCFA)"><input style={inputStyle} type="number" min="0" value={form.prix_unitaire} onChange={set("prix_unitaire")} /></Field>
      <InlineError msg={formError} />
      <ModalFooter onCancel={onClose} onSubmit={handleSave} submitLabel="Ajouter" saving={saving} />
    </Modal>
  );
}

// ── Modal Dispensation nominative ─────────────────────────────────────────────
const VOIES = ["Oral", "IV", "IM", "SC", "Topique", "Inhalation", "Autre"];

function DispensationModal({ med, patients, onClose, onSaved, auth }) {
  const [form, setForm] = useState({
    patient_id: "", quantite: 1, dose: "", duree_jours: 1, voie: "Oral", prescripteur: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.patient_id) return alert("Selectionnez un patient.");
    if (Number(form.quantite) < 1) return alert("Quantite invalide.");
    setSaving(true);
    try {
      await insertDispensation({
        patient_id: form.patient_id,
        medicament_id: med.id,
        etablissement_id: auth?.etablissement_id ?? null,
        quantite: Number(form.quantite),
        dose: form.dose || null,
        duree_jours: Number(form.duree_jours) || null,
        voie: form.voie,
        prescripteur: form.prescripteur || null,
        notes: form.notes || null,
      });
      // Decrementer stock
      await decrementStock(med.id, Number(form.quantite));
      onSaved();
      onClose();
    } catch (e) {
      alert("Erreur : " + e.message);
    } finally { setSaving(false); }
  };

  return (
    <Modal title={`Dispenser — ${med.nom}`} onClose={onClose}>
      <Field label="Patient *">
        <select style={selectStyle} value={form.patient_id} onChange={set("patient_id")}>
          <option value="">-- Selectionner --</option>
          {patients.map((p) => <option key={p.id} value={p.id}>{p.nom} {p.prenom}</option>)}
        </select>
      </Field>
      <Row>
        <Field label="Quantite *">
          <input style={inputStyle} type="number" min="1" max={med.stock_actuel ?? 999} value={form.quantite} onChange={set("quantite")} />
        </Field>
        <Field label="Duree (jours)">
          <input style={inputStyle} type="number" min="1" value={form.duree_jours} onChange={set("duree_jours")} />
        </Field>
      </Row>
      <Row>
        <Field label="Dose (ex: 500mg 3x/j)">
          <input style={inputStyle} value={form.dose} onChange={set("dose")} placeholder="500mg 3x/j" />
        </Field>
        <Field label="Voie">
          <select style={selectStyle} value={form.voie} onChange={set("voie")}>
            {VOIES.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </Field>
      </Row>
      <Field label="Prescripteur">
        <input style={inputStyle} value={form.prescripteur} onChange={set("prescripteur")} placeholder="Dr. Dupont" />
      </Field>
      <div style={{ padding: "10px 14px", backgroundColor: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 8, fontSize: 12, color: "#92400E", marginBottom: 8 }}>
        Stock disponible : {med.stock_actuel ?? 0} unites — apres dispensation : {Math.max(0, (med.stock_actuel ?? 0) - Number(form.quantite || 0))} unites
      </div>
      <ModalFooter onCancel={onClose} onSubmit={handleSave} submitLabel="Confirmer la dispensation" saving={saving} />
    </Modal>
  );
}

export default function Stock() {
  const { auth } = useAuth();
  const { data: medicaments, loading, error, refetch } = useMedicaments();
  const { data: fournisseurs } = useFournisseurs();
  const { data: patients } = usePatients();
  const { toasts, success } = useToast();
  const [filter, setFilter] = useState("tous");
  const [editMed, setEditMed] = useState(null);
  const [commandMed, setCommandMed] = useState(null);
  const [showNouveau, setShowNouveau] = useState(false);
  const [dispenseMed, setDispenseMed] = useState(null);

  const withStatut = medicaments.map((m) => ({ ...m, statut: getStatut(m) }));
  const filtered = withStatut.filter((p) => filter === "tous" || p.statut === filter);
  const valeurStock = medicaments.reduce((s, m) => s + (m.stock_actuel ?? 0) * (m.prix_unitaire ?? 0), 0);

  return (
    <Layout title="Stock Hospitalier" subtitle="Gestion du stock médicamenteux de l'hôpital">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <Toast toasts={toasts} />
      {editMed && <EditModal med={editMed} onClose={() => setEditMed(null)} onSaved={() => { refetch(); success("Médicament mis à jour"); }} />}
      {commandMed && <CommanderModal med={commandMed} fournisseurs={fournisseurs} onClose={() => setCommandMed(null)} onSaved={() => { refetch(); success("Commande passée"); }} />}
      {showNouveau && <NouveauModal onClose={() => setShowNouveau(false)} onSaved={() => { refetch(); success("Médicament ajouté"); }} />}
      {dispenseMed && <DispensationModal med={dispenseMed} patients={patients} auth={auth} onClose={() => setDispenseMed(null)} onSaved={() => { refetch(); success(`Dispensation enregistree — stock mis a jour`); }} />}

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {["tous", "critique", "alerte", "normal"].map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", textTransform: "capitalize",
              border: filter === f ? "2px solid #10B981" : "1.5px solid var(--border)",
              backgroundColor: filter === f ? "#DCFCE7" : "white",
              color: filter === f ? "#16A34A" : "#6B7280",
            }}>{f}</button>
          ))}
        </div>
        <button onClick={() => setShowNouveau(true)} style={{ padding: "8px 16px", backgroundColor: "#10B981", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + Nouveau produit
        </button>
      </div>

      <div className="kpi-row">
        {[
          { label: "Total références",  value: loading ? "…" : medicaments.length, color: "#10B981" },
          { label: "Stock critique",    value: loading ? "…" : withStatut.filter(p => p.statut === "critique").length, color: "#EF4444" },
          { label: "Valeur stock",      value: loading ? "…" : `${(valeurStock / 1000000).toFixed(1)}M FCFA`, color: "#3B82F6" },
          { label: "En alerte",         value: loading ? "…" : withStatut.filter(p => p.statut === "alerte").length, color: "#F59E0B" },
        ].map((s) => (
          <div key={s.label} style={{ backgroundColor: colors.bgCard, padding: "14px 20px", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${s.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{s.label}</div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ backgroundColor: "#FEF2F2", padding: "14px 18px", borderRadius: 12, marginBottom: 16, fontSize: 13, color: "#DC2626" }}>
          Une erreur s'est produite. Veuillez réessayer.
        </div>
      )}

      <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div className="table-scroll"><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: colors.bgSurface }}>
              {["Produit", "DCI / Forme", "Stock actuel", "Stock min.", "Prix unitaire", "Catégorie", "Statut", "Actions"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: colors.textSecondary, borderBottom: "1px solid var(--border)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && [1,2,3,4,5].map((i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border-light)", animation: "pulse 1.5s ease-in-out infinite" }}>
                {[180,120,60,60,100,100,70,80].map((w, j) => (
                  <td key={j} style={{ padding: "13px 16px" }}><div style={{ height: 13, width: w, backgroundColor: colors.borderLight, borderRadius: 6 }} /></td>
                ))}
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: colors.textMuted, fontSize: 13 }}>Aucun produit trouvé</td></tr>
            )}
            {!loading && filtered.map((p) => {
              const s = statusStyle[p.statut];
              return (
                <tr key={p.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "13px 16px", fontWeight: 600, color: colors.navy }}>{p.nom}</td>
                  <td style={{ padding: "13px 16px", color: colors.textSecondary }}>{p.dci ?? "—"}{p.forme ? ` · ${p.forme}` : ""}</td>
                  <td style={{ padding: "13px 16px", fontWeight: 700, color: (p.stock_actuel ?? 0) < (p.stock_minimum ?? 0) ? "#EF4444" : "#374151" }}>{p.stock_actuel ?? 0}</td>
                  <td style={{ padding: "13px 16px", color: colors.textMuted }}>{p.stock_minimum ?? 0}</td>
                  <td style={{ padding: "13px 16px", color: colors.textSecondary }}>{(p.prix_unitaire ?? 0).toLocaleString()} FCFA</td>
                  <td style={{ padding: "13px 16px", color: colors.textSecondary }}>{p.categorie ?? "—"}</td>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ padding: "3px 10px", backgroundColor: s.bg, color: s.color, borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{s.label}</span>
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => setEditMed(p)} style={{ padding: "4px 10px", backgroundColor: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Éditer</button>
                      <button onClick={() => setCommandMed(p)} style={{ padding: "4px 10px", backgroundColor: "#DCFCE7", color: "#16A34A", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Commander</button>
                      <button onClick={() => setDispenseMed(p)} style={{ padding: "4px 10px", backgroundColor: "#FFFBEB", color: "#D97706", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Dispenser</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      </div>
    </Layout>
  );
}
