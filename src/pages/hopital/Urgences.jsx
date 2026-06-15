import { colors } from "../../theme";
import { useState, useEffect, useCallback } from "react";
import Layout from "../../components/Layout";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../supabaseClient";
import { usePatients } from "../../hooks/useSupabaseData";
import { insertConsultation, updateConsultation, insertConstante, upsertHospitalisation } from "../../hooks/useMutations";
import { openDocument, tableHTML, infoGridHTML, fetchEtabFromAuth } from "../../utils/MedOSDocument";

const ACCENT = "#10B981";

const TRIAGE_CFG = {
  urgent:     { label: "Urgent",     bg: "#FEF2F2", border: "#EF4444", color: "#DC2626", dot: "#EF4444" },
  semi_urgent:{ label: "Semi-urgent",bg: "#FFFBEB", border: "#F59E0B", color: "#D97706", dot: "#F59E0B" },
  non_urgent: { label: "Non urgent", bg: "#F0FDF4", border: "#10B981", color: "#16A34A", dot: "#10B981" },
};

const inputSt = { width: "100%", padding: "9px 11px", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", color: colors.navy, backgroundColor: colors.bgCard };
const labelSt = { display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginBottom: 5 };

function fmtDuree(isoStart) {
  if (!isoStart) return "—";
  const diff = Math.floor((Date.now() - new Date(isoStart)) / 60000);
  if (diff < 60) return `${diff} min`;
  const h = Math.floor(diff / 60); const m = diff % 60;
  return `${h}h${m > 0 ? m + "min" : ""}`;
}

function TriageBadge({ triage, size = 11 }) {
  if (!triage) return <span style={{ fontSize: size, padding: "2px 7px", borderRadius: 6, backgroundColor: "#F3F4F6", color: "#6B7280", fontWeight: 600 }}>Non trie</span>;
  const c = TRIAGE_CFG[triage] ?? TRIAGE_CFG.non_urgent;
  return <span style={{ fontSize: size, padding: "2px 8px", borderRadius: 6, backgroundColor: c.bg, color: c.color, fontWeight: 700, border: `1px solid ${c.border}` }}>{c.label}</span>;
}

// ── Modal arrivée urgences ─────────────────────────────────────────────────────
function ModalArrivee({ patients, etabId, auth, onClose, onSaved }) {
  const [form, setForm] = useState({ patient_id: "", motif: "", triage: "non_urgent", medecin_nom: "" });
  const [saving, setSaving] = useState(false);
  const [filtre, setFiltre] = useState("");

  const patsFiltres = patients.filter((p) => {
    const q = filtre.toLowerCase();
    return !q || `${p.prenom} ${p.nom}`.toLowerCase().includes(q) || (p.numero_dossier ?? "").includes(q);
  }).slice(0, 60);

  const handleSave = async () => {
    if (!form.patient_id) return alert("Selectionnez un patient.");
    setSaving(true);
    try {
      await insertConsultation({
        patient_id: form.patient_id,
        etablissement_id: etabId,
        statut: "en_attente",
        service: "Urgences",
        triage: form.triage,
        motif: form.motif || null,
        medecin_nom: form.medecin_nom || null,
        heure_arrivee: new Date().toISOString(),
      });
      if (form.triage === "urgent" && etabId) {
        const pat = patients.find((p) => p.id === form.patient_id);
        await supabase.from("alertes").insert({
          etablissement_id: etabId,
          patient_id: form.patient_id,
          titre: "Arrivee urgente aux urgences",
          message: `${pat ? pat.prenom + " " + pat.nom : "Patient"} — ${form.motif || "Motif non precise"}`,
          type: "urgence",
          statut: "non_lu",
        }).catch(() => {});
      }
      onSaved();
      onClose();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: colors.bgCard, borderRadius: 16, width: "100%", maxWidth: 480, padding: "24px 28px", boxShadow: "0 20px 60px rgba(0,0,0,0.22)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.navy }}>Nouvelle arrivee aux urgences</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted }}>×</button>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelSt}>Patient</label>
          <input style={{ ...inputSt, marginBottom: 6 }} placeholder="Rechercher..." value={filtre} onChange={(e) => setFiltre(e.target.value)} />
          <select style={inputSt} value={form.patient_id} onChange={(e) => setForm((f) => ({ ...f, patient_id: e.target.value }))}>
            <option value="">-- Selectionner le patient --</option>
            {patsFiltres.map((p) => <option key={p.id} value={p.id}>{p.prenom} {p.nom}{p.numero_dossier ? ` — ${p.numero_dossier}` : ""}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelSt}>Motif d'arrivee</label>
          <input style={inputSt} value={form.motif} onChange={(e) => setForm((f) => ({ ...f, motif: e.target.value }))} placeholder="Ex : Douleur abdominale intense, fievre 40°C..." />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelSt}>Triage initial</label>
          <div style={{ display: "flex", gap: 8 }}>
            {[["urgent", "Urgent"], ["semi_urgent", "Semi-urgent"], ["non_urgent", "Non urgent"]].map(([v, l]) => {
              const c = TRIAGE_CFG[v];
              return (
                <button key={v} onClick={() => setForm((f) => ({ ...f, triage: v }))} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: `2px solid ${form.triage === v ? c.border : "#E5E7EB"}`, backgroundColor: form.triage === v ? c.bg : "white", color: form.triage === v ? c.color : "#374151", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  {l}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={labelSt}>Medecin de garde assigne</label>
          <input style={inputSt} value={form.medecin_nom} onChange={(e) => setForm((f) => ({ ...f, medecin_nom: e.target.value }))} placeholder="Dr. Nom" />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, background: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 10, background: saving ? "#D1D5DB" : ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "Enregistrement..." : "Enregistrer l'arrivee"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal triage ABCDE ─────────────────────────────────────────────────────────
function ModalTriage({ consultation, patients, onClose, onSaved }) {
  const [abcde, setAbcde] = useState({ a: null, b: null, c_tension: "", c_pouls: "", d: "", e: "" });
  const [triageFinal, setTriageFinal] = useState("non_urgent");
  const [saving, setSaving] = useState(false);

  const patient = patients.find((p) => p.id === consultation.patient_id);

  // Calcul automatique ESI selon ABCDE
  useEffect(() => {
    if (abcde.a === false || abcde.b === true) { setTriageFinal("urgent"); return; }
    if (abcde.d === "Douleur" || abcde.d === "Inconscient") { setTriageFinal("urgent"); return; }
    if (abcde.b === null && abcde.a === null) return;
    setTriageFinal("semi_urgent");
  }, [abcde]);

  const ToggleBtn = ({ field, value, label }) => (
    <button onClick={() => setAbcde((f) => ({ ...f, [field]: value }))} style={{ flex: 1, padding: "7px 0", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${abcde[field] === value ? ACCENT : "#E5E7EB"}`, backgroundColor: abcde[field] === value ? "#DCFCE7" : "white", color: abcde[field] === value ? "#16A34A" : "#374151" }}>
      {label}
    </button>
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateConsultation(consultation.id, { triage: triageFinal, medecin_nom: consultation.medecin_nom ?? null });
      onSaved();
      onClose();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: colors.bgCard, borderRadius: 16, width: "100%", maxWidth: 500, maxHeight: "92vh", overflowY: "auto", padding: "24px 28px", boxShadow: "0 20px 60px rgba(0,0,0,0.22)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.navy }}>Triage ABCDE</h3>
            <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{patient ? `${patient.prenom} ${patient.nom}` : "—"}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted }}>×</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 16 }}>
          {/* A */}
          <div style={{ padding: "12px 14px", backgroundColor: colors.bgSurface, borderRadius: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: colors.navy, marginBottom: 8 }}>A — Airway : voies aeriennes</div>
            <div style={{ display: "flex", gap: 8 }}>
              <ToggleBtn field="a" value={true}  label="Libres" />
              <ToggleBtn field="a" value={false} label="Obstruees (URGENT)" />
            </div>
          </div>
          {/* B */}
          <div style={{ padding: "12px 14px", backgroundColor: colors.bgSurface, borderRadius: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: colors.navy, marginBottom: 8 }}>B — Breathing : respiration</div>
            <div style={{ display: "flex", gap: 8 }}>
              <ToggleBtn field="b" value={false} label="Normale" />
              <ToggleBtn field="b" value={true}  label="Detresse respiratoire (URGENT)" />
            </div>
          </div>
          {/* C */}
          <div style={{ padding: "12px 14px", backgroundColor: colors.bgSurface, borderRadius: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: colors.navy, marginBottom: 8 }}>C — Circulation : hemodynamique</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label style={labelSt}>Tension (mmHg)</label>
                <input style={inputSt} value={abcde.c_tension} onChange={(e) => setAbcde((f) => ({ ...f, c_tension: e.target.value }))} placeholder="120/80" />
              </div>
              <div>
                <label style={labelSt}>Pouls (bpm)</label>
                <input style={inputSt} type="number" value={abcde.c_pouls} onChange={(e) => setAbcde((f) => ({ ...f, c_pouls: e.target.value }))} placeholder="75" />
              </div>
            </div>
          </div>
          {/* D */}
          <div style={{ padding: "12px 14px", backgroundColor: colors.bgSurface, borderRadius: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: colors.navy, marginBottom: 8 }}>D — Disability : etat de conscience</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["Alerte", "Voix", "Douleur", "Inconscient"].map((v) => (
                <button key={v} onClick={() => setAbcde((f) => ({ ...f, d: v }))} style={{ padding: "6px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${abcde.d === v ? ACCENT : "#E5E7EB"}`, backgroundColor: abcde.d === v ? "#DCFCE7" : "white", color: abcde.d === v ? "#16A34A" : "#374151" }}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          {/* E */}
          <div style={{ padding: "12px 14px", backgroundColor: colors.bgSurface, borderRadius: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: colors.navy, marginBottom: 8 }}>E — Exposure : temperature et lesions</div>
            <input style={inputSt} value={abcde.e} onChange={(e) => setAbcde((f) => ({ ...f, e: e.target.value }))} placeholder="Ex : T 39.2°C, plaie ouverte membre superieur gauche" />
          </div>
        </div>

        {/* Triage final */}
        <div style={{ marginBottom: 18 }}>
          <label style={labelSt}>Triage final (propose selon ABCDE)</label>
          <div style={{ display: "flex", gap: 8 }}>
            {[["urgent", "Urgent"], ["semi_urgent", "Semi-urgent"], ["non_urgent", "Non urgent"]].map(([v, l]) => {
              const c = TRIAGE_CFG[v];
              return (
                <button key={v} onClick={() => setTriageFinal(v)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: `2px solid ${triageFinal === v ? c.border : "#E5E7EB"}`, backgroundColor: triageFinal === v ? c.bg : "white", color: triageFinal === v ? c.color : "#374151", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                  {l}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, background: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 10, background: saving ? "#D1D5DB" : ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "..." : "Valider le triage"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal orientation ──────────────────────────────────────────────────────────
function ModalOrientation({ consultation, auth, etabId, onClose, onSaved }) {
  const { success } = useToast();
  const [orientation, setOrientation] = useState("domicile");
  const [etabTransfert, setEtabTransfert] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (orientation === "hospitaliser") {
        await upsertHospitalisation(consultation.patient_id, {
          etablissement_id: etabId,
          statut: "hospitalise",
          date_entree: new Date().toISOString().slice(0, 10),
          motif_hospitalisation: consultation.motif ?? "Admission depuis urgences",
        });
      }
      await updateConsultation(consultation.id, {
        statut: "termine",
        orientation: orientation,
        notes: orientation === "transfert" ? `Transfert vers : ${etabTransfert}` : null,
      });
      success("Patient oriente");
      onSaved();
      onClose();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: colors.bgCard, borderRadius: 16, width: "100%", maxWidth: 420, padding: "24px 28px", boxShadow: "0 20px 60px rgba(0,0,0,0.22)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.navy }}>Orienter le patient</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted }}>×</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {[
            ["hospitaliser", "Hospitaliser dans l'etablissement", "#3B82F6"],
            ["domicile",     "Retour a domicile",                 ACCENT   ],
            ["transfert",    "Transferer vers un autre etab.",    "#F59E0B" ],
            ["deces",        "Deces aux urgences",                "#1F2937" ],
          ].map(([v, l, c]) => (
            <button key={v} onClick={() => setOrientation(v)} style={{ padding: "11px 14px", borderRadius: 8, fontSize: 13, fontWeight: orientation === v ? 700 : 400, cursor: "pointer", textAlign: "left", border: `1.5px solid ${orientation === v ? c : colors.border}`, backgroundColor: orientation === v ? c + "15" : colors.bgSurface, color: orientation === v ? c : colors.text }}>
              {l}
            </button>
          ))}
        </div>
        {orientation === "transfert" && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelSt}>Etablissement de destination</label>
            <input style={inputSt} value={etabTransfert} onChange={(e) => setEtabTransfert(e.target.value)} placeholder="Nom de l'etablissement" />
          </div>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, background: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 10, background: saving ? "#D1D5DB" : ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "..." : "Valider"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal constantes rapides ───────────────────────────────────────────────────
function ModalConstantesRapides({ consultation, etabId, auth, onClose, onSaved }) {
  const { success } = useToast();
  const [form, setForm] = useState({ temperature: "", tension_systolique: "", tension_diastolique: "", pouls: "", saturation_o2: "" });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { patient_id: consultation.patient_id, etablissement_id: etabId, saisi_par: auth?.user?.email ?? null };
      Object.entries(form).forEach(([k, v]) => { if (v !== "") payload[k] = Number(v); });
      await insertConstante(payload);
      success("Constantes enregistrees");
      onSaved(); onClose();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: colors.bgCard, borderRadius: 16, width: "100%", maxWidth: 380, padding: "24px 28px", boxShadow: "0 20px 60px rgba(0,0,0,0.22)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: colors.navy }}>Constantes rapides</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted }}>×</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          {[
            { key: "temperature",        label: "T° (°C)",      placeholder: "37.0" },
            { key: "tension_systolique", label: "TA sys",        placeholder: "120"  },
            { key: "tension_diastolique",label: "TA dia",        placeholder: "80"   },
            { key: "pouls",              label: "Pouls (bpm)",   placeholder: "75"   },
            { key: "saturation_o2",      label: "SpO2 (%)",      placeholder: "98"   },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label style={labelSt}>{label}</label>
              <input style={inputSt} type="number" value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 9, background: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 9, background: saving ? "#D1D5DB" : ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "..." : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Carte patient urgences ─────────────────────────────────────────────────────
function CartePatientUrgences({ consultation, patients, auth, etabId, onRefresh, phase }) {
  const { success } = useToast();
  const [modalTriage, setModalTriage]     = useState(false);
  const [modalOrient, setModalOrient]     = useState(false);
  const [modalConst, setModalConst]       = useState(false);

  const patient = patients.find((p) => p.id === consultation.patient_id);
  const nom     = patient ? `${patient.prenom} ${patient.nom}` : "Patient inconnu";
  const duree   = fmtDuree(consultation.heure_arrivee);
  const urgentLong = consultation.triage === "urgent" && Math.floor((Date.now() - new Date(consultation.heure_arrivee)) / 60000) > 20;
  const tc      = TRIAGE_CFG[consultation.triage];

  const handleAppeler = async () => {
    try {
      await updateConsultation(consultation.id, { statut: "en_cours", heure_debut: new Date().toISOString() });
      success("Patient appele — prise en charge en cours");
      onRefresh();
    } catch (e) { alert(e.message); }
  };

  return (
    <>
      {modalTriage && <ModalTriage consultation={consultation} patients={patients} onClose={() => setModalTriage(false)} onSaved={() => { onRefresh(); setModalTriage(false); }} />}
      {modalOrient && <ModalOrientation consultation={consultation} auth={auth} etabId={etabId} onClose={() => setModalOrient(false)} onSaved={onRefresh} />}
      {modalConst  && <ModalConstantesRapides consultation={consultation} etabId={etabId} auth={auth} onClose={() => setModalConst(false)} onSaved={onRefresh} />}

      <div style={{
        backgroundColor: colors.bgCard, borderRadius: 10, padding: "12px 14px", marginBottom: 8,
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        borderLeft: `3px solid ${tc?.border ?? "#E5E7EB"}`,
        animation: urgentLong ? "pulse 1.5s infinite" : "none",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>{nom}</div>
          <TriageBadge triage={consultation.triage} />
        </div>
        {consultation.motif && <div style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4, lineHeight: 1.4 }}>{consultation.motif}</div>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: urgentLong ? "#EF4444" : colors.textMuted, fontWeight: urgentLong ? 700 : 400 }}>{duree}</span>
          {consultation.medecin_nom && <span style={{ fontSize: 11, color: colors.textMuted }}>Dr. {consultation.medecin_nom}</span>}
        </div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {phase === "triage" && (
            <button onClick={() => setModalTriage(true)} style={{ padding: "4px 10px", fontSize: 11, fontWeight: 700, backgroundColor: "#FEF3C7", color: "#D97706", border: "none", borderRadius: 6, cursor: "pointer" }}>Trier</button>
          )}
          {phase === "attente" && (
            <button onClick={handleAppeler} style={{ padding: "4px 10px", fontSize: 11, fontWeight: 700, backgroundColor: "#DBEAFE", color: "#2563EB", border: "none", borderRadius: 6, cursor: "pointer" }}>Appeler</button>
          )}
          {(phase === "attente" || phase === "en_cours") && (
            <button onClick={() => setModalOrient(true)} style={{ padding: "4px 10px", fontSize: 11, fontWeight: 700, backgroundColor: "#DCFCE7", color: "#16A34A", border: "none", borderRadius: 6, cursor: "pointer" }}>Orienter</button>
          )}
          <button onClick={() => setModalConst(true)} style={{ padding: "4px 10px", fontSize: 11, fontWeight: 600, backgroundColor: colors.bgSurface, color: colors.textSecondary, border: `1px solid ${colors.border}`, borderRadius: 6, cursor: "pointer" }}>Constantes</button>
        </div>
      </div>
    </>
  );
}

// ── Page principale Urgences ───────────────────────────────────────────────────
export default function Urgences() {
  const { auth }    = useAuth();
  const { toasts }  = useToast();
  const { data: patients } = usePatients();
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [showArrivee, setShowArrivee]     = useState(false);
  const [heure, setHeure]                 = useState(new Date());
  const [etabId, setEtabId]               = useState(auth?.etablissement_id ?? null);

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

  const load = useCallback(async () => {
    if (!etabId) return;
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase.from("consultations")
      .select("*")
      .eq("etablissement_id", etabId)
      .eq("service", "Urgences")
      .gte("heure_arrivee", today + "T00:00:00")
      .order("heure_arrivee", { ascending: true });
    setConsultations(data ?? []);
    setLoading(false);
  }, [etabId]);

  useEffect(() => { load(); }, [load]);

  // Mise à jour heure chaque seconde
  useEffect(() => {
    const t = setInterval(() => setHeure(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Refresh auto toutes les 30s
  useEffect(() => {
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  // Realtime
  useEffect(() => {
    if (!etabId) return;
    const channel = supabase.channel("urgences-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "consultations" }, () => load())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [etabId, load]);

  // Segmentation
  const nonTries    = consultations.filter((c) => !c.triage && c.statut === "en_attente");
  const enAttente   = consultations.filter((c) => c.triage  && c.statut === "en_attente").sort((a, b) => {
    const prio = { urgent: 0, semi_urgent: 1, non_urgent: 2 };
    return (prio[a.triage] ?? 3) - (prio[b.triage] ?? 3) || new Date(a.heure_arrivee) - new Date(b.heure_arrivee);
  });
  const enCours     = consultations.filter((c) => c.statut === "en_cours");
  const termines    = consultations.filter((c) => c.statut === "termine");

  // KPIs
  const tpsAttenteMoyMin = enAttente.length > 0
    ? Math.round(enAttente.reduce((s, c) => s + (Date.now() - new Date(c.heure_arrivee)) / 60000, 0) / enAttente.length)
    : 0;
  const critiques = enAttente.filter((c) => c.triage === "urgent").length;

  const ORIENT_CFG = {
    hospitaliser: { label: "Hospitalise",         bg: "#DBEAFE", color: "#2563EB" },
    domicile:     { label: "Retourne domicile",   bg: "#DCFCE7", color: "#16A34A" },
    transfert:    { label: "Transfere",            bg: "#FEF3C7", color: "#D97706" },
    deces:        { label: "Decede",               bg: "#F3F4F6", color: "#374151" },
  };

  const imprimerRapport = async () => {
    const etab = await fetchEtabFromAuth(auth);
    const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const rows = consultations.map((c) => {
      const pat = patients.find((p) => p.id === c.patient_id);
      const dureeMin = c.heure_debut ? Math.round((new Date(c.heure_debut) - new Date(c.heure_arrivee)) / 60000) : null;
      return [
        c.heure_arrivee ? new Date(c.heure_arrivee).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—",
        pat ? `${pat.prenom} ${pat.nom}` : "—",
        TRIAGE_CFG[c.triage]?.label ?? "Non trie",
        c.medecin_nom ?? "—",
        c.orientation ? (ORIENT_CFG[c.orientation]?.label ?? c.orientation) : (c.statut === "en_cours" ? "En cours" : c.statut === "en_attente" ? "En attente" : "—"),
        dureeMin != null ? `${dureeMin} min` : "—",
      ];
    });
    openDocument({
      titre: "Rapport des urgences",
      sousTitre: today,
      etablissement: etab,
      sections: [
        { titre: "Resume de la journee", html: infoGridHTML([
          { label: "Total passages",   value: String(consultations.length) },
          { label: "Urgents",          value: String(consultations.filter((c) => c.triage === "urgent").length) },
          { label: "Semi-urgents",     value: String(consultations.filter((c) => c.triage === "semi_urgent").length) },
          { label: "Non urgents",      value: String(consultations.filter((c) => c.triage === "non_urgent").length) },
          { label: "Hospitalises",     value: String(consultations.filter((c) => c.orientation === "hospitaliser").length) },
          { label: "Retour domicile",  value: String(consultations.filter((c) => c.orientation === "domicile").length) },
        ]) },
        { titre: `Detail des ${consultations.length} passages`, html: tableHTML(["Arrivee", "Patient", "Triage", "Medecin", "Orientation", "Attente"], rows) },
      ],
    });
  };

  const COLS = [
    { key: "triage",    phase: "triage",   label: "Triage",             count: nonTries.length,  items: nonTries,  bg: "#FEF2F2" },
    { key: "attente",   phase: "attente",  label: "Attente prise en charge", count: enAttente.length, items: enAttente, bg: "#FFFBEB" },
    { key: "en_cours",  phase: "en_cours", label: "En cours",           count: enCours.length,   items: enCours,   bg: "#EFF6FF" },
    { key: "termines",  phase: "termine",  label: "Orientes / Sortis",  count: termines.length,  items: termines,  bg: "#F0FDF4" },
  ];

  return (
    <Layout title="Urgences" subtitle="Gestion des arrivees aux urgences en temps reel">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <Toast toasts={toasts} />

      {showArrivee && (
        <ModalArrivee patients={patients} etabId={etabId} auth={auth} onClose={() => setShowArrivee(false)} onSaved={() => { load(); setShowArrivee(false); }} />
      )}

      {/* Header avec heure + boutons */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#1F2937", fontFamily: "monospace" }}>
          {heure.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          <span style={{ fontSize: 13, fontWeight: 400, color: colors.textMuted, marginLeft: 12 }}>{heure.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={imprimerRapport} style={{ padding: "8px 14px", backgroundColor: "#7C3AED", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Rapport urgences</button>
          <button onClick={() => setShowArrivee(true)} style={{ padding: "8px 16px", backgroundColor: ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Nouvelle arrivee</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { label: "En attente",        value: enAttente.length,       color: enAttente.length > 0     ? "#F59E0B" : "#6B7280" },
          { label: "En cours",          value: enCours.length,         color: enCours.length > 0       ? "#3B82F6" : "#6B7280" },
          { label: "Attente moy.",      value: `${tpsAttenteMoyMin} min`, color: tpsAttenteMoyMin > 30 ? "#EF4444" : "#10B981" },
          { label: "Critiques",         value: critiques,              color: critiques > 0            ? "#EF4444" : "#6B7280" },
        ].map((k) => (
          <div key={k.label} style={{ flex: "1 1 120px", backgroundColor: colors.bgCard, borderRadius: 12, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderTop: `3px solid ${k.color}` }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: k.color }}>{loading ? "…" : k.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 3 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* 4 colonnes */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, alignItems: "start" }}>
        {COLS.map(({ key, phase, label, count, items, bg }) => (
          <div key={key} style={{ backgroundColor: bg, borderRadius: 12, padding: "12px 12px 16px", minHeight: 300 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: colors.navy, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
              <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 10, backgroundColor: count > 0 ? "#374151" : "#E5E7EB", color: count > 0 ? "white" : "#9CA3AF" }}>{count}</span>
            </div>

            {loading && <div style={{ height: 60, backgroundColor: "rgba(255,255,255,0.6)", borderRadius: 8, animation: "pulse 1.5s infinite" }} />}
            {!loading && items.length === 0 && <div style={{ fontSize: 12, color: colors.textMuted, textAlign: "center", padding: "20px 0" }}>Aucun patient</div>}

            {!loading && phase === "termine" && items.map((c) => {
              const pat = patients.find((p) => p.id === c.patient_id);
              const oc = ORIENT_CFG[c.orientation] ?? { label: "—", bg: "#F3F4F6", color: "#6B7280" };
              return (
                <div key={c.id} style={{ backgroundColor: colors.bgCard, borderRadius: 8, padding: "10px 12px", marginBottom: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: colors.navy }}>{pat ? `${pat.prenom} ${pat.nom}` : "—"}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                    <TriageBadge triage={c.triage} />
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, backgroundColor: oc.bg, color: oc.color, fontWeight: 600 }}>{oc.label}</span>
                  </div>
                </div>
              );
            })}

            {!loading && phase !== "termine" && items.map((c) => (
              <CartePatientUrgences key={c.id} consultation={c} patients={patients} auth={auth} etabId={etabId} onRefresh={load} phase={phase} />
            ))}
          </div>
        ))}
      </div>
    </Layout>
  );
}
