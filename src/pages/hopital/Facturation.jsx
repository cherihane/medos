import { colors } from "../../theme";
import { useState, useEffect } from "react";
import Layout from "../../components/Layout";
import Modal, { Field, Row, ModalFooter, inputStyle, selectStyle } from "../../components/Modal";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useAuth } from "../../context/AuthContext";
import { usePatients } from "../../hooks/useSupabaseData";
import { insertFacture, updateFacture, fetchFactures } from "../../hooks/useMutations";
import { openDocument, tableHTML, infoGridHTML, fetchEtabFromAuth } from "../../utils/MedOSDocument";

// ── Constantes ────────────────────────────────────────────────────────────────
const ACTES = [
  "Consultation générale",
  "Consultation spécialisée",
  "Analyse biologique",
  "Radiographie",
  "Échographie",
  "Chirurgie mineure",
  "Chirurgie majeure",
  "Accouchement",
  "Hospitalisation (jour)",
  "Soins infirmiers",
  "Pansement",
  "Injection",
  "Perfusion",
];

function genNumero() {
  const d = new Date();
  return `FAC-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

function StatusBadge({ statut }) {
  const map = {
    brouillon: { bg: "#F3F4F6", color: "#6B7280", label: "Brouillon" },
    emise:     { bg: "#EFF6FF", color: "#2563EB", label: "Emise" },
    payee:     { bg: "#DCFCE7", color: "#16A34A", label: "Payee" },
    annulee:   { bg: "#FEF2F2", color: "#DC2626", label: "Annulee" },
  };
  const s = map[statut] ?? map.brouillon;
  return (
    <span style={{ padding: "3px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700, backgroundColor: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

// ── Modal creation / edition facture ─────────────────────────────────────────
function FactureModal({ patients, onClose, onSaved }) {
  const [patient_id, setPatientId] = useState("");
  const [lignes, setLignes] = useState([
    { type: "acte", libelle: "Consultation générale", quantite: 1, prix_unitaire: 5000 },
  ]);
  const [taux_couverture, setTaux] = useState(0);
  const [type_couverture, setTypeCouverture] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const { auth } = useAuth();

  const sous_total = lignes.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0), 0);
  const montant_couverture = Math.round(sous_total * (Number(taux_couverture) || 0) / 100);
  const reste_patient = sous_total - montant_couverture;

  const addLigne = () => setLignes((prev) => [...prev, { type: "acte", libelle: "", quantite: 1, prix_unitaire: 0 }]);
  const removeLigne = (i) => setLignes((prev) => prev.filter((_, j) => j !== i));
  const setLigne = (i, k, v) => setLignes((prev) => prev.map((l, j) => j === i ? { ...l, [k]: v } : l));

  const handleSave = async () => {
    if (!patient_id) return alert("Selectionnez un patient.");
    if (lignes.length === 0) return alert("Ajoutez au moins une ligne.");
    setSaving(true);
    try {
      await insertFacture({
        numero_facture: genNumero(),
        patient_id,
        etablissement_id: auth?.etablissement_id ?? null,
        lignes,
        sous_total,
        taux_couverture: Number(taux_couverture),
        type_couverture: type_couverture || null,
        montant_couverture,
        reste_patient,
        notes: notes || null,
        statut: "brouillon",
        date_facture: new Date().toISOString().slice(0, 10),
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
    <Modal title="Nouvelle facture" onClose={onClose}>
      <Field label="Patient *">
        <select style={selectStyle} value={patient_id} onChange={(e) => setPatientId(e.target.value)}>
          <option value="">-- Selectionner un patient --</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>{p.nom} {p.prenom}</option>
          ))}
        </select>
      </Field>

      {/* Lignes */}
      <div style={{ margin: "12px 0 8px", fontSize: 12, fontWeight: 700, color: colors.text }}>Lignes de facturation</div>
      {lignes.map((l, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8, marginBottom: 8, alignItems: "end" }}>
          <div>
            {i === 0 && <label style={{ fontSize: 11, color: colors.textSecondary, display: "block", marginBottom: 4 }}>Libelle</label>}
            <select style={{ ...selectStyle, width: "100%" }} value={l.libelle} onChange={(e) => setLigne(i, "libelle", e.target.value)}>
              {ACTES.map((a) => <option key={a} value={a}>{a}</option>)}
              <option value={l.libelle}>{l.libelle !== ACTES[0] && !ACTES.includes(l.libelle) ? l.libelle : "Autre"}</option>
            </select>
          </div>
          <div>
            {i === 0 && <label style={{ fontSize: 11, color: colors.textSecondary, display: "block", marginBottom: 4 }}>Qte</label>}
            <input style={{ ...inputStyle }} type="number" min="1" value={l.quantite} onChange={(e) => setLigne(i, "quantite", e.target.value)} />
          </div>
          <div>
            {i === 0 && <label style={{ fontSize: 11, color: colors.textSecondary, display: "block", marginBottom: 4 }}>Prix (FCFA)</label>}
            <input style={{ ...inputStyle }} type="number" min="0" value={l.prix_unitaire} onChange={(e) => setLigne(i, "prix_unitaire", e.target.value)} />
          </div>
          <button onClick={() => removeLigne(i)} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 18, padding: "0 6px", marginTop: i === 0 ? 18 : 0 }}>x</button>
        </div>
      ))}
      <button onClick={addLigne} style={{ fontSize: 12, color: "#3B82F6", background: "none", border: "none", cursor: "pointer", marginBottom: 12 }}>+ Ajouter une ligne</button>

      <Row>
        <Field label="Couverture (%)">
          <input style={inputStyle} type="number" min="0" max="100" value={taux_couverture} onChange={(e) => setTaux(e.target.value)} />
        </Field>
        <Field label="Type de couverture">
          <select style={selectStyle} value={type_couverture} onChange={(e) => setTypeCouverture(e.target.value)}>
            <option value="">-- Aucune --</option>
            <option value="assurance">Assurance</option>
            <option value="cnss">CNSS</option>
            <option value="mutuelle">Mutuelle</option>
          </select>
        </Field>
      </Row>

      <div style={{ backgroundColor: colors.bgSurface, borderRadius: 10, padding: "12px 16px", marginBottom: 12, fontSize: 13 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ color: colors.textSecondary }}>Sous-total</span>
          <span style={{ fontWeight: 700, color: colors.navy }}>{sous_total.toLocaleString("fr-FR")} FCFA</span>
        </div>
        {Number(taux_couverture) > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ color: colors.textSecondary }}>Prise en charge ({taux_couverture}%)</span>
            <span style={{ fontWeight: 600, color: "#10B981" }}>- {montant_couverture.toLocaleString("fr-FR")} FCFA</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${colors.border}`, paddingTop: 8, marginTop: 4 }}>
          <span style={{ fontWeight: 700, color: colors.navy }}>Reste a payer</span>
          <span style={{ fontWeight: 800, fontSize: 16, color: "#EF4444" }}>{reste_patient.toLocaleString("fr-FR")} FCFA</span>
        </div>
      </div>

      <Field label="Notes">
        <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 60 }} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      <ModalFooter onCancel={onClose} onSubmit={handleSave} submitLabel="Creer la facture" saving={saving} />
    </Modal>
  );
}

