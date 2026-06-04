import { colors } from "../../theme";
import { useState, useEffect, useCallback, useMemo } from "react";
import { SERVICES_HOPITAL } from "../../constants/hopital"; // disponible pour evolutions
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useAuth } from "../../context/AuthContext";
import { usePatients, useMedicaments } from "../../hooks/useSupabaseData";
import { supabase } from "../../supabaseClient";
import {
  fetchConsultationsJour,
  updateConsultation,
  fetchExamens,
  insertConstante,
  upsertHospitalisation,
  insertOrdonnance,
  insertExamen,
} from "../../hooks/useMutations";
import { INTERACTIONS_MEDICAMENTEUSES, CONTRE_INDICATIONS_ANTECEDENTS } from "../../data/interactions";

const ACCENT = "#10B981";

const TRIAGE_ORDER = { urgent: 0, semi_urgent: 1, non_urgent: 2 };

const TRIAGE_CONFIG = {
  urgent:      { color: "#EF4444", bg: "#FEF2F2", label: "Urgent" },
  semi_urgent: { color: "#F59E0B", bg: "#FFFBEB", label: "Semi-urgent" },
  non_urgent:  { color: ACCENT,    bg: "#DCFCE7", label: "Non urgent" },
};

const TYPES_EXAMENS = [
  "Bilan sanguin", "NFS", "Glycemie", "Uree / Creatinine", "Bilan hepatique",
  "Serologie", "Radiographie", "Echographie", "ECG", "Scanner",
  "Analyse urine", "Coproculture", "Frottis / Goutte epaisse", "Autre",
];

