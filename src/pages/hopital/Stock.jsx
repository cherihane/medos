import { colors } from "../../theme";
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import Modal, { Field, Row, ModalFooter, inputStyle, selectStyle } from "../../components/Modal";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useAuth } from "../../context/AuthContext";
import { useMedicaments, useFournisseurs, usePatients } from "../../hooks/useSupabaseData";
import {
  updateMedicament, insertMedicament, insertCommande, insertDispensation,
  decrementStock, updateOrdonnance,
  fetchOrdonnancesADispenser, insertCommandeInterne, fetchCommandesInternes, updateCommandeInterne,
} from "../../hooks/useMutations";
import { supabase } from "../../supabaseClient";

const ACCENT = "#10B981";

const statusStyle = {
  critique: { bg: "#FEF2F2", color: "#EF4444", label: "Critique" },
  alerte:   { bg: "#FFFBEB", color: "#F59E0B", label: "Alerte"   },
  normal:   { bg: "#DCFCE7", color: "#16A34A", label: "Normal"   },
};

const TRIAGE_STYLE = {
  urgent:     { bg: "#FEF2F2", color: "#EF4444" },
  semi_urgent:{ bg: "#FFFBEB", color: "#D97706" },
  non_urgent: { bg: "#DCFCE7", color: "#16A34A" },
};

const STATUT_CI_STYLE = {
  en_attente: { bg: "#FEF3C7", color: "#92400E", label: "En attente" },
  approuvee:  { bg: "#DCFCE7", color: "#16A34A", label: "Approuvee"  },
  servie:     { bg: "#EFF6FF", color: "#2563EB", label: "Servie"     },
  refusee:    { bg: "#FEF2F2", color: "#DC2626", label: "Refusee"    },
};

const inputSt  = { width: "100%", padding: "9px 11px", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", color: colors.navy, backgroundColor: colors.bgCard };
const labelSt  = { display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginBottom: 5 };

function getStatut(m) {
  if (!m.stock_minimum || m.stock_minimum === 0) return "normal";
  const ratio = m.stock_actuel / m.stock_minimum;
  if (ratio <= 0.2) return "critique";
  if (ratio <= 0.5) return "alerte";
  return "normal";
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

function CriticiteBadge({ days }) {
  if (days === null) return null;
  if (days < 0)  return <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 8, fontWeight: 700, backgroundColor: "#FEF2F2", color: "#EF4444" }}>Expire</span>;
  if (days <= 30) return <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 8, fontWeight: 700, backgroundColor: "#FEF2F2", color: "#EF4444" }}>Critique</span>;
  if (days <= 60) return <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 8, fontWeight: 700, backgroundColor: "#FFFBEB", color: "#D97706" }}>Alerte</span>;
  if (days <= 90) return <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 8, fontWeight: 700, backgroundColor: "#FEF3C7", color: "#92400E" }}>Vigilance</span>;
  return <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 8, fontWeight: 700, backgroundColor: "#DCFCE7", color: "#16A34A" }}>OK</span>;
}

