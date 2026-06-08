import { colors } from "../../theme";
import { useState, useEffect, useCallback, useRef } from "react";
import { SERVICES_HOPITAL } from "../../constants/hopital";
import Layout from "../../components/Layout";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../supabaseClient";
import {
  fetchLitsOccupes, insertConstante, fetchConstantes,
  insertNoteEvolution, fetchNotesEvolution,
  insertPerfusion, fetchPerfusionsActives, updatePerfusion,
  fetchPlanSoinsJour, insertPlanSoins, insertAdministration,
  fetchMembresPersonnel, insertCommandeInterne, fetchCommandesInternes,
} from "../../hooks/useMutations";
import { useMedicaments } from "../../hooks/useSupabaseData";

const ACCENT = "#10B981";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtHeure(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function tempsRestantPerfusion(heure_fin_prevue) {
  if (!heure_fin_prevue) return null;
  const diff = Math.round((new Date(heure_fin_prevue) - Date.now()) / 60000);
  if (diff < 0) return { label: "Fin depassee", urgent: true };
  if (diff < 30) return { label: `${diff} min restantes`, urgent: true };
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return { label: h > 0 ? `${h}h${m > 0 ? m + "min" : ""} restantes` : `${m} min restantes`, urgent: false };
}

function volumePerfuse(perfusion) {
  if (!perfusion.debit_ml_h) return null;
  const heuresEcoulees = (Date.now() - new Date(perfusion.heure_debut)) / 3600000;
  return Math.min(Math.round(heuresEcoulees * perfusion.debit_ml_h), perfusion.volume_ml);
}

function alerteConstante(key, value) {
  const v = Number(value);
  if (isNaN(v)) return null;
  const limites = {
    temperature:        { min: 35.5, max: 38.5, label: "Temperature" },
    tension_systolique: { min: 90,  max: 180,  label: "TA systolique" },
    tension_diastolique:{ min: 60,  max: 110,  label: "TA diastolique" },
    pouls:              { min: 50,  max: 120,  label: "Pouls" },
    saturation_o2:      { min: 92,  max: 100,  label: "SpO2" },
  };
  const lim = limites[key];
  if (!lim) return null;
  if (v < lim.min) return `${lim.label} trop bas (${v})`;
  if (v > lim.max) return `${lim.label} trop eleve (${v})`;
  return null;
}

const inputSt = { width: "100%", padding: "9px 11px", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", color: colors.navy, backgroundColor: colors.bgCard };
const labelSt = { display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginBottom: 5 };

const VOIES = ["Oral", "IV", "IM", "SC", "Topique", "Sublingual", "Inhalation"];
const HORAIRES_POSSIBLES = ["06:00","08:00","10:00","12:00","14:00","16:00","18:00","20:00","22:00","00:00"];
const SOLUTES = ["Ringer Lactate","Glucose 5%","Serum physiologique 0.9%","Glucose 10%","Bicarbonate 14","Glucose sale","Autre"];

// ── Modal constantes rapides ───────────────────────────────────────────────────
function ModalConstantes({ hospi, auth, onClose, onSaved }) {
  const [form, setForm] = useState({ temperature: "", tension_systolique: "", tension_diastolique: "", pouls: "", saturation_o2: "" });
  const [saving, setSaving] = useState(false);
  const alertes = Object.entries(form).map(([k, v]) => v ? alerteConstante(k, v) : null).filter(Boolean);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { patient_id: hospi.patient_id, etablissement_id: auth?.etablissement_id ?? null, saisi_par: auth?.user?.email ?? null };
      Object.entries(form).forEach(([k, v]) => { if (v !== "") payload[k] = Number(v); });
      await insertConstante(payload);
      onSaved(); onClose();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const nom = hospi.patients ? `${hospi.patients.prenom} ${hospi.patients.nom}` : "Patient";
  const fields = [
    { key: "temperature", label: "Temperature (°C)", placeholder: "37.0" },
    { key: "tension_systolique", label: "TA systolique (mmHg)", placeholder: "120" },
    { key: "tension_diastolique", label: "TA diastolique (mmHg)", placeholder: "80" },
    { key: "pouls", label: "Pouls (bpm)", placeholder: "75" },
    { key: "saturation_o2", label: "SpO2 (%)", placeholder: "98" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: colors.bgCard, borderRadius: 16, width: "100%", maxWidth: 420, padding: "24px 28px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.navy }}>Constantes — {nom}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted }}>x</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          {fields.map(({ key, label, placeholder }) => (
            <div key={key}>
              <label style={labelSt}>{label}</label>
              <input style={inputSt} type="number" value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} />
            </div>
          ))}
        </div>
        {alertes.length > 0 && (
          <div style={{ padding: "8px 12px", backgroundColor: "#FEF2F2", borderRadius: 8, marginBottom: 12 }}>
            {alertes.map((a, i) => <div key={i} style={{ fontSize: 12, color: "#DC2626", fontWeight: 600 }}>{a}</div>)}
          </div>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, background: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 10, background: saving ? "#D1D5DB" : ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal note rapide ──────────────────────────────────────────────────────────
function ModalNote({ hospi, auth, onClose, onSaved }) {
  const [contenu, setContenu] = useState("");
  const [saving, setSaving] = useState(false);
  const nom = hospi.patients ? `${hospi.patients.prenom} ${hospi.patients.nom}` : "Patient";

  const handleSave = async () => {
    if (!contenu.trim()) return;
    setSaving(true);
    try {
      await insertNoteEvolution({
        patient_id: hospi.patient_id,
        hospitalisation_id: hospi.id ?? null,
        etablissement_id: auth?.etablissement_id ?? null,
        auteur: auth?.user?.email ?? "",
        contenu: contenu.trim(),
        type: "transmission_infirmiere",
      });
      onSaved(); onClose();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: colors.bgCard, borderRadius: 16, width: "100%", maxWidth: 440, padding: "24px 28px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.navy }}>Note — {nom}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted }}>x</button>
        </div>
        <textarea value={contenu} onChange={(e) => setContenu(e.target.value)} placeholder="Observation, transmission, consigne..." rows={5}
          style={{ ...inputSt, resize: "vertical", lineHeight: 1.6, marginBottom: 14 }} />
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, background: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={handleSave} disabled={saving || !contenu.trim()} style={{ flex: 2, padding: 10, background: saving ? "#D1D5DB" : ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal poser perfusion ──────────────────────────────────────────────────────
function ModalPerfusion({ hospi, auth, onClose, onSaved }) {
  const [form, setForm] = useState({
    type_solute: "Ringer Lactate", volume_ml: "", debit_ml_h: "",
    heure_debut: new Date().toISOString().slice(0, 16),
    heure_fin_prevue: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (form.volume_ml && form.debit_ml_h && form.heure_debut) {
      const dureeHeures = Number(form.volume_ml) / Number(form.debit_ml_h);
      const fin = new Date(new Date(form.heure_debut).getTime() + dureeHeures * 3600000);
      setForm((f) => ({ ...f, heure_fin_prevue: fin.toISOString().slice(0, 16) }));
    }
  }, [form.volume_ml, form.debit_ml_h, form.heure_debut]); // eslint-disable-line

  const handleSave = async () => {
    if (!form.volume_ml) return alert("Saisissez le volume.");
    setSaving(true);
    try {
      await insertPerfusion({
        patient_id: hospi.patient_id,
        hospitalisation_id: hospi.id ?? null,
        etablissement_id: auth?.etablissement_id ?? null,
        infirmiere_email: auth?.user?.email ?? "",
        type_solute: form.type_solute === "Autre" ? form.autreNom ?? "Autre" : form.type_solute,
        volume_ml: Number(form.volume_ml),
        debit_ml_h: form.debit_ml_h ? Number(form.debit_ml_h) : null,
        heure_debut: new Date(form.heure_debut).toISOString(),
        heure_fin_prevue: form.heure_fin_prevue ? new Date(form.heure_fin_prevue).toISOString() : null,
        notes: form.notes || null,
        statut: "en_cours",
      });
      onSaved(); onClose();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const nom = hospi.patients ? `${hospi.patients.prenom} ${hospi.patients.nom}` : "Patient";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: colors.bgCard, borderRadius: 16, width: "100%", maxWidth: 480, padding: "24px 28px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.navy }}>Poser une perfusion — {nom}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted }}>x</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={labelSt}>Type de solute</label>
            <select style={inputSt} value={form.type_solute} onChange={(e) => set("type_solute")(e.target.value)}>
              {SOLUTES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {form.type_solute === "Autre" && (
            <div style={{ gridColumn: "1/-1" }}>
              <label style={labelSt}>Nom du solute</label>
              <input style={inputSt} value={form.autreNom ?? ""} onChange={(e) => setForm((f) => ({ ...f, autreNom: e.target.value }))} placeholder="Ex: Mannitol 20%" />
            </div>
          )}
          <div>
            <label style={labelSt}>Volume total (mL)</label>
            <input style={inputSt} type="number" min="1" value={form.volume_ml} onChange={(e) => set("volume_ml")(e.target.value)} placeholder="500" />
          </div>
          <div>
            <label style={labelSt}>Debit (mL/h)</label>
            <input style={inputSt} type="number" min="1" value={form.debit_ml_h} onChange={(e) => set("debit_ml_h")(e.target.value)} placeholder="125" />
          </div>
          <div>
            <label style={labelSt}>Heure de debut</label>
            <input style={inputSt} type="datetime-local" value={form.heure_debut} onChange={(e) => set("heure_debut")(e.target.value)} />
          </div>
          <div>
            <label style={labelSt}>Heure fin prevue (calculee)</label>
            <input style={{ ...inputSt, backgroundColor: colors.bgSurface, color: colors.textMuted }} value={form.heure_fin_prevue} readOnly />
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelSt}>Notes (optionnel)</label>
          <textarea style={{ ...inputSt, resize: "vertical" }} rows={2} value={form.notes} onChange={(e) => set("notes")(e.target.value)} placeholder="Ex: Voie sous-claviere gauche, regler a 41 gouttes/min" />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, background: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 10, background: saving ? "#D1D5DB" : ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "Enregistrement..." : "Poser la perfusion"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal ajouter plan de soins ────────────────────────────────────────────────
function ModalPlanSoins({ litsOccupes, auth, onClose, onSaved }) {
  const [form, setForm] = useState({ patient_id: "", medicament_nom: "", dose: "", voie: "Oral", horaires: [], date_debut: new Date().toISOString().slice(0,10), date_fin: "", prescripteur: "" });
  const [saving, setSaving] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleHoraire = (h) => setForm((f) => ({
    ...f,
    horaires: f.horaires.includes(h) ? f.horaires.filter((x) => x !== h) : [...f.horaires, h].sort(),
  }));

  const handleSave = async () => {
    if (!form.patient_id || !form.medicament_nom || !form.dose || form.horaires.length === 0) return alert("Remplissez tous les champs obligatoires et selectionnez au moins un horaire.");
    setSaving(true);
    try {
      await insertPlanSoins({
        patient_id: form.patient_id,
        etablissement_id: auth?.etablissement_id ?? null,
        medicament_nom: form.medicament_nom,
        dose: form.dose,
        voie: form.voie,
        horaires: form.horaires,
        date_debut: form.date_debut,
        date_fin: form.date_fin || null,
        prescripteur: form.prescripteur || null,
        actif: true,
      });
      onSaved(); onClose();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: colors.bgCard, borderRadius: 16, width: "100%", maxWidth: 520, padding: "24px 28px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.navy }}>Ajouter au plan de soins</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted }}>x</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={labelSt}>Patient *</label>
            <select style={inputSt} value={form.patient_id} onChange={(e) => set("patient_id")(e.target.value)}>
              <option value="">-- Selectionner --</option>
              {litsOccupes.map((h) => <option key={h.patient_id} value={h.patient_id}>{h.patients?.prenom} {h.patients?.nom} — Lit {h.lit ?? "?"}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={labelSt}>Medicament *</label>
            <input style={inputSt} value={form.medicament_nom} onChange={(e) => set("medicament_nom")(e.target.value)} placeholder="Ex: Paracetamol 1g, Amoxicilline 500mg" />
          </div>
          <div>
            <label style={labelSt}>Dose *</label>
            <input style={inputSt} value={form.dose} onChange={(e) => set("dose")(e.target.value)} placeholder="Ex: 1 comprime, 500mg" />
          </div>
          <div>
            <label style={labelSt}>Voie *</label>
            <select style={inputSt} value={form.voie} onChange={(e) => set("voie")(e.target.value)}>
              {VOIES.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label style={labelSt}>Date debut</label>
            <input style={inputSt} type="date" value={form.date_debut} onChange={(e) => set("date_debut")(e.target.value)} />
          </div>
          <div>
            <label style={labelSt}>Date fin (optionnel)</label>
            <input style={inputSt} type="date" value={form.date_fin} onChange={(e) => set("date_fin")(e.target.value)} />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={labelSt}>Prescripteur</label>
            <input style={inputSt} value={form.prescripteur} onChange={(e) => set("prescripteur")(e.target.value)} placeholder="Dr. Nom" />
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ ...labelSt, marginBottom: 8 }}>Horaires * (cocher les creneaux)</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {HORAIRES_POSSIBLES.map((h) => {
              const sel = form.horaires.includes(h);
              return (
                <button key={h} onClick={() => toggleHoraire(h)} style={{ padding: "5px 11px", borderRadius: 8, border: `1.5px solid ${sel ? ACCENT : colors.border}`, backgroundColor: sel ? ACCENT : colors.bgSurface, color: sel ? "white" : colors.text, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {h}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, background: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 10, background: saving ? "#D1D5DB" : ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "Enregistrement..." : "Ajouter au plan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Section demande de médicament (infirmière / aide-soignant) ────────────────
function DemanderMedicament({ auth, etabId, serviceFil }) {
  const { success } = useToast();
  const { data: medicaments } = useMedicaments();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ medicament_id: "", medicament_nom: "", autre: false, autreNom: "", quantite: 1, motif: "" });
  const [saving, setSaving] = useState(false);
  const [mesDemandes, setMesDemandes] = useState([]);

  const STATUT_LABEL = { en_attente: "En attente", approuvee: "Approuvee", servie: "Servie", refusee: "Refusee" };
  const STATUT_COLOR = { en_attente: "#D97706", approuvee: "#16A34A", servie: "#2563EB", refusee: "#EF4444" };

  const loadDemandes = useCallback(async () => {
    if (!etabId || !auth?.user?.email) return;
    const data = await fetchCommandesInternes(etabId);
    setMesDemandes(data.filter((c) => c.demandeur_email === auth.user.email).slice(0, 5));
  }, [etabId, auth?.user?.email]); // eslint-disable-line

  useEffect(() => { loadDemandes(); }, [loadDemandes]);

  const handleSend = async () => {
    const nom = form.autre ? form.autreNom.trim() : medicaments.find((m) => m.id === form.medicament_id)?.nom ?? "";
    if (!nom) return alert("Selectionnez ou saisissez un medicament.");
    if (!form.quantite || Number(form.quantite) < 1) return alert("Quantite invalide.");
    setSaving(true);
    try {
      await insertCommandeInterne({
        etablissement_id: etabId ?? null,
        demandeur_email: auth?.user?.email ?? "",
        demandeur_service: serviceFil || null,
        medicament_id: !form.autre && form.medicament_id ? form.medicament_id : null,
        medicament_nom: nom,
        quantite_demandee: Number(form.quantite),
        motif: form.motif || null,
        statut: "en_attente",
      });
      success("Demande envoyee au pharmacien");
      setForm({ medicament_id: "", medicament_nom: "", autre: false, autreNom: "", quantite: 1, motif: "" });
      setOpen(false);
      loadDemandes();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ backgroundColor: colors.bgCard, borderRadius: 12, padding: "16px 20px", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: open ? 14 : 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>Demander un medicament a la pharmacie</div>
        <button onClick={() => setOpen((v) => !v)} style={{ padding: "5px 12px", fontSize: 12, fontWeight: 700, backgroundColor: open ? colors.bgSurface : ACCENT, color: open ? colors.textSecondary : "white", border: `1px solid ${open ? colors.border : ACCENT}`, borderRadius: 7, cursor: "pointer" }}>
          {open ? "Fermer" : "+ Nouvelle demande"}
        </button>
      </div>

      {open && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={labelSt}>Medicament *</label>
            {!form.autre ? (
              <select style={inputSt} value={form.medicament_id} onChange={(e) => setForm((f) => ({ ...f, medicament_id: e.target.value }))}>
                <option value="">-- Selectionner --</option>
                {medicaments.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>
            ) : (
              <input style={inputSt} value={form.autreNom} onChange={(e) => setForm((f) => ({ ...f, autreNom: e.target.value }))} placeholder="Nom du medicament" />
            )}
            <button onClick={() => setForm((f) => ({ ...f, autre: !f.autre, medicament_id: "", autreNom: "" }))} style={{ background: "none", border: "none", fontSize: 11, color: "#6B7280", cursor: "pointer", marginTop: 4, textDecoration: "underline" }}>
              {form.autre ? "Choisir dans le stock" : "Saisir manuellement"}
            </button>
          </div>
          <div>
            <label style={labelSt}>Quantite *</label>
            <input style={inputSt} type="number" min="1" value={form.quantite} onChange={(e) => setForm((f) => ({ ...f, quantite: e.target.value }))} />
          </div>
          <div>
            <label style={labelSt}>Motif</label>
            <input style={inputSt} value={form.motif} onChange={(e) => setForm((f) => ({ ...f, motif: e.target.value }))} placeholder="Optionnel..." />
          </div>
          <div style={{ gridColumn: "1/-1", display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={() => setOpen(false)} style={{ padding: "7px 14px", background: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 12, cursor: "pointer" }}>Annuler</button>
            <button onClick={handleSend} disabled={saving} style={{ padding: "7px 16px", background: saving ? "#D1D5DB" : ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
              {saving ? "Envoi..." : "Envoyer la demande"}
            </button>
          </div>
        </div>
      )}

      {mesDemandes.length > 0 && (
        <div style={{ marginTop: open ? 0 : 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, textTransform: "uppercase", marginBottom: 6 }}>Mes 5 dernieres demandes</div>
          {mesDemandes.map((d) => (
            <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${colors.borderLight}`, fontSize: 12 }}>
              <div>
                <span style={{ fontWeight: 700, color: colors.navy }}>{d.medicament_nom}</span>
                <span style={{ color: colors.textMuted, marginLeft: 8 }}>x{d.quantite_demandee}</span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: STATUT_COLOR[d.statut] ?? "#6B7280" }}>{STATUT_LABEL[d.statut] ?? d.statut}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Onglet 1 — Mes patients ────────────────────────────────────────────────────
function OngletPatients({ litsOccupes, perfusionsActives, loading, auth, onRefresh }) {
  const { success } = useToast();
  const [serviceFil, setServiceFil] = useState("");
  const [modalConst, setModalConst] = useState(null);
  const [modalNote, setModalNote]   = useState(null);
  const [modalPerf, setModalPerf]   = useState(null);

  const filtres = serviceFil ? litsOccupes.filter((h) => h.service === serviceFil) : litsOccupes;
  const services = [...new Set(litsOccupes.map((h) => h.service).filter(Boolean))];

  return (
    <div>
      {modalConst && <ModalConstantes hospi={modalConst} auth={auth} onClose={() => setModalConst(null)} onSaved={() => { onRefresh(); success("Constantes enregistrees"); }} />}
      {modalNote  && <ModalNote hospi={modalNote} auth={auth} onClose={() => setModalNote(null)} onSaved={() => { onRefresh(); success("Note enregistree"); }} />}
      {modalPerf  && <ModalPerfusion hospi={modalPerf} auth={auth} onClose={() => setModalPerf(null)} onSaved={() => { onRefresh(); success("Perfusion posee"); }} />}

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={() => setServiceFil("")} style={{ padding: "5px 12px", borderRadius: 8, border: `1.5px solid ${!serviceFil ? ACCENT : colors.border}`, backgroundColor: !serviceFil ? ACCENT : colors.bgSurface, color: !serviceFil ? "white" : colors.text, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Tous</button>
        {services.map((s) => (
          <button key={s} onClick={() => setServiceFil(s)} style={{ padding: "5px 12px", borderRadius: 8, border: `1.5px solid ${serviceFil === s ? ACCENT : colors.border}`, backgroundColor: serviceFil === s ? ACCENT : colors.bgSurface, color: serviceFil === s ? "white" : colors.text, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{s}</button>
        ))}
      </div>

      {loading && [1,2,3].map((i) => <div key={i} style={{ height: 80, backgroundColor: colors.bgSurface, borderRadius: 10, marginBottom: 10, animation: "pulse 1.5s ease-in-out infinite" }} />)}
      {!loading && filtres.length === 0 && <div style={{ textAlign: "center", color: colors.textMuted, padding: 32, fontSize: 13 }}>Aucun patient hospitalise.</div>}

      <DemanderMedicament auth={auth} etabId={auth?.etablissement_id} serviceFil={serviceFil} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
        {!loading && filtres.map((h) => {
          const nom = h.patients ? `${h.patients.prenom} ${h.patients.nom}` : "Patient inconnu";
          const tc = h.patients?.triage;
          const triageCfg = { urgent: { color: "#EF4444", bg: "#FEF2F2" }, semi_urgent: { color: "#D97706", bg: "#FFFBEB" }, non_urgent: { color: ACCENT, bg: "#DCFCE7" } }[tc] ?? null;
          const perf = perfusionsActives.find((p) => p.patient_id === h.patient_id);
          const tr = perf ? tempsRestantPerfusion(perf.heure_fin_prevue) : null;

          return (
            <div key={h.id ?? h.patient_id} style={{ backgroundColor: colors.bgCard, borderRadius: 12, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderLeft: `4px solid ${triageCfg?.color ?? "#E5E7EB"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: colors.navy }}>{nom}</div>
                  <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{h.service ?? "—"} · Lit {h.lit ?? "?"} · Ch. {h.chambre ?? "?"}</div>
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {triageCfg && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, backgroundColor: triageCfg.bg, color: triageCfg.color }}>{tc?.replace("_"," ")}</span>}
                  {perf && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, backgroundColor: tr?.urgent ? "#FEF2F2" : "#EFF6FF", color: tr?.urgent ? "#EF4444" : "#2563EB", animation: tr?.urgent ? "pulse 1.5s infinite" : "none" }}>
                      {perf.type_solute} — {tr?.label ?? "En cours"}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button onClick={() => setModalConst(h)} style={{ flex: 1, padding: "6px 0", fontSize: 11, fontWeight: 700, backgroundColor: "#DCFCE7", color: "#16A34A", border: "none", borderRadius: 7, cursor: "pointer" }}>Constantes</button>
                <button onClick={() => setModalPerf(h)} style={{ flex: 1, padding: "6px 0", fontSize: 11, fontWeight: 700, backgroundColor: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 7, cursor: "pointer" }}>Perfusion</button>
                <button onClick={() => setModalNote(h)} style={{ flex: 1, padding: "6px 0", fontSize: 11, fontWeight: 700, backgroundColor: colors.bgSurface, color: colors.textSecondary, border: `1px solid ${colors.border}`, borderRadius: 7, cursor: "pointer" }}>Note</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Onglet 2 — Plan de soins ───────────────────────────────────────────────────
function OngletPlanSoins({ litsOccupes, auth, etabId }) {
  const { success } = useToast();
  const [planJour, setPlanJour] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(null); // plan_id + heure en cours

  const load = useCallback(async () => {
    if (!etabId) return;
    setLoading(true);
    setPlanJour(await fetchPlanSoinsJour(etabId));
    setLoading(false);
  }, [etabId]);

  useEffect(() => { load(); }, [load]);

  const today = new Date().toISOString().slice(0, 10);
  const heureActuelle = new Date().toTimeString().slice(0, 5);

  // Grouper par horaire
  const groups = {};
  planJour.forEach((plan) => {
    (plan.horaires ?? []).forEach((heure) => {
      if (!groups[heure]) groups[heure] = [];
      const dejaDonne = (plan.administrations_medicament ?? []).some((a) =>
        a.heure_prevue === heure && new Date(a.heure_reelle).toISOString().slice(0, 10) === today
      );
      groups[heure].push({ plan, heure, dejaDonne, patient: plan.patients });
    });
  });
  const horairesOrdonnes = Object.keys(groups).sort();

  async function administrer(plan, heure, statut = "administre") {
    setSaving(`${plan.id}-${heure}`);
    try {
      await insertAdministration({
        plan_soins_id: plan.id, patient_id: plan.patient_id,
        etablissement_id: etabId, infirmiere_email: auth?.user?.email ?? "",
        medicament_nom: plan.medicament_nom, dose: plan.dose, voie: plan.voie,
        heure_prevue: heure, statut,
      });
      success(`${plan.medicament_nom} — ${statut}`);
      load();
    } catch (e) { alert(e.message); }
    finally { setSaving(null); }
  }

  if (loading) return <div style={{ textAlign: "center", color: colors.textMuted, padding: 40 }}>Chargement...</div>;

  return (
    <div>
      {showModal && <ModalPlanSoins litsOccupes={litsOccupes} auth={auth} onClose={() => setShowModal(false)} onSaved={() => { load(); success("Medicament ajoute au plan"); }} />}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>Plan de soins du jour — {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</div>
        <button onClick={() => setShowModal(true)} style={{ padding: "7px 16px", backgroundColor: ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Ajouter au plan</button>
      </div>

      {horairesOrdonnes.length === 0 && <div style={{ textAlign: "center", color: colors.textMuted, padding: 40, fontSize: 13 }}>Aucun medicament dans le plan de soins du jour.</div>}

      {horairesOrdonnes.map((heure) => {
        const items = groups[heure];
        const nbRestants = items.filter((x) => !x.dejaDonne).length;
        const isPasse = heure < heureActuelle;
        const isCourant = Math.abs(
          new Date(`1970-01-01T${heure}:00`) - new Date(`1970-01-01T${heureActuelle}:00`)
        ) <= 30 * 60000;

        return (
          <div key={heure} style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: isCourant ? ACCENT : isPasse ? colors.textMuted : colors.navy }}>{heure}</div>
              {isCourant && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 8, backgroundColor: "#DCFCE7", color: "#16A34A", fontWeight: 700 }}>MAINTENANT</span>}
              {nbRestants > 0 && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 8, backgroundColor: "#FEF3C7", color: "#92400E", fontWeight: 700 }}>{nbRestants} restant(s)</span>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {items.map(({ plan, dejaDonne, patient }) => {
                const key = `${plan.id}-${heure}`;
                const isSaving = saving === key;
                return (
                  <div key={key} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10,
                    backgroundColor: dejaDonne ? "#F0FDF4" : isPasse && !isCourant ? "#F9FAFB" : colors.bgCard,
                    border: `1px solid ${dejaDonne ? "#86EFAC" : colors.border}`,
                    opacity: dejaDonne ? 0.75 : 1,
                  }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: colors.navy, textDecoration: dejaDonne ? "line-through" : "none" }}>{plan.medicament_nom}</span>
                      <span style={{ fontSize: 12, color: colors.textSecondary, marginLeft: 8 }}>{plan.dose} · {plan.voie}</span>
                      <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{patient?.prenom} {patient?.nom}</div>
                    </div>
                    {dejaDonne
                      ? <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, backgroundColor: "#DCFCE7", color: "#16A34A", fontWeight: 600 }}>Administre</span>
                      : (
                        <div style={{ display: "flex", gap: 5 }}>
                          <button onClick={() => administrer(plan, heure, "administre")} disabled={isSaving} style={{ padding: "5px 10px", fontSize: 11, fontWeight: 700, backgroundColor: ACCENT, color: "white", border: "none", borderRadius: 6, cursor: isSaving ? "wait" : "pointer" }}>{isSaving ? "..." : "Administrer"}</button>
                          <button onClick={() => administrer(plan, heure, "reporte")} disabled={isSaving} style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600, backgroundColor: colors.bgSurface, color: colors.textSecondary, border: `1px solid ${colors.border}`, borderRadius: 6, cursor: "pointer" }}>Reporter</button>
                          <button onClick={() => administrer(plan, heure, "omis")} disabled={isSaving} style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600, backgroundColor: "#FEF2F2", color: "#DC2626", border: "none", borderRadius: 6, cursor: "pointer" }}>Omis</button>
                        </div>
                      )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Onglet 3 — Perfusions ──────────────────────────────────────────────────────
function OngletPerfusions({ perfusionsActives, litsOccupes, loading, auth, etabId, onRefresh }) {
  const { success } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editDebit, setEditDebit] = useState(null);
  const [newDebit, setNewDebit] = useState("");
  const [tick, setTick] = useState(0);

  // Refresh des temps restants toutes les 60s sans re-fetch
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60000);
    return () => clearInterval(t);
  }, []);

  // Realtime sur les perfusions
  useEffect(() => {
    if (!etabId) return;
    const channel = supabase.channel("perfusions-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "perfusions" }, () => onRefresh())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [etabId, onRefresh]);

  const today = new Date().toISOString().slice(0, 10);
  const finDepassee = perfusionsActives.filter((p) => p.heure_fin_prevue && new Date(p.heure_fin_prevue) < new Date());

  const handleTerminer = async (id) => {
    try {
      await updatePerfusion(id, { statut: "terminee", heure_fin_reelle: new Date().toISOString() });
      success("Perfusion terminee"); onRefresh();
    } catch (e) { alert(e.message); }
  };

  const handleModifierDebit = async () => {
    if (!newDebit || !editDebit) return;
    try {
      const { heure_debut, volume_ml } = editDebit;
      const newFin = new Date(new Date(heure_debut).getTime() + (volume_ml / Number(newDebit)) * 3600000).toISOString();
      await updatePerfusion(editDebit.id, { debit_ml_h: Number(newDebit), heure_fin_prevue: newFin });
      success("Debit modifie"); setEditDebit(null); onRefresh();
    } catch (e) { alert(e.message); }
  };

  // Perfusions terminées aujourd'hui (à charger séparément)
  const [termineesJour, setTermineesJour] = useState([]);
  useEffect(() => {
    if (!etabId) return;
    supabase.from("perfusions").select("*, patients(prenom, nom)").eq("etablissement_id", etabId).eq("statut", "terminee").gte("heure_fin_reelle", today + "T00:00:00").order("heure_fin_reelle", { ascending: false }).then(({ data }) => setTermineesJour(data ?? []));
  }, [etabId, today, tick]); // eslint-disable-line

  return (
    <div>
      {showModal && (
        <ModalPerfusion
          hospi={litsOccupes[0] ?? { patient_id: "", patients: null, id: null }}
          auth={auth}
          onClose={() => setShowModal(false)}
          onSaved={() => { success("Perfusion posee"); onRefresh(); setShowModal(false); }}
        />
      )}
      {editDebit && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: colors.bgCard, borderRadius: 14, padding: 24, width: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: colors.navy }}>Modifier le debit — {editDebit.patients?.prenom} {editDebit.patients?.nom}</h3>
            <label style={labelSt}>Nouveau debit (mL/h)</label>
            <input style={{ ...inputSt, marginBottom: 14 }} type="number" value={newDebit} onChange={(e) => setNewDebit(e.target.value)} placeholder={String(editDebit.debit_ml_h ?? "")} autoFocus />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setEditDebit(null)} style={{ flex: 1, padding: 9, background: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Annuler</button>
              <button onClick={handleModifierDebit} style={{ flex: 2, padding: 9, background: ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Modifier</button>
            </div>
          </div>
        </div>
      )}

      <div className="kpi-row" style={{ marginBottom: 16 }}>
        {[
          { label: "En cours",        value: perfusionsActives.length,  color: "#3B82F6" },
          { label: "Fin depassee",    value: finDepassee.length,         color: finDepassee.length > 0 ? "#EF4444" : "#9CA3AF" },
          { label: "Terminees auj.",  value: termineesJour.length,       color: ACCENT },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: colors.bgCard, padding: "12px 16px", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>Perfusions en cours ({perfusionsActives.length})</div>
        <button onClick={() => setShowModal(true)} style={{ padding: "7px 16px", backgroundColor: ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Poser une perfusion</button>
      </div>

      {loading && <div style={{ textAlign: "center", color: colors.textMuted, padding: 32 }}>Chargement...</div>}
      {!loading && perfusionsActives.length === 0 && <div style={{ textAlign: "center", color: colors.textMuted, padding: 32, fontSize: 13 }}>Aucune perfusion en cours.</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        {perfusionsActives.map((p) => {
          const vol = volumePerfuse(p);
          const pct = vol != null ? Math.min(100, Math.round((vol / p.volume_ml) * 100)) : null;
          const tr = tempsRestantPerfusion(p.heure_fin_prevue);
          return (
            <div key={p.id} style={{ backgroundColor: colors.bgCard, borderRadius: 12, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderLeft: `4px solid ${tr?.urgent ? "#EF4444" : "#3B82F6"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>{p.patients?.prenom} {p.patients?.nom}</div>
                  <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{p.type_solute} {p.volume_ml}mL{p.debit_ml_h ? ` · ${p.debit_ml_h}mL/h` : ""}</div>
                  <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>Debut : {fmtHeure(p.heure_debut)} · Fin prevue : {fmtHeure(p.heure_fin_prevue)}</div>
                </div>
                {tr && (
                  <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 8, backgroundColor: tr.urgent ? "#FEF2F2" : "#EFF6FF", color: tr.urgent ? "#DC2626" : "#2563EB", fontWeight: 700, animation: tr.urgent ? "pulse 1.5s infinite" : "none" }}>
                    {tr.label}
                  </span>
                )}
              </div>
              {pct != null && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>
                    <span>{vol}mL perfuses</span><span>{pct}%</span>
                  </div>
                  <div style={{ height: 6, backgroundColor: "#E5E7EB", borderRadius: 4 }}>
                    <div style={{ height: "100%", width: `${pct}%`, backgroundColor: pct >= 90 ? "#EF4444" : "#3B82F6", borderRadius: 4, transition: "width 0.3s" }} />
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => handleTerminer(p.id)} style={{ padding: "5px 12px", fontSize: 11, fontWeight: 700, backgroundColor: "#DCFCE7", color: "#16A34A", border: "none", borderRadius: 6, cursor: "pointer" }}>Terminer</button>
                <button onClick={() => { setEditDebit(p); setNewDebit(String(p.debit_ml_h ?? "")); }} style={{ padding: "5px 12px", fontSize: 11, fontWeight: 600, backgroundColor: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 6, cursor: "pointer" }}>Modifier debit</button>
              </div>
              {p.notes && <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 8, fontStyle: "italic" }}>{p.notes}</div>}
            </div>
          );
        })}
      </div>

      {termineesJour.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: colors.textSecondary, marginBottom: 10 }}>Terminees aujourd'hui ({termineesJour.length})</div>
          {termineesJour.map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", backgroundColor: colors.bgSurface, borderRadius: 8, marginBottom: 6, fontSize: 12 }}>
              <span style={{ fontWeight: 600, color: colors.navy }}>{p.patients?.prenom} {p.patients?.nom}</span>
              <span style={{ color: colors.textMuted }}>{p.type_solute} {p.volume_ml}mL · terminee a {fmtHeure(p.heure_fin_reelle)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Onglet 4 — Transmissions ───────────────────────────────────────────────────
function OngletTransmissions({ litsOccupes, auth, etabId }) {
  const { success } = useToast();
  const [transmissions, setTransmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [patientId, setPatientId] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!etabId) return;
    setLoading(true);
    const { data } = await supabase.from("notes_evolution").select("*, patients(prenom, nom)").eq("etablissement_id", etabId).eq("type", "transmission_infirmiere").order("created_at", { ascending: false }).limit(20);
    setTransmissions(data ?? []);
    setLoading(false);
  }, [etabId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!patientId || !message.trim()) return;
    setSaving(true);
    try {
      const hosp = litsOccupes.find((h) => h.patient_id === patientId);
      await insertNoteEvolution({
        patient_id: patientId,
        hospitalisation_id: hosp?.id ?? null,
        etablissement_id: etabId,
        auteur: auth?.user?.email ?? "",
        contenu: message.trim(),
        type: "transmission_infirmiere",
      });
      success("Transmission enregistree"); setMessage(""); setPatientId(""); load();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const seuil4h = new Date(Date.now() - 4 * 3600000).toISOString();

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      {/* Saisie */}
      <div style={{ backgroundColor: colors.bgCard, borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy, marginBottom: 14 }}>Laisser une transmission</div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelSt}>Patient hospitalise</label>
          <select style={{ ...inputSt, cursor: "pointer" }} value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            <option value="">-- Selectionner --</option>
            {litsOccupes.map((h) => <option key={h.patient_id} value={h.patient_id}>{h.patients?.prenom} {h.patients?.nom} — {h.service ?? "—"} Lit {h.lit ?? "?"}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelSt}>Message *</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} placeholder="Consignes pour la prochaine infirmiere...&#10;Ex: Patient agite depuis 14h, alarme perf a verifier, signes d'essoufflement a surveiller." style={{ ...inputSt, resize: "vertical", lineHeight: 1.6 }} />
        </div>
        <button onClick={handleSave} disabled={saving || !patientId || !message.trim()} style={{ width: "100%", padding: 10, backgroundColor: saving ? "#D1D5DB" : ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
          {saving ? "Enregistrement..." : "Enregistrer la transmission"}
        </button>
      </div>

      {/* Historique */}
      <div style={{ backgroundColor: colors.bgCard, borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy, marginBottom: 14 }}>Transmissions recentes du service</div>
        {loading && <div style={{ textAlign: "center", color: colors.textMuted, padding: 24 }}>Chargement...</div>}
        {!loading && transmissions.length === 0 && <div style={{ textAlign: "center", color: colors.textMuted, padding: 24, fontSize: 13 }}>Aucune transmission enregistree.</div>}
        <div style={{ maxHeight: 400, overflowY: "auto" }}>
          {transmissions.map((t) => {
            const isNew = t.created_at > seuil4h;
            return (
              <div key={t.id} style={{ padding: "10px 12px", backgroundColor: isNew ? "#F0FDF4" : colors.bgSurface, borderRadius: 8, marginBottom: 8, borderLeft: `3px solid ${isNew ? ACCENT : "#E5E7EB"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: colors.navy }}>{t.patients?.prenom} {t.patients?.nom}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {isNew && <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, backgroundColor: "#DCFCE7", color: "#16A34A" }}>Nouveau</span>}
                    <span style={{ fontSize: 11, color: colors.textMuted }}>{fmtHeure(t.created_at)} {fmtDate(t.created_at)}</span>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: colors.text, lineHeight: 1.5 }}>{t.contenu}</div>
                <div style={{ fontSize: 10, color: colors.textMuted, marginTop: 4 }}>{t.auteur}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function MonService() {
  const { auth } = useAuth();
  const { toasts } = useToast();
  const [litsOccupes, setLitsOccupes]       = useState([]);
  const [perfusionsActives, setPerfusionsActives] = useState([]);
  const [loading, setLoading]               = useState(true);
  const [onglet, setOnglet]                 = useState("patients");
  const [etabId, setEtabId]                 = useState(auth?.etablissement_id ?? null);

  useEffect(() => {
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
  }, [auth]);

  const load = useCallback(async () => {
    if (!etabId) return;
    setLoading(true);
    const [lits, perfs] = await Promise.all([
      fetchLitsOccupes(etabId),
      fetchPerfusionsActives(etabId),
    ]);
    setLitsOccupes(lits ?? []);
    setPerfusionsActives(perfs ?? []);
    setLoading(false);
  }, [etabId]);

  useEffect(() => { load(); }, [load]);

  const finDepassee = perfusionsActives.filter((p) => p.heure_fin_prevue && new Date(p.heure_fin_prevue) < new Date()).length;

  const ONGLETS = [
    { key: "patients",      label: `Mes patients (${litsOccupes.length})` },
    { key: "plan",          label: "Plan de soins" },
    { key: "perfusions",    label: `Perfusions${finDepassee > 0 ? ` (${finDepassee} fin depassee)` : ""}` },
    { key: "transmissions", label: "Transmissions" },
  ];

  return (
    <Layout title="Mon service" subtitle="Tableau de bord infirmier — patients, soins, perfusions, transmissions">
      <Toast toasts={toasts} />
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {finDepassee > 0 && (
        <div style={{ padding: "10px 16px", backgroundColor: "#FEF2F2", border: "1.5px solid #EF4444", borderRadius: 10, marginBottom: 16, fontSize: 13, color: "#DC2626", fontWeight: 700 }}>
          {finDepassee} perfusion(s) dont la fin est depassee — verifier immediatement
        </div>
      )}

      <div style={{ display: "flex", gap: 2, marginBottom: 24, borderBottom: `2px solid ${colors.border}` }}>
        {ONGLETS.map((o) => (
          <button key={o.key} onClick={() => setOnglet(o.key)} style={{
            padding: "10px 18px", background: "none", border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: onglet === o.key ? 800 : 400,
            color: onglet === o.key ? ACCENT : colors.textSecondary,
            borderBottom: onglet === o.key ? `3px solid ${ACCENT}` : "3px solid transparent",
            marginBottom: -2, whiteSpace: "nowrap",
          }}>{o.label}</button>
        ))}
      </div>

      {onglet === "patients"      && <OngletPatients litsOccupes={litsOccupes} perfusionsActives={perfusionsActives} loading={loading} auth={auth} onRefresh={load} />}
      {onglet === "plan"          && <OngletPlanSoins litsOccupes={litsOccupes} auth={auth} etabId={etabId} />}
      {onglet === "perfusions"    && <OngletPerfusions perfusionsActives={perfusionsActives} litsOccupes={litsOccupes} loading={loading} auth={auth} etabId={etabId} onRefresh={load} />}
      {onglet === "transmissions" && <OngletTransmissions litsOccupes={litsOccupes} auth={auth} etabId={etabId} />}
    </Layout>
  );
}