function minutesDepuis(iso) {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

function fmtMin(m) { return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`; }

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

function calcAge(dateNaissance) {
  if (!dateNaissance) return null;
  return Math.floor((Date.now() - new Date(dateNaissance).getTime()) / (365.25 * 24 * 3600 * 1000));
}

const inputSt = { width: "100%", padding: "9px 11px", border: "1.5px solid #E5E7EB", borderRadius: 9, fontSize: 13, outline: "none", boxSizing: "border-box", background: "white", color: "#0A1628" };
const labelSt = { display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginBottom: 5 };

// ── Carte consultation ────────────────────────────────────────────────────────
function CarteFile({ c, onAppeler, onTerminer, actif }) {
  const nom = c.patients ? `${c.patients.prenom} ${c.patients.nom}` : "Patient inconnu";
  const t = TRIAGE_CONFIG[c.triage];
  const minAttente = minutesDepuis(c.statut === "en_cours" ? c.heure_debut : c.heure_arrivee);
  const enRetard = (c.triage === "urgent" && minAttente > 20) || (c.triage !== "urgent" && minAttente > 60);

  return (
    <div style={{
      padding: "12px 14px", borderRadius: 10, marginBottom: 8, cursor: "pointer",
      backgroundColor: actif ? "#F0FDF4" : "white",
      border: actif ? `2px solid ${ACCENT}` : `1px solid ${colors.border}`,
      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#0A1628" }}>{nom}</div>
        {t && <span style={{ fontSize: 10, fontWeight: 800, color: t.color, backgroundColor: t.bg, padding: "2px 7px", borderRadius: 6 }}>{t.label}</span>}
      </div>
      {c.motif && <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 6, fontStyle: "italic" }}>{c.motif}</div>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: enRetard ? "#EF4444" : "#9CA3AF" }}>
          {c.statut === "en_cours" ? "En cours" : "Attente"} : {fmtMin(minAttente)}
        </span>
        {c.statut === "en_attente" && (
          <button onClick={() => onAppeler(c)}
            style={{ fontSize: 11, padding: "3px 10px", background: "#3B82F6", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}>
            Appeler
          </button>
        )}
        {c.statut === "en_cours" && (
          <button onClick={() => onTerminer(c)}
            style={{ fontSize: 11, padding: "3px 10px", background: ACCENT, color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}>
            Terminer
          </button>
        )}
      </div>
    </div>
  );
}

// ── Modal nouvelle ordonnance simplifiee ──────────────────────────────────────
function ModalOrdonnance({ patient, etablissementId, medecinNom, medicaments, onClose, onSaved }) {
  const LIGNE = () => ({ id: Date.now() + Math.random(), medicament_id: "", nom: "", posologie: "", duree: "" });
  const [lignes, setLignes] = useState([LIGNE()]);
  const [saving, setSaving] = useState(false);

  const setLigne = (id, k, v) => setLignes((ls) => ls.map((l) => l.id === id ? { ...l, [k]: v } : l));
  const handleMedSelect = (id, medId) => {
    const med = medicaments.find((m) => m.id === medId);
    setLignes((ls) => ls.map((l) => l.id === id ? { ...l, medicament_id: medId, nom: med?.nom ?? "" } : l));
  };

  // Check interactions
  const warnings = useMemo(() => {
    const noms = lignes.map((l) => (l.nom || "").toLowerCase());
    const ws = [];
    INTERACTIONS_MEDICAMENTEUSES.forEach(({ meds, niveau, message }) => {
      if (noms.some((n) => n.includes(meds[0])) && noms.some((n) => n.includes(meds[1]))) ws.push({ niveau, message });
    });
    (patient?.antecedents ?? []).forEach((ant) => {
      CONTRE_INDICATIONS_ANTECEDENTS.forEach(({ antecedent, medicaments: meds2, message }) => {
        if (ant.toLowerCase().includes(antecedent) && meds2.some((m) => noms.some((n) => n.includes(m)))) ws.push({ niveau: "contre-indication", message });
      });
    });
    return ws;
  }, [lignes, patient]);

  const handleSave = async () => {
    const valides = lignes.filter((l) => l.medicament_id && l.posologie.trim());
    if (!valides.length) return alert("Ajoutez au moins un medicament avec posologie.");
    if (warnings.some((w) => w.niveau === "contre-indication")) {
      if (!window.confirm("Des contre-indications ont ete detectees. Confirmer quand meme ?")) return;
    }
    setSaving(true);
    try {
      await insertOrdonnance({
        patient_id: patient.id, medecin_nom: medecinNom ?? "Non precise",
        date_emission: new Date().toISOString().slice(0, 10),
        statut: "en_attente",
        notes: JSON.stringify({ lignes: valides.map((l) => ({ medicament_id: l.medicament_id, nom: l.nom, posologie: l.posologie, duree: l.duree })) }),
        ...(etablissementId ? { etablissement_id: etablissementId } : {}),
      });
      onSaved();
      onClose();
    } catch (e) { alert(e.message); setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 560, maxHeight: "85vh", overflow: "auto", padding: "22px 24px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#0A1628" }}>Nouvelle ordonnance — {patient.prenom} {patient.nom}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF" }}>x</button>
        </div>
        {lignes.map((l) => (
          <div key={l.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr auto", gap: 8, marginBottom: 8, alignItems: "center" }}>
            <select style={{ ...inputSt, padding: "7px 9px" }} value={l.medicament_id} onChange={(e) => handleMedSelect(l.id, e.target.value)}>
              <option value="">-- Medicament --</option>
              {medicaments.map((m) => <option key={m.id} value={m.id}>{m.nom}{m.dosage ? ` ${m.dosage}` : ""}</option>)}
            </select>
            <input style={{ ...inputSt, padding: "7px 9px" }} value={l.posologie} onChange={(e) => setLigne(l.id, "posologie", e.target.value)} placeholder="1 cp x 3/j" />
            <input style={{ ...inputSt, padding: "7px 9px" }} value={l.duree} onChange={(e) => setLigne(l.id, "duree", e.target.value)} placeholder="7j" />
            <button onClick={() => lignes.length > 1 && setLignes((ls) => ls.filter((x) => x.id !== l.id))} style={{ background: "none", border: "none", color: "#EF4444", fontSize: 16, cursor: "pointer" }}>x</button>
          </div>
        ))}
        <button onClick={() => setLignes((ls) => [...ls, LIGNE()])} style={{ fontSize: 12, color: ACCENT, background: "none", border: "none", cursor: "pointer", marginBottom: 12 }}>+ Ajouter un medicament</button>
        {warnings.map((w, i) => (
          <div key={i} style={{ padding: "8px 12px", marginBottom: 6, borderRadius: 8, borderLeft: `4px solid ${w.niveau === "contre-indication" ? "#EF4444" : "#F59E0B"}`, backgroundColor: w.niveau === "contre-indication" ? "#FEF2F2" : "#FFFBEB", fontSize: 12, color: w.niveau === "contre-indication" ? "#DC2626" : "#92400E" }}>
            <strong>{w.niveau === "contre-indication" ? "Contre-indication" : "Precaution"} :</strong> {w.message}
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, background: "#F3F4F6", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 10, background: saving ? "#D1D5DB" : ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "Enregistrement..." : "Creer l'ordonnance"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal prescrire examen simplifie ──────────────────────────────────────────
function ModalExamen({ patient, etablissementId, prescripteur, onClose, onSaved }) {
  const [form, setForm] = useState({ type_examen: TYPES_EXAMENS[0], libelle: "", urgence: false });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await insertExamen({
        patient_id: patient.id, prescripteur,
        type_examen: form.type_examen, libelle: form.libelle || null,
        urgence: form.urgence, statut: "prescrit",
        date_prescription: new Date().toISOString(),
        etablissement_id: etablissementId ?? null,
      });
      onSaved();
      onClose();
    } catch (e) { alert(e.message); setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 420, padding: "22px 24px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#0A1628" }}>Prescrire un examen — {patient.prenom} {patient.nom}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF" }}>x</button>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelSt}>Type d'examen</label>
          <select style={inputSt} value={form.type_examen} onChange={(e) => setForm((f) => ({ ...f, type_examen: e.target.value }))}>
            {TYPES_EXAMENS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelSt}>Precision</label>
          <input style={inputSt} value={form.libelle} onChange={(e) => setForm((f) => ({ ...f, libelle: e.target.value }))} placeholder="Ex: Radio thorax face" />
        </div>
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => setForm((f) => ({ ...f, urgence: !f.urgence }))}
            style={{ padding: "7px 16px", borderRadius: 8, border: `2px solid ${form.urgence ? "#EF4444" : "#E5E7EB"}`, backgroundColor: form.urgence ? "#FEF2F2" : "white", color: form.urgence ? "#DC2626" : "#374151", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
            {form.urgence ? "URGENT" : "Marquer urgent"}
          </button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, background: "#F3F4F6", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 10, background: saving ? "#D1D5DB" : ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "Enregistrement..." : "Prescrire"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Dossier rapide du patient en cours ────────────────────────────────────────
function DossierRapide({ patient, etablissementId, medecinNom, medicaments, onUpdate }) {
  const { toasts, success } = useToast();
  const [showOrd, setShowOrd] = useState(false);
  const [showExamen, setShowExamen] = useState(false);
  const [showConst, setShowConst] = useState(false);
  const [constForm, setConstForm] = useState({ temperature: "", tension_systolique: "", tension_diastolique: "", pouls: "", saturation_o2: "" });
  const [savingConst, setSavingConst] = useState(false);
  const [lastOrd, setLastOrd] = useState([]);

  useEffect(() => {
    supabase.from("ordonnances").select("reference, date_emission, statut, notes").eq("patient_id", patient.id)
      .order("date_emission", { ascending: false }).limit(3).then(({ data }) => setLastOrd(data ?? []));
  }, [patient.id]);

  const age = calcAge(patient.date_naissance);
  const allergies = (patient.antecedents ?? []).filter((a) => a.toLowerCase().includes("allergie") || a.toLowerCase().includes("allerg"));

  const handleSaveConst = async () => {
    setSavingConst(true);
    try {
      const payload = { patient_id: patient.id, etablissement_id: etablissementId ?? null, saisi_par: medecinNom };
      ["temperature", "tension_systolique", "tension_diastolique", "pouls", "saturation_o2"].forEach((k) => {
        if (constForm[k] !== "") payload[k] = Number(constForm[k]);
      });
      await insertConstante(payload);
      setConstForm({ temperature: "", tension_systolique: "", tension_diastolique: "", pouls: "", saturation_o2: "" });
      setShowConst(false);
      success("Constantes enregistrees");
      onUpdate();
    } catch (e) { alert(e.message); }
    finally { setSavingConst(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Toast toasts={toasts} />
      {showOrd && <ModalOrdonnance patient={patient} etablissementId={etablissementId} medecinNom={medecinNom} medicaments={medicaments} onClose={() => setShowOrd(false)} onSaved={() => { setShowOrd(false); success("Ordonnance creee"); onUpdate(); }} />}
      {showExamen && <ModalExamen patient={patient} etablissementId={etablissementId} prescripteur={medecinNom} onClose={() => setShowExamen(false)} onSaved={() => { setShowExamen(false); success("Examen prescrit"); onUpdate(); }} />}

      {/* Infos patient */}
      <div style={{ backgroundColor: "white", borderRadius: 10, padding: "14px 16px", border: `1px solid ${colors.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0A1628" }}>{patient.prenom} {patient.nom}</div>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
              {age ? `${age} ans — ` : ""}{patient.groupe_sanguin ?? "Groupe sanguin inconnu"}
            </div>
          </div>
          {patient.statut && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 8, backgroundColor: patient.statut === "hospitalise" ? "#FEF2F2" : "#F0FDF4", color: patient.statut === "hospitalise" ? "#EF4444" : ACCENT }}>
              {patient.statut}
            </span>
          )}
        </div>
        {allergies.length > 0 && (
          <div style={{ marginTop: 8, padding: "6px 10px", backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 8, fontSize: 12, color: "#DC2626", fontWeight: 700 }}>
            Allergies : {allergies.join(", ")}
          </div>
        )}
        {(patient.antecedents ?? []).filter((a) => !a.toLowerCase().includes("allergie")).length > 0 && (
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
            {patient.antecedents.filter((a) => !a.toLowerCase().includes("allergie")).map((a) => (
              <span key={a} style={{ fontSize: 10, padding: "2px 7px", backgroundColor: "#FEF3C7", color: "#D97706", borderRadius: 6, fontWeight: 700 }}>{a}</span>
            ))}
          </div>
        )}
      </div>

      {/* Actions rapides */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[
          { label: "Nouvelle ordonnance", color: "#3B82F6", bg: "#EFF6FF", fn: () => setShowOrd(true) },
          { label: "Prescrire un examen", color: "#8B5CF6", bg: "#EDE9FE", fn: () => setShowExamen(true) },
          { label: "Constantes", color: ACCENT, bg: "#F0FDF4", fn: () => setShowConst((v) => !v) },
        ].map((a) => (
          <button key={a.label} onClick={a.fn}
            style={{ padding: "7px 14px", backgroundColor: a.bg, color: a.color, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            {a.label}
          </button>
        ))}
      </div>

      {/* Mini formulaire constantes inline */}
      {showConst && (
        <div style={{ backgroundColor: "#F0FDF4", borderRadius: 10, padding: "12px 16px", border: `1px solid #86EFAC` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 10 }}>Saisie rapide des constantes</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 10 }}>
            {[
              { key: "temperature", ph: "T°" },
              { key: "tension_systolique", ph: "TA sys." },
              { key: "tension_diastolique", ph: "TA dia." },
              { key: "pouls", ph: "Pouls" },
              { key: "saturation_o2", ph: "SpO2" },
            ].map(({ key, ph }) => (
              <input key={key} type="number" placeholder={ph}
                style={{ ...inputSt, padding: "6px 8px", fontSize: 12 }}
                value={constForm[key]} onChange={(e) => setConstForm((f) => ({ ...f, [key]: e.target.value }))} />
            ))}
          </div>
          <button onClick={handleSaveConst} disabled={savingConst}
            style={{ padding: "7px 16px", background: savingConst ? "#D1D5DB" : ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: savingConst ? "wait" : "pointer" }}>
            {savingConst ? "Enregistrement..." : "Sauvegarder"}
          </button>
        </div>
      )}

      {/* Dernieres ordonnances */}
      {lastOrd.length > 0 && (
        <div style={{ backgroundColor: "white", borderRadius: 10, padding: "12px 16px", border: `1px solid ${colors.border}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#0A1628", marginBottom: 8 }}>Dernieres ordonnances</div>
          {lastOrd.map((o) => {
            let lignes = [];
            try { lignes = JSON.parse(o.notes ?? "{}").lignes ?? []; } catch { /* noop */ }
            return (
              <div key={o.reference} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${colors.borderLight}` }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{fmtDate(o.date_emission)} — <span style={{ color: o.statut === "en_attente" ? "#D97706" : ACCENT }}>{o.statut}</span></div>
                {lignes.length > 0 && <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>{lignes.map((l) => l.nom).join(", ")}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function MesConsultations() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const { toasts, success } = useToast();
  const { data: patients } = usePatients();
  const { data: medicaments } = useMedicaments();
  const [consultations, setConsultations] = useState([]);
  const [examens, setExamens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [etabId, setEtabId] = useState(auth?.etablissement_id ?? null);
  const [tick, setTick] = useState(0);

  const medecinNom  = auth?.user?.email ?? "";
  const todayISO    = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    let eid = auth?.etablissement_id;
    if (!eid && auth?.user?.email) {
      const { data } = await supabase.from("etablissements").select("id").eq("email", auth.user.email).maybeSingle();
      eid = data?.id ?? null;
    }
    if (eid) setEtabId(eid);
    const [cData, eData] = await Promise.all([
      fetchConsultationsJour(eid, todayISO),
      fetchExamens(eid),
    ]);
    setConsultations(cData);
    setExamens(eData.filter((e) => e.statut === "resultat_disponible" && (e.prescripteur ?? "").includes(medecinNom.split("@")[0])));
    setLoading(false);
  }, [auth, todayISO, medecinNom]);

  useEffect(() => { load(); }, [load]);

  // Filtrer consultations du medecin, triees par triage puis heure_arrivee
  const maFile = useMemo(() => {
    const mes = consultations.filter((c) =>
      (c.statut === "en_attente" || c.statut === "en_cours") &&
      (c.medecin_nom ?? "").toLowerCase().includes(medecinNom.split("@")[0].toLowerCase()) || medecinNom === ""
    );
    return [...mes].sort((a, b) => {
      const ta = TRIAGE_ORDER[a.triage] ?? 3;
      const tb = TRIAGE_ORDER[b.triage] ?? 3;
      if (ta !== tb) return ta - tb;
      return new Date(a.heure_arrivee) - new Date(b.heure_arrivee);
    });
  }, [consultations, medecinNom]);

  const patientEnCours = useMemo(() => {
    const c = maFile.find((c) => c.statut === "en_cours");
    if (!c) return null;
    return patients.find((p) => p.id === c.patient_id) ?? null;
  }, [maFile, patients]);

  const handleAppeler = async (c) => {
    const updated = { statut: "en_cours", heure_debut: new Date().toISOString() };
    await updateConsultation(c.id, updated);
    setConsultations((prev) => prev.map((x) => x.id === c.id ? { ...x, ...updated } : x));
    success("Consultation demarree");
  };

  const handleTerminer = async (c) => {
    const updated = { statut: "termine", heure_fin: new Date().toISOString() };
    await updateConsultation(c.id, updated);
    setConsultations((prev) => prev.map((x) => x.id === c.id ? { ...x, ...updated } : x));
    success("Consultation terminee");
  };

  const nbTermines = consultations.filter((c) => c.statut === "termine" && (c.medecin_nom ?? "").toLowerCase().includes(medecinNom.split("@")[0].toLowerCase())).length;

  return (
    <Layout title="Mes consultations" subtitle="Cockpit du medecin — File et dossier patient">
      <Toast toasts={toasts} />

      {/* KPIs */}
      <div className="kpi-row" style={{ marginBottom: 20 }}>
        {[
          { label: "En attente",           value: loading ? "…" : maFile.filter((c) => c.statut === "en_attente").length, color: "#F59E0B" },
          { label: "En cours",             value: loading ? "…" : maFile.filter((c) => c.statut === "en_cours").length,   color: "#3B82F6" },
          { label: "Terminees aujourd'hui",value: loading ? "…" : nbTermines,                                              color: ACCENT },
          { label: "Resultats a valider",  value: loading ? "…" : examens.length,                                         color: examens.length > 0 ? "#EF4444" : "#9CA3AF" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: colors.bgCard, padding: "14px 20px", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Corps principal — file + dossier */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 3fr", gap: 16, marginBottom: 20 }}>
        {/* File d'attente */}
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "18px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 800, color: colors.navy }}>Ma file d'attente</h3>
          {loading && <div style={{ color: colors.textMuted, fontSize: 13 }}>Chargement...</div>}
          {!loading && maFile.length === 0 && (
            <div style={{ fontSize: 13, color: colors.textMuted, textAlign: "center", padding: "20px 0" }}>Aucune consultation en attente</div>
          )}
          {!loading && maFile.map((c) => (
            <CarteFile key={c.id} c={c} onAppeler={handleAppeler} onTerminer={handleTerminer} actif={c.statut === "en_cours"} />
          ))}
        </div>

        {/* Dossier patient en cours */}
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "18px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 800, color: colors.navy }}>Dossier du patient en cours</h3>
          {!patientEnCours ? (
            <div style={{ fontSize: 13, color: colors.textMuted, textAlign: "center", padding: "40px 0" }}>
              Appelez un patient pour afficher son dossier
            </div>
          ) : (
            <DossierRapide
              patient={patientEnCours}
              etablissementId={etabId}
              medecinNom={medecinNom}
              medicaments={medicaments}
              onUpdate={load}
            />
          )}
        </div>
      </div>

      {/* Examens a valider */}
      {examens.length > 0 && (
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "18px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: colors.navy }}>Mes examens avec resultats disponibles</h3>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#EF4444", backgroundColor: "#FEF2F2", padding: "3px 10px", borderRadius: 8 }}>{examens.length} en attente</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {examens.map((e) => {
              const p = patients.find((pt) => pt.id === e.patient_id);
              const INTERP = { normal: { color: ACCENT, bg: "#DCFCE7" }, anormal: { color: "#D97706", bg: "#FEF3C7" }, critique: { color: "#DC2626", bg: "#FEF2F2" } };
              const ic = INTERP[e.interpretation];
              return (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 9, backgroundColor: "#F8FAFC", border: `1px solid ${colors.border}` }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0A1628" }}>{p ? `${p.prenom} ${p.nom}` : "—"}</div>
                    <div style={{ fontSize: 12, color: "#6B7280" }}>{e.type_examen}{e.libelle ? ` — ${e.libelle}` : ""}</div>
                  </div>
                  {ic && <span style={{ fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 8, backgroundColor: ic.bg, color: ic.color }}>{e.interpretation}</span>}
                  <button onClick={() => navigate("/hopital/examens")}
                    style={{ fontSize: 11, padding: "4px 10px", border: "none", borderRadius: 7, background: "#EFF6FF", color: "#2563EB", cursor: "pointer", fontWeight: 600 }}>
                    Voir le resultat
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Layout>
  );
}
