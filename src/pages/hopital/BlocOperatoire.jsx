import { colors } from "../../theme";
import { useState, useEffect, useCallback } from "react";
import Layout from "../../components/Layout";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../supabaseClient";
import { usePatients } from "../../hooks/useSupabaseData";
import {
  fetchSallesOperation, upsertSalleOperation, updateSalleStatut,
  insertIntervention, updateIntervention, fetchInterventionsJour,
  genererNumeroIntervention,
  insertChecklist, updateChecklist, fetchChecklistIntervention,
  insertCRO, updateCRO, fetchCROIntervention,
  insertFeuilleReveil, updateFeuilleReveil, fetchFeuilleReveilIntervention,
} from "../../hooks/useMutations";
import { openDocument, tableHTML, infoGridHTML, signatureRowHTML, fetchEtabFromAuth } from "../../utils/MedOSDocument";

const ACCENT = "#8B5CF6";

const inputSt  = { width: "100%", padding: "9px 11px", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", color: colors.navy, backgroundColor: colors.bgCard };
const labelSt  = { display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginBottom: 5 };
const secTitle = (t) => <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 10, paddingBottom: 6, borderBottom: "1.5px solid #E5E7EB" }}>{t}</div>;

const STATUT_CFG = {
  planifiee:      { label: "Planifiee",      bg: "#F3F4F6", color: "#6B7280" },
  en_preparation: { label: "En preparation", bg: "#FEF3C7", color: "#D97706" },
  en_cours:       { label: "En cours",       bg: "#DBEAFE", color: "#2563EB" },
  en_reveil:      { label: "En reveil",      bg: "#EDE9FE", color: "#7C3AED" },
  terminee:       { label: "Terminee",       bg: "#DCFCE7", color: "#16A34A" },
  annulee:        { label: "Annulee",        bg: "#FEF2F2", color: "#EF4444" },
  reportee:       { label: "Reportee",       bg: "#F3F4F6", color: "#9CA3AF" },
};

const SPECIALITES = ["Chirurgie generale","Orthopedie","Gynecologie","Urologie","ORL","Ophtalmologie","Neurochirurgie","Autre"];
const TYPES_ACC   = ["programmee","urgente","ambulatoire"];
const SALLE_STATUT_CFG = {
  libre:       { label: "Libre",        bg: "#DCFCE7", color: "#16A34A" },
  occupee:     { label: "Occupee",      bg: "#FEF2F2", color: "#EF4444" },
  nettoyage:   { label: "Nettoyage",    bg: "#FEF3C7", color: "#D97706" },
  hors_service:{ label: "Hors service", bg: "#F3F4F6", color: "#9CA3AF" },
};

function fmtDate(d) { if (!d) return "—"; return new Date(d).toLocaleDateString("fr-FR"); }
function fmtDureeMin(ms) { const m = Math.floor(ms / 60000); if (m < 60) return `${m} min`; return `${Math.floor(m/60)}h${m%60>0?m%60+"min":""}`; }

