import { colors } from "../../theme";
import { useState, useEffect, useCallback, useMemo } from "react";
import { SERVICES_HOPITAL } from "../../constants/hopital"; // disponible pour evolutions
import Layout from "../../components/Layout";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useAuth } from "../../context/AuthContext";
import { usePatients } from "../../hooks/useSupabaseData";
import {
  insertExamen,
  updateExamen,
  fetchExamens,
} from "../../hooks/useMutations";
import { openDocument, tableHTML, infoGridHTML, signatureRowHTML, fetchEtabFromAuth } from "../../utils/MedOSDocument";
import { VALEURS_REFERENCE, evaluerValeur } from "../../data/valeurs_reference";
import { supabase } from "../../supabaseClient";

// ── Constantes ────────────────────────────────────────────────────────────────
const ACCENT = "#10B981";

const TYPES_EXAMENS = [
  "Bilan sanguin", "NFS", "Glycemie", "Uree / Creatinine", "Bilan hepatique",
  "Serologie", "Radiographie", "Echographie", "ECG", "Scanner",
  "Analyse urine", "Coproculture", "Frottis / Goutte epaisse", "Autre",
];

const STATUT_CONFIG = {
  prescrit:            { label: "Prescrit",            color: "#6B7280", bg: "#F3F4F6" },
  en_cours:            { label: "En cours",            color: "#3B82F6", bg: "#DBEAFE" },
  resultat_disponible: { label: "Resultat disponible", color: "#10B981", bg: "#DCFCE7" },
  annule:              { label: "Annule",              color: "#EF4444", bg: "#FEF2F2" },
};

const INTERPRETATION_CONFIG = {
  normal:   { label: "Normal",   color: "#16A34A", bg: "#DCFCE7" },
  anormal:  { label: "Anormal",  color: "#D97706", bg: "#FEF3C7" },
  critique: { label: "Critique", color: "#DC2626", bg: "#FEF2F2" },
};

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function StatutBadge({ statut }) {
  const s = STATUT_CONFIG[statut] ?? { label: statut, color: "#6B7280", bg: "#F3F4F6" };
  return <span style={{ padding: "2px 9px", borderRadius: 8, fontSize: 11, fontWeight: 700, backgroundColor: s.bg, color: s.color }}>{s.label}</span>;
}

