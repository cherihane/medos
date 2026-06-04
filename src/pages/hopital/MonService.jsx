import { colors } from "../../theme";
import { useState, useEffect, useCallback } from "react";
import Layout from "../../components/Layout";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../supabaseClient";
import {
  fetchLitsOccupes,
  insertConstante,
  insertNoteEvolution,
  fetchConsultationsJour,
  updateConsultation,
} from "../../hooks/useMutations";

const ACCENT = "#10B981";

function fmtHeure(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function minutesDepuis(iso) {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

function fmtMin(m) { return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`; }

const TRIAGE_CONFIG = {
  urgent:      { color: "#EF4444", bg: "#FEF2F2", label: "Urgent" },
  semi_urgent: { color: "#F59E0B", bg: "#FFFBEB", label: "Semi-urgent" },
  non_urgent:  { color: ACCENT,    bg: "#DCFCE7", label: "Non urgent" },
};

// ── Mini-modal constantes rapides ─────────────────────────────────────────────
function ModalConstantesRapides({ hospi, auth, onClose, onSaved }) {
  const [form, setForm] = useState({ temperature: "", tension_systolique: "", tension_diastolique: "", pouls: "", saturation_o2: "" });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { patient_id: hospi.patient_id, etablissement_id: auth?.etablissement_id ?? null, saisi_par: auth?.user?.email ?? null };
      ["temperature", "tension_systolique", "tension_diastolique", "pouls", "saturation_o2"].forEach((k) => {
        if (form[k] !== "") payload[k] = Number(form[k]);
      });
      await insertConstante(payload);
      onSaved();
      onClose();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const inputSt = { width: "100%", padding: "8px 10px", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" };
  const labelSt = { display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginBottom: 4 };
  const nom = hospi.patients ? `${hospi.patients.prenom} ${hospi.patients.nom}` : "Patient";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 400, padding: "22px 24px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0A1628" }}>Constantes — {nom}</div>
            <div style={{ fontSize: 11, color: "#6B7280" }}>Lit {hospi.lit ?? "?"} — Ch. {hospi.chambre ?? "?"}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF" }}>x</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[
            { key: "temperature",        label: "Temperature (C)", placeholder: "37.2" },
            { key: "pouls",              label: "Pouls (bpm)",      placeholder: "72" },
            { key: "tension_systolique", label: "TA sys. (mmHg)",   placeholder: "120" },
            { key: "tension_diastolique",label: "TA dias. (mmHg)",  placeholder: "80" },
            { key: "saturation_o2",      label: "SpO2 (%)",         placeholder: "98" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label style={labelSt}>{label}</label>
              <input style={inputSt} type="number" placeholder={placeholder}
                value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "9px 0", background: "#F3F4F6", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 2, padding: "9px 0", background: saving ? "#D1D5DB" : ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "Enregistrement..." : "Sauvegarder"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Mini-modal note d'evolution ───────────────────────────────────────────────
function ModalNoteRapide({ hospi, auth, onClose, onSaved }) {
  const [form, setForm] = useState({ type: "observation", contenu: "" });
  const [saving, setSaving] = useState(false);
  const nom = hospi.patients ? `${hospi.patients.prenom} ${hospi.patients.nom}` : "Patient";

  const handleSave = async () => {
    if (!form.contenu.trim()) return alert("Le contenu est obligatoire.");
    setSaving(true);
    try {
      await insertNoteEvolution({
        patient_id: hospi.patient_id,
        hospitalisation_id: hospi.id,
        etablissement_id: auth?.etablissement_id ?? null,
        auteur: auth?.user?.email ?? "Inconnu",
        contenu: form.contenu,
        type: form.type,
      });
      onSaved();
      onClose();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const inputSt = { width: "100%", padding: "8px 10px", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" };
  const labelSt = { display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginBottom: 4 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 400, padding: "22px 24px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#0A1628" }}>Note — {nom}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF" }}>x</button>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelSt}>Type de note</label>
          <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            style={{ ...inputSt, background: "white" }}>
            <option value="observation">Observation</option>
            <option value="transmission">Transmission infirmiere</option>
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelSt}>Contenu *</label>
          <textarea value={form.contenu} onChange={(e) => setForm((f) => ({ ...f, contenu: e.target.value }))}
            style={{ ...inputSt, resize: "vertical", minHeight: 100 }} placeholder="Etat du patient, observations..." />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "9px 0", background: "#F3F4F6", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 2, padding: "9px 0", background: saving ? "#D1D5DB" : ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "Enregistrement..." : "Enregistrer la note"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Carte patient hospitalise ─────────────────────────────────────────────────
function CartePatient({ hospi, auth, onRefresh }) {
  const [showConstantes, setShowConstantes] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const nom = hospi.patients ? `${hospi.patients.prenom} ${hospi.patients.nom}` : "Patient inconnu";
  const triage = hospi.patients?.triage;
  const t = TRIAGE_CONFIG[triage];

  return (
    <>
      {showConstantes && (
        <ModalConstantesRapides hospi={hospi} auth={auth} onClose={() => setShowConstantes(false)} onSaved={onRefresh} />
      )}
      {showNote && (
        <ModalNoteRapide hospi={hospi} auth={auth} onClose={() => setShowNote(false)} onSaved={onRefresh} />
      )}
      <div style={{ backgroundColor: "white", borderRadius: 10, padding: "12px 16px", border: `1px solid ${colors.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0A1628" }}>{nom}</div>
            <div style={{ fontSize: 11, color: "#6B7280" }}>
              {hospi.service ?? "—"} — Lit {hospi.lit ?? "?"} — Ch. {hospi.chambre ?? "?"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {hospi.constante_manquante && (
              <span style={{ fontSize: 10, fontWeight: 800, color: "#EF4444", backgroundColor: "#FEF2F2", padding: "2px 7px", borderRadius: 6 }}>Constante manquante</span>
            )}
            {hospi.transmission_manquante && (
              <span style={{ fontSize: 10, fontWeight: 800, color: "#D97706", backgroundColor: "#FFFBEB", padding: "2px 7px", borderRadius: 6 }}>Transmission en attente</span>
            )}
            {t && (
              <span style={{ fontSize: 10, fontWeight: 800, color: t.color, backgroundColor: t.bg, padding: "2px 7px", borderRadius: 6 }}>{t.label}</span>
            )}
          </div>
        </div>
        <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 10 }}>
          Entree : {hospi.date_entree ? new Date(hospi.date_entree).toLocaleDateString("fr-FR") : "—"}
          {hospi.date_sortie_prevue ? ` — Sortie prevue : ${new Date(hospi.date_sortie_prevue).toLocaleDateString("fr-FR")}` : ""}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setShowConstantes(true)}
            style={{ fontSize: 11, padding: "4px 11px", border: "none", borderRadius: 7, background: "#DBEAFE", color: "#2563EB", cursor: "pointer", fontWeight: 700 }}>
            Prendre les constantes
          </button>
          <button onClick={() => setShowNote(true)}
            style={{ fontSize: 11, padding: "4px 11px", border: "none", borderRadius: 7, background: "#DCFCE7", color: "#16A34A", cursor: "pointer", fontWeight: 700 }}>
            Ajouter une note
          </button>
        </div>
      </div>
    </>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function MonService() {
  const { auth } = useAuth();
  const { toasts, success } = useToast();
  const [lits, setLits] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [alertes, setAlertes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [etabId, setEtabId] = useState(auth?.etablissement_id ?? null);
  const [tick, setTick] = useState(0);

  const todayISO = new Date().toISOString().slice(0, 10);

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

    const maintenant = Date.now();
    const [litsData, consultData, alertesData] = await Promise.all([
      fetchLitsOccupes(eid),
      fetchConsultationsJour(eid, todayISO),
      supabase.from("alertes").select("id, titre, severite, created_at").eq("resolu", false).order("created_at", { ascending: false }).limit(5).then((r) => r.data ?? []),
    ]);

    // Verifier constantes manquantes (6h) et transmissions manquantes (12h)
    const patientIds = litsData.map((h) => h.patient_id);
    const seuilConst = new Date(maintenant - 6 * 60 * 60 * 1000).toISOString();
    const seuilTrans = new Date(maintenant - 12 * 60 * 60 * 1000).toISOString();

    const [constRecentes, notesRecentes] = await Promise.all([
      patientIds.length > 0
        ? supabase.from("constantes_vitales").select("patient_id").in("patient_id", patientIds).gte("created_at", seuilConst).then((r) => new Set((r.data ?? []).map((c) => c.patient_id)))
        : Promise.resolve(new Set()),
      patientIds.length > 0
        ? supabase.from("notes_evolution").select("patient_id").in("patient_id", patientIds).eq("type", "transmission").gte("created_at", seuilTrans).then((r) => new Set((r.data ?? []).map((n) => n.patient_id)))
        : Promise.resolve(new Set()),
    ]);

    const litsAvecBadges = litsData.map((h) => ({
      ...h,
      constante_manquante:   !constRecentes.has(h.patient_id),
      transmission_manquante: !notesRecentes.has(h.patient_id),
    }));

    setLits(litsAvecBadges);
    setConsultations(consultData.filter((c) => c.statut === "en_attente" || c.statut === "en_cours"));
    setAlertes(alertesData);
    setLoading(false);
  }, [auth, todayISO]);

  useEffect(() => { load(); }, [load]);

  const handleAppelerSuivant = async () => {
    const prochain = consultations.find((c) => c.statut === "en_attente");
    if (!prochain) return;
    const updated = { statut: "en_cours", heure_debut: new Date().toISOString() };
    await updateConsultation(prochain.id, updated);
    setConsultations((prev) => prev.map((c) => c.id === prochain.id ? { ...c, ...updated } : c));
    success("Prochain patient appele");
  };

  const enAttente = consultations.filter((c) => c.statut === "en_attente");
  const enCours   = consultations.filter((c) => c.statut === "en_cours");
  const nbAlertesUrgentes = alertes.filter((a) => a.severite === "critique").length;

  return (
    <Layout title="Mon service" subtitle="Cockpit infirmier — Patients et file d'attente">
      <Toast toasts={toasts} />

      {/* Section 1 — Patients hospitalises */}
      <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "20px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: colors.navy }}>Patients hospitalises</h3>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {lits.filter((h) => h.constante_manquante).length > 0 && (
              <span style={{ fontSize: 11, fontWeight: 800, color: "#EF4444", backgroundColor: "#FEF2F2", padding: "3px 10px", borderRadius: 8 }}>
                {lits.filter((h) => h.constante_manquante).length} constante(s) manquante(s)
              </span>
            )}
            <span style={{ fontSize: 12, color: colors.textSecondary }}>{lits.length} patient(s)</span>
          </div>
        </div>
        {loading && <div style={{ color: colors.textMuted, fontSize: 13 }}>Chargement...</div>}
        {!loading && lits.length === 0 && (
          <div style={{ fontSize: 13, color: colors.textMuted, textAlign: "center", padding: "20px 0" }}>Aucun patient hospitalise actuellement</div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 10 }}>
          {!loading && lits.map((h) => (
            <CartePatient key={h.id} hospi={h} auth={auth} onRefresh={() => { load(); success("Enregistre"); }} />
          ))}
        </div>
      </div>

      {/* Sections 2 + 3 — File + Alertes */}
      <div className="dash-grid-2">
        {/* File d'attente */}
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "20px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: colors.navy }}>File d'attente du jour</h3>
            {enAttente.length > 0 && (
              <button onClick={handleAppelerSuivant}
                style={{ padding: "6px 14px", background: "#3B82F6", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                Appeler le suivant
              </button>
            )}
          </div>
          {loading && <div style={{ color: colors.textMuted, fontSize: 13 }}>Chargement...</div>}
          {!loading && enCours.length === 0 && enAttente.length === 0 && (
            <div style={{ fontSize: 13, color: colors.textMuted, textAlign: "center", padding: "20px 0" }}>Aucune consultation ce jour</div>
          )}
          {!loading && enCours.map((c) => (
            <div key={c.id} style={{ padding: "10px 12px", borderRadius: 8, backgroundColor: "#EFF6FF", borderLeft: "3px solid #3B82F6", marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0A1628" }}>{c.patients ? `${c.patients.prenom} ${c.patients.nom}` : "—"}</div>
              <div style={{ fontSize: 11, color: "#2563EB", fontWeight: 600 }}>En cours — depuis {fmtMin(minutesDepuis(c.heure_debut))}</div>
              {c.motif && <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>{c.motif}</div>}
            </div>
          ))}
          {!loading && enAttente.map((c, i) => (
            <div key={c.id} style={{ padding: "10px 12px", borderRadius: 8, backgroundColor: i === 0 ? "#FFFBEB" : "#F8FAFC", borderLeft: `3px solid ${i === 0 ? "#F59E0B" : "#E5E7EB"}`, marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0A1628" }}>{c.patients ? `${c.patients.prenom} ${c.patients.nom}` : "—"}</div>
              <div style={{ fontSize: 11, color: "#9CA3AF" }}>Attente : {fmtMin(minutesDepuis(c.heure_arrivee))} — {c.service}</div>
              {c.motif && <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>{c.motif}</div>}
            </div>
          ))}
        </div>

        {/* Alertes */}
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "20px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: colors.navy }}>Alertes du jour</h3>
            {nbAlertesUrgentes > 0 && (
              <span style={{ fontSize: 11, fontWeight: 800, color: "#EF4444", backgroundColor: "#FEF2F2", padding: "3px 10px", borderRadius: 8 }}>{nbAlertesUrgentes} urgente(s)</span>
            )}
          </div>
          {loading && <div style={{ color: colors.textMuted, fontSize: 13 }}>Chargement...</div>}
          {!loading && alertes.length === 0 && (
            <div style={{ fontSize: 13, color: colors.textMuted, textAlign: "center", padding: "20px 0" }}>Aucune alerte active</div>
          )}
          {!loading && alertes.map((a) => {
            const est_critique = a.severite === "critique";
            return (
              <div key={a.id} style={{ padding: "10px 12px", borderRadius: 8, marginBottom: 8, backgroundColor: est_critique ? "#FEF2F2" : "#FFFBEB", borderLeft: `3px solid ${est_critique ? "#EF4444" : "#F59E0B"}` }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0A1628" }}>{a.titre}</div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                  {new Date(a.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            );
          })}
          <a href="/hopital/alertes" style={{ display: "block", textAlign: "center", marginTop: 12, fontSize: 12, color: "#3B82F6", fontWeight: 600, textDecoration: "none" }}>
            Voir toutes les alertes
          </a>
        </div>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </Layout>
  );
}