function Tog({ value, current, label, onChange, color }) {
  const c = color ?? ACCENT;
  const active = current === value;
  return (
    <button type="button" onClick={() => onChange(value)} style={{ flex: 1, padding: "7px 8px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${active ? c : "#E5E7EB"}`, backgroundColor: active ? c + "18" : "white", color: active ? c : "#374151" }}>
      {label}
    </button>
  );
}

// ── Chronomètre live ──────────────────────────────────────────────────────────
function Chrono({ isoStart }) {
  const [elapsed, setElapsed] = useState(Date.now() - new Date(isoStart));
  useEffect(() => {
    const t = setInterval(() => setElapsed(Date.now() - new Date(isoStart)), 10000);
    return () => clearInterval(t);
  }, [isoStart]);
  return <span>{fmtDureeMin(elapsed)}</span>;
}

// ── Impression CRO ────────────────────────────────────────────────────────────
async function imprimerCRO(cro, intervention, patient, auth) {
  const etab = await fetchEtabFromAuth(auth);
  openDocument({
    titre: "Compte rendu operatoire",
    sousTitre: `${intervention.numero_intervention} — ${fmtDate(intervention.heure_debut_reelle ?? intervention.date_prevue)}`,
    etablissement: etab,
    sections: [
      { titre: "Identification", html: infoGridHTML([
        { label: "Patient",          value: patient ? `${patient.prenom} ${patient.nom}` : "—" },
        { label: "Date naissance",   value: patient?.date_naissance ? fmtDate(patient.date_naissance) : "—" },
        { label: "Groupe sanguin",   value: patient?.groupe_sanguin ?? "—" },
        { label: "N° intervention",  value: intervention.numero_intervention },
        { label: "Date",             value: fmtDate(intervention.heure_debut_reelle ?? intervention.date_prevue) },
        { label: "Duree",            value: intervention.heure_debut_reelle && intervention.heure_fin_reelle ? fmtDureeMin(new Date(intervention.heure_fin_reelle) - new Date(intervention.heure_debut_reelle)) : "—" },
      ]) },
      { titre: "Diagnostic pre-operatoire", html: `<p style="font-size:13px">${intervention.diagnostic_preoperatoire ?? "—"}</p>` },
      { titre: "Anesthesie", html: infoGridHTML([
        { label: "Type",        value: cro.type_anesthesie ?? "—" },
        { label: "Inducteur",   value: cro.inducteur ?? "—" },
        { label: "Curare",      value: cro.curare ?? "—" },
        { label: "Morphinique", value: cro.morphinique ?? "—" },
        { label: "Gaz",         value: cro.gaz ?? "—" },
      ]) },
      { titre: "Description de l'acte", html: `<p style="font-size:13px;line-height:1.7;white-space:pre-wrap">${cro.description_acte}</p>` },
      ...(cro.incidents_perop ? [{ titre: "Incidents per-operatoires", html: `<p style="font-size:13px;color:#DC2626">${cro.incidents_perop}</p>` }] : []),
      { titre: "Bilan operatoire", html: infoGridHTML([
        { label: "Pertes sanguines", value: cro.pertes_sang_ml ? `${cro.pertes_sang_ml} mL` : "—" },
        { label: "Transfusion",      value: cro.transfusion ? `Oui${cro.transfusion_detail ? " — " + cro.transfusion_detail : ""}` : "Non" },
      ]) },
      { titre: "Consignes post-operatoires", html: `<p style="font-size:13px">${cro.consignes_postop ?? "—"}</p>` },
      ...(cro.consommables?.length > 0 ? [{ titre: "Consommables utilises", html: tableHTML(["Consommable","Reference","Quantite","N° lot"], cro.consommables.map((c) => [c.nom, c.reference ?? "—", String(c.quantite ?? 1), c.lot ?? "—"])) }] : []),
      { titre: "", html: signatureRowHTML(["Chirurgien", "Anesthesiste", "Instrumentiste"]) },
    ],
  });
}

// ── Modal programmer une intervention ─────────────────────────────────────────
function ModalProgrammer({ patients, salles, etabId, auth, onClose, onSaved }) {
  const { success, error: showError } = useToast();
  const [form, setForm] = useState({
    patient_id: "", date_prevue: new Date().toISOString().slice(0, 10), heure_prevue: "08:00",
    duree_prevue_min: 60, intitule: "", type: "programmee", specialite: SPECIALITES[0],
    salle_id: "", chirurgien_principal: auth?.user?.email ?? "", chirurgien_aide: "",
    anesthesiste: "", instrumentiste: "", diagnostic_preoperatoire: "",
    notes_preoperatoires: "", consentement_signe: false, date_consentement: "",
  });
  const [saving, setSaving] = useState(false);
  const [filtre, setFiltre] = useState("");
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const patsFiltres = patients.filter((p) => !filtre || `${p.prenom} ${p.nom}`.toLowerCase().includes(filtre.toLowerCase())).slice(0, 60);

  const handleSave = async () => {
    if (!form.patient_id || !form.intitule.trim() || !form.chirurgien_principal.trim()) {
      return showError("Patient, intitule et chirurgien principal sont obligatoires.");
    }
    setSaving(true);
    try {
      const numero = await genererNumeroIntervention(etabId);
      await insertIntervention({ ...form, etablissement_id: etabId, numero_intervention: numero, duree_prevue_min: Number(form.duree_prevue_min), salle_id: form.salle_id || null, date_consentement: form.date_consentement || null });
      success("Intervention programmee");
      onSaved(); onClose();
    } catch (e) { showError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 14 }}>
      <div style={{ background: colors.bgCard, borderRadius: 16, width: "100%", maxWidth: 620, maxHeight: "93vh", overflowY: "auto", padding: "22px 26px", boxShadow: "0 20px 60px rgba(0,0,0,0.22)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.navy }}>Programmer une intervention</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted }}>×</button>
        </div>

        {secTitle("Patient")}
        <input style={{ ...inputSt, marginBottom: 6 }} placeholder="Rechercher..." value={filtre} onChange={(e) => setFiltre(e.target.value)} />
        <select style={{ ...inputSt, marginBottom: 14 }} value={form.patient_id} onChange={(e) => set("patient_id")(e.target.value)}>
          <option value="">-- Selectionner --</option>
          {patsFiltres.map((p) => <option key={p.id} value={p.id}>{p.prenom} {p.nom}{p.numero_dossier ? ` — ${p.numero_dossier}` : ""}</option>)}
        </select>

        {secTitle("Planification")}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div><label style={labelSt}>Date prevue</label><input type="date" style={inputSt} value={form.date_prevue} onChange={(e) => set("date_prevue")(e.target.value)} /></div>
          <div><label style={labelSt}>Heure</label><input type="time" style={inputSt} value={form.heure_prevue} onChange={(e) => set("heure_prevue")(e.target.value)} /></div>
          <div><label style={labelSt}>Duree (min)</label><input type="number" min="15" step="15" style={inputSt} value={form.duree_prevue_min} onChange={(e) => set("duree_prevue_min")(e.target.value)} /></div>
        </div>

        {secTitle("Intervention")}
        <div style={{ marginBottom: 10 }}><label style={labelSt}>Intitule *</label><input style={inputSt} value={form.intitule} onChange={(e) => set("intitule")(e.target.value)} placeholder="Ex : Appendicectomie, Hernie inguinale droite" /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 10 }}>
          <div>
            <label style={labelSt}>Type</label>
            <select style={inputSt} value={form.type} onChange={(e) => set("type")(e.target.value)}>
              {TYPES_ACC.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label style={labelSt}>Specialite</label>
            <select style={inputSt} value={form.specialite} onChange={(e) => set("specialite")(e.target.value)}>
              {SPECIALITES.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label style={labelSt}>Salle</label>
            <select style={inputSt} value={form.salle_id} onChange={(e) => set("salle_id")(e.target.value)}>
              <option value="">— Non assignee —</option>
              {salles.filter((s) => s.statut === "libre").map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
            </select>
          </div>
        </div>

        {secTitle("Equipe")}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          {[["chirurgien_principal","Chirurgien principal *"],["chirurgien_aide","Chirurgien aide"],["anesthesiste","Anesthesiste"],["instrumentiste","Instrumentiste"]].map(([k,l]) => (
            <div key={k}><label style={labelSt}>{l}</label><input style={inputSt} value={form[k]} onChange={(e) => set(k)(e.target.value)} /></div>
          ))}
        </div>

        <div style={{ marginBottom: 12 }}><label style={labelSt}>Diagnostic pre-operatoire</label><textarea rows={2} style={{ ...inputSt, resize: "vertical" }} value={form.diagnostic_preoperatoire} onChange={(e) => set("diagnostic_preoperatoire")(e.target.value)} /></div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div>
            <label style={labelSt}>Consentement signe</label>
            <div style={{ display: "flex", gap: 6 }}>
              <Tog value={true}  current={form.consentement_signe} label="Oui" onChange={set("consentement_signe")} />
              <Tog value={false} current={form.consentement_signe} label="Non" onChange={set("consentement_signe")} color="#EF4444" />
            </div>
          </div>
          {form.consentement_signe && (
            <div><label style={labelSt}>Date consentement</label><input type="date" style={inputSt} value={form.date_consentement} onChange={(e) => set("date_consentement")(e.target.value)} /></div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, background: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 10, background: saving ? "#D1D5DB" : ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "Enregistrement..." : "Programmer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Onglet 1 — Programme du jour ──────────────────────────────────────────────
function OngletProgramme({ etabId, patients, salles, auth }) {
  const { success, error: showError } = useToast();
  const [date, setDate]             = useState(new Date().toISOString().slice(0, 10));
  const [interventions, setInter]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [annulerModal, setAnnulerModal] = useState(null);
  const [reporterModal, setReporterModal] = useState(null);
  const [motifAnnul, setMotifAnnul] = useState("");
  const [nvDate, setNvDate]         = useState("");

  const load = useCallback(async () => {
    if (!etabId) return;
    setLoading(true);
    setInter(await fetchInterventionsJour(etabId, date));
    setLoading(false);
  }, [etabId, date]);

  useEffect(() => { load(); }, [load]);

  const kpis = {
    planifiees:     interventions.filter((i) => i.statut === "planifiee").length,
    enCours:        interventions.filter((i) => i.statut === "en_cours").length,
    terminees:      interventions.filter((i) => i.statut === "terminee").length,
    annulees:       interventions.filter((i) => i.statut === "annulee").length,
    urgentes:       interventions.filter((i) => i.type === "urgente").length,
  };

  const handleAction = async (inter, action) => {
    try {
      switch (action) {
        case "preparer":
          await updateIntervention(inter.id, { statut: "en_preparation" });
          // Créer checklist automatiquement
          const existingCL = await fetchChecklistIntervention(inter.id);
          if (!existingCL) await insertChecklist({ intervention_id: inter.id, etablissement_id: etabId });
          success("Preparation lancee — checklist creee");
          break;
        case "demarrer":
          await updateIntervention(inter.id, { statut: "en_cours", heure_debut_reelle: new Date().toISOString() });
          if (inter.salle_id) await updateSalleStatut(inter.salle_id, "occupee");
          success("Intervention demarree");
          break;
        case "terminer":
          await updateIntervention(inter.id, { statut: "en_reveil", heure_fin_reelle: new Date().toISOString() });
          const existingFR = await fetchFeuilleReveilIntervention(inter.id);
          if (!existingFR) await insertFeuilleReveil({ intervention_id: inter.id, patient_id: inter.patient_id, etablissement_id: etabId, infirmiere_reveil: auth?.user?.email ?? "" });
          success("Intervention terminee — feuille de reveil creee");
          break;
        case "cloturer":
          await updateIntervention(inter.id, { statut: "terminee" });
          if (inter.salle_id) await updateSalleStatut(inter.salle_id, "nettoyage");
          success("Intervention cloturee");
          break;
        default: break;
      }
      load();
    } catch (e) { showError(e.message); }
  };

  const handleAnnuler = async () => {
    if (!annulerModal) return;
    await updateIntervention(annulerModal.id, { statut: "annulee", notes_preoperatoires: motifAnnul });
    setAnnulerModal(null); setMotifAnnul(""); load();
  };
  const handleReporter = async () => {
    if (!reporterModal || !nvDate) return showError("Saisissez une nouvelle date.");
    await updateIntervention(reporterModal.id, { statut: "reportee", date_prevue: nvDate });
    setReporterModal(null); setNvDate(""); load();
  };

  const handleImprimer = async () => {
    const etab = await fetchEtabFromAuth(auth);
    const rows = interventions.map((i) => [
      i.heure_prevue?.slice(0, 5) ?? "—",
      i.patients ? `${i.patients.prenom} ${i.patients.nom}` : "—",
      i.intitule,
      i.salles_operation?.nom ?? "—",
      i.chirurgien_principal,
      i.anesthesiste ?? "—",
      `${i.duree_prevue_min} min`,
      STATUT_CFG[i.statut]?.label ?? i.statut,
    ]);
    openDocument({
      titre: "Programme operatoire",
      sousTitre: new Date(date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
      etablissement: etab,
      sections: [{ titre: `${interventions.length} interventions programmees`, html: tableHTML(["Heure","Patient","Intervention","Salle","Chirurgien","Anesthesiste","Duree","Statut"], rows) }],
    });
  };

  return (
    <div>
      {showModal && <ModalProgrammer patients={patients} salles={salles} etabId={etabId} auth={auth} onClose={() => setShowModal(false)} onSaved={load} />}

      {/* Modal annulation */}
      {annulerModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: colors.bgCard, borderRadius: 14, padding: 24, width: 380 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: colors.navy }}>Annuler — {annulerModal.intitule}</h3>
            <label style={labelSt}>Motif</label>
            <textarea rows={3} style={{ ...inputSt, marginBottom: 14, resize: "vertical" }} value={motifAnnul} onChange={(e) => setMotifAnnul(e.target.value)} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setAnnulerModal(null)} style={{ flex: 1, padding: 9, background: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Fermer</button>
              <button onClick={handleAnnuler} style={{ flex: 2, padding: 9, background: "#EF4444", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Confirmer l'annulation</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal reporter */}
      {reporterModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: colors.bgCard, borderRadius: 14, padding: 24, width: 340 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: colors.navy }}>Reporter — {reporterModal.intitule}</h3>
            <label style={labelSt}>Nouvelle date</label>
            <input type="date" style={{ ...inputSt, marginBottom: 14 }} value={nvDate} onChange={(e) => setNvDate(e.target.value)} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setReporterModal(null)} style={{ flex: 1, padding: 9, background: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Annuler</button>
              <button onClick={handleReporter} style={{ flex: 2, padding: 9, background: ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Reporter</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputSt, width: 170 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleImprimer} style={{ padding: "7px 14px", backgroundColor: "#7C3AED", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Imprimer</button>
          <button onClick={() => setShowModal(true)} style={{ padding: "7px 16px", backgroundColor: ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Programmer</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        {[["Planifiees",kpis.planifiees,"#6B7280"],["En cours",kpis.enCours,"#2563EB"],["Terminees",kpis.terminees,"#16A34A"],["Annulees",kpis.annulees,"#EF4444"],["Urgentes",kpis.urgentes,kpis.urgentes>0?"#EF4444":"#9CA3AF"]].map(([l,v,c]) => (
          <div key={l} style={{ flex: "1 1 100px", backgroundColor: colors.bgCard, borderRadius: 12, padding: "12px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderTop: `3px solid ${c}` }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: c }}>{loading ? "…" : v}</div>
            <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>

      {loading && <div style={{ textAlign: "center", color: colors.textMuted, padding: 40 }}>Chargement...</div>}
      {!loading && interventions.length === 0 && <div style={{ textAlign: "center", color: colors.textMuted, padding: 40, fontSize: 13 }}>Aucune intervention programmee ce jour.</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {interventions.map((inter) => {
          const st  = STATUT_CFG[inter.statut] ?? STATUT_CFG.planifiee;
          const pat = inter.patients;
          const hasAllergies = (pat?.allergies ?? []).length > 0;
          return (
            <div key={inter.id} style={{ backgroundColor: colors.bgCard, borderRadius: 12, padding: "14px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderLeft: `4px solid ${st.color}`, opacity: inter.statut === "annulee" ? 0.6 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: ACCENT }}>{inter.heure_prevue?.slice(0, 5)}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>{inter.intitule}</span>
                    {inter.type === "urgente" && <span style={{ fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 4, backgroundColor: "#FEF2F2", color: "#EF4444" }}>URGENT</span>}
                  </div>
                  <div style={{ fontSize: 12, color: colors.textSecondary }}>
                    {pat ? `${pat.prenom} ${pat.nom}` : "—"}
                    {hasAllergies && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 800, color: "#EF4444", backgroundColor: "#FEF2F2", padding: "1px 6px", borderRadius: 4 }}>ALLERGIES</span>}
                    <span style={{ marginLeft: 10, color: colors.textMuted }}>Salle : {inter.salles_operation?.nom ?? "—"}</span>
                    <span style={{ marginLeft: 10, color: colors.textMuted }}>Chir. : {inter.chirurgien_principal}</span>
                    {inter.anesthesiste && <span style={{ marginLeft: 10, color: colors.textMuted }}>Anesth. : {inter.anesthesiste}</span>}
                    <span style={{ marginLeft: 10, color: colors.textMuted }}>{inter.duree_prevue_min} min</span>
                  </div>
                  {inter.statut === "en_cours" && inter.heure_debut_reelle && (
                    <div style={{ fontSize: 11, color: "#2563EB", fontWeight: 700, marginTop: 4 }}>En cours depuis : <Chrono isoStart={inter.heure_debut_reelle} /></div>
                  )}
                </div>
                <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 8, fontWeight: 700, backgroundColor: st.bg, color: st.color, animation: inter.statut === "en_cours" ? "pulse 2s infinite" : "none", whiteSpace: "nowrap" }}>{st.label}</span>
              </div>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {inter.statut === "planifiee" && (
                  <>
                    <button onClick={() => handleAction(inter, "preparer")} style={{ padding: "4px 11px", fontSize: 11, fontWeight: 700, backgroundColor: "#FEF3C7", color: "#D97706", border: "none", borderRadius: 6, cursor: "pointer" }}>Preparer</button>
                    <button onClick={() => setReporterModal(inter)} style={{ padding: "4px 11px", fontSize: 11, fontWeight: 600, backgroundColor: colors.bgSurface, color: colors.textSecondary, border: `1px solid ${colors.border}`, borderRadius: 6, cursor: "pointer" }}>Reporter</button>
                    <button onClick={() => setAnnulerModal(inter)} style={{ padding: "4px 11px", fontSize: 11, fontWeight: 600, backgroundColor: "#FEF2F2", color: "#EF4444", border: "none", borderRadius: 6, cursor: "pointer" }}>Annuler</button>
                  </>
                )}
                {inter.statut === "en_preparation" && (
                  <button onClick={() => handleAction(inter, "demarrer")} style={{ padding: "4px 11px", fontSize: 11, fontWeight: 700, backgroundColor: "#DBEAFE", color: "#2563EB", border: "none", borderRadius: 6, cursor: "pointer" }}>Demarrer l'intervention</button>
                )}
                {inter.statut === "en_cours" && (
                  <button onClick={() => handleAction(inter, "terminer")} style={{ padding: "4px 11px", fontSize: 11, fontWeight: 700, backgroundColor: "#EDE9FE", color: ACCENT, border: "none", borderRadius: 6, cursor: "pointer" }}>Terminer → Reveil</button>
                )}
                {inter.statut === "en_reveil" && (
                  <button onClick={() => handleAction(inter, "cloturer")} style={{ padding: "4px 11px", fontSize: 11, fontWeight: 700, backgroundColor: "#DCFCE7", color: "#16A34A", border: "none", borderRadius: 6, cursor: "pointer" }}>Cloturer</button>
                )}
                <span style={{ fontSize: 11, color: colors.textMuted, padding: "4px 6px" }}>{inter.numero_intervention}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Onglet 2 — Salles ─────────────────────────────────────────────────────────
function OngletSalles({ etabId, auth, interventionsJour }) {
  const { success, error: showError } = useToast();
  const ri = auth?.role_interne;
  const [salles, setSalles] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [formSalle, setFormSalle] = useState({ nom: "", specialite: SPECIALITES[0] });

  const loadSalles = useCallback(async () => {
    if (!etabId) return;
    setSalles(await fetchSallesOperation(etabId));
  }, [etabId]);

  useEffect(() => { loadSalles(); }, [loadSalles]);

  // Realtime
  useEffect(() => {
    if (!etabId) return;
    const ch = supabase.channel("salles-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "salles_operation" }, loadSalles)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [etabId, loadSalles]);

  const kpisSalles = Object.entries(SALLE_STATUT_CFG).map(([k, c]) => ({ label: c.label, value: salles.filter((s) => s.statut === k).length, color: c.color }));

  const handleStatut = async (salle, statut) => {
    await updateSalleStatut(salle.id, statut);
    success(`${salle.nom} → ${statut}`);
    loadSalles();
  };

  const handleAddSalle = async () => {
    if (!formSalle.nom.trim()) return showError("Nom obligatoire.");
    await upsertSalleOperation({ ...formSalle, etablissement_id: etabId, statut: "libre" });
    success("Salle ajoutee"); setShowAdd(false); setFormSalle({ nom: "", specialite: SPECIALITES[0] }); loadSalles();
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {kpisSalles.map((k) => (
          <div key={k.label} style={{ flex: "1 1 110px", backgroundColor: colors.bgCard, borderRadius: 12, padding: "12px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderTop: `3px solid ${k.color}` }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {(!ri || ri === "Directeur" || ri === "Médecin") && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
          <button onClick={() => setShowAdd((v) => !v)} style={{ padding: "7px 14px", backgroundColor: ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Ajouter une salle</button>
        </div>
      )}

      {showAdd && (
        <div style={{ backgroundColor: colors.bgSurface, borderRadius: 10, padding: "14px 16px", marginBottom: 14, display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}><label style={labelSt}>Nom</label><input style={inputSt} value={formSalle.nom} onChange={(e) => setFormSalle((f) => ({ ...f, nom: e.target.value }))} placeholder="Bloc 1, Salle A..." /></div>
          <div style={{ flex: 1 }}><label style={labelSt}>Specialite</label><select style={inputSt} value={formSalle.specialite} onChange={(e) => setFormSalle((f) => ({ ...f, specialite: e.target.value }))}>{SPECIALITES.map((v) => <option key={v} value={v}>{v}</option>)}</select></div>
          <button onClick={handleAddSalle} style={{ padding: "9px 16px", backgroundColor: ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Ajouter</button>
        </div>
      )}

      {salles.length === 0 && <div style={{ textAlign: "center", color: colors.textMuted, padding: 40, fontSize: 13 }}>Aucune salle configuree. Ajoutez vos salles d'operation.</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
        {salles.map((s) => {
          const sc = SALLE_STATUT_CFG[s.statut] ?? SALLE_STATUT_CFG.libre;
          const interEnCours = interventionsJour.find((i) => i.salle_id === s.id && i.statut === "en_cours");
          return (
            <div key={s.id} style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: `2px solid ${sc.color}30` }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: colors.navy, marginBottom: 4 }}>{s.nom}</div>
              <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 12 }}>{s.specialite ?? "—"}</div>
              <span style={{ fontSize: 12, padding: "4px 12px", borderRadius: 8, fontWeight: 700, backgroundColor: sc.bg, color: sc.color }}>{sc.label}</span>
              {interEnCours && (
                <div style={{ marginTop: 10, padding: "8px 10px", backgroundColor: "#EFF6FF", borderRadius: 8, fontSize: 11 }}>
                  <div style={{ fontWeight: 700, color: "#2563EB" }}>{interEnCours.intitule}</div>
                  <div style={{ color: colors.textMuted, marginTop: 2 }}>{interEnCours.patients?.prenom} {interEnCours.patients?.nom}</div>
                </div>
              )}
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 12 }}>
                {Object.entries(SALLE_STATUT_CFG).filter(([k]) => k !== s.statut).map(([k, c]) => (
                  <button key={k} onClick={() => handleStatut(s, k)} style={{ padding: "3px 8px", fontSize: 10, fontWeight: 600, cursor: "pointer", border: `1px solid ${c.color}`, borderRadius: 5, backgroundColor: c.bg, color: c.color }}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Onglet 3 — Checklist OMS ──────────────────────────────────────────────────
function OngletChecklist({ etabId, interventionsJour, patients, auth }) {
  const { success, error: showError } = useToast();
  const [interSel, setInterSel] = useState("");
  const [checklist, setChecklist] = useState(null);
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    if (!interSel) { setChecklist(null); return; }
    fetchChecklistIntervention(interSel).then(setChecklist);
  }, [interSel]);

  const inter = interventionsJour.find((i) => i.id === interSel);
  const pat   = inter?.patients;

  const toggle = async (field) => {
    if (!checklist) return;
    const val = !checklist[field];
    setSaving(field);
    setChecklist((prev) => ({ ...prev, [field]: val }));
    await updateChecklist(checklist.id, { [field]: val });
    setSaving(null);
  };

  const saveEtape = async (etape) => {
    if (!checklist) return;
    const now = new Date().toISOString();
    const patch = etape === "signin"
      ? { signin_par: auth?.user?.email, signin_heure: now }
      : etape === "timeout"
      ? { timeout_par: auth?.user?.email, timeout_heure: now }
      : { signout_par: auth?.user?.email, signout_heure: now };
    await updateChecklist(checklist.id, patch);
    setChecklist((prev) => ({ ...prev, ...patch }));
    success(`${etape} valide`);
  };

  const handleImprimer = async () => {
    if (!checklist || !inter) return;
    const etab = await fetchEtabFromAuth(auth);
    const row = (label, val) => `<tr style="border-bottom:1px solid #E5E7EB"><td style="padding:6px 10px;color:#6B7280;width:60%">${label}</td><td style="padding:6px 10px;font-weight:600;color:${val?"#16A34A":"#EF4444"}">${val?"Confirme":"Non confirme"}</td></tr>`;
    openDocument({
      titre: "Checklist pre-operatoire OMS Safe Surgery",
      sousTitre: `${inter.numero_intervention} — ${inter.intitule}`,
      etablissement: etab,
      sections: [
        { titre: "SIGN IN — Avant induction", html: `<table style="width:100%;border-collapse:collapse;font-size:12px">${row("Identite confirmee",checklist.signin_identite_confirmee)}${row("Site marque",checklist.signin_site_marque)}${row("Allergie verifiee",checklist.signin_allergie_verifiee)}${row("Voie aerienne evaluee",checklist.signin_voie_aerienne_ok)}${row("Risque hemorragique evalue",checklist.signin_risque_hemorragie)}${row("Materiel verifie",checklist.signin_materiel_ok)}</table><p style="font-size:11px;color:#6B7280;margin-top:8px">Signe par : ${checklist.signin_par ?? "—"} le ${checklist.signin_heure ? new Date(checklist.signin_heure).toLocaleString("fr-FR") : "—"}</p>` },
        { titre: "TIME OUT — Avant incision", html: `<table style="width:100%;border-collapse:collapse;font-size:12px">${row("Equipe presentee",checklist.timeout_equipe_presentee)}${row("Patient et procedure confirmes",checklist.timeout_patient_confirme)}${row("Intervention confirmee",checklist.timeout_intervention_confirmee)}${row("Antibioprophylaxie",checklist.timeout_antibioprophylaxie)}${row("Images disponibles",checklist.timeout_images_disponibles)}</table><p style="font-size:11px;color:#6B7280;margin-top:8px">Signe par : ${checklist.timeout_par ?? "—"} le ${checklist.timeout_heure ? new Date(checklist.timeout_heure).toLocaleString("fr-FR") : "—"}</p>` },
        { titre: "SIGN OUT — Avant sortie", html: `<table style="width:100%;border-collapse:collapse;font-size:12px">${row("Intitule note",checklist.signout_intervention_notee)}${row("Compte instruments correct",checklist.signout_compte_instruments)}${row("Pieces anatomiques etiquetees",checklist.signout_pieces_anatomiques)}${row("Equipements signales",checklist.signout_equipement_ok)}</table><p style="font-size:11px;color:#6B7280;margin-top:8px">Signe par : ${checklist.signout_par ?? "—"} le ${checklist.signout_heure ? new Date(checklist.signout_heure).toLocaleString("fr-FR") : "—"}</p>` },
      ],
    });
  };

  const CheckItem = ({ field, label }) => {
    const checked = checklist?.[field] ?? false;
    return (
      <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${colors.borderLight}`, cursor: "pointer" }}>
        <input type="checkbox" checked={checked} onChange={() => toggle(field)} style={{ width: 16, height: 16, accentColor: ACCENT, cursor: "pointer" }} disabled={saving === field} />
        <span style={{ fontSize: 13, color: checked ? "#16A34A" : colors.text, fontWeight: checked ? 600 : 400, textDecoration: checked ? "none" : "none" }}>{label}</span>
        {checked && <span style={{ fontSize: 10, color: "#16A34A", marginLeft: "auto" }}>OK</span>}
      </label>
    );
  };

  const activeInters = interventionsJour.filter((i) => !["terminee","annulee"].includes(i.statut));

  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <label style={labelSt}>Selectionner une intervention</label>
          <select style={inputSt} value={interSel} onChange={(e) => setInterSel(e.target.value)}>
            <option value="">-- Selectionner --</option>
            {activeInters.map((i) => <option key={i.id} value={i.id}>{i.heure_prevue?.slice(0,5)} — {i.intitule} — {i.patients?.prenom} {i.patients?.nom}</option>)}
          </select>
        </div>
        {checklist && <button onClick={handleImprimer} style={{ padding: "9px 14px", backgroundColor: "#7C3AED", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", alignSelf: "flex-end" }}>Imprimer</button>}
      </div>

      {!interSel && <div style={{ textAlign: "center", color: colors.textMuted, padding: 40, fontSize: 13 }}>Selectionnez une intervention pour afficher la checklist.</div>}
      {interSel && !checklist && <div style={{ textAlign: "center", color: colors.textMuted, padding: 32 }}>Aucune checklist pour cette intervention. Lancez la preparation depuis le programme.</div>}

      {checklist && inter && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Infos patient */}
          {pat && (
            <div style={{ padding: "10px 14px", backgroundColor: (pat.allergies?.length > 0) ? "#FEF2F2" : "#F0FDF4", borderRadius: 10, fontSize: 12, border: `1px solid ${(pat.allergies?.length > 0) ? "#FECACA" : "#BBF7D0"}` }}>
              <span style={{ fontWeight: 700, color: colors.navy }}>{pat.prenom} {pat.nom}</span>
              {pat.groupe_sanguin && <span style={{ marginLeft: 10, color: colors.textMuted }}>Gr. {pat.groupe_sanguin}</span>}
              {(pat.allergies?.length > 0) && <span style={{ marginLeft: 10, fontWeight: 700, color: "#DC2626" }}>ALLERGIES : {pat.allergies.join(", ")}</span>}
            </div>
          )}

          {/* SIGN IN */}
          <div style={{ backgroundColor: colors.bgCard, borderRadius: 12, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#D97706", marginBottom: 12, textTransform: "uppercase" }}>Sign In — Avant induction anesthesie</div>
            <CheckItem field="signin_identite_confirmee" label="Le patient a confirme son identite, le site operatoire, la procedure et son consentement" />
            <CheckItem field="signin_site_marque"        label="Site operatoire marque (si applicable)" />
            <CheckItem field="signin_allergie_verifiee"  label="Allergie verifiee" />
            <CheckItem field="signin_voie_aerienne_ok"   label="Voie aerienne et risque d'inhalation evalues" />
            <CheckItem field="signin_risque_hemorragie"  label="Risque hemorragique evalue — disponibilite du sang verifiee" />
            <CheckItem field="signin_materiel_ok"        label="Materiel et medicaments anesthesiques verifies" />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
              <button onClick={() => saveEtape("signin")} style={{ padding: "6px 14px", backgroundColor: "#FEF3C7", color: "#D97706", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                {checklist.signin_heure ? `Valide le ${new Date(checklist.signin_heure).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}` : "Valider Sign In"}
              </button>
            </div>
          </div>

          {/* TIME OUT */}
          <div style={{ backgroundColor: colors.bgCard, borderRadius: 12, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#EF4444", marginBottom: 12, textTransform: "uppercase" }}>Time Out — Avant incision cutanee</div>
            {!checklist.timeout_antibioprophylaxie && (
              <div style={{ padding: "8px 12px", backgroundColor: "#FEF2F2", borderLeft: `4px solid #EF4444`, borderRadius: 6, fontSize: 12, color: "#DC2626", marginBottom: 10, fontWeight: 600 }}>
                Antibioprophylaxie non confirmee — verifier avant incision
              </div>
            )}
            <CheckItem field="timeout_equipe_presentee"         label="Toute l'equipe s'est presentee par son nom et sa fonction" />
            <CheckItem field="timeout_patient_confirme"          label="Patient, site et procedure confirmes a voix haute" />
            <CheckItem field="timeout_intervention_confirmee"    label="Intervention et etapes critiques confirmees avec le chirurgien" />
            <CheckItem field="timeout_antibioprophylaxie"        label="Antibioprophylaxie administree si indiquee (< 60 min avant)" />
            <CheckItem field="timeout_images_disponibles"        label="Imageries necessaires affichees" />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
              <button onClick={() => saveEtape("timeout")} style={{ padding: "6px 14px", backgroundColor: "#FEF2F2", color: "#EF4444", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                {checklist.timeout_heure ? `Valide le ${new Date(checklist.timeout_heure).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}` : "Valider Time Out"}
              </button>
            </div>
          </div>

          {/* SIGN OUT */}
          <div style={{ backgroundColor: colors.bgCard, borderRadius: 12, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#10B981", marginBottom: 12, textTransform: "uppercase" }}>Sign Out — Avant sortie du bloc</div>
            <CheckItem field="signout_intervention_notee"    label="Intitule de l'intervention note dans le dossier" />
            <CheckItem field="signout_compte_instruments"    label="Compte des instruments, compresses et aiguilles correct" />
            <CheckItem field="signout_pieces_anatomiques"    label="Pieces anatomiques etiquetees (si applicable)" />
            <CheckItem field="signout_equipement_ok"         label="Problemes d'equipements a signaler — aucun" />
            <div style={{ marginTop: 10 }}>
              <label style={labelSt}>Consignes pour le reveil</label>
              <textarea rows={2} style={{ ...inputSt, resize: "vertical" }} defaultValue={checklist.signout_consignes_reveil ?? ""} onBlur={async (e) => { await updateChecklist(checklist.id, { signout_consignes_reveil: e.target.value }); }} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
              <button onClick={() => saveEtape("signout")} style={{ padding: "6px 14px", backgroundColor: "#DCFCE7", color: "#16A34A", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                {checklist.signout_heure ? `Valide le ${new Date(checklist.signout_heure).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}` : "Valider Sign Out"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Onglet 4 — Compte rendu opératoire ───────────────────────────────────────
function OngletCRO({ etabId, interventionsJour, patients, auth }) {
  const { success, error: showError } = useToast();
  const [interSel, setInterSel] = useState("");
  const [cro, setCro] = useState(null);
  const [mode, setMode] = useState("view"); // "view" | "edit"
  const [form, setForm] = useState({ intitule_acte: "", voie_abord: "", position: "", type_anesthesie: "Generale", inducteur: "", curare: "", morphinique: "", gaz: "", description_acte: "", incidents_perop: "", pertes_sang_ml: "", transfusion: false, transfusion_detail: "", suites_operatoires: "", consignes_postop: "", consommables: [], chirurgien: auth?.user?.email ?? "", anesthesiste: "", instrumentiste: "" });
  const [saving, setSaving] = useState(false);
  const [nvConso, setNvConso] = useState({ nom: "", reference: "", quantite: 1, lot: "" });
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!interSel) { setCro(null); setMode("view"); return; }
    fetchCROIntervention(interSel).then((c) => {
      setCro(c);
      if (c) { setForm(c); setMode("view"); } else setMode("edit");
    });
  }, [interSel]);

  const inter = interventionsJour.find((i) => i.id === interSel);
  const pat   = inter?.patients;

  const handleSave = async () => {
    if (!form.description_acte.trim()) return showError("La description de l'acte est obligatoire.");
    setSaving(true);
    try {
      const payload = { ...form, intervention_id: interSel, patient_id: inter?.patient_id, etablissement_id: etabId, pertes_sang_ml: form.pertes_sang_ml ? Number(form.pertes_sang_ml) : null };
      const saved = cro ? await updateCRO(cro.id, payload) : await insertCRO(payload);
      setCro(saved); setMode("view");
      success("CRO enregistre");
    } catch (e) { showError(e.message); }
    finally { setSaving(false); }
  };

  const ajouterConso = () => {
    if (!nvConso.nom.trim()) return;
    setForm((f) => ({ ...f, consommables: [...(f.consommables ?? []), { ...nvConso }] }));
    setNvConso({ nom: "", reference: "", quantite: 1, lot: "" });
  };

  const CROInterventions = interventionsJour.filter((i) => ["en_reveil","terminee"].includes(i.statut));

  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
          <label style={labelSt}>Selectionner une intervention (terminees / en reveil)</label>
          <select style={inputSt} value={interSel} onChange={(e) => setInterSel(e.target.value)}>
            <option value="">-- Selectionner --</option>
            {CROInterventions.map((i) => <option key={i.id} value={i.id}>{i.numero_intervention} — {i.intitule} — {i.patients?.prenom} {i.patients?.nom}</option>)}
          </select>
        </div>
        {cro && mode === "view" && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setMode("edit")} style={{ padding: "9px 14px", backgroundColor: ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Modifier</button>
            <button onClick={() => imprimerCRO(cro, inter, pat, auth)} style={{ padding: "9px 14px", backgroundColor: "#7C3AED", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Imprimer</button>
          </div>
        )}
      </div>

      {!interSel && <div style={{ textAlign: "center", color: colors.textMuted, padding: 40, fontSize: 13 }}>Selectionnez une intervention terminee pour saisir ou consulter le CRO.</div>}

      {cro && mode === "view" && (
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: colors.navy, marginBottom: 12 }}>{cro.intitule_acte}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12, fontSize: 12 }}>
            {[["Voie d'abord",cro.voie_abord],["Position",cro.position],["Anesthesie",cro.type_anesthesie],["Chirurgien",cro.chirurgien]].map(([l,v]) => (
              <div key={l}><span style={{ color: colors.textMuted }}>{l} : </span><span style={{ fontWeight: 600 }}>{v ?? "—"}</span></div>
            ))}
          </div>
          <div style={{ backgroundColor: colors.bgSurface, borderRadius: 8, padding: "12px 14px", fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap", marginBottom: 12 }}>{cro.description_acte}</div>
          {cro.consignes_postop && <div style={{ fontSize: 12, color: colors.textSecondary }}><strong>Consignes post-op :</strong> {cro.consignes_postop}</div>}
        </div>
      )}

      {((interSel && !cro) || mode === "edit") && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {secTitle("Acte realise")}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "1/-1" }}><label style={labelSt}>Intitule de l'acte</label><input style={inputSt} value={form.intitule_acte} onChange={(e) => set("intitule_acte")(e.target.value)} placeholder="Ex : Appendicectomie par voie ouverte" /></div>
            <div><label style={labelSt}>Voie d'abord</label><input style={inputSt} value={form.voie_abord} onChange={(e) => set("voie_abord")(e.target.value)} placeholder="Laparotomie, Laparoscopie..." /></div>
            <div><label style={labelSt}>Position</label><input style={inputSt} value={form.position} onChange={(e) => set("position")(e.target.value)} placeholder="Decubitus dorsal..." /></div>
          </div>

          {secTitle("Anesthesie")}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={labelSt}>Type</label>
              <div style={{ display: "flex", gap: 6 }}>{["Generale","Rachianesthesie","ALR","Locale"].map((v) => <Tog key={v} value={v} current={form.type_anesthesie} label={v} onChange={set("type_anesthesie")} />)}</div>
            </div>
            {[["inducteur","Inducteur"],["curare","Curare"],["morphinique","Morphinique"],["gaz","Gaz"]].map(([k,l]) => (
              <div key={k}><label style={labelSt}>{l}</label><input style={inputSt} value={form[k]} onChange={(e) => set(k)(e.target.value)} /></div>
            ))}
          </div>

          {secTitle("Description de l'acte *")}
          <textarea rows={8} style={{ ...inputSt, resize: "vertical", lineHeight: 1.6 }} value={form.description_acte} onChange={(e) => set("description_acte")(e.target.value)} placeholder="Compte rendu narratif complet de l'intervention..." />

          {secTitle("Incidents per-operatoires")}
          <textarea rows={3} style={{ ...inputSt, resize: "vertical" }} value={form.incidents_perop} onChange={(e) => set("incidents_perop")(e.target.value)} placeholder="Aucun / Decrire les incidents..." />

          {secTitle("Bilan")}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div><label style={labelSt}>Pertes sanguines (mL)</label><input type="number" style={inputSt} value={form.pertes_sang_ml} onChange={(e) => set("pertes_sang_ml")(e.target.value)} /></div>
            <div>
              <label style={labelSt}>Transfusion</label>
              <div style={{ display: "flex", gap: 6 }}>
                <Tog value={false} current={form.transfusion} label="Non" onChange={set("transfusion")} />
                <Tog value={true}  current={form.transfusion} label="Oui" onChange={set("transfusion")} color="#EF4444" />
              </div>
            </div>
            {form.transfusion && <div><label style={labelSt}>Detail transfusion</label><input style={inputSt} value={form.transfusion_detail} onChange={(e) => set("transfusion_detail")(e.target.value)} /></div>}
          </div>

          {secTitle("Suites operatoires + consignes post-op")}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={labelSt}>Suites immediates</label><textarea rows={3} style={{ ...inputSt, resize: "vertical" }} value={form.suites_operatoires} onChange={(e) => set("suites_operatoires")(e.target.value)} /></div>
            <div><label style={labelSt}>Consignes post-operatoires</label><textarea rows={3} style={{ ...inputSt, resize: "vertical" }} value={form.consignes_postop} onChange={(e) => set("consignes_postop")(e.target.value)} /></div>
          </div>

          {secTitle(`Consommables utilises (${(form.consommables ?? []).length})`)}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            {(form.consommables ?? []).map((c, i) => (
              <span key={i} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, backgroundColor: colors.bgSurface, color: colors.text, border: `1px solid ${colors.border}` }}>
                {c.nom} x{c.quantite}
                <button onClick={() => setForm((f) => ({ ...f, consommables: f.consommables.filter((_,j) => j !== i) }))} style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", marginLeft: 4, fontSize: 13 }}>×</button>
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[["nom","Nom"],["reference","Ref"],["lot","Lot"]].map(([k,l]) => (
              <div key={k}><label style={labelSt}>{l}</label><input style={{ ...inputSt, width: 130 }} value={nvConso[k]} onChange={(e) => setNvConso((f) => ({ ...f, [k]: e.target.value }))} /></div>
            ))}
            <div><label style={labelSt}>Qte</label><input type="number" min="1" style={{ ...inputSt, width: 70 }} value={nvConso.quantite} onChange={(e) => setNvConso((f) => ({ ...f, quantite: Number(e.target.value) }))} /></div>
            <button onClick={ajouterConso} style={{ alignSelf: "flex-end", padding: "9px 14px", backgroundColor: ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Ajouter</button>
          </div>

          {secTitle("Equipe")}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[["chirurgien","Chirurgien *"],["anesthesiste","Anesthesiste"],["instrumentiste","Instrumentiste"]].map(([k,l]) => (
              <div key={k}><label style={labelSt}>{l}</label><input style={inputSt} value={form[k]} onChange={(e) => set(k)(e.target.value)} /></div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            {mode === "edit" && cro && <button onClick={() => setMode("view")} style={{ flex: 1, padding: 10, background: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Annuler</button>}
            <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 10, background: saving ? "#D1D5DB" : ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
              {saving ? "Enregistrement..." : cro ? "Mettre a jour le CRO" : "Enregistrer le CRO"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Onglet 5 — Salle de réveil ─────────────────────────────────────────────────
function OngletReveil({ etabId, interventionsJour, patients, auth }) {
  const { success, error: showError } = useToast();
  const [interSel, setInterSel]   = useState("");
  const [feuille, setFeuille]     = useState(null);
  const [saving, setSaving]       = useState(false);
  const [destination, setDestination] = useState("Service chirurgie");
  const [nvReleve, setNvReleve]   = useState({ activite: 0, respiration: 0, circulation: 0, conscience: 0, spo2: 0 });

  useEffect(() => {
    if (!interSel) { setFeuille(null); return; }
    fetchFeuilleReveilIntervention(interSel).then(setFeuille);
  }, [interSel]);

  const inter = interventionsJour.find((i) => i.id === interSel);
  const releves = feuille?.releves_aldrete ?? [];
  const dernierScore = releves.length > 0 ? releves.at(-1).total : null;
  const score_nv = Object.values(nvReleve).reduce((s, v) => s + Number(v), 0);
  const apteASortir = dernierScore != null && dernierScore >= 9;

  const CRITERES_ALDRETE = [
    { key: "activite",    label: "Activite (membres)",  desc: ["Aucune","2 membres","4 membres"] },
    { key: "respiration", label: "Respiration",          desc: ["Apnee","Dyspnee","Normale"] },
    { key: "circulation", label: "Circulation (TA)",     desc: ["+/-50% pre-op","+/-20-50%","+/-20%"] },
    { key: "conscience",  label: "Conscience",           desc: ["Non reveillable","Eveillable","Eveille"] },
    { key: "spo2",        label: "SpO2",                 desc: ["<90%","90-92%",">92%"] },
  ];

  const handleAjouterReleve = async () => {
    if (!feuille) return;
    setSaving(true);
    try {
      const nvs = [...releves, { heure: new Date().toISOString(), ...nvReleve, total: score_nv }];
      const updated = await updateFeuilleReveil(feuille.id, { releves_aldrete: nvs });
      setFeuille(updated);
      setNvReleve({ activite: 0, respiration: 0, circulation: 0, conscience: 0, spo2: 0 });
      success("Releve Aldrete enregistre");
    } catch (e) { showError(e.message); }
    finally { setSaving(false); }
  };

  const handleSortie = async () => {
    if (!feuille || !inter) return;
    if (!window.confirm(`Confirmer la sortie du reveil vers : ${destination} ?`)) return;
    setSaving(true);
    try {
      await updateFeuilleReveil(feuille.id, { score_aldrete_sortie: dernierScore, heure_sortie_reveil: new Date().toISOString(), destination });
      await updateIntervention(inter.id, { statut: "terminee" });
      if (inter.salle_id) await updateSalleStatut(inter.salle_id, "nettoyage");
      success("Sortie du reveil validee — intervention cloturee");
      const etab = await fetchEtabFromAuth(auth);
      const rows = releves.map((r) => [
        r.heure ? new Date(r.heure).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}) : "—",
        String(r.activite ?? ""), String(r.respiration ?? ""), String(r.circulation ?? ""), String(r.conscience ?? ""), String(r.spo2 ?? ""), String(r.total ?? ""),
      ]);
      openDocument({
        titre: "Feuille de reveil",
        sousTitre: `${inter.numero_intervention} — ${inter.intitule}`,
        etablissement: etab,
        sections: [
          { titre: "Scores Aldrete", html: tableHTML(["Heure","Activite","Respiration","Circulation","Conscience","SpO2","Total"], rows) },
          { titre: "Sortie", html: infoGridHTML([{ label: "Destination", value: destination },{ label: "Score de sortie", value: String(dernierScore ?? "—") }]) },
        ],
      });
    } catch (e) { showError(e.message); }
    finally { setSaving(false); }
  };

  const enReveil = interventionsJour.filter((i) => i.statut === "en_reveil");

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <label style={labelSt}>Patient en salle de reveil</label>
        <select style={inputSt} value={interSel} onChange={(e) => setInterSel(e.target.value)}>
          <option value="">-- Selectionner --</option>
          {enReveil.map((i) => <option key={i.id} value={i.id}>{i.numero_intervention} — {i.intitule} — {i.patients?.prenom} {i.patients?.nom}</option>)}
        </select>
      </div>

      {!interSel && <div style={{ textAlign: "center", color: colors.textMuted, padding: 40, fontSize: 13 }}>Aucun patient en salle de reveil pour le moment.</div>}

      {feuille && inter && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Scores Aldrete */}
          <div style={{ backgroundColor: colors.bgCard, borderRadius: 12, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>Score Aldrete</div>
              {apteASortir && <span style={{ fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 8, backgroundColor: "#DCFCE7", color: "#16A34A" }}>Apte a sortir (score {dernierScore}/10)</span>}
              {!apteASortir && dernierScore != null && <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 8, backgroundColor: "#FEF3C7", color: "#D97706" }}>Score : {dernierScore}/10</span>}
            </div>

            {/* Historique */}
            {releves.length > 0 && (
              <div style={{ maxHeight: 120, overflowY: "auto", marginBottom: 12 }}>
                {[...releves].reverse().map((r, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, padding: "5px 0", borderBottom: `1px solid ${colors.borderLight}`, fontSize: 11 }}>
                    <span style={{ color: colors.textMuted, width: 50 }}>{r.heure ? new Date(r.heure).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}) : "—"}</span>
                    {CRITERES_ALDRETE.map((c) => <span key={c.key} style={{ fontWeight: 700, color: r.total >= 9 ? "#16A34A" : "#D97706" }}>{r[c.key]}</span>)}
                    <span style={{ fontWeight: 800, color: r.total >= 9 ? "#16A34A" : "#EF4444", marginLeft: 4 }}>={r.total}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Nouveau relevé */}
            {secTitle(`Nouveau releve — Total : ${score_nv}/10`)}
            {CRITERES_ALDRETE.map((c) => (
              <div key={c.key} style={{ marginBottom: 10 }}>
                <label style={labelSt}>{c.label}</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {[0,1,2].map((v) => (
                    <button key={v} type="button" onClick={() => setNvReleve((f) => ({ ...f, [c.key]: v }))} style={{ flex: 1, padding: "6px 0", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${nvReleve[c.key] === v ? ACCENT : "#E5E7EB"}`, backgroundColor: nvReleve[c.key] === v ? ACCENT + "18" : "white", color: nvReleve[c.key] === v ? ACCENT : "#374151" }}>
                      {v} — {c.desc[v]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button onClick={handleAjouterReleve} disabled={saving} style={{ width: "100%", padding: 10, background: ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Enregistrer ce releve
            </button>
          </div>

          {/* Sortie */}
          <div style={{ backgroundColor: colors.bgCard, borderRadius: 12, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy, marginBottom: 14 }}>Sortie du reveil</div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelSt}>Destination</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {["Service chirurgie","Soins intensifs","Domicile (ambulatoire)"].map((v) => (
                  <button key={v} type="button" onClick={() => setDestination(v)} style={{ padding: "9px 14px", borderRadius: 8, fontSize: 13, fontWeight: destination === v ? 700 : 400, cursor: "pointer", textAlign: "left", border: `1.5px solid ${destination === v ? ACCENT : colors.border}`, backgroundColor: destination === v ? ACCENT + "18" : colors.bgSurface, color: destination === v ? ACCENT : colors.text }}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            {apteASortir ? (
              <button onClick={handleSortie} disabled={saving} style={{ width: "100%", padding: 12, background: "#16A34A", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Valider la sortie du reveil
              </button>
            ) : (
              <div style={{ padding: "12px 14px", backgroundColor: "#FEF3C7", borderRadius: 8, fontSize: 13, color: "#D97706", fontWeight: 600, textAlign: "center" }}>
                Score Aldrete &lt; 9 — maintenir en surveillance
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function BlocOperatoire() {
  const { auth }        = useAuth();
  const { toasts }      = useToast();
  const { data: patients } = usePatients(auth?.etablissement_id);
  const [onglet, setOnglet]   = useState("programme");
  const [etabId, setEtabId]   = useState(auth?.etablissement_id ?? null);
  const [salles, setSalles]   = useState([]);
  const [date, setDate]       = useState(new Date().toISOString().slice(0, 10));
  const [interventionsJour, setInterventionsJour] = useState([]);
  const ri = auth?.role_interne;

  // Résolution etabId
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

  const loadShared = useCallback(async () => {
    if (!etabId) return;
    const [s, i] = await Promise.all([
      fetchSallesOperation(etabId),
      fetchInterventionsJour(etabId, date),
    ]);
    setSalles(s);
    setInterventionsJour(i);
  }, [etabId, date]);

  useEffect(() => { loadShared(); }, [loadShared]);

  // Infirmière : seulement checklist + réveil
  const ONGLETS_TOUS = [
    { key: "programme", label: "Programme du jour"     },
    { key: "salles",    label: "Salles"                },
    { key: "checklist", label: "Checklist OMS"         },
    { key: "cro",       label: "Compte rendu"          },
    { key: "reveil",    label: "Salle de reveil"       },
  ];
  const ONGLETS = ri === "Infirmière"
    ? ONGLETS_TOUS.filter((o) => ["checklist","reveil"].includes(o.key))
    : ONGLETS_TOUS;

  return (
    <Layout title="Bloc operatoire" subtitle="Programme, checklist OMS, comptes rendus operatoires et salle de reveil">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <Toast toasts={toasts} />

      <div style={{ display: "flex", gap: 2, marginBottom: 24, borderBottom: `2px solid ${colors.border}` }}>
        {ONGLETS.map((o) => (
          <button key={o.key} onClick={() => setOnglet(o.key)} style={{ padding: "10px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: onglet === o.key ? 800 : 400, color: onglet === o.key ? ACCENT : colors.textSecondary, borderBottom: onglet === o.key ? `3px solid ${ACCENT}` : "3px solid transparent", marginBottom: -2, whiteSpace: "nowrap" }}>
            {o.label}
          </button>
        ))}
      </div>

      {onglet === "programme" && <OngletProgramme etabId={etabId} patients={patients} salles={salles} auth={auth} />}
      {onglet === "salles"    && <OngletSalles    etabId={etabId} auth={auth} interventionsJour={interventionsJour} />}
      {onglet === "checklist" && <OngletChecklist etabId={etabId} interventionsJour={interventionsJour} patients={patients} auth={auth} />}
      {onglet === "cro"       && <OngletCRO       etabId={etabId} interventionsJour={interventionsJour} patients={patients} auth={auth} />}
      {onglet === "reveil"    && <OngletReveil    etabId={etabId} interventionsJour={interventionsJour} patients={patients} auth={auth} />}
    </Layout>
  );
}
