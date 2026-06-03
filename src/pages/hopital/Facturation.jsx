import { colors } from "../../theme";
import { useState, useEffect, useCallback } from "react";
import Layout from "../../components/Layout";
import Modal, { Field, Row, ModalFooter, inputStyle, selectStyle } from "../../components/Modal";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useAuth } from "../../context/AuthContext";
import { usePatients } from "../../hooks/useSupabaseData";
import {
  insertFacture, updateFacture, fetchFactures,
  fetchTarifsActes, fetchTarifsActesTous, insertTarifActe, updateTarifActe, deleteTarifActe,
} from "../../hooks/useMutations";
import { supabase } from "../../supabaseClient";
import { openDocument, tableHTML, infoGridHTML, fetchEtabFromAuth } from "../../utils/MedOSDocument";

// ── Constantes ────────────────────────────────────────────────────────────────
const ACCENT = "#10B981";

const ACTES_FALLBACK = [
  "Consultation generale", "Consultation specialisee", "Analyse biologique",
  "Radiographie", "Echographie", "Chirurgie mineure", "Chirurgie majeure",
  "Accouchement", "Hospitalisation (jour)", "Soins infirmiers",
  "Pansement", "Injection", "Perfusion",
];

const CATEGORIES = [
  { value: "consultation", label: "Consultation" },
  { value: "examen",       label: "Examen" },
  { value: "medicament",   label: "Medicament" },
  { value: "chirurgie",    label: "Chirurgie" },
  { value: "soins",        label: "Soins" },
  { value: "autre",        label: "Autre" },
];