// ── Impression facture ────────────────────────────────────────────────────────
async function imprimerFacture(facture, patients, auth) {
  const patient = patients.find((p) => p.id === facture.patient_id) ?? {};
  const etab = await fetchEtabFromAuth(auth);
  const dateFr = fmtDate(facture.date_facture);

  const lignesRows = (facture.lignes ?? []).map((l) => [
    l.libelle ?? "—",
    String(l.quantite ?? 1),
    `${Number(l.prix_unitaire ?? 0).toLocaleString("fr-FR")} FCFA`,
    `${((l.quantite ?? 1) * (l.prix_unitaire ?? 0)).toLocaleString("fr-FR")} FCFA`,
  ]);

  const infoHTML = infoGridHTML([
    { label: "Patient",    value: `${patient.prenom ?? ""} ${patient.nom ?? ""}` },
    { label: "Dossier",   value: patient.numero_dossier ?? facture.patient_id?.slice(0, 8).toUpperCase() ?? "—" },
    { label: "Date",      value: dateFr },
    { label: "Statut",    value: facture.statut?.toUpperCase() ?? "—" },
  ]);

  const totalHTML = `
    <div style="margin-top:16px;padding:14px 18px;background:#F8FAFC;border-radius:8px;font-size:13px">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span>Sous-total</span>
        <strong>${Number(facture.sous_total ?? 0).toLocaleString("fr-FR")} FCFA</strong>
      </div>
      ${facture.taux_couverture > 0 ? `
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;color:#16A34A">
        <span>Prise en charge ${facture.type_couverture ? `(${facture.type_couverture})` : ""} — ${facture.taux_couverture}%</span>
        <strong>- ${Number(facture.montant_couverture ?? 0).toLocaleString("fr-FR")} FCFA</strong>
      </div>` : ""}
      <div style="display:flex;justify-content:space-between;border-top:2px solid #E5E7EB;padding-top:10px;font-size:16px">
        <strong>Reste a payer</strong>
        <strong style="color:#DC2626">${Number(facture.reste_patient ?? facture.sous_total ?? 0).toLocaleString("fr-FR")} FCFA</strong>
      </div>
    </div>`;

  openDocument({
    titre: `Facture ${facture.numero_facture}`,
    sousTitre: `Emise le ${dateFr}`,
    etablissement: etab,
    sections: [
      { titre: "Informations patient", html: infoHTML },
      { titre: "Detail des prestations", html: tableHTML(["Prestation", "Qte", "Prix unitaire", "Total"], lignesRows, { alignRight: [1, 2, 3] }) + totalHTML },
    ],
  });
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function Facturation() {
  const { auth } = useAuth();
  const { data: patients } = usePatients();
  const { toasts, success } = useToast();
  const [factures, setFactures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterStatut, setFilterStatut] = useState("tous");

  const load = async () => {
    setLoading(true);
    const data = await fetchFactures(auth?.etablissement_id);
    setFactures(data);
    setLoading(false);
  };

  useEffect(() => { if (auth?.etablissement_id) load(); }, [auth?.etablissement_id]); // eslint-disable-line

  const filtered = filterStatut === "tous" ? factures : factures.filter((f) => f.statut === filterStatut);
  const totalEmises = factures.filter((f) => f.statut === "emise").reduce((s, f) => s + (f.sous_total ?? 0), 0);
  const totalPayees = factures.filter((f) => f.statut === "payee").reduce((s, f) => s + (f.reste_patient ?? f.sous_total ?? 0), 0);

  return (
    <Layout title="Facturation" subtitle="Gestion des factures et prise en charge patients">
      <Toast toasts={toasts} />

      {showModal && (
        <FactureModal
          patients={patients}
          onClose={() => setShowModal(false)}
          onSaved={() => { load(); success("Facture creee avec succes"); }}
        />
      )}

      {/* KPIs */}
      <div className="kpi-row" style={{ marginBottom: 20 }}>
        {[
          { label: "Total factures", value: loading ? "…" : factures.length, color: "#3B82F6" },
          { label: "Montant emis", value: loading ? "…" : `${(totalEmises / 1000).toFixed(0)}K FCFA`, color: "#F59E0B" },
          { label: "Montant encaisse", value: loading ? "…" : `${(totalPayees / 1000).toFixed(0)}K FCFA`, color: "#10B981" },
          { label: "En attente", value: loading ? "…" : factures.filter((f) => f.statut === "emise").length, color: "#EF4444" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: colors.bgCard, padding: "16px 20px", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filtres + bouton */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {["tous", "brouillon", "emise", "payee", "annulee"].map((s) => (
            <button key={s} onClick={() => setFilterStatut(s)} style={{
              padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", textTransform: "capitalize",
              backgroundColor: filterStatut === s ? "#3B82F6" : colors.bgSurface,
              color: filterStatut === s ? "white" : colors.textSecondary,
            }}>{s}</button>
          ))}
        </div>
        <button onClick={() => setShowModal(true)} style={{ padding: "8px 18px", backgroundColor: "#10B981", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          + Nouvelle facture
        </button>
      </div>

      {/* Table */}
      <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div className="table-scroll">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: colors.bgSurface }}>
                {["Numero", "Patient", "Date", "Sous-total", "Couverture", "Reste a payer", "Statut", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: colors.textSecondary, borderBottom: `1px solid ${colors.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && [1, 2, 3].map((i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${colors.borderLight}` }}>
                  {[120, 150, 80, 100, 80, 100, 70, 80].map((w, j) => (
                    <td key={j} style={{ padding: "13px 16px" }}><div style={{ height: 13, width: w, backgroundColor: colors.borderLight, borderRadius: 6 }} /></td>
                  ))}
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: colors.textMuted, fontSize: 13 }}>Aucune facture</td></tr>
              )}
              {!loading && filtered.map((f) => {
                const patient = patients.find((p) => p.id === f.patient_id);
                return (
                  <tr key={f.id} style={{ borderBottom: `1px solid ${colors.borderLight}` }}>
                    <td style={{ padding: "13px 16px", fontWeight: 700, color: "#3B82F6", fontSize: 12 }}>{f.numero_facture}</td>
                    <td style={{ padding: "13px 16px", fontWeight: 600, color: colors.navy }}>{patient ? `${patient.prenom} ${patient.nom}` : "—"}</td>
                    <td style={{ padding: "13px 16px", color: colors.textSecondary }}>{fmtDate(f.date_facture)}</td>
                    <td style={{ padding: "13px 16px", fontWeight: 600, color: colors.navy }}>{Number(f.sous_total ?? 0).toLocaleString("fr-FR")} FCFA</td>
                    <td style={{ padding: "13px 16px", color: "#10B981" }}>
                      {f.taux_couverture > 0 ? `${f.taux_couverture}% ${f.type_couverture ?? ""}` : "—"}
                    </td>
                    <td style={{ padding: "13px 16px", fontWeight: 700, color: "#EF4444" }}>{Number(f.reste_patient ?? f.sous_total ?? 0).toLocaleString("fr-FR")} FCFA</td>
                    <td style={{ padding: "13px 16px" }}><StatusBadge statut={f.statut} /></td>
                    <td style={{ padding: "13px 16px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => imprimerFacture(f, patients, auth)} style={{ padding: "4px 10px", backgroundColor: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Imprimer</button>
                        {f.statut === "emise" && (
                          <button onClick={async () => { await updateFacture(f.id, { statut: "payee" }); load(); success("Facture marquee comme payee"); }} style={{ padding: "4px 10px", backgroundColor: "#DCFCE7", color: "#16A34A", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Payer</button>
                        )}
                        {f.statut === "brouillon" && (
                          <button onClick={async () => { await updateFacture(f.id, { statut: "emise" }); load(); success("Facture emise"); }} style={{ padding: "4px 10px", backgroundColor: "#FEF3C7", color: "#D97706", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Emettre</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