const InlineError = ({ msg }) => msg ? (
  <div style={{ padding: "10px 14px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 13, color: "#DC2626", marginBottom: 4 }}>{msg}</div>
) : null;

// ── Modals existants ──────────────────────────────────────────────────────────
function EditModal({ med, onClose, onSaved }) {
  const [form, setForm] = useState({ nom: med.nom ?? "", stock_actuel: med.stock_actuel ?? 0, stock_minimum: med.stock_minimum ?? 0, prix_unitaire: med.prix_unitaire ?? 0, categorie: med.categorie ?? "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const set = (k) => (e) => { setFormError(null); setForm((f) => ({ ...f, [k]: e.target.value })); };
  const handleSave = async () => {
    if (!form.nom.trim()) { setFormError("Le nom est obligatoire."); return; }
    setSaving(true);
    try { await updateMedicament(med.id, { ...form, stock_actuel: Number(form.stock_actuel), stock_minimum: Number(form.stock_minimum), prix_unitaire: Number(form.prix_unitaire) }); onSaved(); onClose(); }
    catch (e) { setFormError("Erreur : " + e.message); } finally { setSaving(false); }
  };
  return (
    <Modal title={`Editer — ${med.nom}`} onClose={onClose}>
      <Field label="Nom *"><input style={inputStyle} value={form.nom} onChange={set("nom")} /></Field>
      <Row><Field label="Stock actuel"><input style={inputStyle} type="number" min="0" value={form.stock_actuel} onChange={set("stock_actuel")} /></Field>
           <Field label="Seuil minimum"><input style={inputStyle} type="number" min="0" value={form.stock_minimum} onChange={set("stock_minimum")} /></Field></Row>
      <Row><Field label="Prix (FCFA)"><input style={inputStyle} type="number" min="0" value={form.prix_unitaire} onChange={set("prix_unitaire")} /></Field>
           <Field label="Categorie"><input style={inputStyle} value={form.categorie} onChange={set("categorie")} /></Field></Row>
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
    if (!form.fournisseur_id) { setFormError("Selectionnez un fournisseur."); return; }
    setSaving(true);
    try { await insertCommande({ fournisseur_id: form.fournisseur_id, statut: "envoyee", date_commande: new Date().toISOString(), date_livraison_prevue: form.date_livraison_prevue || null, montant_total: 0, notes: `${med.nom} — Qte : ${form.quantite}` }); onSaved(); onClose(); }
    catch (e) { setFormError("Erreur : " + e.message); } finally { setSaving(false); }
  };
  return (
    <Modal title={`Commander — ${med.nom}`} onClose={onClose}>
      <Field label="Fournisseur">
        <select style={selectStyle} value={form.fournisseur_id} onChange={set("fournisseur_id")}>
          <option value="">— Selectionner —</option>
          {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
        </select>
      </Field>
      <Row><Field label="Quantite"><input style={inputStyle} type="number" min="1" value={form.quantite} onChange={set("quantite")} /></Field>
           <Field label="Livraison souhaitee"><input style={inputStyle} type="date" value={form.date_livraison_prevue} onChange={set("date_livraison_prevue")} /></Field></Row>
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
    try { await insertMedicament({ ...form, stock_actuel: Number(form.stock_actuel), stock_minimum: Number(form.stock_minimum), prix_unitaire: Number(form.prix_unitaire) }); onSaved(); onClose(); }
    catch (e) { setFormError("Erreur : " + e.message); } finally { setSaving(false); }
  };
  return (
    <Modal title="Nouveau medicament" onClose={onClose}>
      <Row><Field label="Nom *"><input style={inputStyle} value={form.nom} onChange={set("nom")} /></Field>
           <Field label="Code"><input style={inputStyle} value={form.code} onChange={set("code")} /></Field></Row>
      <Field label="Categorie"><input style={inputStyle} value={form.categorie} onChange={set("categorie")} /></Field>
      <Row><Field label="Stock initial"><input style={inputStyle} type="number" min="0" value={form.stock_actuel} onChange={set("stock_actuel")} /></Field>
           <Field label="Seuil minimum"><input style={inputStyle} type="number" min="0" value={form.stock_minimum} onChange={set("stock_minimum")} /></Field></Row>
      <Field label="Prix unitaire (FCFA)"><input style={inputStyle} type="number" min="0" value={form.prix_unitaire} onChange={set("prix_unitaire")} /></Field>
      <InlineError msg={formError} />
      <ModalFooter onCancel={onClose} onSubmit={handleSave} submitLabel="Ajouter" saving={saving} />
    </Modal>
  );
}

const VOIES_DISP = ["Oral", "IV", "IM", "SC", "Topique", "Inhalation", "Autre"];

function DispensationModal({ med, patients, onClose, onSaved, auth }) {
  const { error: showError } = useToast();
  const [form, setForm] = useState({ patient_id: "", quantite: 1, dose: "", duree_jours: 1, voie: "Oral", prescripteur: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const handleSave = async () => {
    if (!form.patient_id) return showError("Selectionnez un patient.");
    if (Number(form.quantite) < 1) return showError("Quantite invalide.");
    setSaving(true);
    try {
      await insertDispensation({ patient_id: form.patient_id, medicament_id: med.id, etablissement_id: auth?.etablissement_id ?? null, quantite: Number(form.quantite), dose: form.dose || null, duree_jours: Number(form.duree_jours) || null, voie: form.voie, prescripteur: form.prescripteur || null, notes: form.notes || null });
      await decrementStock(med.id, Number(form.quantite));
      onSaved(); onClose();
    } catch (e) { showError("Erreur : " + e.message); } finally { setSaving(false); }
  };
  return (
    <Modal title={`Dispenser — ${med.nom}`} onClose={onClose}>
      <Field label="Patient *">
        <select style={selectStyle} value={form.patient_id} onChange={set("patient_id")}>
          <option value="">-- Selectionner --</option>
          {patients.map((p) => <option key={p.id} value={p.id}>{p.nom} {p.prenom}</option>)}
        </select>
      </Field>
      <Row><Field label="Quantite *"><input style={inputStyle} type="number" min="1" max={med.stock_actuel ?? 999} value={form.quantite} onChange={set("quantite")} /></Field>
           <Field label="Duree (jours)"><input style={inputStyle} type="number" min="1" value={form.duree_jours} onChange={set("duree_jours")} /></Field></Row>
      <Row><Field label="Dose (ex: 500mg 3x/j)"><input style={inputStyle} value={form.dose} onChange={set("dose")} placeholder="500mg 3x/j" /></Field>
           <Field label="Voie"><select style={selectStyle} value={form.voie} onChange={set("voie")}>{VOIES_DISP.map((v) => <option key={v} value={v}>{v}</option>)}</select></Field></Row>
      <Field label="Prescripteur"><input style={inputStyle} value={form.prescripteur} onChange={set("prescripteur")} placeholder="Dr. Dupont" /></Field>
      <div style={{ padding: "10px 14px", backgroundColor: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 8, fontSize: 12, color: "#92400E", marginBottom: 8 }}>
        Stock disponible : {med.stock_actuel ?? 0} unites — apres dispensation : {Math.max(0, (med.stock_actuel ?? 0) - Number(form.quantite || 0))} unites
      </div>
      <ModalFooter onCancel={onClose} onSubmit={handleSave} submitLabel="Confirmer la dispensation" saving={saving} />
    </Modal>
  );
}

// ── Modal dispensation par ordonnance ─────────────────────────────────────────
function ModalDispensationOrdonnance({ ordonnance, medicaments, auth, onClose, onSaved }) {
  const { success, error: showError } = useToast();
  const lignes = (() => { try { return JSON.parse(ordonnance.notes ?? "{}").lignes ?? []; } catch { return []; } })();
  const patient = ordonnance.patients;

  const [items, setItems] = useState(() =>
    lignes.map((l) => {
      const med = medicaments.find((m) => m.nom.toLowerCase() === l.nom.toLowerCase() || m.id === l.medicament_id);
      const qtePresc = parseInt(l.posologie) || 1;
      return { ...l, checked: true, qte_dispensee: qtePresc, med, qte_prescrite: qtePresc };
    })
  );
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const coches = items.filter((i) => i.checked && i.med);
    if (coches.length === 0) return showError("Aucun medicament a dispenser.");
    setSaving(true);
    try {
      for (const item of coches) {
        const qte = Number(item.qte_dispensee) || 1;
        await insertDispensation({ patient_id: ordonnance.patient_id, medicament_id: item.med.id, etablissement_id: auth?.etablissement_id ?? null, quantite: qte, dose: item.posologie || null, voie: "Oral", prescripteur: ordonnance.medecin_nom || null, notes: notes || null });
        await decrementStock(item.med.id, qte);
      }
      await updateOrdonnance(ordonnance.id, { statut: "dispensee" });
      success("Ordonnance dispensee");
      onSaved();
      onClose();
    } catch (e) { showError("Erreur : " + e.message); } finally { setSaving(false); }
  };

  const setItem = (idx, field, value) => setItems((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: colors.bgCard, borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "92vh", overflowY: "auto", padding: "24px 28px", boxShadow: "0 20px 60px rgba(0,0,0,0.22)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.navy }}>Dispensation — {ordonnance.reference ?? "—"}</h3>
            <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 3 }}>
              {patient ? `${patient.prenom} ${patient.nom}` : "Patient inconnu"} · Dr. {ordonnance.medecin_nom ?? "—"}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted }}>x</button>
        </div>

        <div style={{ marginBottom: 16 }}>
          {items.length === 0 && <div style={{ color: colors.textMuted, fontSize: 13, padding: "12px 0" }}>Aucun medicament dans cette ordonnance.</div>}
          {items.map((item, idx) => {
            const stockActuel = item.med?.stock_actuel ?? 0;
            const qte = Number(item.qte_dispensee) || 0;
            const manque = item.med && qte > stockActuel;
            return (
              <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", marginBottom: 8, backgroundColor: item.checked ? colors.bgSurface : "#F9FAFB", borderRadius: 10, border: `1px solid ${item.checked ? colors.border : "#E5E7EB"}`, opacity: item.checked ? 1 : 0.5 }}>
                <input type="checkbox" checked={item.checked} onChange={(e) => setItem(idx, "checked", e.target.checked)} style={{ marginTop: 3, accentColor: ACCENT, cursor: "pointer" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>{item.nom}</div>
                  <div style={{ fontSize: 11, color: colors.textMuted }}>{item.posologie}{item.duree ? ` · ${item.duree}` : ""}</div>
                  {item.med && <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>Stock : {stockActuel} unites</div>}
                  {!item.med && <div style={{ fontSize: 11, color: "#F59E0B", fontWeight: 600 }}>Medicament non trouve dans le stock</div>}
                  {manque && item.checked && (
                    <div style={{ fontSize: 11, color: "#D97706", fontWeight: 600, marginTop: 4 }}>
                      Stock insuffisant ({stockActuel} dispo, {qte} demande) — dispensation partielle possible
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <label style={{ ...labelSt, marginBottom: 2 }}>Qte dispensee</label>
                  <input type="number" min="0" max={item.med?.stock_actuel ?? 999} value={item.qte_dispensee}
                    onChange={(e) => setItem(idx, "qte_dispensee", e.target.value)}
                    disabled={!item.checked}
                    style={{ ...inputSt, width: 80, textAlign: "center" }} />
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelSt}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ ...inputSt, resize: "vertical" }} placeholder="Optionnel..." />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, background: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 10, background: saving ? "#D1D5DB" : ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "Validation..." : "Valider la dispensation"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Onglet 1 — Stock ──────────────────────────────────────────────────────────
function OngletStock({ auth }) {
  const { data: medicaments, loading, error, refetch } = useMedicaments();
  const { data: fournisseurs } = useFournisseurs();
  const { data: patients } = usePatients(auth?.etablissement_id);
  const { success, error: showError } = useToast();
  const [filter, setFilter] = useState("tous");
  const [editMed, setEditMed] = useState(null);
  const [commandMed, setCommandMed] = useState(null);
  const [showNouveau, setShowNouveau] = useState(false);
  const [dispenseMed, setDispenseMed] = useState(null);

  const withStatut = medicaments.map((m) => ({ ...m, statut: getStatut(m) }));
  const filtered = withStatut.filter((p) => filter === "tous" || p.statut === filter);
  const valeurStock = medicaments.reduce((s, m) => s + (m.stock_actuel ?? 0) * (m.prix_unitaire ?? 0), 0);

  return (
    <div>
      {editMed    && <EditModal med={editMed} onClose={() => setEditMed(null)} onSaved={() => { refetch(); success("Medicament mis a jour"); }} />}
      {commandMed && <CommanderModal med={commandMed} fournisseurs={fournisseurs} onClose={() => setCommandMed(null)} onSaved={() => { refetch(); success("Commande passee"); }} />}
      {showNouveau && <NouveauModal onClose={() => setShowNouveau(false)} onSaved={() => { refetch(); success("Medicament ajoute"); }} />}
      {dispenseMed && <DispensationModal med={dispenseMed} patients={patients} auth={auth} onClose={() => setDispenseMed(null)} onSaved={() => { refetch(); success("Dispensation enregistree — stock mis a jour"); }} />}

      {auth?.role_interne === "Infirmière" && (
        <div style={{ padding: "10px 16px", backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 10, marginBottom: 16, fontSize: 13, color: "#1D4ED8", fontWeight: 600 }}>
          Consultation uniquement — contactez le pharmacien hospitalier pour les modifications de stock.
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {["tous", "critique", "alerte", "normal"].map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", textTransform: "capitalize", border: filter === f ? `2px solid ${ACCENT}` : "1.5px solid var(--border)", backgroundColor: filter === f ? "#DCFCE7" : "white", color: filter === f ? "#16A34A" : "#6B7280" }}>{f}</button>
          ))}
        </div>
        {auth?.role_interne !== "Infirmière" && (
          <button onClick={() => setShowNouveau(true)} style={{ padding: "8px 16px", backgroundColor: ACCENT, color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Nouveau produit</button>
        )}
      </div>

      <div className="kpi-row">
        {[
          { label: "Total references",  value: loading ? "…" : medicaments.length, color: ACCENT },
          { label: "Stock critique",    value: loading ? "…" : withStatut.filter((p) => p.statut === "critique").length, color: "#EF4444" },
          { label: "Valeur stock",      value: loading ? "…" : `${(valeurStock / 1000000).toFixed(1)}M FCFA`, color: "#3B82F6" },
          { label: "En alerte",         value: loading ? "…" : withStatut.filter((p) => p.statut === "alerte").length, color: "#F59E0B" },
        ].map((s) => (
          <div key={s.label} style={{ backgroundColor: colors.bgCard, padding: "14px 20px", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${s.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{s.label}</div>
          </div>
        ))}
      </div>

      {error && <div style={{ backgroundColor: "#FEF2F2", padding: "14px 18px", borderRadius: 12, marginBottom: 16, fontSize: 13, color: "#DC2626" }}>Une erreur s'est produite.</div>}

      <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div className="table-scroll"><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: colors.bgSurface }}>
              {["Produit", "DCI / Forme", "Stock actuel", "Stock min.", "Prix unitaire", "Categorie", "Statut", "Actions"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: colors.textSecondary, borderBottom: "1px solid var(--border)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && [1,2,3,4,5].map((i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border-light)", animation: "pulse 1.5s ease-in-out infinite" }}>
                {[180,120,60,60,100,100,70,80].map((w, j) => <td key={j} style={{ padding: "13px 16px" }}><div style={{ height: 13, width: w, backgroundColor: colors.borderLight, borderRadius: 6 }} /></td>)}
              </tr>
            ))}
            {!loading && filtered.length === 0 && <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: colors.textMuted }}>Aucun produit trouve</td></tr>}
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
                  <td style={{ padding: "13px 16px" }}><span style={{ padding: "3px 10px", backgroundColor: s.bg, color: s.color, borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{s.label}</span></td>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      {auth?.role_interne !== "Infirmière" && (
                        <>
                          <button onClick={() => setEditMed(p)} style={{ padding: "4px 10px", backgroundColor: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Editer</button>
                          <button onClick={() => setCommandMed(p)} style={{ padding: "4px 10px", backgroundColor: "#DCFCE7", color: "#16A34A", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Commander</button>
                          <button onClick={() => setDispenseMed(p)} style={{ padding: "4px 10px", backgroundColor: "#FFFBEB", color: "#D97706", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Dispenser</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}

// ── Onglet 2 — File de dispensation ──────────────────────────────────────────
function OngletDispensation({ auth, etabId }) {
  const { data: medicaments } = useMedicaments();
  const navigate = useNavigate();
  const [ordonnances, setOrdonnances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalDisp, setModalDisp] = useState(null);
  const [dispenseeCount, setDispenseeCount] = useState(0);

  const load = useCallback(async () => {
    if (!etabId) return;
    setLoading(true);
    const [ordo, dispCount] = await Promise.all([
      fetchOrdonnancesADispenser(etabId),
      supabase.from("ordonnances").select("id", { count: "exact", head: true })
        .eq("etablissement_id", etabId).eq("statut", "dispensee")
        .gte("updated_at", new Date().toISOString().slice(0, 10) + "T00:00:00"),
    ]);
    // Trier : urgents en premier, puis par date_emission
    const sorted = (ordo ?? []).sort((a, b) => {
      const ua = a.patients?.triage === "urgent" ? 0 : 1;
      const ub = b.patients?.triage === "urgent" ? 0 : 1;
      if (ua !== ub) return ua - ub;
      return new Date(a.date_emission) - new Date(b.date_emission);
    });
    setOrdonnances(sorted);
    setDispenseeCount(dispCount.count ?? 0);
    setLoading(false);
  }, [etabId]);

  useEffect(() => { load(); }, [load]);

  const urgentes = ordonnances.filter((o) => o.patients?.triage === "urgent").length;

  return (
    <div>
      {modalDisp && (
        <ModalDispensationOrdonnance
          ordonnance={modalDisp}
          medicaments={medicaments}
          auth={auth}
          onClose={() => setModalDisp(null)}
          onSaved={() => { setModalDisp(null); load(); }}
        />
      )}

      <div className="kpi-row" style={{ marginBottom: 20 }}>
        {[
          { label: "En attente",       value: ordonnances.length,  color: ordonnances.length > 0 ? "#F59E0B" : "#9CA3AF" },
          { label: "Urgentes",         value: urgentes,            color: urgentes > 0 ? "#EF4444" : "#9CA3AF" },
          { label: "Dispensees auj.",  value: dispenseeCount,      color: ACCENT },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: colors.bgCard, padding: "14px 20px", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{loading ? "…" : k.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{k.label}</div>
          </div>
        ))}
      </div>

      {loading && [1,2].map((i) => <div key={i} style={{ height: 120, backgroundColor: colors.bgSurface, borderRadius: 12, marginBottom: 12, animation: "pulse 1.5s ease-in-out infinite" }} />)}
      {!loading && ordonnances.length === 0 && (
        <div style={{ textAlign: "center", color: colors.textMuted, padding: 40, fontSize: 13 }}>Aucune ordonnance en attente de dispensation.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {!loading && ordonnances.map((o) => {
          const p = o.patients;
          const tc = p?.triage;
          const tStyle = TRIAGE_STYLE[tc] ?? null;
          const lignes = (() => { try { return JSON.parse(o.notes ?? "{}").lignes ?? []; } catch { return []; } })();
          return (
            <div key={o.id} style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "18px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderLeft: `4px solid ${tStyle?.color ?? "#E5E7EB"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: colors.navy }}>
                    {p ? `${p.prenom} ${p.nom}` : "Patient inconnu"}
                    {p?.numero_dossier && <span style={{ fontSize: 11, color: colors.textMuted, fontWeight: 400, marginLeft: 8 }}>{p.numero_dossier}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                    {o.reference ?? "—"} · {o.date_emission ? new Date(o.date_emission).toLocaleDateString("fr-FR") : "—"} · Dr. {o.medecin_nom ?? "—"}
                  </div>
                </div>
                {tStyle && tc && (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 8, backgroundColor: tStyle.bg, color: tStyle.color }}>
                    {tc.replace("_", " ")}
                  </span>
                )}
              </div>

              {lignes.length > 0 && (
                <div style={{ backgroundColor: colors.bgSurface, borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
                  {lignes.map((l, i) => (
                    <div key={i} style={{ fontSize: 12, color: colors.text, padding: "3px 0", borderBottom: i < lignes.length - 1 ? `1px solid ${colors.borderLight}` : "none" }}>
                      <span style={{ fontWeight: 600 }}>{l.nom}</span>
                      <span style={{ color: colors.textMuted, marginLeft: 8 }}>{l.posologie}{l.duree ? ` · ${l.duree}` : ""}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setModalDisp(o)} style={{ padding: "7px 16px", backgroundColor: ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  Dispenser
                </button>
                <button onClick={() => navigate(`/hopital/patients?patient_id=${o.patient_id}`)} style={{ padding: "7px 14px", backgroundColor: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  Voir le dossier
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Onglet 3 — Péremptions ────────────────────────────────────────────────────
function OngletPeremptions({ auth }) {
  const { data: medicaments, loading } = useMedicaments();
  const { data: fournisseurs } = useFournisseurs();
  const { success, error: showError } = useToast();
  const [seuil, setSeuil] = useState(90);
  const [commandMed, setCommandMed] = useState(null);

  const bientotPerimes = medicaments
    .filter((m) => m.date_peremption)
    .map((m) => ({ ...m, joursRestants: daysUntil(m.date_peremption) }))
    .filter((m) => m.joursRestants !== null && m.joursRestants <= seuil)
    .sort((a, b) => a.joursRestants - b.joursRestants);

  const kpis = {
    expires:   bientotPerimes.filter((m) => m.joursRestants < 0).length,
    critique:  bientotPerimes.filter((m) => m.joursRestants >= 0 && m.joursRestants <= 30).length,
    alerte:    bientotPerimes.filter((m) => m.joursRestants > 30 && m.joursRestants <= 60).length,
    vigilance: bientotPerimes.filter((m) => m.joursRestants > 60 && m.joursRestants <= 90).length,
  };

  return (
    <div>
      {commandMed && <CommanderModal med={commandMed} fournisseurs={fournisseurs} onClose={() => setCommandMed(null)} onSaved={() => success("Commande passee")} />}

      <div className="kpi-row" style={{ marginBottom: 16 }}>
        {[
          { label: "Expires",   value: kpis.expires,   color: "#EF4444" },
          { label: "Critique (≤30j)",  value: kpis.critique,  color: "#EF4444" },
          { label: "Alerte (≤60j)",    value: kpis.alerte,    color: "#F59E0B" },
          { label: "Vigilance (≤90j)", value: kpis.vigilance, color: "#D97706" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: colors.bgCard, padding: "14px 20px", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[30, 60, 90].map((j) => (
          <button key={j} onClick={() => setSeuil(j)} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: seuil === j ? `2px solid ${ACCENT}` : "1.5px solid var(--border)", backgroundColor: seuil === j ? "#DCFCE7" : colors.bgSurface, color: seuil === j ? "#16A34A" : colors.textSecondary }}>
            {j} jours
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign: "center", color: colors.textMuted, padding: 32 }}>Chargement...</div>}

      {!loading && bientotPerimes.length === 0 && (
        <div style={{ textAlign: "center", color: colors.textMuted, padding: 40, fontSize: 13 }}>Aucun medicament proche de peremption dans les {seuil} prochains jours.</div>
      )}

      {!loading && bientotPerimes.length > 0 && (
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: colors.bgSurface }}>
                {["Medicament", "Categorie", "Stock actuel", "Date peremption", "Jours restants", "Criticite", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: colors.textSecondary, textTransform: "uppercase", borderBottom: `1px solid ${colors.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bientotPerimes.map((m) => (
                <tr key={m.id} style={{ borderBottom: `1px solid ${colors.borderLight}` }}>
                  <td style={{ padding: "12px 14px", fontWeight: 600, color: colors.navy }}>{m.nom}</td>
                  <td style={{ padding: "12px 14px", color: colors.textSecondary }}>{m.categorie ?? "—"}</td>
                  <td style={{ padding: "12px 14px", fontWeight: 700, color: (m.stock_actuel ?? 0) === 0 ? "#EF4444" : "#374151" }}>{m.stock_actuel ?? 0}</td>
                  <td style={{ padding: "12px 14px", color: colors.textSecondary }}>{new Date(m.date_peremption).toLocaleDateString("fr-FR")}</td>
                  <td style={{ padding: "12px 14px", fontWeight: 700, color: m.joursRestants < 0 ? "#EF4444" : m.joursRestants <= 30 ? "#EF4444" : "#D97706" }}>
                    {m.joursRestants < 0 ? `${Math.abs(m.joursRestants)}j depasse` : `${m.joursRestants}j`}
                  </td>
                  <td style={{ padding: "12px 14px" }}><CriticiteBadge days={m.joursRestants} /></td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      {m.joursRestants < 0 && (
                        <button onClick={async () => { if (window.confirm("Retirer ce medicament du stock (expire) ?")) { await updateMedicament(m.id, { stock_actuel: 0, actif: false }); success("Medicament retire du stock"); } }}
                          style={{ padding: "4px 10px", backgroundColor: "#FEF2F2", color: "#EF4444", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                          Retirer
                        </button>
                      )}
                      <button onClick={() => setCommandMed(m)} style={{ padding: "4px 10px", backgroundColor: "#DCFCE7", color: "#16A34A", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Commander</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Onglet 4 — Commandes internes ─────────────────────────────────────────────
function OngletCommandesInternes({ auth, etabId }) {
  const { success, error: showError } = useToast();
  const [commandes, setCommandes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtre, setFiltre] = useState("tous");
  const [modalApprouver, setModalApprouver] = useState(null);
  const [modalRefuser, setModalRefuser] = useState(null);
  const [qteServie, setQteServie] = useState("");
  const [notesRefus, setNotesRefus] = useState("");
  const { data: medicaments } = useMedicaments();

  const load = useCallback(async () => {
    if (!etabId) return;
    setLoading(true);
    setCommandes(await fetchCommandesInternes(etabId));
    setLoading(false);
  }, [etabId]);

  useEffect(() => { load(); }, [load]);

  const filtrees = filtre === "tous" ? commandes : commandes.filter((c) => c.statut === filtre);

  const today = new Date().toISOString().slice(0, 10);
  const kpis = {
    enAttente: commandes.filter((c) => c.statut === "en_attente").length,
    approuvees: commandes.filter((c) => c.statut === "approuvee").length,
    serviesAuj: commandes.filter((c) => c.statut === "servie" && c.created_at?.slice(0, 10) === today).length,
  };

  const handleApprouver = async () => {
    if (!modalApprouver) return;
    try {
      await updateCommandeInterne(modalApprouver.id, { statut: "approuvee", quantite_servie: Number(qteServie) || modalApprouver.quantite_demandee, pharmacien_email: auth?.user?.email ?? "" });
      success("Commande approuvee"); setModalApprouver(null); setQteServie(""); load();
    } catch (e) { showError(e.message); }
  };

  const handleServir = async (cmd) => {
    try {
      const med = medicaments.find((m) => m.id === cmd.medicament_id);
      await updateCommandeInterne(cmd.id, { statut: "servie" });
      if (med && cmd.quantite_servie) await decrementStock(med.id, cmd.quantite_servie);
      success("Medicament servi"); load();
    } catch (e) { showError(e.message); }
  };

  const handleRefuser = async () => {
    if (!modalRefuser) return;
    try {
      await updateCommandeInterne(modalRefuser.id, { statut: "refusee", notes_pharmacien: notesRefus });
      success("Commande refusee"); setModalRefuser(null); setNotesRefus(""); load();
    } catch (e) { showError(e.message); }
  };

  return (
    <div>
      {modalApprouver && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: colors.bgCard, borderRadius: 14, padding: 24, width: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: colors.navy }}>Approuver — {modalApprouver.medicament_nom}</h3>
            <label style={labelSt}>Quantite a servir</label>
            <input style={{ ...inputSt, marginBottom: 14 }} type="number" value={qteServie || modalApprouver.quantite_demandee} onChange={(e) => setQteServie(e.target.value)} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setModalApprouver(null); setQteServie(""); }} style={{ flex: 1, padding: 9, background: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Annuler</button>
              <button onClick={handleApprouver} style={{ flex: 2, padding: 9, background: ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Approuver</button>
            </div>
          </div>
        </div>
      )}
      {modalRefuser && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: colors.bgCard, borderRadius: 14, padding: 24, width: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: colors.navy }}>Refuser — {modalRefuser.medicament_nom}</h3>
            <label style={labelSt}>Motif (optionnel)</label>
            <textarea style={{ ...inputSt, marginBottom: 14, resize: "vertical" }} rows={3} value={notesRefus} onChange={(e) => setNotesRefus(e.target.value)} placeholder="Ex: Medicament hors formulaire..." />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setModalRefuser(null); setNotesRefus(""); }} style={{ flex: 1, padding: 9, background: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Annuler</button>
              <button onClick={handleRefuser} style={{ flex: 2, padding: 9, background: "#EF4444", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Refuser</button>
            </div>
          </div>
        </div>
      )}

      <div className="kpi-row" style={{ marginBottom: 16 }}>
        {[
          { label: "En attente",       value: kpis.enAttente,  color: kpis.enAttente > 0 ? "#F59E0B" : "#9CA3AF" },
          { label: "Approuvees",       value: kpis.approuvees, color: ACCENT },
          { label: "Servies auj.",     value: kpis.serviesAuj, color: "#3B82F6" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: colors.bgCard, padding: "14px 20px", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["tous", "en_attente", "approuvee", "servie", "refusee"].map((s) => {
          const labels = { tous: "Tous", en_attente: "En attente", approuvee: "Approuvee", servie: "Servie", refusee: "Refusee" };
          return (
            <button key={s} onClick={() => setFiltre(s)} style={{ padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: filtre === s ? `2px solid ${ACCENT}` : "1.5px solid var(--border)", backgroundColor: filtre === s ? "#DCFCE7" : colors.bgSurface, color: filtre === s ? "#16A34A" : colors.textSecondary }}>
              {labels[s]}
            </button>
          );
        })}
      </div>

      {loading && <div style={{ textAlign: "center", color: colors.textMuted, padding: 32 }}>Chargement...</div>}
      {!loading && filtrees.length === 0 && <div style={{ textAlign: "center", color: colors.textMuted, padding: 32, fontSize: 13 }}>Aucune commande interne.</div>}

      {!loading && filtrees.length > 0 && (
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: colors.bgSurface }}>
                {["Demandeur", "Service", "Medicament", "Qte", "Statut", "Date", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: colors.textSecondary, textTransform: "uppercase", borderBottom: `1px solid ${colors.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrees.map((c) => {
                const st = STATUT_CI_STYLE[c.statut] ?? { bg: "#F3F4F6", color: "#6B7280", label: c.statut };
                return (
                  <tr key={c.id} style={{ borderBottom: `1px solid ${colors.borderLight}` }}>
                    <td style={{ padding: "11px 14px", color: colors.navy, fontWeight: 600 }}>{c.demandeur_email}</td>
                    <td style={{ padding: "11px 14px", color: colors.textSecondary }}>{c.demandeur_service ?? "—"}</td>
                    <td style={{ padding: "11px 14px", fontWeight: 700, color: colors.navy }}>{c.medicament_nom}</td>
                    <td style={{ padding: "11px 14px", color: colors.textSecondary }}>{c.quantite_servie ?? c.quantite_demandee}</td>
                    <td style={{ padding: "11px 14px" }}><span style={{ padding: "2px 9px", borderRadius: 8, fontSize: 11, fontWeight: 700, backgroundColor: st.bg, color: st.color }}>{st.label}</span></td>
                    <td style={{ padding: "11px 14px", color: colors.textMuted, fontSize: 11 }}>{c.created_at ? new Date(c.created_at).toLocaleDateString("fr-FR") : "—"}</td>
                    <td style={{ padding: "11px 14px" }}>
                      <div style={{ display: "flex", gap: 5 }}>
                        {c.statut === "en_attente" && (
                          <>
                            <button onClick={() => { setModalApprouver(c); setQteServie(String(c.quantite_demandee)); }} style={{ padding: "4px 10px", backgroundColor: "#DCFCE7", color: "#16A34A", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Approuver</button>
                            <button onClick={() => setModalRefuser(c)} style={{ padding: "4px 10px", backgroundColor: "#FEF2F2", color: "#EF4444", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Refuser</button>
                          </>
                        )}
                        {c.statut === "approuvee" && (
                          <button onClick={() => handleServir(c)} style={{ padding: "4px 10px", backgroundColor: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Servir</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function Stock() {
  const { auth } = useAuth();
  const { toasts, error: showError } = useToast();
  const [onglet, setOnglet] = useState("stock");
  const [etabId, setEtabId] = useState(auth?.etablissement_id ?? null);

  useEffect(() => {
    if (etabId) return;
    const resolve = async () => {
      let eid = auth?.etablissement_id;
      if (!eid && auth?.user?.email) {
        const { data } = await supabase.from("etablissements").select("id").eq("email", auth.user.email).maybeSingle();
        eid = data?.id ?? null;
      }
      if (!eid && auth?.user?.email) {
        const { data } = await supabase.from("membres_personnel").select("etablissement_id").eq("email", auth.user.email).eq("actif", true).maybeSingle();
        eid = data?.etablissement_id ?? null;
      }
      if (eid) setEtabId(eid);
    };
    resolve();
  }, [auth, etabId]);

  const isPharmacien = auth?.role_interne === "Pharmacien hospitalier";

  const ONGLETS = [
    { key: "stock",             label: "Stock"                },
    ...(isPharmacien ? [
      { key: "dispensation",    label: "File de dispensation" },
      { key: "peremptions",     label: "Peremptions"          },
      { key: "commandes",       label: "Commandes internes"   },
    ] : []),
  ];

  return (
    <Layout title="Stock Hospitalier" subtitle="Gestion du stock medicamenteux de l'hopital">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <Toast toasts={toasts} />

      {ONGLETS.length > 1 && (
        <div style={{ display: "flex", gap: 2, marginBottom: 24, borderBottom: `2px solid ${colors.border}` }}>
          {ONGLETS.map((o) => (
            <button key={o.key} onClick={() => setOnglet(o.key)} style={{ padding: "10px 18px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: onglet === o.key ? 800 : 400, color: onglet === o.key ? ACCENT : colors.textSecondary, borderBottom: onglet === o.key ? `3px solid ${ACCENT}` : "3px solid transparent", marginBottom: -2, whiteSpace: "nowrap" }}>
              {o.label}
            </button>
          ))}
        </div>
      )}

      {onglet === "stock"        && <OngletStock auth={auth} />}
      {onglet === "dispensation" && <OngletDispensation auth={auth} etabId={etabId} />}
      {onglet === "peremptions"  && <OngletPeremptions auth={auth} />}
      {onglet === "commandes"    && <OngletCommandesInternes auth={auth} etabId={etabId} />}
    </Layout>
  );
}