// ── Modal prescrire ────────────────────────────────────────────────────────────
function ModalPrescrire({ patients, etabId, onClose, onSaved }) {
  const [filtre, setFiltre] = useState("");
  const [form, setForm] = useState({
    patient_id: "", type_examen: TYPES_EXAMENS[0], libelle: "",
    prescripteur: "", urgence: false, notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const patientsFiltres = useMemo(() => {
    const q = filtre.toLowerCase();
    return patients.filter((p) => `${p.prenom} ${p.nom}`.toLowerCase().includes(q)).slice(0, 80);
  }, [patients, filtre]);

  const handleSave = async () => {
    if (!form.patient_id) { setErr("Selectionnez un patient."); return; }
    setSaving(true);
    try {
      await insertExamen({ ...form, etablissement_id: etabId ?? null, statut: "prescrit", date_prescription: new Date().toISOString() });
      onSaved();
      onClose();
    } catch (e) { setErr(e.message); setSaving(false); }
  };

  const inputSt = { width: "100%", padding: "9px 11px", border: "1.5px solid #E5E7EB", borderRadius: 9, fontSize: 13, outline: "none", boxSizing: "border-box", background: "white", color: "#0A1628" };
  const labelSt = { display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginBottom: 5 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 520, maxHeight: "90vh", overflow: "auto", padding: "26px 28px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0A1628" }}>Prescrire un examen</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF" }}>x</button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelSt}>Patient</label>
          <input style={{ ...inputSt, marginBottom: 6 }} placeholder="Rechercher..." value={filtre} onChange={(e) => setFiltre(e.target.value)} />
          <select style={inputSt} value={form.patient_id} onChange={(e) => set("patient_id")(e.target.value)}>
            <option value="">-- Selectionnez un patient --</option>
            {patientsFiltres.map((p) => <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>)}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelSt}>Type d'examen</label>
            <select style={inputSt} value={form.type_examen} onChange={(e) => set("type_examen")(e.target.value)}>
              {TYPES_EXAMENS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={labelSt}>Prescripteur</label>
            <input style={inputSt} value={form.prescripteur} onChange={(e) => set("prescripteur")(e.target.value)} placeholder="Dr. Nom" />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelSt}>Libelle / precision</label>
          <input style={inputSt} value={form.libelle} onChange={(e) => set("libelle")(e.target.value)} placeholder="Ex : Radio thorax face" />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelSt}>Notes</label>
          <input style={inputSt} value={form.notes} onChange={(e) => set("notes")(e.target.value)} placeholder="Optionnel..." />
        </div>

        <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => set("urgence")(!form.urgence)}
            style={{ padding: "7px 16px", borderRadius: 8, border: `2px solid ${form.urgence ? "#EF4444" : "#E5E7EB"}`,
              backgroundColor: form.urgence ? "#FEF2F2" : "white",
              color: form.urgence ? "#DC2626" : "#374151",
              fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
            {form.urgence ? "URGENT" : "Marquer urgent"}
          </button>
        </div>

        {err && <div style={{ padding: "8px 12px", background: "#FEF2F2", borderRadius: 8, fontSize: 12, color: "#DC2626", marginBottom: 12 }}>{err}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 11, background: "#F8FAFC", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 2, padding: 11, background: saving ? "#D1D5DB" : ACCENT, color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "Enregistrement..." : "Prescrire"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal saisir résultat ──────────────────────────────────────────────────────
function ModalResultat({ examen, patient, etabId, onClose, onSaved }) {
  const refsDisponibles = VALEURS_REFERENCE[examen.type_examen] ?? [];
  const [form, setForm] = useState({
    resultat_texte: examen.resultat_texte ?? "",
    interpretation: examen.interpretation ?? "",
    date_realisation: new Date().toISOString().slice(0, 16),
  });
  const [valeursForm, setValeursForm] = useState(() => {
    if (examen.resultat_valeurs && typeof examen.resultat_valeurs === "object") return { ...examen.resultat_valeurs };
    return {};
  });
  const [saving, setSaving] = useState(false);

  const patientAge = patient?.date_naissance
    ? Math.floor((Date.now() - new Date(patient.date_naissance)) / (365.25 * 86400000))
    : 30;
  const patientGenre = patient?.genre ?? "adulte";

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateExamen(examen.id, {
        ...form,
        statut: "resultat_disponible",
        resultat_valeurs: Object.keys(valeursForm).length > 0 ? valeursForm : null,
      });
      if (etabId) {
        await supabase.from("alertes").insert({
          etablissement_id: etabId,
          patient_id: examen.patient_id ?? null,
          titre: "Resultat d'examen disponible",
          message: `${examen.type_examen}${examen.libelle ? " — " + examen.libelle : ""}${patient ? " — " + patient.prenom + " " + patient.nom : ""}`,
          type: "examen",
          statut: "non_lu",
        }).catch(() => {});
      }
      onSaved();
      onClose();
    } catch (e) { showError(e.message); setSaving(false); }
  };

  const inputSt = { width: "100%", padding: "9px 11px", border: "1.5px solid #E5E7EB", borderRadius: 9, fontSize: 13, outline: "none", boxSizing: "border-box", background: "white", color: "#0A1628" };
  const labelSt = { display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginBottom: 5 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", padding: "26px 28px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0A1628" }}>Saisir le resultat — {examen.type_examen}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF" }}>x</button>
        </div>

        {refsDisponibles.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <label style={labelSt}>Valeurs mesurees</label>
            <div style={{ backgroundColor: "#F8FAFC", borderRadius: 10, padding: "10px 14px" }}>
              {refsDisponibles.map((ref) => {
                const val = valeursForm[ref.champ] ?? "";
                const eval_ = val !== "" ? evaluerValeur(val, ref, patientGenre, patientAge) : null;
                return (
                  <div key={ref.champ} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <label style={{ fontSize: 12, color: "#6B7280", width: 180, flexShrink: 0 }}>{ref.label} ({ref.unite})</label>
                    <input type="number" step="0.1" value={val}
                      onChange={(e) => setValeursForm((prev) => ({ ...prev, [ref.champ]: e.target.value }))}
                      style={{ ...inputSt, width: 90, textAlign: "center" }} />
                    {eval_ && (
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, backgroundColor: eval_.color + "20", color: eval_.color, fontWeight: 700, whiteSpace: "nowrap" }}>
                        {eval_.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <label style={labelSt}>Resultat (texte libre)</label>
          <textarea value={form.resultat_texte} onChange={(e) => setForm((f) => ({ ...f, resultat_texte: e.target.value }))}
            style={{ ...inputSt, minHeight: 70, resize: "vertical" }} placeholder="Observations, commentaires..." />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelSt}>Interpretation globale</label>
          <div style={{ display: "flex", gap: 8 }}>
            {Object.entries(INTERPRETATION_CONFIG).map(([v, t]) => (
              <button key={v} onClick={() => setForm((f) => ({ ...f, interpretation: v }))}
                style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: `2px solid ${form.interpretation === v ? t.color : "#E5E7EB"}`, backgroundColor: form.interpretation === v ? t.bg : "white", color: form.interpretation === v ? t.color : "#374151", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelSt}>Date de realisation</label>
          <input style={inputSt} type="datetime-local" value={form.date_realisation}
            onChange={(e) => setForm((f) => ({ ...f, date_realisation: e.target.value }))} />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 11, background: "#F8FAFC", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 2, padding: 11, background: saving ? "#D1D5DB" : "#3B82F6", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "Enregistrement..." : "Enregistrer le resultat"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Panel lecture résultat + impression ────────────────────────────────────────
function PanelResultat({ examen, patient, auth, onClose }) {
  const interp = INTERPRETATION_CONFIG[examen.interpretation];
  const handleImprimer = async () => {
    const etab = await fetchEtabFromAuth(auth);
    openDocument({
      titre: "Resultat d'examen",
      sousTitre: `${examen.type_examen}${examen.libelle ? " — " + examen.libelle : ""}`,
      etablissement: etab,
      sections: [
        { titre: "Patient", html: infoGridHTML([
          { label: "Nom", value: patient ? `${patient.prenom} ${patient.nom}` : "—" },
          { label: "Prescripteur", value: examen.prescripteur ?? "—" },
          { label: "Date prescription", value: fmtDate(examen.date_prescription) },
          { label: "Date realisation", value: fmtDate(examen.date_realisation) },
        ]) },
        { titre: "Resultat", html: `<p style="font-size:15px;line-height:1.6;white-space:pre-wrap">${examen.resultat_texte ?? "—"}</p>` + (examen.interpretation ? `<div style="display:inline-block;padding:6px 16px;border-radius:8px;background:${interp?.bg};color:${interp?.color};font-weight:800;font-size:13px;margin-top:8px">${interp?.label ?? examen.interpretation}</div>` : "") },
        { titre: "", html: signatureRowHTML(["Date et signature du biologiste / medecin", "Cachet de l'etablissement"]) },
      ],
    });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 520, maxHeight: "90vh", overflow: "auto", padding: "26px 28px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0A1628" }}>{examen.type_examen}</h3>
            {examen.libelle && <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{examen.libelle}</div>}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF" }}>x</button>
        </div>

        <div style={{ marginBottom: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ fontSize: 12 }}><strong>Prescripteur :</strong> {examen.prescripteur ?? "—"}</div>
          <div style={{ fontSize: 12 }}><strong>Realise le :</strong> {fmtDate(examen.date_realisation)}</div>
          {examen.urgence && <div style={{ fontSize: 11, fontWeight: 800, color: "#EF4444" }}>URGENT</div>}
        </div>

        {examen.resultat_valeurs && (() => {
          const refs = VALEURS_REFERENCE[examen.type_examen] ?? [];
          const valeurs = examen.resultat_valeurs;
          if (refs.length === 0) return null;
          return (
            <div style={{ marginBottom: 14 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ backgroundColor: "#F8FAFC" }}>
                    {["Valeur", "Resultat", "Reference", "Statut"].map((h) => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: "#6B7280", fontSize: 11, textTransform: "uppercase", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {refs.filter((ref) => valeurs[ref.champ] !== undefined && valeurs[ref.champ] !== "").map((ref) => {
                    const val = valeurs[ref.champ];
                    const eval_ = evaluerValeur(val, ref);
                    const refMin = ref.min_adulte ?? ref.min_homme ?? "—";
                    const refMax = ref.max_adulte ?? ref.max_homme ?? "—";
                    return (
                      <tr key={ref.champ} style={{ borderBottom: "1px solid #F3F4F6" }}>
                        <td style={{ padding: "7px 10px", color: "#374151" }}>{ref.label}</td>
                        <td style={{ padding: "7px 10px", fontWeight: 700, color: eval_?.color ?? "#374151" }}>{val} {ref.unite}</td>
                        <td style={{ padding: "7px 10px", color: "#6B7280" }}>{refMin}–{refMax} {ref.unite}</td>
                        <td style={{ padding: "7px 10px" }}>
                          {eval_ && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, backgroundColor: eval_.color + "20", color: eval_.color, fontWeight: 700 }}>{eval_.statut === "normal" ? "Normal" : eval_.statut === "bas" ? "Bas" : "Eleve"}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}

        {examen.resultat_texte && (
          <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "14px 16px", marginBottom: 14, fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", color: "#0A1628" }}>
            {examen.resultat_texte}
          </div>
        )}

        {examen.interpretation && (
          <div style={{ marginBottom: 20 }}>
            <span style={{ display: "inline-block", padding: "7px 20px", borderRadius: 10, fontSize: 14, fontWeight: 800,
              backgroundColor: interp?.bg, color: interp?.color }}>
              {interp?.label ?? examen.interpretation}
            </span>
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 11, background: "#F8FAFC", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, cursor: "pointer" }}>Fermer</button>
          <button onClick={handleImprimer} style={{ flex: 2, padding: 11, background: "#7C3AED", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Imprimer</button>
        </div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function Examens() {
  const { auth } = useAuth();
  const { toasts, success, error: showError } = useToast();
  const { data: patients } = usePatients(auth?.etablissement_id);
  const [examens, setExamens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPrescrire, setShowPrescrire] = useState(false);
  const [modalResultat, setModalResultat] = useState(null);
  const [panelResultat, setPanelResultat] = useState(null);
  const [filtreStatut, setFiltreStatut] = useState("Tous");
  const [filtreType, setFiltreType] = useState("Tous");
  const [etabId, setEtabId] = useState(auth?.etablissement_id ?? null);

  const load = useCallback(async () => {
    setLoading(true);
    let eid = auth?.etablissement_id;
    if (!eid && auth?.user?.email) {
      const { supabase: sb } = await import("../../supabaseClient");
      const { data } = await sb.from("etablissements").select("id").eq("email", auth.user.email).maybeSingle();
      eid = data?.id ?? null;
    }
    if (eid) setEtabId(eid);
    const data = await fetchExamens(eid);
    setExamens(data);
    setLoading(false);
  }, [auth]);

  useEffect(() => { load(); }, [load]);

  const ri = auth?.role_interne;
  const isLaborantin = ri === "Laborantin";
  const isMedecin    = ri === "Médecin";

  // Par defaut, laborantin voit les examens a traiter en premier
  const [filtreStatutEffectif, setFiltreStatutEffectif] = useState(isLaborantin ? "prescrit" : "Tous");

  const filtres = useMemo(() => {
    let r = examens;
    const fs = filtreStatutEffectif !== "Tous" ? filtreStatutEffectif : filtreStatut;
    if (fs !== "Tous") r = r.filter((e) => e.statut === fs);
    if (filtreType !== "Tous") r = r.filter((e) => e.type_examen === filtreType);
    if (isMedecin) {
      const prefix = (auth?.user?.email ?? "").split("@")[0].toLowerCase();
      if (prefix) r = r.filter((e) => (e.prescripteur ?? "").toLowerCase().includes(prefix));
    }
    return r;
  }, [examens, filtreStatut, filtreStatutEffectif, filtreType, isMedecin, auth]);

  const kpis = {
    prescrits:  examens.filter((e) => e.statut === "prescrit").length,
    en_cours:   examens.filter((e) => e.statut === "en_cours").length,
    resultats:  examens.filter((e) => e.statut === "resultat_disponible").length,
    total:      examens.length,
  };

  const getPatient = (e) => {
    if (e.patients) return e.patients;
    return patients.find((p) => p.id === e.patient_id) ?? null;
  };

  const imprimerRapportLabo = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [etab, examRes] = await Promise.all([
      fetchEtabFromAuth(auth),
      supabase.from("examens").select("*, patients(prenom, nom, numero_dossier)")
        .eq("etablissement_id", etabId)
        .gte("created_at", today + "T00:00:00")
        .lte("created_at", today + "T23:59:59")
        .order("created_at", { ascending: true }),
    ]);
    const examensJour = examRes.data ?? [];
    const stats = {
      total:    examensJour.length,
      rendus:   examensJour.filter((e) => e.statut === "resultat_disponible").length,
      enCours:  examensJour.filter((e) => e.statut === "en_cours").length,
      urgents:  examensJour.filter((e) => e.urgence).length,
    };
    const rows = examensJour.map((e) => [
      e.patients ? `${e.patients.prenom} ${e.patients.nom}` : "—",
      e.patients?.numero_dossier ?? "—",
      e.type_examen,
      e.libelle ?? "—",
      e.prescripteur ?? "—",
      e.urgence ? "Oui" : "Non",
      e.statut === "resultat_disponible" ? "Rendu" : e.statut === "en_cours" ? "En cours" : "Prescrit",
      e.interpretation ?? "—",
    ]);
    openDocument({
      titre: "Rapport journalier du laboratoire",
      sousTitre: new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
      etablissement: etab,
      sections: [
        { titre: "Resume de la journee", html: infoGridHTML([
          { label: "Total examens",    value: String(stats.total)   },
          { label: "Resultats rendus", value: String(stats.rendus)  },
          { label: "En cours",         value: String(stats.enCours) },
          { label: "Urgents traites",  value: String(stats.urgents) },
        ]) },
        { titre: `Detail des ${stats.total} examens`, html: rows.length === 0
          ? "<p style='color:#6B7280;font-size:13px'>Aucun examen enregistre aujourd'hui.</p>"
          : tableHTML(["Patient", "Dossier", "Type", "Precision", "Prescripteur", "Urgent", "Statut", "Interpretation"], rows)
        },
        { titre: "", html: signatureRowHTML(["Responsable laboratoire", "Chef de service"]) },
      ],
    });
  };

  return (
    <Layout title="Examens / Laboratoire" subtitle="Suivi des examens et resultats biologiques">
      <Toast toasts={toasts} />

      {showPrescrire && (
        <ModalPrescrire
          patients={patients}
          etabId={etabId}
          onClose={() => setShowPrescrire(false)}
          onSaved={() => { load(); success("Examen prescrit"); }}
        />
      )}
      {modalResultat && (
        <ModalResultat
          examen={modalResultat}
          patient={getPatient(modalResultat)}
          etabId={etabId}
          onClose={() => setModalResultat(null)}
          onSaved={() => { load(); success("Resultat enregistre"); setModalResultat(null); }}
        />
      )}
      {panelResultat && (
        <PanelResultat
          examen={panelResultat}
          patient={getPatient(panelResultat)}
          auth={auth}
          onClose={() => setPanelResultat(null)}
        />
      )}

      {/* KPI */}
      <div className="kpi-row" style={{ marginBottom: 20 }}>
        {[
          { label: "Prescrits",           value: kpis.prescrits, color: "#6B7280" },
          { label: "En cours",            value: kpis.en_cours,  color: "#3B82F6" },
          { label: "Resultats disponibles",value: kpis.resultats, color: ACCENT },
          { label: "Total",               value: kpis.total,     color: "#8B5CF6" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: colors.bgCard, padding: "14px 20px", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{loading ? "…" : k.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Bandeau laborantin */}
      {isLaborantin && kpis.prescrits + kpis.en_cours > 0 && (
        <div style={{ padding: "8px 16px", backgroundColor: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, marginBottom: 14, fontSize: 13, color: "#D97706", fontWeight: 700 }}>
          {kpis.prescrits + kpis.en_cours} examen(s) en attente de traitement
        </div>
      )}

      {/* Filtres + action */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["Tous", "prescrit", "en_cours", "resultat_disponible"].map((s) => {
            const actif = isLaborantin ? filtreStatutEffectif === s : filtreStatut === s;
            return (
              <button key={s} onClick={() => { if (isLaborantin) setFiltreStatutEffectif(s); else setFiltreStatut(s); }}
                style={{ padding: "5px 12px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
                  backgroundColor: actif ? "#3B82F6" : "#F3F4F6",
                  color: actif ? "white" : "#374151" }}>
                {STATUT_CONFIG[s]?.label ?? "Tous"}
              </button>
            );
          })}
          <select value={filtreType} onChange={(e) => setFiltreType(e.target.value)}
            style={{ padding: "5px 10px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 12, background: "white", color: "#0A1628" }}>
            <option value="Tous">Tous les types</option>
            {TYPES_EXAMENS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {isLaborantin && (
          <button onClick={imprimerRapportLabo}
            style={{ padding: "8px 16px", background: "#7C3AED", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Rapport du jour
          </button>
        )}
        {!isLaborantin && (
          <button onClick={() => setShowPrescrire(true)}
            style={{ padding: "8px 16px", background: ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            + Prescrire un examen
          </button>
        )}
      </div>

      {/* Tableau */}
      <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: colors.bgSurface }}>
              {["Patient", "Type d'examen", "Prescripteur", "Urgence", "Date prescription", "Statut", "Actions"].map((h) => (
                <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontSize: 11, fontWeight: 800, color: colors.textSecondary, textTransform: "uppercase", borderBottom: `1px solid ${colors.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: colors.textMuted }}>Chargement...</td></tr>
            )}
            {!loading && filtres.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: colors.textMuted }}>Aucun examen</td></tr>
            )}
            {!loading && filtres.map((e, i) => {
              const p = getPatient(e);
              return (
                <tr key={e.id} style={{ borderBottom: `1px solid ${colors.borderLight}`, backgroundColor: i % 2 === 0 ? "white" : "#FAFAFA" }}>
                  <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#0A1628" }}>
                    {p ? `${p.prenom} ${p.nom}` : "—"}
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 13, color: "#374151" }}>
                    {e.type_examen}{e.libelle ? ` — ${e.libelle}` : ""}
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#6B7280" }}>{e.prescripteur ?? "—"}</td>
                  <td style={{ padding: "10px 14px" }}>
                    {e.urgence && <span style={{ fontSize: 10, fontWeight: 800, color: "#EF4444", backgroundColor: "#FEF2F2", padding: "2px 7px", borderRadius: 6 }}>URGENT</span>}
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#6B7280" }}>{fmtDate(e.date_prescription)}</td>
                  <td style={{ padding: "10px 14px" }}><StatutBadge statut={e.statut} /></td>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      {(e.statut === "prescrit" || e.statut === "en_cours") && (
                        <>
                          <button onClick={() => updateExamen(e.id, { statut: "en_cours" }).then(load)}
                            style={{ fontSize: 11, padding: "3px 9px", border: "none", borderRadius: 6, background: "#DBEAFE", color: "#2563EB", cursor: "pointer", fontWeight: 600 }}>
                            En cours
                          </button>
                          {!isMedecin && (
                            <button onClick={() => setModalResultat(e)}
                              style={{ fontSize: 11, padding: "3px 9px", border: "none", borderRadius: 6, background: "#DCFCE7", color: "#16A34A", cursor: "pointer", fontWeight: 600 }}>
                              {isLaborantin ? "Traiter cet examen" : "Resultat"}
                            </button>
                          )}
                        </>
                      )}
                      {e.statut === "resultat_disponible" && (
                        <button onClick={() => setPanelResultat(e)}
                          style={{ fontSize: 11, padding: "3px 9px", border: "none", borderRadius: 6, background: "#F3F4F6", color: "#374151", cursor: "pointer", fontWeight: 600 }}>
                          Voir
                        </button>
                      )}
                      <button onClick={async () => { if (window.confirm("Annuler cet examen ?")) { await updateExamen(e.id, { statut: "annule" }); load(); success("Examen annule"); } }}
                        style={{ fontSize: 11, padding: "3px 9px", border: "none", borderRadius: 6, background: "#FEF2F2", color: "#EF4444", cursor: "pointer", fontWeight: 600 }}>
                        Annuler
                      </button>
                    </div>
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
