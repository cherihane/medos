import { colors } from "../../theme";
import { useState, useEffect, useCallback } from "react";
import Layout from "../../components/Layout";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../supabaseClient";
import { usePatients } from "../../hooks/useSupabaseData";
import {
  insertGrossesse, updateGrossesse, fetchGrossessesActives, fetchGrossessesEtablissement,
  fetchCPNGrossesse, insertCPN,
  insertPartogramme, updatePartogramme, fetchPartogrammesActifs,
  insertAccouchement, fetchAccouchementsEtablissement,
  insertNouveauNe, fetchNouveauNesEtablissement,
  genererNumeroMaternite, fetchMembresPersonnel,
} from "../../hooks/useMutations";
import { openDocument, tableHTML, infoGridHTML, signatureRowHTML, fetchEtabFromAuth } from "../../utils/MedOSDocument";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from "recharts";

const ACCENT = "#EC4899";
const inputSt = { width: "100%", padding: "9px 11px", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", color: colors.navy, backgroundColor: colors.bgCard };
const labelSt = { display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginBottom: 5 };
const sectionTitle = (label) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 10, paddingBottom: 6, borderBottom: "1.5px solid #E5E7EB" }}>{label}</div>
);

const TYPES_ACC = ["eutocique", "cesarienne", "forceps", "ventouse", "siege"];
const FACTEURS_RISQUE = ["diabete", "hypertension", "age > 35", "VIH+", "drepanocytose", "antecedent cesarienne", "grossesse multiple", "placenta praevia"];

function ageSA(ddr) {
  if (!ddr) return null;
  return Math.floor((Date.now() - new Date(ddr)) / (7 * 86400000));
}
function dap(ddr) {
  if (!ddr) return null;
  const d = new Date(ddr);
  d.setDate(d.getDate() + 280);
  return d.toISOString().slice(0, 10);
}
function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}
function fmtDuree(iso) {
  if (!iso) return "—";
  const min = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h${min % 60 > 0 ? (min % 60) + "min" : ""}`;
}

// ── Toggle button helper ───────────────────────────────────────────────────────
function Tog({ value, current, label, onChange, color }) {
  const active = current === value;
  const c = color ?? ACCENT;
  return (
    <button type="button" onClick={() => onChange(value)} style={{ flex: 1, padding: "7px 10px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${active ? c : "#E5E7EB"}`, backgroundColor: active ? c + "18" : "white", color: active ? c : "#374151" }}>
      {label}
    </button>
  );
}