function genNumero() {
  const d = new Date();
  return `FAC-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

function fmtDateCourte(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
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

// ── Panel gestion tarifs (slide-in lateral) ───────────────────────────────────
function PanelTarifs({ etabId, onClose }) {
  const [tarifs, setTarifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ libelle: "", categorie: "consultation", prix_defaut: 0 });
  const [saving, setSaving] = useState(false);
  const { toasts, success } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchTarifsActesTous(etabId);
    setTarifs(data);
    setLoading(false);
  }, [etabId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.libelle.trim()) return alert("Le libelle est obligatoire.");
    setSaving(true);
    try {
      if (editing) {
        await updateTarifActe(editing.id, { libelle: form.libelle, categorie: form.categorie, prix_defaut: Number(form.prix_defaut) });
      } else {
        await insertTarifActe({ ...form, etablissement_id: etabId ?? null, prix_defaut: Number(form.prix_defaut) });
      }
      setShowForm(false);
      setEditing(null);
      setForm({ libelle: "", categorie: "consultation", prix_defaut: 0 });
      load();
      success(editing ? "Tarif mis a jour" : "Tarif ajoute");
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const handleEdit = (t) => {
    setEditing(t);
    setForm({ libelle: t.libelle, categorie: t.categorie ?? "consultation", prix_defaut: t.prix_defaut });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer ce tarif ?")) return;
    await deleteTarifActe(id);
    load();
    success("Tarif supprime");
  };

  const inputSt = { width: "100%", padding: "9px 11px", border: "1.5px solid #E5E7EB", borderRadius: 9, fontSize: 13, outline: "none", boxSizing: "border-box", background: "white", color: "#0A1628" };
  const labelSt = { display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginBottom: 5 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1300, display: "flex", alignItems: "flex-start", justifyContent: "flex-end" }}>
      <Toast toasts={toasts} />
      <div style={{ background: "white", width: "100%", maxWidth: 540, height: "100vh", overflowY: "auto", boxShadow: "-8px 0 40px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0A1628" }}>Gestion des tarifs</div>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>Tarifs pratiques par votre etablissement</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#9CA3AF" }}>x</button>
        </div>

        <div style={{ padding: "16px 24px", flex: 1, overflowY: "auto" }}>
          {showForm && (
            <div style={{ background: "#F8FAFC", borderRadius: 12, padding: "16px 18px", marginBottom: 20, border: "1.5px solid #E5E7EB" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0A1628", marginBottom: 12 }}>{editing ? "Modifier le tarif" : "Nouveau tarif"}</div>
              <div style={{ marginBottom: 10 }}>
                <label style={labelSt}>Libelle *</label>
                <input style={inputSt} value={form.libelle} onChange={(e) => setForm((f) => ({ ...f, libelle: e.target.value }))} placeholder="Ex: Consultation generale" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={labelSt}>Categorie</label>
                  <select style={inputSt} value={form.categorie} onChange={(e) => setForm((f) => ({ ...f, categorie: e.target.value }))}>
                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelSt}>Prix (FCFA)</label>
                  <input style={inputSt} type="number" min="0" value={form.prix_defaut} onChange={(e) => setForm((f) => ({ ...f, prix_defaut: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setShowForm(false); setEditing(null); setForm({ libelle: "", categorie: "consultation", prix_defaut: 0 }); }}
                  style={{ flex: 1, padding: "8px 0", background: "#F3F4F6", border: "none", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>Annuler</button>
                <button onClick={handleSave} disabled={saving}
                  style={{ flex: 2, padding: "8px 0", background: saving ? "#D1D5DB" : ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
                  {saving ? "Enregistrement..." : editing ? "Sauvegarder" : "Ajouter"}
                </button>
              </div>
            </div>
          )}

          {!showForm && (
            <button onClick={() => setShowForm(true)}
              style={{ marginBottom: 16, padding: "8px 16px", background: ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              + Ajouter un tarif
            </button>
          )}

          {loading && <div style={{ textAlign: "center", color: "#9CA3AF", padding: 24 }}>Chargement...</div>}
          {!loading && tarifs.length === 0 && (
            <div style={{ textAlign: "center", color: "#9CA3AF", padding: 24, fontSize: 13 }}>Aucun tarif configure. Cliquez sur "+ Ajouter un tarif" pour commencer.</div>
          )}
          {!loading && tarifs.map((t) => (
            <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 14px", borderRadius: 10, marginBottom: 6, background: t.actif ? "#F8FAFC" : "#FEF2F2", border: "1px solid #E5E7EB" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0A1628" }}>{t.libelle}</div>
                <div style={{ fontSize: 11, color: "#6B7280" }}>
                  {CATEGORIES.find((c) => c.value === t.categorie)?.label ?? t.categorie}
                  {!t.actif && <span style={{ color: "#EF4444", fontWeight: 700 }}> — Inactif</span>}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>{Number(t.prix_defaut).toLocaleString("fr-FR")} FCFA</span>
                <button onClick={() => handleEdit(t)} style={{ fontSize: 11, padding: "3px 9px", border: "none", borderRadius: 6, background: "#EFF6FF", color: "#2563EB", cursor: "pointer", fontWeight: 600 }}>Editer</button>
                <button onClick={() => updateTarifActe(t.id, { actif: !t.actif }).then(load)}
                  style={{ fontSize: 11, padding: "3px 9px", border: "none", borderRadius: 6, background: "#F3F4F6", color: "#374151", cursor: "pointer", fontWeight: 600 }}>
                  {t.actif ? "Desact." : "Activer"}
                </button>
                <button onClick={() => handleDelete(t.id)} style={{ fontSize: 11, padding: "3px 9px", border: "none", borderRadius: 6, background: "#FEF2F2", color: "#EF4444", cursor: "pointer", fontWeight: 600 }}>Sup.</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Charger actes non factures d'un patient ────────────────────────────────────
async function chargerActesNonFactures(patient_id) {
  const sept_jours_avant = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [cRes, eRes, dRes] = await Promise.all([
    supabase.from("consultations").select("id, service, medecin_nom, heure_fin, motif")
      .eq("patient_id", patient_id).eq("statut", "termine").gte("heure_fin", sept_jours_avant),
    supabase.from("examens").select("id, type_examen, libelle, date_prescription")
      .eq("patient_id", patient_id).eq("statut", "resultat_disponible"),
    supabase.from("dispensations").select("id, quantite, created_at, medicaments(nom)")
      .eq("patient_id", patient_id).gte("created_at", sept_jours_avant),
  ]);
  return [
    ...(cRes.data ?? []).map((c) => ({
      id: "c_" + c.id, source: "consultation", categorie: "consultation",
      libelle: `Consultation — ${c.service}${c.medecin_nom ? " — " + c.medecin_nom : ""}`,
      date: c.heure_fin,
    })),
    ...(eRes.data ?? []).map((e) => ({
      id: "e_" + e.id, source: "examen", categorie: "examen",
      libelle: `Examen : ${e.type_examen}${e.libelle ? " — " + e.libelle : ""}`,
      date: e.date_prescription,
    })),
    ...(dRes.data ?? []).map((d) => ({
      id: "d_" + d.id, source: "dispensation", categorie: "medicament",
      libelle: `Medicament : ${d.medicaments?.nom ?? "—"} x${d.quantite}`,
      date: d.created_at,
    })),
  ];
}

// ── Modal creation facture ────────────────────────────────────────────────────
function FactureModal({ patients, etabId, onClose, onSaved }) {
  const [patient_id, setPatientId] = useState("");
  const [filtrePatient, setFiltrePatient] = useState("");
  const [tarifs, setTarifs] = useState([]);
  const [actesNonFactures, setActesNonFactures] = useState([]);
  const [actesCoches, setActesCoches] = useState({});
  const [loadingActes, setLoadingActes] = useState(false);
  const [lignes, setLignes] = useState([{ libelle: "", quantite: 1, prix_unitaire: 0 }]);
  const [taux_couverture, setTaux] = useState(0);
  const [type_couverture, setTypeCouverture] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchTarifsActes(etabId).then(setTarifs); }, [etabId]);

  const handlePatientChange = async (pid) => {
    setPatientId(pid);
    setActesNonFactures([]);
    setActesCoches({});
    if (!pid) return;
    setLoadingActes(true);
    const actes = await chargerActesNonFactures(pid);
    setActesNonFactures(actes);
    setLoadingActes(false);
  };

  const toggleActe = (acte) => {
    setActesCoches((prev) => {
      const next = { ...prev };
      if (next[acte.id]) { delete next[acte.id]; }
      else {
        const tarif = tarifs.find((t) => t.categorie === acte.categorie);
        next[acte.id] = { ...acte, prix_unitaire: tarif?.prix_defaut ?? 0 };
      }
      return next;
    });
  };

  const sous_total_actes  = Object.values(actesCoches).reduce((s, a) => s + (Number(a.prix_unitaire) || 0), 0);
  const sous_total_lignes = lignes.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0), 0);
  const sous_total        = sous_total_actes + sous_total_lignes;
  const montant_couverture = Math.round(sous_total * (Number(taux_couverture) || 0) / 100);
  const reste_patient      = sous_total - montant_couverture;

  const addLigne    = () => setLignes((prev) => [...prev, { libelle: "", quantite: 1, prix_unitaire: 0 }]);
  const removeLigne = (i) => setLignes((prev) => prev.filter((_, j) => j !== i));
  const setLigne    = (i, k, v) => setLignes((prev) => prev.map((l, j) => j === i ? { ...l, [k]: v } : l));

  const handleTarifSelect = (i, val) => {
    const tarif = tarifs.find((t) => t.id === val);
    if (tarif) setLignes((prev) => prev.map((l, j) => j === i ? { ...l, libelle: tarif.libelle, prix_unitaire: tarif.prix_defaut } : l));
    else setLigne(i, "libelle", val);
  };

  const handleSave = async () => {
    if (!patient_id) return alert("Selectionnez un patient.");
    const lignesActes  = Object.values(actesCoches).map((a) => ({ libelle: a.libelle, quantite: 1, prix_unitaire: Number(a.prix_unitaire) || 0 }));
    const lignesValides = lignes.filter((l) => l.libelle.trim());
    const toutesLignes  = [...lignesActes, ...lignesValides];
    if (toutesLignes.length === 0) return alert("Ajoutez au moins une ligne ou cochez un acte.");
    setSaving(true);
    try {
      await insertFacture({
        numero_facture: genNumero(), patient_id,
        etablissement_id: etabId ?? null,
        lignes: toutesLignes, sous_total,
        taux_couverture: Number(taux_couverture),
        type_couverture: type_couverture || null,
        montant_couverture, reste_patient,
        notes: notes || null, statut: "brouillon",
        date_facture: new Date().toISOString().slice(0, 10),
      });
      onSaved(); onClose();
    } catch (e) { alert("Erreur : " + e.message); }
    finally { setSaving(false); }
  };

  const patientsFiltres = patients.filter((p) => {
    const q = filtrePatient.toLowerCase();
    return q === "" || `${p.prenom} ${p.nom}`.toLowerCase().includes(q);
  }).slice(0, 100);

  return (
    <Modal title="Nouvelle facture" onClose={onClose}>
      <Field label="Rechercher un patient">
        <input style={inputStyle} placeholder="Nom ou prenom..." value={filtrePatient} onChange={(e) => setFiltrePatient(e.target.value)} />
      </Field>
      <Field label="Patient *">
        <select style={selectStyle} value={patient_id} onChange={(e) => handlePatientChange(e.target.value)}>
          <option value="">-- Selectionner un patient --</option>
          {patientsFiltres.map((p) => (
            <option key={p.id} value={p.id}>{p.nom} {p.prenom}</option>
          ))}
        </select>
      </Field>

      {/* Actes non factures du dossier */}
      {patient_id && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: colors.text, marginBottom: 8 }}>Actes recents du patient (7 derniers jours, non factures)</div>
          {loadingActes && <div style={{ fontSize: 12, color: colors.textMuted }}>Chargement des actes...</div>}
          {!loadingActes && tarifs.length === 0 && (
            <div style={{ fontSize: 12, color: "#D97706", padding: "8px 12px", background: "#FFFBEB", borderRadius: 8, border: "1px solid #FDE68A" }}>
              Configurez vos tarifs (bouton "Gerer les tarifs") pour utiliser cette fonctionnalite.
            </div>
          )}
          {!loadingActes && tarifs.length > 0 && actesNonFactures.length === 0 && (
            <div style={{ fontSize: 12, color: colors.textMuted, fontStyle: "italic" }}>Aucun acte recent non facture pour ce patient.</div>
          )}
          {!loadingActes && tarifs.length > 0 && actesNonFactures.map((acte) => {
            const coche = !!actesCoches[acte.id];
            const tarif = tarifs.find((t) => t.categorie === acte.categorie);
            return (
              <div key={acte.id} onClick={() => toggleActe(acte)}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", marginBottom: 5, borderRadius: 8, cursor: "pointer",
                  border: `1.5px solid ${coche ? ACCENT : "#E5E7EB"}`, backgroundColor: coche ? "#F0FDF4" : "#F8FAFC" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${coche ? ACCENT : "#D1D5DB"}`, backgroundColor: coche ? ACCENT : "white", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {coche && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#0A1628" }}>{acte.libelle}</div>
                    <div style={{ fontSize: 11, color: "#6B7280" }}>{fmtDateCourte(acte.date)}</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: tarif ? ACCENT : "#9CA3AF", flexShrink: 0, marginLeft: 12 }}>
                  {tarif ? `${Number(tarif.prix_defaut).toLocaleString("fr-FR")} FCFA` : "Tarif non configure"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lignes manuelles */}
      <div style={{ margin: "4px 0 8px", fontSize: 12, fontWeight: 700, color: colors.text }}>Lignes supplementaires</div>
      {lignes.map((l, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8, marginBottom: 8, alignItems: "end" }}>
          <div>
            {i === 0 && <label style={{ fontSize: 11, color: colors.textSecondary, display: "block", marginBottom: 4 }}>Acte / tarif</label>}
            <select style={{ ...selectStyle, width: "100%" }}
              value={tarifs.find((t) => t.libelle === l.libelle)?.id ?? l.libelle}
              onChange={(e) => handleTarifSelect(i, e.target.value)}>
              <option value="">-- Choisir --</option>
              {tarifs.length > 0
                ? tarifs.map((t) => <option key={t.id} value={t.id}>{t.libelle} ({Number(t.prix_defaut).toLocaleString("fr-FR")} FCFA)</option>)
                : ACTES_FALLBACK.map((a) => <option key={a} value={a}>{a}</option>)
              }
              {l.libelle && !tarifs.find((t) => t.libelle === l.libelle) && l.libelle !== "" && (
                <option value={l.libelle}>{l.libelle}</option>
              )}
            </select>
          </div>
          <div>
            {i === 0 && <label style={{ fontSize: 11, color: colors.textSecondary, display: "block", marginBottom: 4 }}>Qte</label>}
            <input style={inputStyle} type="number" min="1" value={l.quantite} onChange={(e) => setLigne(i, "quantite", e.target.value)} />
          </div>
          <div>
            {i === 0 && <label style={{ fontSize: 11, color: colors.textSecondary, display: "block", marginBottom: 4 }}>Prix (FCFA)</label>}
            <input style={inputStyle} type="number" min="0" value={l.prix_unitaire} onChange={(e) => setLigne(i, "prix_unitaire", e.target.value)} />
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
            <span style={{ fontWeight: 600, color: ACCENT }}>- {montant_couverture.toLocaleString("fr-FR")} FCFA</span>
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
  const totalHTML = `<div style="margin-top:16px;padding:14px 18px;background:#F8FAFC;border-radius:8px;font-size:13px">
    <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>Sous-total</span><strong>${Number(facture.sous_total ?? 0).toLocaleString("fr-FR")} FCFA</strong></div>
    ${facture.taux_couverture > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:6px;color:#16A34A"><span>Prise en charge ${facture.type_couverture ? `(${facture.type_couverture})` : ""} — ${facture.taux_couverture}%</span><strong>- ${Number(facture.montant_couverture ?? 0).toLocaleString("fr-FR")} FCFA</strong></div>` : ""}
    <div style="display:flex;justify-content:space-between;border-top:2px solid #E5E7EB;padding-top:10px;font-size:16px"><strong>Reste a payer</strong><strong style="color:#DC2626">${Number(facture.reste_patient ?? facture.sous_total ?? 0).toLocaleString("fr-FR")} FCFA</strong></div>
  </div>`;
  openDocument({
    titre: `Facture ${facture.numero_facture}`,
    sousTitre: `Emise le ${dateFr}`,
    etablissement: etab,
    sections: [
      { titre: "Informations patient", html: infoGridHTML([
        { label: "Patient",  value: `${patient.prenom ?? ""} ${patient.nom ?? ""}` },
        { label: "Dossier",  value: patient.numero_dossier ?? "—" },
        { label: "Date",     value: dateFr },
        { label: "Statut",   value: (facture.statut ?? "").toUpperCase() },
      ]) },
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
  const [showTarifs, setShowTarifs] = useState(false);
  const [filterStatut, setFilterStatut] = useState("tous");
  const [etabId, setEtabId] = useState(auth?.etablissement_id ?? null);

  const load = useCallback(async () => {
    setLoading(true);
    let eid = auth?.etablissement_id;
    if (!eid && auth?.user?.email) {
      const { data } = await supabase.from("etablissements").select("id").eq("email", auth.user.email).maybeSingle();
      eid = data?.id ?? null;
    }
    if (eid) setEtabId(eid);
    const data = await fetchFactures(eid);
    setFactures(data);
    setLoading(false);
  }, [auth]);

  useEffect(() => { load(); }, [load]);

  const filtered     = filterStatut === "tous" ? factures : factures.filter((f) => f.statut === filterStatut);
  const totalEmises  = factures.filter((f) => f.statut === "emise").reduce((s, f) => s + (f.sous_total ?? 0), 0);
  const totalPayees  = factures.filter((f) => f.statut === "payee").reduce((s, f) => s + (f.reste_patient ?? f.sous_total ?? 0), 0);

  return (
    <Layout title="Facturation" subtitle="Gestion des factures et prise en charge patients">
      <Toast toasts={toasts} />

      {showTarifs && <PanelTarifs etabId={etabId} onClose={() => setShowTarifs(false)} />}

      {showModal && (
        <FactureModal
          patients={patients}
          etabId={etabId}
          onClose={() => setShowModal(false)}
          onSaved={() => { load(); success("Facture creee avec succes"); }}
        />
      )}

      {/* KPIs */}
      <div className="kpi-row" style={{ marginBottom: 20 }}>
        {[
          { label: "Total factures",  value: loading ? "…" : factures.length,                              color: "#3B82F6" },
          { label: "Montant emis",    value: loading ? "…" : `${(totalEmises / 1000).toFixed(0)}K FCFA`,  color: "#F59E0B" },
          { label: "Encaisse",        value: loading ? "…" : `${(totalPayees / 1000).toFixed(0)}K FCFA`,  color: ACCENT },
          { label: "En attente",      value: loading ? "…" : factures.filter((f) => f.statut === "emise").length, color: "#EF4444" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: colors.bgCard, padding: "16px 20px", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filtres + boutons */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["tous", "brouillon", "emise", "payee", "annulee"].map((s) => (
            <button key={s} onClick={() => setFilterStatut(s)} style={{
              padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", textTransform: "capitalize",
              backgroundColor: filterStatut === s ? "#3B82F6" : colors.bgSurface,
              color: filterStatut === s ? "white" : colors.textSecondary,
            }}>{s}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowTarifs(true)} style={{ padding: "8px 16px", backgroundColor: colors.bgCard, color: "#374151", border: `1px solid ${colors.border}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Gerer les tarifs
          </button>
          <button onClick={() => setShowModal(true)} style={{ padding: "8px 18px", backgroundColor: ACCENT, color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            + Nouvelle facture
          </button>
        </div>
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
                    <td style={{ padding: "13px 16px", color: ACCENT }}>
                      {f.taux_couverture > 0 ? `${f.taux_couverture}% ${f.type_couverture ?? ""}` : "—"}
                    </td>
                    <td style={{ padding: "13px 16px", fontWeight: 700, color: "#EF4444" }}>{Number(f.reste_patient ?? f.sous_total ?? 0).toLocaleString("fr-FR")} FCFA</td>
                    <td style={{ padding: "13px 16px" }}><StatusBadge statut={f.statut} /></td>
                    <td style={{ padding: "13px 16px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => imprimerFacture(f, patients, auth)} style={{ padding: "4px 10px", backgroundColor: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Imprimer</button>
                        {f.statut === "emise" && (
                          <button onClick={async () => { await updateFacture(f.id, { statut: "payee" }); load(); success("Facture marquee payee"); }} style={{ padding: "4px 10px", backgroundColor: "#DCFCE7", color: "#16A34A", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Payer</button>
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