// ── Certificat de naissance ────────────────────────────────────────────────────
async function imprimerCertificatNaissance(nn, acc, mere, auth) {
  const etab = await fetchEtabFromAuth(auth);
  openDocument({
    titre: "Certificat de naissance",
    sousTitre: `N° ${nn.numero_certificat_naissance} — ${fmtDate(acc.date_heure_accouchement)}`,
    etablissement: etab,
    sections: [
      { titre: "Nouveau-ne", html: infoGridHTML([
        { label: "Prenom",            value: nn.prenom || "A definir" },
        { label: "Nom",               value: nn.nom ?? (mere?.nom ?? "—") },
        { label: "Sexe",              value: nn.sexe === "M" ? "Masculin" : nn.sexe === "F" ? "Feminin" : "Indetermine" },
        { label: "Date de naissance", value: fmtDate(acc.date_heure_accouchement) },
        { label: "Heure",             value: acc.date_heure_accouchement ? new Date(acc.date_heure_accouchement).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—" },
        { label: "Poids",             value: `${nn.poids_naissance_g} g` },
        { label: "Taille",            value: nn.taille_naissance_cm ? `${nn.taille_naissance_cm} cm` : "—" },
        { label: "APGAR (1/5 min)",   value: `${nn.apgar_1min ?? "—"} / ${nn.apgar_5min ?? "—"}` },
      ]) },
      { titre: "Mere", html: infoGridHTML([
        { label: "Nom et prenom",     value: mere ? `${mere.prenom} ${mere.nom}` : "—" },
        { label: "Date de naissance", value: mere?.date_naissance ? fmtDate(mere.date_naissance) : "—" },
        { label: "N° dossier",        value: mere?.numero_dossier ?? "—" },
      ]) },
      { titre: "Accouchement", html: infoGridHTML([
        { label: "Type",        value: acc.type_accouchement },
        { label: "Sage-femme",  value: acc.sage_femme },
        { label: "Medecin",     value: acc.medecin ?? "—" },
      ]) },
      { titre: "", html: signatureRowHTML(["Sage-femme", "Medecin accoucheur", "Directeur de l'etablissement"]) },
    ],
  });
}

// ── Modal ouverture grossesse ─────────────────────────────────────────────────
function ModalOuvrirGrossesse({ patients, etabId, auth, onClose, onSaved }) {
  const { success, error: showError } = useToast();
  const [form, setForm] = useState({ patient_id: "", date_dernieres_regles: "", gestite: 1, parite: 0, groupe_sanguin_confirme: "", rhesus: "+", grossesse_a_risque: false, facteurs_risque: [], sage_femme_referente: auth?.user?.email ?? "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [filtre, setFiltre] = useState("");

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const dap_calc = form.date_dernieres_regles ? dap(form.date_dernieres_regles) : "";
  const patsFiltres = patients.filter((p) => !filtre || `${p.prenom} ${p.nom}`.toLowerCase().includes(filtre.toLowerCase())).slice(0, 60);

  const handleSave = async () => {
    if (!form.patient_id) return showError("Selectionnez une patiente.");
    setSaving(true);
    try {
      const numero = await genererNumeroMaternite(etabId, "grossesse");
      await insertGrossesse({ ...form, etablissement_id: etabId, numero_grossesse: numero, date_accouchement_prevue: dap_calc || null, gestite: Number(form.gestite), parite: Number(form.parite) });
      success("Dossier de grossesse ouvert");
      onSaved(); onClose();
    } catch (e) { showError(e.message); }
    finally { setSaving(false); }
  };

  const toggleFacteur = (f) => setForm((prev) => ({
    ...prev,
    facteurs_risque: prev.facteurs_risque.includes(f) ? prev.facteurs_risque.filter((x) => x !== f) : [...prev.facteurs_risque, f],
  }));

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: colors.bgCard, borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "93vh", overflowY: "auto", padding: "22px 26px", boxShadow: "0 20px 60px rgba(0,0,0,0.22)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.navy }}>Ouvrir un dossier de grossesse</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted }}>×</button>
        </div>
        {sectionTitle("Patiente")}
        <input style={{ ...inputSt, marginBottom: 6 }} placeholder="Rechercher..." value={filtre} onChange={(e) => setFiltre(e.target.value)} />
        <select style={{ ...inputSt, marginBottom: 14 }} value={form.patient_id} onChange={(e) => set("patient_id")(e.target.value)}>
          <option value="">-- Selectionner --</option>
          {patsFiltres.map((p) => <option key={p.id} value={p.id}>{p.prenom} {p.nom}{p.numero_dossier ? ` — ${p.numero_dossier}` : ""}</option>)}
        </select>

        {sectionTitle("Grossesse")}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelSt}>DDR (dernieres regles)</label>
            <input type="date" style={inputSt} value={form.date_dernieres_regles} onChange={(e) => set("date_dernieres_regles")(e.target.value)} />
          </div>
          <div>
            <label style={labelSt}>DAP calculee</label>
            <input style={{ ...inputSt, backgroundColor: "#F8FAFC", color: colors.textMuted }} value={dap_calc || "—"} readOnly />
          </div>
          <div>
            <label style={labelSt}>Gestite</label>
            <input type="number" min="1" style={inputSt} value={form.gestite} onChange={(e) => set("gestite")(e.target.value)} />
          </div>
          <div>
            <label style={labelSt}>Parite</label>
            <input type="number" min="0" style={inputSt} value={form.parite} onChange={(e) => set("parite")(e.target.value)} />
          </div>
          <div>
            <label style={labelSt}>Groupe sanguin</label>
            <select style={inputSt} value={form.groupe_sanguin_confirme} onChange={(e) => set("groupe_sanguin_confirme")(e.target.value)}>
              <option value="">—</option>
              {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label style={labelSt}>Sage-femme referente</label>
            <input style={inputSt} value={form.sage_femme_referente} onChange={(e) => set("sage_femme_referente")(e.target.value)} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelSt}>Grossesse a risque</label>
          <div style={{ display: "flex", gap: 8, marginBottom: form.grossesse_a_risque ? 10 : 0 }}>
            <Tog value={true}  current={form.grossesse_a_risque} label="Oui" onChange={set("grossesse_a_risque")} color="#EF4444" />
            <Tog value={false} current={form.grossesse_a_risque} label="Non" onChange={set("grossesse_a_risque")} />
          </div>
          {form.grossesse_a_risque && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {FACTEURS_RISQUE.map((f) => {
                const sel = form.facteurs_risque.includes(f);
                return <button key={f} type="button" onClick={() => toggleFacteur(f)} style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${sel ? "#EF4444" : "#E5E7EB"}`, backgroundColor: sel ? "#FEE2E2" : "white", color: sel ? "#DC2626" : "#374151" }}>{f}</button>;
              })}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelSt}>Notes</label>
          <textarea rows={2} style={{ ...inputSt, resize: "vertical" }} value={form.notes} onChange={(e) => set("notes")(e.target.value)} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, background: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 10, background: saving ? "#D1D5DB" : ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "Enregistrement..." : "Ouvrir le dossier"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal CPN ─────────────────────────────────────────────────────────────────
function ModalCPN({ grossesse, patient, etabId, auth, onClose, onSaved }) {
  const { success, error: showError } = useToast();
  const [form, setForm] = useState({
    date_cpn: new Date().toISOString().slice(0, 10),
    age_gestationnel_sa: grossesse.date_dernieres_regles ? ageSA(grossesse.date_dernieres_regles) : "",
    poids_kg: "", tension_systolique: "", tension_diastolique: "", temperature: "",
    hauteur_uterine_cm: "", presentation: "cephalique", bruit_coeur_foetal: "", mouvements_foetaux: true, oedemes: false,
    hemoglobine: "", glycemie: "", albuminurie: "negatif", serologie_syphilis: "negatif", test_vih: "non_fait", serologie_hepatite_b: "negatif",
    supplementation_fer: true, supplementation_acide_folique: true, milda_distribue: false, ttv_administre: false, numero_ttv: "",
    date_prochain_rdv: "", prescripteur: auth?.user?.email ?? "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  // Alertes automatiques
  const alertHTA  = Number(form.tension_systolique) > 140 || Number(form.tension_diastolique) > 90;
  const alertAnemie = form.hemoglobine && Number(form.hemoglobine) < 10;
  const alertVIH    = form.test_vih === "positif";
  const alertPE     = alertHTA && (form.albuminurie === "++" || form.albuminurie === "+++");

  const handleSave = async () => {
    setSaving(true);
    try {
      const cpns = await fetchCPNGrossesse(grossesse.id);
      await insertCPN({ ...form, grossesse_id: grossesse.id, patient_id: grossesse.patient_id, etablissement_id: etabId, numero_cpn: cpns.length + 1, poids_kg: form.poids_kg || null, tension_systolique: form.tension_systolique || null, tension_diastolique: form.tension_diastolique || null, hemoglobine: form.hemoglobine || null, bruit_coeur_foetal: form.bruit_coeur_foetal || null, age_gestationnel_sa: form.age_gestationnel_sa || null });
      success(`CPN ${cpns.length + 1} enregistree`);
      onSaved(); onClose();
    } catch (e) { showError(e.message); }
    finally { setSaving(false); }
  };

  const nom = patient ? `${patient.prenom} ${patient.nom}` : "Patiente";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: colors.bgCard, borderRadius: 16, width: "100%", maxWidth: 600, maxHeight: "94vh", overflowY: "auto", padding: "22px 26px", boxShadow: "0 20px 60px rgba(0,0,0,0.22)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.navy }}>Nouvelle CPN — {nom}</h3>
            <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{grossesse.numero_grossesse} · {form.age_gestationnel_sa ? `${form.age_gestationnel_sa} SA` : ""}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted }}>×</button>
        </div>

        {alertPE && <div style={{ padding: "8px 12px", backgroundColor: "#FEF2F2", border: "1px solid #EF4444", borderRadius: 8, fontSize: 12, color: "#DC2626", fontWeight: 700, marginBottom: 10 }}>Suspicion pre-eclampsie — hospitaliser immediatement</div>}
        {alertVIH && <div style={{ padding: "8px 12px", backgroundColor: "#FEF2F2", border: "1px solid #EF4444", borderRadius: 8, fontSize: 12, color: "#DC2626", fontWeight: 700, marginBottom: 10 }}>PTME : contacter le service VIH immediatement</div>}
        {alertHTA && !alertPE && <div style={{ padding: "8px 12px", backgroundColor: "#FFFBEB", border: "1px solid #F59E0B", borderRadius: 8, fontSize: 12, color: "#D97706", fontWeight: 700, marginBottom: 10 }}>Attention : hypertension gravidique — surveiller</div>}
        {alertAnemie && <div style={{ padding: "8px 12px", backgroundColor: "#FFFBEB", border: "1px solid #F59E0B", borderRadius: 8, fontSize: 12, color: "#D97706", fontWeight: 700, marginBottom: 10 }}>Anemie — renforcer la supplementation</div>}

        {sectionTitle("Constantes maternelles")}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
          {[["poids_kg","Poids (kg)"],["tension_systolique","TA sys"],["tension_diastolique","TA dia"],["temperature","Temp °C"]].map(([k,l]) => (
            <div key={k}><label style={labelSt}>{l}</label><input type="number" step="0.1" style={inputSt} value={form[k]} onChange={(e) => set(k)(e.target.value)} /></div>
          ))}
        </div>

        {sectionTitle("Examen obstetrical")}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div><label style={labelSt}>Hauteur uterine (cm)</label><input type="number" step="0.5" style={inputSt} value={form.hauteur_uterine_cm} onChange={(e) => set("hauteur_uterine_cm")(e.target.value)} /></div>
          <div><label style={labelSt}>BCF (bpm)</label><input type="number" style={inputSt} value={form.bruit_coeur_foetal} onChange={(e) => set("bruit_coeur_foetal")(e.target.value)} /></div>
          <div><label style={labelSt}>Presentation</label>
            <div style={{ display: "flex", gap: 6 }}>{["cephalique","siege","transverse"].map((v) => <Tog key={v} value={v} current={form.presentation} label={v} onChange={set("presentation")} />)}</div>
          </div>
          <div><label style={labelSt}>Mouvements foetaux</label><div style={{ display: "flex", gap: 6 }}><Tog value={true} current={form.mouvements_foetaux} label="Oui" onChange={set("mouvements_foetaux")} /><Tog value={false} current={form.mouvements_foetaux} label="Non" onChange={set("mouvements_foetaux")} color="#EF4444" /></div></div>
          <div><label style={labelSt}>Oedemes</label><div style={{ display: "flex", gap: 6 }}><Tog value={false} current={form.oedemes} label="Non" onChange={set("oedemes")} /><Tog value={true} current={form.oedemes} label="Oui" onChange={set("oedemes")} color="#F59E0B" /></div></div>
        </div>

        {sectionTitle("Examens de laboratoire")}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div><label style={labelSt}>Hemoglobine (g/dL)</label><input type="number" step="0.1" style={inputSt} value={form.hemoglobine} onChange={(e) => set("hemoglobine")(e.target.value)} /></div>
          <div><label style={labelSt}>Glycemie (g/L)</label><input type="number" step="0.01" style={inputSt} value={form.glycemie} onChange={(e) => set("glycemie")(e.target.value)} /></div>
          <div><label style={labelSt}>Albuminurie</label><div style={{ display: "flex", gap: 4 }}>{["negatif","+","++","+++"].map((v) => <Tog key={v} value={v} current={form.albuminurie} label={v} onChange={set("albuminurie")} />)}</div></div>
          <div><label style={labelSt}>Test VIH</label><div style={{ display: "flex", gap: 4 }}>{["negatif","positif","non_fait"].map((v) => <Tog key={v} value={v} current={form.test_vih} label={v} onChange={set("test_vih")} color={v === "positif" ? "#EF4444" : ACCENT} />)}</div></div>
          <div><label style={labelSt}>Serologie syphilis</label><div style={{ display: "flex", gap: 6 }}><Tog value="negatif" current={form.serologie_syphilis} label="Negatif" onChange={set("serologie_syphilis")} /><Tog value="positif" current={form.serologie_syphilis} label="Positif" onChange={set("serologie_syphilis")} color="#EF4444" /></div></div>
          <div><label style={labelSt}>Hepatite B</label><div style={{ display: "flex", gap: 6 }}><Tog value="negatif" current={form.serologie_hepatite_b} label="Negatif" onChange={set("serologie_hepatite_b")} /><Tog value="positif" current={form.serologie_hepatite_b} label="Positif" onChange={set("serologie_hepatite_b")} color="#EF4444" /></div></div>
        </div>

        {sectionTitle("Traitements")}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          {[["supplementation_fer","Fer + acide folique"],["milda_distribue","MILDA distribuee"],["ttv_administre","TTV administre"]].map(([k,l]) => (
            <label key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={!!form[k]} onChange={(e) => set(k)(e.target.checked)} style={{ accentColor: ACCENT }} />
              {l}
            </label>
          ))}
        </div>

        {sectionTitle("Prochain RDV")}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div><label style={labelSt}>Date</label><input type="date" style={inputSt} value={form.date_prochain_rdv} onChange={(e) => set("date_prochain_rdv")(e.target.value)} /></div>
          <div><label style={labelSt}>Prescripteur</label><input style={inputSt} value={form.prescripteur} onChange={(e) => set("prescripteur")(e.target.value)} /></div>
        </div>
        <div style={{ marginBottom: 16 }}><label style={labelSt}>Notes</label><textarea rows={2} style={{ ...inputSt, resize: "vertical" }} value={form.notes} onChange={(e) => set("notes")(e.target.value)} /></div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, background: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 10, background: saving ? "#D1D5DB" : ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "Enregistrement..." : "Enregistrer la CPN"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Detail grossesse ──────────────────────────────────────────────────────────
function DetailGrossesse({ grossesse, patients, etabId, auth, onClose, onRefresh }) {
  const [cpns, setCpns] = useState([]);
  const [showCPN, setShowCPN] = useState(false);
  const patient = patients.find((p) => p.id === grossesse.patient_id);

  useEffect(() => {
    fetchCPNGrossesse(grossesse.id).then(setCpns);
  }, [grossesse.id]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: colors.bgCard, borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", padding: "22px 26px", boxShadow: "0 20px 60px rgba(0,0,0,0.22)" }}>
        {showCPN && <ModalCPN grossesse={grossesse} patient={patient} etabId={etabId} auth={auth} onClose={() => setShowCPN(false)} onSaved={() => { fetchCPNGrossesse(grossesse.id).then(setCpns); onRefresh(); }} />}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.navy }}>{patient ? `${patient.prenom} ${patient.nom}` : "—"}</h3>
            <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{grossesse.numero_grossesse} · G{grossesse.gestite}P{grossesse.parite}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted }}>×</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[["DDR", fmtDate(grossesse.date_dernieres_regles)],["DAP", fmtDate(grossesse.date_accouchement_prevue)],["AG", grossesse.date_dernieres_regles ? `${ageSA(grossesse.date_dernieres_regles)} SA` : "—"]].map(([l,v]) => (
            <div key={l} style={{ backgroundColor: colors.bgSurface, borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: colors.textMuted, textTransform: "uppercase" }}>{l}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: colors.navy, marginTop: 2 }}>{v}</div>
            </div>
          ))}
        </div>
        {grossesse.grossesse_a_risque && (
          <div style={{ padding: "8px 12px", backgroundColor: "#FEF2F2", borderRadius: 8, fontSize: 12, color: "#DC2626", fontWeight: 600, marginBottom: 12 }}>
            Grossesse a risque : {(grossesse.facteurs_risque ?? []).join(", ")}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>CPN ({cpns.length})</div>
          <button onClick={() => setShowCPN(true)} style={{ padding: "6px 14px", backgroundColor: ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Nouvelle CPN</button>
        </div>
        {cpns.length === 0 && <div style={{ textAlign: "center", color: colors.textMuted, fontSize: 13, padding: "16px 0" }}>Aucune CPN enregistree.</div>}
        {cpns.map((c) => (
          <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", backgroundColor: colors.bgSurface, borderRadius: 8, marginBottom: 6, fontSize: 12 }}>
            <div>
              <span style={{ fontWeight: 700, color: colors.navy }}>CPN {c.numero_cpn}</span>
              <span style={{ color: colors.textMuted, marginLeft: 8 }}>{fmtDate(c.date_cpn)}</span>
              {c.age_gestationnel_sa && <span style={{ color: colors.textSecondary, marginLeft: 8 }}>{c.age_gestationnel_sa} SA</span>}
            </div>
            {c.tension_systolique && <span style={{ color: c.tension_systolique > 140 ? "#EF4444" : "#374151" }}>{c.tension_systolique}/{c.tension_diastolique}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Modal admission salle ─────────────────────────────────────────────────────
function ModalAdmissionSalle({ grossessesActives, patients, etabId, auth, onClose, onSaved }) {
  const { success, error: showError } = useToast();
  const [form, setForm] = useState({ grossesse_id: "", patient_id: "", heure_debut_travail: new Date().toISOString().slice(0, 16), type_rupture_membranes: "intactes" });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.grossesse_id) return showError("Selectionnez une grossesse.");
    setSaving(true);
    try {
      const g = grossessesActives.find((x) => x.id === form.grossesse_id);
      await insertPartogramme({ ...form, patient_id: g?.patient_id, etablissement_id: etabId, heure_debut_travail: new Date(form.heure_debut_travail).toISOString(), releves: [] });
      success("Patiente admise en salle d'accouchement");
      onSaved(); onClose();
    } catch (e) { showError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: colors.bgCard, borderRadius: 16, width: "100%", maxWidth: 440, padding: "22px 26px", boxShadow: "0 20px 60px rgba(0,0,0,0.22)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.navy }}>Admettre en salle</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted }}>×</button>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelSt}>Grossesse</label>
          <select style={inputSt} value={form.grossesse_id} onChange={(e) => setForm((f) => ({ ...f, grossesse_id: e.target.value }))}>
            <option value="">-- Selectionner --</option>
            {grossessesActives.map((g) => {
              const p = patients.find((x) => x.id === g.patient_id);
              return <option key={g.id} value={g.id}>{p ? `${p.prenom} ${p.nom}` : "—"} — {g.numero_grossesse}</option>;
            })}
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelSt}>Heure debut travail</label>
          <input type="datetime-local" style={inputSt} value={form.heure_debut_travail} onChange={(e) => setForm((f) => ({ ...f, heure_debut_travail: e.target.value }))} />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={labelSt}>Etat membranes</label>
          <div style={{ display: "flex", gap: 6 }}>
            {["intactes","spontanee","artificielle"].map((v) => <Tog key={v} value={v} current={form.type_rupture_membranes} label={v} onChange={(val) => setForm((f) => ({ ...f, type_rupture_membranes: val }))} />)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, background: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 10, background: saving ? "#D1D5DB" : ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "..." : "Admettre"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Vue partogramme ───────────────────────────────────────────────────────────
function VuePartogramme({ partogramme, patients, grossessesActives, etabId, auth, onClose, onRefresh }) {
  const { success, error: showError } = useToast();
  const [releve, setReleve] = useState({ heure: new Date().toISOString().slice(0, 16), dilatation_cm: "", descente_station: "", contractions_nb: "", contractions_duree: "", bcf: "", tension_sys: "", tension_dia: "", pouls_mere: "", liquide_amniotique: "clair", notes: "" });
  const [showAccouchement, setShowAccouchement] = useState(false);
  const [saving, setSaving] = useState(false);

  const patient = patients.find((p) => p.id === partogramme.patient_id);
  const grossesse = grossessesActives.find((g) => g.id === partogramme.grossesse_id);
  const releves = partogramme.releves ?? [];

  const chartData = releves.map((r) => ({
    heure: Math.round((new Date(r.heure) - new Date(partogramme.heure_debut_travail)) / 3600000 * 10) / 10,
    dilatation: r.dilatation_cm,
    bcf: r.bcf,
    alerte: r.dilatation_cm != null ? 4 + Math.max(0, Math.round((new Date(r.heure) - new Date(partogramme.heure_debut_travail)) / 3600000)) : null,
  }));

  const handleAjouterReleve = async () => {
    if (!releve.dilatation_cm) return showError("La dilatation est obligatoire.");
    setSaving(true);
    try {
      const nvReleves = [...releves, { ...releve, heure: new Date(releve.heure).toISOString(), dilatation_cm: Number(releve.dilatation_cm), bcf: releve.bcf ? Number(releve.bcf) : null, tension_sys: releve.tension_sys ? Number(releve.tension_sys) : null, tension_dia: releve.tension_dia ? Number(releve.tension_dia) : null, pouls_mere: releve.pouls_mere ? Number(releve.pouls_mere) : null, contractions_nb: releve.contractions_nb ? Number(releve.contractions_nb) : null }];
      await updatePartogramme(partogramme.id, { releves: nvReleves });
      success("Releve ajoute");
      setReleve((prev) => ({ ...prev, heure: new Date().toISOString().slice(0, 16) }));
      onRefresh();
    } catch (e) { showError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div style={{ background: colors.bgCard, borderRadius: 16, width: "100%", maxWidth: 800, maxHeight: "95vh", overflowY: "auto", padding: "20px 24px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        {showAccouchement && <ModalAccouchement partogramme={partogramme} grossesse={grossesse} patients={patients} etabId={etabId} auth={auth} onClose={() => setShowAccouchement(false)} onSaved={() => { setShowAccouchement(false); onRefresh(); onClose(); }} />}

        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.navy }}>Partogramme — {patient ? `${patient.prenom} ${patient.nom}` : "—"}</h3>
            <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>Travail depuis : {fmtDuree(partogramme.heure_debut_travail)}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowAccouchement(true)} style={{ padding: "7px 14px", backgroundColor: "#1F2937", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Cloturer</button>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted }}>×</button>
          </div>
        </div>

        {/* Graphique */}
        {chartData.length > 0 && (
          <div style={{ marginBottom: 16, backgroundColor: colors.bgSurface, borderRadius: 10, padding: "14px 10px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, marginBottom: 8, textTransform: "uppercase" }}>Graphique partogramme</div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData}>
                <XAxis dataKey="heure" label={{ value: "Heures", position: "insideBottom", offset: -2 }} tick={{ fontSize: 10 }} />
                <YAxis yAxisId="dil" domain={[0, 10]} label={{ value: "Dil. (cm)", angle: -90, position: "insideLeft", style: { fontSize: 10 } }} tick={{ fontSize: 10 }} />
                <YAxis yAxisId="bcf" orientation="right" domain={[80, 180]} label={{ value: "BCF", angle: 90, position: "insideRight", style: { fontSize: 10 } }} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine yAxisId="dil" stroke="#F59E0B" strokeDasharray="4 2" label={{ value: "Alerte OMS", fill: "#F59E0B", fontSize: 9 }} />
                <Line yAxisId="dil" type="monotone" dataKey="dilatation" stroke="#3B82F6" strokeWidth={2} dot={{ r: 4 }} name="Dilatation (cm)" />
                <Line yAxisId="bcf" type="monotone" dataKey="bcf" stroke="#EF4444" strokeWidth={1.5} dot={{ r: 3 }} name="BCF (bpm)" />
                <Line yAxisId="dil" type="monotone" dataKey="alerte" stroke="#F59E0B" strokeDasharray="4 2" dot={false} name="Ligne alerte" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Historique releves */}
        {releves.length > 0 && (
          <div style={{ marginBottom: 14, maxHeight: 140, overflowY: "auto" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, textTransform: "uppercase", marginBottom: 6 }}>Releves ({releves.length})</div>
            {[...releves].reverse().map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 12, padding: "6px 0", borderBottom: `1px solid ${colors.borderLight}`, fontSize: 11, color: colors.text }}>
                <span style={{ color: colors.textMuted }}>{r.heure ? new Date(r.heure).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—"}</span>
                <span><strong>{r.dilatation_cm} cm</strong></span>
                {r.bcf && <span>BCF {r.bcf}</span>}
                {r.tension_sys && <span>{r.tension_sys}/{r.tension_dia}</span>}
                {r.contractions_nb && <span>{r.contractions_nb} CU/10min</span>}
                {r.liquide_amniotique && r.liquide_amniotique !== "clair" && <span style={{ color: "#EF4444", fontWeight: 700 }}>LA {r.liquide_amniotique}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Formulaire nouveau releve */}
        {sectionTitle("Nouveau releve")}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 12 }}>
          <div style={{ gridColumn: "1/-1" }}><label style={labelSt}>Heure</label><input type="datetime-local" style={inputSt} value={releve.heure} onChange={(e) => setReleve((f) => ({ ...f, heure: e.target.value }))} /></div>
          {[["dilatation_cm","Dilatation (cm)"],["descente_station","Station"],["contractions_nb","CU / 10min"],["contractions_duree","Duree (sec)"],["bcf","BCF (bpm)"],["tension_sys","TA sys"],["tension_dia","TA dia"],["pouls_mere","Pouls mere"]].map(([k,l]) => (
            <div key={k}><label style={labelSt}>{l}</label><input type="number" style={inputSt} value={releve[k]} onChange={(e) => setReleve((f) => ({ ...f, [k]: e.target.value }))} /></div>
          ))}
          <div style={{ gridColumn: "1/3" }}>
            <label style={labelSt}>Liquide amniotique</label>
            <div style={{ display: "flex", gap: 6 }}>
              {["clair","meconial","absent"].map((v) => <Tog key={v} value={v} current={releve.liquide_amniotique} label={v} onChange={(val) => setReleve((f) => ({ ...f, liquide_amniotique: val }))} color={v !== "clair" ? "#EF4444" : ACCENT} />)}
            </div>
          </div>
        </div>
        <button onClick={handleAjouterReleve} disabled={saving} style={{ width: "100%", padding: 10, background: saving ? "#D1D5DB" : ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer", marginBottom: 4 }}>
          {saving ? "Enregistrement..." : "Ajouter le releve"}
        </button>
      </div>
    </div>
  );
}

// ── Modal accouchement ────────────────────────────────────────────────────────
function ModalAccouchement({ partogramme, grossesse, patients, etabId, auth, onClose, onSaved }) {
  const { error: showError } = useToast();
  const [form, setForm] = useState({ date_heure_accouchement: new Date().toISOString().slice(0, 16), type_accouchement: "eutocique", indication_cesarienne: "", sage_femme: auth?.user?.email ?? "", medecin: "", perinee: "intact", delivrance: "naturelle", pertes_sang_ml: "", complications_mere: "", notes: "" });
  const [showNN, setShowNN] = useState(false);
  const [accData, setAccData] = useState(null);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const duree = partogramme ? Math.round((new Date(form.date_heure_accouchement) - new Date(partogramme.heure_debut_travail)) / 3600000 * 10) / 10 : null;

  const handleSave = async () => {
    if (!form.sage_femme.trim()) return showError("La sage-femme est obligatoire.");
    try {
      const numero = await genererNumeroMaternite(etabId, "accouchement");
      const acc = await insertAccouchement({ ...form, grossesse_id: grossesse?.id ?? null, patient_id: partogramme?.patient_id ?? null, partogramme_id: partogramme?.id ?? null, etablissement_id: etabId, numero_accouchement: numero, date_heure_accouchement: new Date(form.date_heure_accouchement).toISOString(), duree_travail_heures: duree, pertes_sang_ml: form.pertes_sang_ml ? Number(form.pertes_sang_ml) : null });
      if (grossesse) await updateGrossesse(grossesse.id, { statut: "accouchee" });
      if (partogramme) await updatePartogramme(partogramme.id, { statut: "termine" });
      setAccData(acc);
      setShowNN(true);
    } catch (e) { showError(e.message); }
  };

  const patient = patients.find((p) => p.id === partogramme?.patient_id);

  if (showNN && accData) {
    return <ModalNouveauNe accouchement={accData} patient={patient} etabId={etabId} auth={auth} onClose={onClose} onSaved={onSaved} />;
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: colors.bgCard, borderRadius: 16, width: "100%", maxWidth: 540, maxHeight: "93vh", overflowY: "auto", padding: "22px 26px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.navy }}>Enregistrer l'accouchement</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted }}>×</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div style={{ gridColumn: "1/-1" }}><label style={labelSt}>Date et heure</label><input type="datetime-local" style={inputSt} value={form.date_heure_accouchement} onChange={(e) => set("date_heure_accouchement")(e.target.value)} /></div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={labelSt}>Type d'accouchement</label>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {TYPES_ACC.map((v) => <Tog key={v} value={v} current={form.type_accouchement} label={v} onChange={set("type_accouchement")} />)}
            </div>
          </div>
          {form.type_accouchement === "cesarienne" && (
            <div style={{ gridColumn: "1/-1" }}><label style={labelSt}>Indication cesarienne</label><input style={inputSt} value={form.indication_cesarienne} onChange={(e) => set("indication_cesarienne")(e.target.value)} /></div>
          )}
          <div><label style={labelSt}>Sage-femme *</label><input style={inputSt} value={form.sage_femme} onChange={(e) => set("sage_femme")(e.target.value)} /></div>
          <div><label style={labelSt}>Medecin</label><input style={inputSt} value={form.medecin} onChange={(e) => set("medecin")(e.target.value)} /></div>
          <div>
            <label style={labelSt}>Perinee</label>
            <select style={inputSt} value={form.perinee} onChange={(e) => set("perinee")(e.target.value)}>
              {["intact","dechirure_1","dechirure_2","episiotomie"].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label style={labelSt}>Delivrance</label>
            <div style={{ display: "flex", gap: 5 }}>
              {["naturelle","dirigee","manuelle"].map((v) => <Tog key={v} value={v} current={form.delivrance} label={v} onChange={set("delivrance")} />)}
            </div>
          </div>
          <div><label style={labelSt}>Pertes sang (mL)</label><input type="number" style={inputSt} value={form.pertes_sang_ml} onChange={(e) => set("pertes_sang_ml")(e.target.value)} /></div>
          {duree != null && <div><label style={labelSt}>Duree travail</label><input style={{ ...inputSt, backgroundColor: "#F8FAFC", color: colors.textMuted }} value={`${duree}h`} readOnly /></div>}
          <div style={{ gridColumn: "1/-1" }}><label style={labelSt}>Complications (mere)</label><input style={inputSt} value={form.complications_mere} onChange={(e) => set("complications_mere")(e.target.value)} placeholder="Optionnel" /></div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, background: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={handleSave} style={{ flex: 2, padding: 10, background: ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Enregistrer et saisir le nouveau-ne
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal nouveau-né ──────────────────────────────────────────────────────────
function ModalNouveauNe({ accouchement, patient, etabId, auth, onClose, onSaved }) {
  const { success, error: showError } = useToast();
  const [form, setForm] = useState({ prenom: "", nom: patient?.nom ?? "", sexe: "M", poids_naissance_g: "", taille_naissance_cm: "", perimetre_cranien_cm: "", etat_naissance: "vivant", cri_naissance: true, reanimation_necessaire: false, vitamine_k: true, collyre: true, bcg_vaccine: false, vhb_vaccine: false, allaitement_maternel: true });
  const [apgar, setApgar] = useState({ a1: [0,0,0,0,0], a5: [0,0,0,0,0], a10: [0,0,0,0,0] });
  const [saving, setSaving] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const scoreApgar = (arr) => arr.reduce((s, v) => s + Number(v), 0);
  const a1 = scoreApgar(apgar.a1); const a5 = scoreApgar(apgar.a5); const a10 = scoreApgar(apgar.a10);

  const alertFaiblePoids = form.poids_naissance_g && Number(form.poids_naissance_g) < 2500;
  const alertTresFaible  = form.poids_naissance_g && Number(form.poids_naissance_g) < 1500;
  const alertApgar       = a5 < 7;

  const APGAR_LABELS = ["FC","Resp.","Tonus","React.","Couleur"];

  const setApgarVal = (moment, idx, val) => setApgar((prev) => {
    const arr = [...prev[moment]]; arr[idx] = Number(val);
    return { ...prev, [moment]: arr };
  });

  const handleSave = async () => {
    if (!form.poids_naissance_g) return showError("Le poids est obligatoire.");
    setSaving(true);
    try {
      const numCert = await genererNumeroMaternite(etabId, "naissance");
      const nn = await insertNouveauNe({ ...form, accouchement_id: accouchement.id, grossesse_id: accouchement.grossesse_id, mere_patient_id: accouchement.patient_id, etablissement_id: etabId, poids_naissance_g: Number(form.poids_naissance_g), taille_naissance_cm: form.taille_naissance_cm || null, perimetre_cranien_cm: form.perimetre_cranien_cm || null, apgar_1min: a1, apgar_5min: a5, apgar_10min: a10, numero_certificat_naissance: numCert });
      await imprimerCertificatNaissance(nn, accouchement, patient, auth);
      success("Nouveau-ne enregistre — certificat imprime");
      onSaved();
    } catch (e) { showError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1400, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div style={{ background: colors.bgCard, borderRadius: 16, width: "100%", maxWidth: 580, maxHeight: "95vh", overflowY: "auto", padding: "20px 24px", boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.navy }}>Nouveau-ne</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted }}>×</button>
        </div>

        {alertTresFaible  && <div style={{ padding: "8px 12px", backgroundColor: "#FEF2F2", borderRadius: 8, fontSize: 12, color: "#DC2626", fontWeight: 700, marginBottom: 10 }}>Tres faible poids — soins intensifs neonataux</div>}
        {alertFaiblePoids && !alertTresFaible && <div style={{ padding: "8px 12px", backgroundColor: "#FFFBEB", borderRadius: 8, fontSize: 12, color: "#D97706", fontWeight: 700, marginBottom: 10 }}>Faible poids de naissance</div>}
        {alertApgar && <div style={{ padding: "8px 12px", backgroundColor: "#FEF2F2", borderRadius: 8, fontSize: 12, color: "#DC2626", fontWeight: 700, marginBottom: 10 }}>APGAR 5min &lt; 7 — reanimation necessaire</div>}

        {sectionTitle("Identite")}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div><label style={labelSt}>Prenom</label><input style={inputSt} value={form.prenom} onChange={(e) => set("prenom")(e.target.value)} /></div>
          <div><label style={labelSt}>Nom (mere)</label><input style={inputSt} value={form.nom} onChange={(e) => set("nom")(e.target.value)} /></div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={labelSt}>Sexe</label>
            <div style={{ display: "flex", gap: 8 }}>
              {[["M","Masculin"],["F","Feminin"],["indetermine","Indetermine"]].map(([v,l]) => <Tog key={v} value={v} current={form.sexe} label={l} onChange={set("sexe")} />)}
            </div>
          </div>
        </div>

        {sectionTitle("A la naissance")}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div><label style={labelSt}>Poids (g) *</label><input type="number" style={inputSt} value={form.poids_naissance_g} onChange={(e) => set("poids_naissance_g")(e.target.value)} /></div>
          <div><label style={labelSt}>Taille (cm)</label><input type="number" step="0.1" style={inputSt} value={form.taille_naissance_cm} onChange={(e) => set("taille_naissance_cm")(e.target.value)} /></div>
          <div><label style={labelSt}>PC (cm)</label><input type="number" step="0.1" style={inputSt} value={form.perimetre_cranien_cm} onChange={(e) => set("perimetre_cranien_cm")(e.target.value)} /></div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={labelSt}>Etat</label>
            <div style={{ display: "flex", gap: 6 }}>
              {[["vivant","Vivant"],["mort_ne","Mort-ne"],["mort_ne_macere","Mort-ne macere"]].map(([v,l]) => <Tog key={v} value={v} current={form.etat_naissance} label={l} onChange={set("etat_naissance")} color={v !== "vivant" ? "#374151" : ACCENT} />)}
            </div>
          </div>
          <div><label style={labelSt}>Cri a la naissance</label><div style={{ display: "flex", gap: 6 }}><Tog value={true} current={form.cri_naissance} label="Oui" onChange={set("cri_naissance")} /><Tog value={false} current={form.cri_naissance} label="Non" onChange={set("cri_naissance")} color="#EF4444" /></div></div>
          <div><label style={labelSt}>Reanimation</label><div style={{ display: "flex", gap: 6 }}><Tog value={false} current={form.reanimation_necessaire} label="Non" onChange={set("reanimation_necessaire")} /><Tog value={true} current={form.reanimation_necessaire} label="Oui" onChange={set("reanimation_necessaire")} color="#EF4444" /></div></div>
        </div>

        {sectionTitle(`Score APGAR — 1min: ${a1}  5min: ${a5}  10min: ${a10}`)}
        <div style={{ overflowX: "auto", marginBottom: 14 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ backgroundColor: colors.bgSurface }}>
                <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: 700, color: colors.textSecondary }}>Critere</th>
                {["1 min","5 min","10 min"].map((h) => <th key={h} style={{ padding: "6px 10px", fontWeight: 700, color: colors.textSecondary }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {APGAR_LABELS.map((label, idx) => (
                <tr key={idx} style={{ borderBottom: `1px solid ${colors.borderLight}` }}>
                  <td style={{ padding: "6px 10px", color: colors.text }}>{label}</td>
                  {["a1","a5","a10"].map((m) => (
                    <td key={m} style={{ padding: "4px 10px", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                        {[0,1,2].map((v) => (
                          <button key={v} type="button" onClick={() => setApgarVal(m, idx, v)} style={{ width: 28, height: 28, borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", border: `1.5px solid ${apgar[m][idx] === v ? ACCENT : "#E5E7EB"}`, backgroundColor: apgar[m][idx] === v ? ACCENT + "18" : "white", color: apgar[m][idx] === v ? ACCENT : "#374151" }}>{v}</button>
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sectionTitle("Soins immediats")}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
          {[["vitamine_k","Vitamine K"],["collyre","Collyre ophtalmique"],["bcg_vaccine","BCG"],["vhb_vaccine","Vaccin HBV"],["allaitement_maternel","Allaitement maternel"]].map(([k,l]) => (
            <label key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={!!form[k]} onChange={(e) => set(k)(e.target.checked)} style={{ accentColor: ACCENT }} />
              {l}
            </label>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, background: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 10, background: saving ? "#D1D5DB" : ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "Enregistrement..." : "Enregistrer et imprimer le certificat"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Onglet 1 : Dashboard ──────────────────────────────────────────────────────
function OngletDashboard({ etabId, auth, grossessesActives, partogrammesActifs, onRefresh }) {
  const today = new Date().toISOString().slice(0, 10);
  const debut_mois = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!etabId) return;
    Promise.all([
      supabase.from("accouchements").select("id", { count: "exact", head: true }).eq("etablissement_id", etabId).gte("date_heure_accouchement", debut_mois),
      supabase.from("nouveau_nes").select("id", { count: "exact", head: true }).eq("etablissement_id", etabId).eq("etat_naissance", "vivant").gte("created_at", debut_mois),
      supabase.from("nouveau_nes").select("id", { count: "exact", head: true }).eq("etablissement_id", etabId).in("etat_naissance", ["mort_ne","mort_ne_macere"]).gte("created_at", debut_mois),
    ]).then(([acc, vivants, mn]) => setStats({ acc: acc.count ?? 0, vivants: vivants.count ?? 0, mortNes: mn.count ?? 0 }));
  }, [etabId, debut_mois]);

  const termineDepasse = grossessesActives.filter((g) => g.date_accouchement_prevue && g.date_accouchement_prevue < today);
  const cette_semaine  = grossessesActives.filter((g) => {
    if (!g.date_accouchement_prevue) return false;
    const d = new Date(g.date_accouchement_prevue);
    const diff = (d - new Date()) / 86400000;
    return diff >= 0 && diff <= 7;
  });
  const aRisque = grossessesActives.filter((g) => g.grossesse_a_risque);

  return (
    <div>
      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { label: "Grossesses en cours",    value: grossessesActives.length, color: ACCENT },
          { label: "Accouchements ce mois",  value: stats?.acc ?? "…",        color: "#8B5CF6" },
          { label: "Nes vivants ce mois",    value: stats?.vivants ?? "…",    color: "#10B981" },
          { label: "Mort-nes ce mois",       value: stats?.mortNes ?? "…",    color: stats?.mortNes > 0 ? "#374151" : "#9CA3AF" },
          { label: "Grossesses a risque",    value: aRisque.length,           color: aRisque.length > 0 ? "#EF4444" : "#9CA3AF" },
          { label: "Terme depasse",          value: termineDepasse.length,    color: termineDepasse.length > 0 ? "#EF4444" : "#9CA3AF" },
        ].map((k) => (
          <div key={k.label} style={{ flex: "1 1 130px", backgroundColor: colors.bgCard, borderRadius: 12, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderTop: `3px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 3 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {partogrammesActifs.length > 0 && (
        <div style={{ backgroundColor: "#FFF0F6", border: `1.5px solid ${ACCENT}`, borderRadius: 10, padding: "14px 18px", marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT, marginBottom: 8 }}>Travaux en cours ({partogrammesActifs.length})</div>
          {partogrammesActifs.map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: `1px solid ${ACCENT}30`, fontSize: 12 }}>
              <span style={{ fontWeight: 600, color: colors.navy }}>{p.patients?.prenom} {p.patients?.nom}</span>
              <span style={{ color: ACCENT, fontWeight: 700 }}>{fmtDuree(p.heure_debut_travail)} de travail</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy, marginBottom: 12 }}>Prochains accouchements ({grossessesActives.slice(0, 8).length})</div>
          {grossessesActives.slice(0, 8).map((g) => {
            const p = g.patients;
            const depasse = g.date_accouchement_prevue < today;
            const proche  = cette_semaine.some((x) => x.id === g.id);
            return (
              <div key={g.id} style={{ padding: "8px 0", borderBottom: `1px solid ${colors.borderLight}`, fontSize: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 700, color: colors.navy }}>{p?.prenom} {p?.nom}</span>
                  {depasse ? <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 4, backgroundColor: "#FEF2F2", color: "#EF4444" }}>Terme depasse</span>
                    : proche ? <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 4, backgroundColor: "#FFFBEB", color: "#D97706" }}>Cette semaine</span>
                    : null}
                </div>
                <div style={{ color: colors.textMuted, marginTop: 2 }}>{fmtDate(g.date_accouchement_prevue)} · {g.date_dernieres_regles ? `${ageSA(g.date_dernieres_regles)} SA` : "—"} · {g.sage_femme_referente ?? "—"}</div>
                {g.grossesse_a_risque && <span style={{ fontSize: 10, color: "#EF4444", fontWeight: 600 }}>A risque</span>}
              </div>
            );
          })}
          {grossessesActives.length === 0 && <div style={{ color: colors.textMuted, fontSize: 13, textAlign: "center", padding: "16px 0" }}>Aucune grossesse en cours.</div>}
        </div>
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy, marginBottom: 12 }}>Grossesses a risque ({aRisque.length})</div>
          {aRisque.length === 0 && <div style={{ color: colors.textMuted, fontSize: 13, textAlign: "center", padding: "16px 0" }}>Aucune grossesse a risque.</div>}
          {aRisque.map((g) => (
            <div key={g.id} style={{ padding: "8px 0", borderBottom: `1px solid ${colors.borderLight}`, fontSize: 12 }}>
              <span style={{ fontWeight: 700, color: colors.navy }}>{g.patients?.prenom} {g.patients?.nom}</span>
              <div style={{ color: "#EF4444", marginTop: 2, fontSize: 11 }}>{(g.facteurs_risque ?? []).join(", ")}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Onglet 2 : Grossesses ─────────────────────────────────────────────────────
function OngletGrossesses({ etabId, patients, auth, onRefresh }) {
  const { success, error: showError } = useToast();
  const [grossesses, setGrossesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtre, setFiltre] = useState("toutes");
  const [showModal, setShowModal] = useState(false);
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    if (!etabId) return;
    setLoading(true);
    setGrossesses(await fetchGrossessesEtablissement(etabId));
    setLoading(false);
  }, [etabId]);

  useEffect(() => { load(); }, [load]);

  const filtered = grossesses.filter((g) => {
    if (filtre === "en_cours") return g.statut === "en_cours";
    if (filtre === "accouchee") return g.statut === "accouchee";
    if (filtre === "risque") return g.grossesse_a_risque;
    return true;
  });

  return (
    <div>
      {showModal && <ModalOuvrirGrossesse patients={patients} etabId={etabId} auth={auth} onClose={() => setShowModal(false)} onSaved={() => { load(); onRefresh(); success("Dossier ouvert"); }} />}
      {detail && <DetailGrossesse grossesse={detail} patients={patients} etabId={etabId} auth={auth} onClose={() => setDetail(null)} onRefresh={load} />}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[["toutes","Toutes"],["en_cours","En cours"],["accouchee","Accouchees"],["risque","A risque"]].map(([v,l]) => (
            <button key={v} onClick={() => setFiltre(v)} style={{ padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${filtre === v ? ACCENT : "#E5E7EB"}`, backgroundColor: filtre === v ? ACCENT + "18" : "white", color: filtre === v ? ACCENT : "#6B7280" }}>{l}</button>
          ))}
        </div>
        <button onClick={() => setShowModal(true)} style={{ padding: "7px 16px", backgroundColor: ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Ouvrir un dossier</button>
      </div>

      {loading && <div style={{ textAlign: "center", color: colors.textMuted, padding: 32 }}>Chargement...</div>}
      {!loading && filtered.length === 0 && <div style={{ textAlign: "center", color: colors.textMuted, padding: 40, fontSize: 13 }}>Aucune grossesse.</div>}
      {!loading && filtered.length > 0 && (
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ backgroundColor: colors.bgSurface }}>
                {["N° Grossesse","Patiente","DDR","Terme prevu","SA","A risque","Sage-femme","Statut",""].map((h) => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: colors.textSecondary, textTransform: "uppercase", borderBottom: `1px solid ${colors.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => {
                const p = g.patients;
                const sa = g.date_dernieres_regles ? ageSA(g.date_dernieres_regles) : null;
                return (
                  <tr key={g.id} style={{ borderBottom: `1px solid ${colors.borderLight}`, cursor: "pointer" }} onClick={() => setDetail(g)}>
                    <td style={{ padding: "10px 12px", fontFamily: "monospace", color: ACCENT }}>{g.numero_grossesse}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: colors.navy }}>{p ? `${p.prenom} ${p.nom}` : "—"}</td>
                    <td style={{ padding: "10px 12px", color: colors.textSecondary }}>{fmtDate(g.date_dernieres_regles)}</td>
                    <td style={{ padding: "10px 12px", color: colors.textSecondary }}>{fmtDate(g.date_accouchement_prevue)}</td>
                    <td style={{ padding: "10px 12px", color: colors.navy, fontWeight: 700 }}>{sa ?? "—"}</td>
                    <td style={{ padding: "10px 12px" }}>{g.grossesse_a_risque ? <span style={{ color: "#EF4444", fontWeight: 700 }}>Oui</span> : <span style={{ color: "#9CA3AF" }}>Non</span>}</td>
                    <td style={{ padding: "10px 12px", color: colors.textSecondary }}>{g.sage_femme_referente ?? "—"}</td>
                    <td style={{ padding: "10px 12px" }}><span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, backgroundColor: g.statut === "en_cours" ? "#FFF0F6" : "#DCFCE7", color: g.statut === "en_cours" ? ACCENT : "#16A34A", fontWeight: 700 }}>{g.statut}</span></td>
                    <td style={{ padding: "10px 12px" }}><button onClick={(e) => { e.stopPropagation(); setDetail(g); }} style={{ fontSize: 11, padding: "3px 9px", border: "none", borderRadius: 6, background: "#EFF6FF", color: "#2563EB", cursor: "pointer", fontWeight: 600 }}>Detail</button></td>
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

// ── Onglet 3 : Salle d'accouchement ──────────────────────────────────────────
function OngletSalle({ etabId, patients, grossessesActives, auth, onRefresh }) {
  const { success, error: showError } = useToast();
  const [partogrammes, setPartogrammes] = useState([]);
  const [showAdmission, setShowAdmission] = useState(false);
  const [partogrammeOuvert, setPartogrammeOuvert] = useState(null);

  const load = useCallback(async () => {
    if (!etabId) return;
    setPartogrammes(await fetchPartogrammesActifs(etabId));
  }, [etabId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      {showAdmission && <ModalAdmissionSalle grossessesActives={grossessesActives} patients={patients} etabId={etabId} auth={auth} onClose={() => setShowAdmission(false)} onSaved={() => { load(); onRefresh(); setShowAdmission(false); }} />}
      {partogrammeOuvert && (
        <VuePartogramme partogramme={partogrammeOuvert} patients={patients} grossessesActives={grossessesActives} etabId={etabId} auth={auth} onClose={() => setPartogrammeOuvert(null)} onRefresh={() => { load(); onRefresh(); setPartogrammeOuvert(null); }} />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>Travaux en cours ({partogrammes.length})</div>
        <button onClick={() => setShowAdmission(true)} style={{ padding: "7px 16px", backgroundColor: ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Admettre une patiente</button>
      </div>

      {partogrammes.length === 0 && <div style={{ textAlign: "center", color: colors.textMuted, padding: 40, fontSize: 13 }}>Aucun travail en cours en salle d'accouchement.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {partogrammes.map((p) => {
          const dernierReleve = (p.releves ?? []).at(-1);
          return (
            <div key={p.id} style={{ backgroundColor: colors.bgCard, borderRadius: 12, padding: "16px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderLeft: `4px solid ${ACCENT}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: colors.navy }}>{p.patients?.prenom} {p.patients?.nom}</div>
                  <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>Debut travail : {p.heure_debut_travail ? new Date(p.heure_debut_travail).toLocaleString("fr-FR") : "—"} · Duree : {fmtDuree(p.heure_debut_travail)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  {dernierReleve && <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>Dilatation : {dernierReleve.dilatation_cm} cm</div>}
                  {dernierReleve?.bcf && <div style={{ fontSize: 11, color: colors.textMuted }}>BCF : {dernierReleve.bcf} bpm</div>}
                </div>
              </div>
              <button onClick={() => setPartogrammeOuvert(p)} style={{ padding: "6px 14px", backgroundColor: ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                Ouvrir le partogramme
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Onglet 4 : Nouveau-nés ────────────────────────────────────────────────────
function OngletNouveauNes({ etabId, patients, auth }) {
  const [nns, setNns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtrePeriode, setFiltrePeriode] = useState("mois");

  useEffect(() => {
    if (!etabId) return;
    setLoading(true);
    fetchNouveauNesEtablissement(etabId, 200).then((data) => { setNns(data); setLoading(false); });
  }, [etabId]);

  const debut = filtrePeriode === "mois"
    ? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    : filtrePeriode === "trimestre"
    ? new Date(Date.now() - 90 * 86400000).toISOString()
    : "1970-01-01";

  const filtres = nns.filter((n) => n.created_at >= debut);
  const vivants   = filtres.filter((n) => n.etat_naissance === "vivant").length;
  const faible    = filtres.filter((n) => n.poids_naissance_g < 2500).length;
  const tresFaible= filtres.filter((n) => n.poids_naissance_g < 1500).length;
  const apgarBas  = filtres.filter((n) => n.apgar_5min != null && n.apgar_5min < 7).length;
  const mortNes   = filtres.filter((n) => n.etat_naissance !== "vivant").length;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[["mois","Ce mois"],["trimestre","3 mois"],["tout","Tout"]].map(([v,l]) => (
          <button key={v} onClick={() => setFiltrePeriode(v)} style={{ padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${filtrePeriode === v ? ACCENT : "#E5E7EB"}`, backgroundColor: filtrePeriode === v ? ACCENT + "18" : "white", color: filtrePeriode === v ? ACCENT : "#6B7280" }}>{l}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {[["Nes vivants",vivants,"#10B981"],["Faible poids (<2500g)",faible,faible>0?"#F59E0B":"#9CA3AF"],["Tres faible (<1500g)",tresFaible,tresFaible>0?"#EF4444":"#9CA3AF"],["APGAR 5min < 7",apgarBas,apgarBas>0?"#EF4444":"#9CA3AF"],["Mort-nes",mortNes,mortNes>0?"#374151":"#9CA3AF"]].map(([l,v,c]) => (
          <div key={l} style={{ flex: "1 1 130px", backgroundColor: colors.bgCard, borderRadius: 12, padding: "12px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderTop: `3px solid ${c}` }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: c }}>{loading ? "…" : v}</div>
            <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>

      {!loading && filtres.length === 0 && <div style={{ textAlign: "center", color: colors.textMuted, padding: 40, fontSize: 13 }}>Aucun nouveau-ne enregistre.</div>}
      {!loading && filtres.length > 0 && (
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ backgroundColor: colors.bgSurface }}>
                {["Date","Prenom & Nom","Sexe","Poids (g)","APGAR 5min","Etat","Mere","Actions"].map((h) => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: colors.textSecondary, textTransform: "uppercase", borderBottom: `1px solid ${colors.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtres.map((n) => {
                const mere = n.patients;
                const apgarColor = n.apgar_5min != null ? (n.apgar_5min < 7 ? "#EF4444" : n.apgar_5min < 9 ? "#F59E0B" : "#16A34A") : "#9CA3AF";
                return (
                  <tr key={n.id} style={{ borderBottom: `1px solid ${colors.borderLight}` }}>
                    <td style={{ padding: "10px 12px", color: colors.textSecondary }}>{fmtDate(n.created_at)}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: colors.navy }}>{n.prenom || "—"} {n.nom || ""}</td>
                    <td style={{ padding: "10px 12px", color: colors.textSecondary }}>{n.sexe === "M" ? "M" : n.sexe === "F" ? "F" : "—"}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: n.poids_naissance_g < 2500 ? "#F59E0B" : colors.navy }}>{n.poids_naissance_g}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: apgarColor }}>{n.apgar_5min ?? "—"}</td>
                    <td style={{ padding: "10px 12px" }}><span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, fontWeight: 700, backgroundColor: n.etat_naissance === "vivant" ? "#DCFCE7" : "#F3F4F6", color: n.etat_naissance === "vivant" ? "#16A34A" : "#374151" }}>{n.etat_naissance}</span></td>
                    <td style={{ padding: "10px 12px", color: colors.textSecondary }}>{mere ? `${mere.prenom} ${mere.nom}` : "—"}</td>
                    <td style={{ padding: "10px 12px" }}>
                      {n.numero_certificat_naissance && (
                        <button onClick={() => imprimerCertificatNaissance(n, n.accouchements ?? {}, mere, auth)} style={{ fontSize: 11, padding: "3px 9px", border: "none", borderRadius: 6, background: ACCENT + "18", color: ACCENT, cursor: "pointer", fontWeight: 600 }}>Certificat</button>
                      )}
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

// ── Onglet 5 : Registre ───────────────────────────────────────────────────────
function OngletRegistre({ etabId, patients, auth }) {
  const [accouchements, setAccouchements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtrePeriode, setFiltrePeriode] = useState("mois");

  useEffect(() => {
    if (!etabId) return;
    setLoading(true);
    fetchAccouchementsEtablissement(etabId, 200).then((data) => { setAccouchements(data); setLoading(false); });
  }, [etabId]);

  const debut = filtrePeriode === "mois"
    ? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    : filtrePeriode === "3mois" ? new Date(Date.now() - 90 * 86400000).toISOString()
    : filtrePeriode === "6mois" ? new Date(Date.now() - 180 * 86400000).toISOString()
    : "1970-01-01";

  const filtres = accouchements.filter((a) => a.date_heure_accouchement >= debut);
  const total = filtres.length;
  const parType = TYPES_ACC.reduce((acc, t) => { acc[t] = filtres.filter((a) => a.type_accouchement === t).length; return acc; }, {});
  const tauxCesar = total > 0 ? Math.round((parType.cesarienne / total) * 100) : 0;
  const mortNes = filtres.reduce((s, a) => s + (a.nouveau_nes ?? []).filter((n) => n.etat_naissance !== "vivant").length, 0);
  const poidsTotal = filtres.flatMap((a) => (a.nouveau_nes ?? []).map((n) => n.poids_naissance_g)).filter(Boolean);
  const poidsMoyen = poidsTotal.length > 0 ? Math.round(poidsTotal.reduce((s, v) => s + v, 0) / poidsTotal.length) : null;

  const handleExporter = async () => {
    const etab = await fetchEtabFromAuth(auth);
    const rows = filtres.map((a) => {
      const nn = (a.nouveau_nes ?? [])[0];
      const p = a.patients;
      return [
        a.numero_accouchement,
        fmtDate(a.date_heure_accouchement),
        p ? `${p.prenom} ${p.nom}` : "—",
        a.type_accouchement,
        a.sage_femme,
        nn ? `${nn.prenom || "—"} ${nn.nom || ""}` : "—",
        nn ? `${nn.poids_naissance_g} g` : "—",
        nn?.apgar_5min ?? "—",
        nn?.etat_naissance ?? "—",
      ];
    });
    openDocument({
      titre: "Registre des accouchements",
      sousTitre: `${fmtDate(new Date().toISOString())} — ${total} accouchements`,
      etablissement: etab,
      sections: [
        { titre: "Statistiques", html: infoGridHTML([
          { label: "Total", value: String(total) },
          { label: "Eutocique", value: String(parType.eutocique ?? 0) },
          { label: "Cesarienne", value: `${parType.cesarienne ?? 0} (${tauxCesar}%)` },
          { label: "Mort-nes", value: String(mortNes) },
          { label: "Poids moyen", value: poidsMoyen ? `${poidsMoyen} g` : "—" },
        ]) },
        { titre: `Detail des ${total} accouchements`, html: tableHTML(["N° ACC","Date","Mere","Type","Sage-femme","Nouveau-ne","Poids","APGAR 5","Etat"], rows) },
      ],
    });
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[["mois","Ce mois"],["3mois","3 mois"],["6mois","6 mois"],["tout","Tout"]].map(([v,l]) => (
            <button key={v} onClick={() => setFiltrePeriode(v)} style={{ padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${filtrePeriode === v ? ACCENT : "#E5E7EB"}`, backgroundColor: filtrePeriode === v ? ACCENT + "18" : "white", color: filtrePeriode === v ? ACCENT : "#6B7280" }}>{l}</button>
          ))}
        </div>
        <button onClick={handleExporter} style={{ padding: "7px 14px", backgroundColor: "#1F2937", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Exporter le registre</button>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        {[["Total",total,"#8B5CF6"],["Eutociques",parType.eutocique??0,"#10B981"],["Cesariennes",`${parType.cesarienne??0} (${tauxCesar}%)`,"#3B82F6"],["Mort-nes",mortNes,mortNes>0?"#374151":"#9CA3AF"],["Poids moyen",poidsMoyen?`${poidsMoyen}g`:"—","#F59E0B"]].map(([l,v,c]) => (
          <div key={l} style={{ flex: "1 1 110px", backgroundColor: colors.bgCard, borderRadius: 12, padding: "12px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderTop: `3px solid ${c}` }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: c }}>{loading ? "…" : v}</div>
            <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>

      {!loading && filtres.length === 0 && <div style={{ textAlign: "center", color: colors.textMuted, padding: 40, fontSize: 13 }}>Aucun accouchement enregistre.</div>}
      {!loading && filtres.length > 0 && (
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ backgroundColor: colors.bgSurface }}>
                {["N° ACC","Date","Mere","Type","Sage-femme","Nouveau-ne","Poids","APGAR","Etat"].map((h) => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: colors.textSecondary, textTransform: "uppercase", borderBottom: `1px solid ${colors.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtres.map((a) => {
                const nn = (a.nouveau_nes ?? [])[0];
                const p = a.patients;
                return (
                  <tr key={a.id} style={{ borderBottom: `1px solid ${colors.borderLight}` }}>
                    <td style={{ padding: "10px 12px", fontFamily: "monospace", color: ACCENT }}>{a.numero_accouchement}</td>
                    <td style={{ padding: "10px 12px", color: colors.textSecondary }}>{fmtDate(a.date_heure_accouchement)}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: colors.navy }}>{p ? `${p.prenom} ${p.nom}` : "—"}</td>
                    <td style={{ padding: "10px 12px" }}><span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, backgroundColor: a.type_accouchement === "cesarienne" ? "#DBEAFE" : "#DCFCE7", color: a.type_accouchement === "cesarienne" ? "#2563EB" : "#16A34A", fontWeight: 700 }}>{a.type_accouchement}</span></td>
                    <td style={{ padding: "10px 12px", color: colors.textSecondary }}>{a.sage_femme}</td>
                    <td style={{ padding: "10px 12px", color: colors.navy }}>{nn ? `${nn.prenom || "—"} ${nn.nom || ""}` : "—"}</td>
                    <td style={{ padding: "10px 12px", color: nn?.poids_naissance_g < 2500 ? "#F59E0B" : colors.navy, fontWeight: 700 }}>{nn?.poids_naissance_g ? `${nn.poids_naissance_g} g` : "—"}</td>
                    <td style={{ padding: "10px 12px", color: nn?.apgar_5min < 7 ? "#EF4444" : "#16A34A", fontWeight: 700 }}>{nn?.apgar_5min ?? "—"}</td>
                    <td style={{ padding: "10px 12px" }}>{nn ? <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 6, backgroundColor: nn.etat_naissance === "vivant" ? "#DCFCE7" : "#F3F4F6", color: nn.etat_naissance === "vivant" ? "#16A34A" : "#374151", fontWeight: 700 }}>{nn.etat_naissance}</span> : "—"}</td>
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
export default function Maternite() {
  const { auth } = useAuth();
  const { toasts, error: showError } = useToast();
  const { data: patients } = usePatients(auth?.etablissement_id);
  const [onglet, setOnglet] = useState("dashboard");
  const [etabId, setEtabId] = useState(auth?.etablissement_id ?? null);
  const [grossessesActives, setGrossessesActives] = useState([]);
  const [partogrammesActifs, setPartogrammesActifs] = useState([]);

  useEffect(() => {
    if (etabId) return;
    const resolve = async () => {
      let eid = auth?.etablissement_id;
      if (!eid && auth?.user?.email) {
        const { data } = await supabase.from("membres_personnel").select("etablissement_id").eq("email", auth.user.email).eq("actif", true).maybeSingle();
        eid = data?.etablissement_id ?? null;
      }
      if (eid) setEtabId(eid);
    };
    resolve();
  }, [auth, etabId]);

  const loadBase = useCallback(async () => {
    if (!etabId) return;
    const [g, p] = await Promise.all([fetchGrossessesActives(etabId), fetchPartogrammesActifs(etabId)]);
    setGrossessesActives(g);
    setPartogrammesActifs(p);
  }, [etabId]);

  useEffect(() => { loadBase(); }, [loadBase]);

  const ONGLETS = [
    { key: "dashboard",  label: "Tableau de bord" },
    { key: "grossesses", label: `Grossesses (${grossessesActives.length})` },
    { key: "salle",      label: `Salle d'accouchement${partogrammesActifs.length > 0 ? ` (${partogrammesActifs.length})` : ""}` },
    { key: "nnes",       label: "Nouveau-nes" },
    { key: "registre",   label: "Registre" },
  ];

  return (
    <Layout title="Maternite" subtitle="Suivi de grossesse, accouchements, nouveau-nes et certificats de naissance">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <Toast toasts={toasts} />

      <div style={{ display: "flex", gap: 2, marginBottom: 24, borderBottom: `2px solid ${colors.border}` }}>
        {ONGLETS.map((o) => (
          <button key={o.key} onClick={() => setOnglet(o.key)} style={{ padding: "10px 18px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: onglet === o.key ? 800 : 400, color: onglet === o.key ? ACCENT : colors.textSecondary, borderBottom: onglet === o.key ? `3px solid ${ACCENT}` : "3px solid transparent", marginBottom: -2, whiteSpace: "nowrap" }}>
            {o.label}
          </button>
        ))}
      </div>

      {onglet === "dashboard" && <OngletDashboard etabId={etabId} auth={auth} grossessesActives={grossessesActives} partogrammesActifs={partogrammesActifs} onRefresh={loadBase} />}
      {onglet === "grossesses" && <OngletGrossesses etabId={etabId} patients={patients} auth={auth} onRefresh={loadBase} />}
      {onglet === "salle"     && <OngletSalle etabId={etabId} patients={patients} grossessesActives={grossessesActives} auth={auth} onRefresh={loadBase} />}
      {onglet === "nnes"      && <OngletNouveauNes etabId={etabId} patients={patients} auth={auth} />}
      {onglet === "registre"  && <OngletRegistre etabId={etabId} patients={patients} auth={auth} />}
    </Layout>
  );
}
