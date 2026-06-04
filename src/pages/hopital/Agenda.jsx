import { colors } from "../../theme";
import { useState, useEffect, useCallback, useMemo } from "react";
import { SERVICES_HOPITAL } from "../../constants/hopital";
import Layout from "../../components/Layout";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useAuth } from "../../context/AuthContext";
import { usePatients } from "../../hooks/useSupabaseData";
import { supabase } from "../../supabaseClient";
import { insertConsultation, updateConsultation, fetchRdvSemaine } from "../../hooks/useMutations";

const ACCENT = "#10B981";

const TRIAGE_CONFIG = {
  urgent:      { label: "Urgent",      color: "#EF4444", bg: "#FEF2F2" },
  semi_urgent: { label: "Semi-urgent", color: "#F59E0B", bg: "#FFFBEB" },
  non_urgent:  { label: "Non urgent",  color: "#10B981", bg: "#DCFCE7" },
};

const STATUT_CONFIG = {
  en_attente: { label: "En attente", color: "#F59E0B", bg: "#FFFBEB" },
  en_cours:   { label: "En cours",   color: "#3B82F6", bg: "#EFF6FF" },
  termine:    { label: "Termine",    color: "#10B981", bg: "#F0FDF4" },
  annule:     { label: "Annule",     color: "#6B7280", bg: "#F3F4F6" },
};

// Créneaux de 07h00 à 18h00 par demi-heure
const CRENEAUX = Array.from({ length: 23 }, (_, i) => {
  const h = Math.floor(i / 2) + 7;
  const m = (i % 2) * 30;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

const JOURS_FR = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];

function getWeekDates(base) {
  const monday = new Date(base);
  monday.setDate(base.getDate() - ((base.getDay() + 6) % 7));
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function toISO(d) { return d.toISOString().slice(0, 10); }

function fmtJour(d) {
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

function envoyerSMSRappelRdv(patient, rdv) {
  const tel = patient?.telephone?.replace(/\s/g, "");
  if (!tel) return;
  const date = new Date(rdv.date_rdv).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const corps = `Rappel : Vous avez un rendez-vous le ${date} a ${rdv.heure_rdv?.slice(0, 5)} — Service ${rdv.service}. En cas d'empechement, contactez-nous.`;
  window.open(`sms:${tel}?body=${encodeURIComponent(corps)}`);
}

// Créneaux demi-heure pour le select
const CRENEAUX_OPTIONS = CRENEAUX.map((c) => ({ value: c, label: c }));

// ── Modal nouveau RDV ──────────────────────────────────────────────────────────
function ModalNouveauRdv({ patients, etabId, auth, onClose, onSaved }) {
  const [membres, setMembres]   = useState([]);
  const [form, setForm]         = useState({
    patient_id: "", medecin_nom: "", service: SERVICES_HOPITAL[0],
    date_rdv: new Date().toISOString().slice(0, 10),
    heure_rdv: "08:00", motif: "", triage: "non_urgent",
  });
  const [filtrePatient, setFiltrePatient] = useState("");
  const [sendSms, setSendSms]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState(null);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!etabId) return;
    supabase.from("membres_personnel").select("email, role_interne, prenom, nom")
      .eq("etablissement_id", etabId).eq("actif", true).eq("role_interne", "Médecin")
      .then(({ data }) => setMembres(data ?? []));
  }, [etabId]);

  const patsFiltres = useMemo(() => {
    const q = filtrePatient.toLowerCase();
    return patients.filter((p) =>
      !q || `${p.prenom} ${p.nom}`.toLowerCase().includes(q) || (p.numero_dossier ?? "").includes(q)
    ).slice(0, 80);
  }, [patients, filtrePatient]);

  const handleSave = async () => {
    if (!form.patient_id) { setErr("Selectionnez un patient."); return; }
    if (!form.date_rdv)   { setErr("La date est obligatoire."); return; }
    setSaving(true);
    try {
      await insertConsultation({
        ...form,
        type: "rdv",
        statut: "en_attente",
        heure_arrivee: new Date().toISOString(),
        etablissement_id: etabId ?? null,
      });

      if (sendSms) {
        const patient = patients.find((p) => p.id === form.patient_id);
        if (patient?.telephone) envoyerSMSRappelRdv(patient, form);
      }
      onSaved();
      onClose();
    } catch (e) { setErr(e.message); setSaving(false); }
  };

  const inputSt = { width: "100%", padding: "9px 11px", border: "1.5px solid #E5E7EB", borderRadius: 9, fontSize: 13, outline: "none", boxSizing: "border-box", background: "white", color: "#0A1628" };
  const labelSt = { display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginBottom: 5 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "92vh", overflow: "auto", padding: "26px 28px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0A1628" }}>Nouveau rendez-vous</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF" }}>x</button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelSt}>Patient *</label>
          <input style={{ ...inputSt, marginBottom: 6 }} placeholder="Rechercher par nom..." value={filtrePatient} onChange={(e) => setFiltrePatient(e.target.value)} />
          <select style={inputSt} value={form.patient_id} onChange={(e) => set("patient_id")(e.target.value)}>
            <option value="">-- Selectionnez un patient --</option>
            {patsFiltres.map((p) => <option key={p.id} value={p.id}>{p.prenom} {p.nom}{p.numero_dossier ? ` — ${p.numero_dossier}` : ""}</option>)}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelSt}>Medecin</label>
            {membres.length > 0 ? (
              <select style={inputSt} value={form.medecin_nom} onChange={(e) => set("medecin_nom")(e.target.value)}>
                <option value="">-- Selectionner --</option>
                {membres.map((m) => <option key={m.email} value={m.email}>{m.prenom ?? ""} {m.nom ?? ""} ({m.email})</option>)}
              </select>
            ) : (
              <input style={inputSt} value={form.medecin_nom} onChange={(e) => set("medecin_nom")(e.target.value)} placeholder="Dr. Nom" />
            )}
          </div>
          <div>
            <label style={labelSt}>Service</label>
            <select style={inputSt} value={form.service} onChange={(e) => set("service")(e.target.value)}>
              {SERVICES_HOPITAL.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelSt}>Date RDV *</label>
            <input style={inputSt} type="date" value={form.date_rdv} onChange={(e) => set("date_rdv")(e.target.value)} />
          </div>
          <div>
            <label style={labelSt}>Heure RDV</label>
            <select style={inputSt} value={form.heure_rdv} onChange={(e) => set("heure_rdv")(e.target.value)}>
              {CRENEAUX_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelSt}>Motif</label>
          <input style={inputSt} value={form.motif} onChange={(e) => set("motif")(e.target.value)} placeholder="Motif de la consultation..." />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelSt}>Triage pre-estime</label>
          <div style={{ display: "flex", gap: 8 }}>
            {Object.entries(TRIAGE_CONFIG).map(([v, t]) => (
              <button key={v} onClick={() => set("triage")(v)}
                style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: `2px solid ${form.triage === v ? t.color : "#E5E7EB"}`, backgroundColor: form.triage === v ? t.bg : "white", color: form.triage === v ? t.color : "#374151", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "10px 14px", backgroundColor: colors.bgSurface, borderRadius: 8 }}>
          <input type="checkbox" id="sendSms" checked={sendSms} onChange={(e) => setSendSms(e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} />
          <label htmlFor="sendSms" style={{ fontSize: 13, color: colors.text, cursor: "pointer" }}>Envoyer un SMS de confirmation au patient</label>
        </div>

        {err && <div style={{ padding: "8px 12px", background: "#FEF2F2", borderRadius: 8, fontSize: 12, color: "#DC2626", marginBottom: 12 }}>{err}</div>}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 11, background: "#F8FAFC", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 2, padding: 11, background: saving ? "#D1D5DB" : ACCENT, color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "Enregistrement..." : "Enregistrer le RDV"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Panel détail RDV ───────────────────────────────────────────────────────────
function PanelRdv({ rdv, patient, etabId, auth, onClose, onUpdated }) {
  const [saving, setSaving] = useState(false);
  const s = STATUT_CONFIG[rdv.statut] ?? STATUT_CONFIG.en_attente;
  const t = TRIAGE_CONFIG[rdv.triage] ?? TRIAGE_CONFIG.non_urgent;

  const handleConfirmerArrivee = async () => {
    setSaving(true);
    try {
      await updateConsultation(rdv.id, { statut: "en_attente", heure_arrivee: new Date().toISOString() });
      onUpdated();
      onClose();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const handleAnnuler = async () => {
    if (!window.confirm("Annuler ce rendez-vous ?")) return;
    setSaving(true);
    try {
      await updateConsultation(rdv.id, { statut: "annule" });
      onUpdated();
      onClose();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 440, padding: "24px 28px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Rendez-vous</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF" }}>x</button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <span style={{ padding: "3px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700, backgroundColor: s.bg, color: s.color }}>{s.label}</span>
          <span style={{ padding: "3px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700, backgroundColor: t.bg, color: t.color }}>{t.label}</span>
        </div>

        <div style={{ marginBottom: 16 }}>
          {[
            ["Patient",  patient ? `${patient.prenom} ${patient.nom}` : rdv.patients ? `${rdv.patients.prenom} ${rdv.patients.nom}` : "—"],
            ["Date",     new Date(rdv.date_rdv).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })],
            ["Heure",    rdv.heure_rdv?.slice(0, 5) ?? "—"],
            ["Service",  rdv.service ?? "—"],
            ["Medecin",  rdv.medecin_nom || "—"],
            ["Motif",    rdv.motif || "—"],
            ["Tel.",     patient?.telephone ?? rdv.patients?.telephone ?? "—"],
          ].map(([l, v]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #F3F4F6", fontSize: 13 }}>
              <span style={{ color: colors.textSecondary, fontWeight: 500 }}>{l}</span>
              <span style={{ color: colors.navy, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rdv.statut !== "annule" && rdv.statut !== "termine" && (
            <button onClick={handleConfirmerArrivee} disabled={saving}
              style={{ padding: "10px", background: ACCENT, color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
              Confirmer l'arrivee
            </button>
          )}
          {(patient?.telephone ?? rdv.patients?.telephone) && (
            <button onClick={() => envoyerSMSRappelRdv(patient ?? rdv.patients, rdv)}
              style={{ padding: "10px", background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Envoyer SMS de rappel
            </button>
          )}
          {rdv.statut !== "annule" && rdv.statut !== "termine" && (
            <button onClick={handleAnnuler} disabled={saving}
              style={{ padding: "10px", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
              Annuler le RDV
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function Agenda() {
  const { auth } = useAuth();
  const { toasts, success } = useToast();
  const { data: patients } = usePatients();
  const [weekBase, setWeekBase]       = useState(new Date());
  const [rdvs, setRdvs]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [panelRdv, setPanelRdv]       = useState(null);
  const [filtreMedia, setFiltreMedia] = useState("tous");
  const [etabId, setEtabId]           = useState(auth?.etablissement_id ?? null);

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

  const weekDates = getWeekDates(weekBase);
  const weekStart = toISO(weekDates[0]);
  const weekEnd   = toISO(weekDates[4]);
  const todayISO  = toISO(new Date());

  const load = useCallback(async () => {
    if (!etabId) return;
    setLoading(true);
    const data = await fetchRdvSemaine(etabId, weekStart, weekEnd);
    setRdvs(data);
    setLoading(false);
  }, [etabId, weekStart, weekEnd]);

  useEffect(() => { load(); }, [load]);

  // Organiser par jour + heure
  const grille = useMemo(() => {
    const g = {};
    weekDates.forEach((d) => { g[toISO(d)] = {}; });
    rdvs.forEach((rdv) => {
      const jour  = rdv.date_rdv;
      const heure = rdv.heure_rdv?.slice(0, 5) ?? "08:00";
      const med   = rdv.medecin_nom ?? "";
      if (filtreMedia !== "tous" && med !== filtreMedia) return;
      if (!g[jour]) g[jour] = {};
      if (!g[jour][heure]) g[jour][heure] = [];
      g[jour][heure].push(rdv);
    });
    return g;
  }, [rdvs, weekDates, filtreMedia]);

  const medecins = useMemo(() => {
    const s = new Set(rdvs.map((r) => r.medecin_nom).filter(Boolean));
    return [...s];
  }, [rdvs]);

  const prevWeek = () => { const d = new Date(weekBase); d.setDate(d.getDate()-7); setWeekBase(d); };
  const nextWeek = () => { const d = new Date(weekBase); d.setDate(d.getDate()+7); setWeekBase(d); };

  const COL_W = 160;
  const HEADER_W = 64;

  return (
    <Layout title="Agenda" subtitle="Calendrier des rendez-vous — vue semaine">
      <Toast toasts={toasts} />

      {showModal && (
        <ModalNouveauRdv
          patients={patients} etabId={etabId} auth={auth}
          onClose={() => setShowModal(false)}
          onSaved={() => { load(); success("Rendez-vous enregistre"); }}
        />
      )}
      {panelRdv && (
        <PanelRdv
          rdv={panelRdv} patient={patients.find((p) => p.id === panelRdv.patient_id)}
          etabId={etabId} auth={auth}
          onClose={() => setPanelRdv(null)}
          onUpdated={() => { load(); setPanelRdv(null); }}
        />
      )}

      {/* Header navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={prevWeek} style={{ padding: "7px 14px", border: `1px solid ${colors.border}`, borderRadius: 8, background: colors.bgCard, cursor: "pointer", fontSize: 13, fontWeight: 600, color: colors.text }}>Precedente</button>
          <span style={{ fontSize: 14, fontWeight: 700, color: colors.navy }}>
            {weekDates[0].toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} — {weekDates[4].toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
          </span>
          <button onClick={nextWeek} style={{ padding: "7px 14px", border: `1px solid ${colors.border}`, borderRadius: 8, background: colors.bgCard, cursor: "pointer", fontSize: 13, fontWeight: 600, color: colors.text }}>Suivante</button>
          <button onClick={() => setWeekBase(new Date())} style={{ padding: "7px 12px", border: "none", borderRadius: 8, background: "#EFF6FF", cursor: "pointer", fontSize: 13, color: "#2563EB", fontWeight: 700 }}>Auj.</button>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={filtreMedia} onChange={(e) => setFiltreMedia(e.target.value)}
            style={{ padding: "7px 12px", border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 12, background: colors.bgCard, color: colors.text }}>
            <option value="tous">Tous les medecins</option>
            {medecins.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <button onClick={() => setShowModal(true)}
            style={{ padding: "7px 16px", background: ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            + Nouveau RDV
          </button>
        </div>
      </div>

      {/* KPIs semaine */}
      <div className="kpi-row" style={{ marginBottom: 16 }}>
        {[
          { label: "RDV cette semaine",  value: rdvs.length, color: ACCENT },
          { label: "Aujourd'hui",        value: rdvs.filter((r) => r.date_rdv === todayISO).length, color: "#3B82F6" },
          { label: "En attente",         value: rdvs.filter((r) => r.statut === "en_attente").length, color: "#F59E0B" },
          { label: "Termines",           value: rdvs.filter((r) => r.statut === "termine").length, color: "#6B7280" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: colors.bgCard, padding: "12px 18px", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Grille calendrier */}
      <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, boxShadow: "0 1px 6px rgba(0,0,0,0.08)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: HEADER_W + COL_W * 5 }}>
            {/* En-tête jours */}
            <div style={{ display: "grid", gridTemplateColumns: `${HEADER_W}px repeat(5, ${COL_W}px)`, borderBottom: `2px solid ${colors.border}`, position: "sticky", top: 0, backgroundColor: colors.bgCard, zIndex: 5 }}>
              <div style={{ padding: "10px 8px", borderRight: `1px solid ${colors.border}`, backgroundColor: colors.bgSurface }} />
              {weekDates.map((d, i) => {
                const iso = toISO(d);
                const isToday = iso === todayISO;
                const nbRdv = (grille[iso] ? Object.values(grille[iso]).flat().length : 0);
                return (
                  <div key={iso} style={{ padding: "10px 8px", textAlign: "center", borderRight: i < 4 ? `1px solid ${colors.border}` : "none", backgroundColor: isToday ? "#EFF6FF" : colors.bgCard, borderBottom: isToday ? `3px solid ${ACCENT}` : "none" }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: isToday ? ACCENT : colors.navy, textTransform: "capitalize" }}>{JOURS_FR[i]} {d.getDate()}</div>
                    {nbRdv > 0 && <div style={{ fontSize: 10, color: ACCENT, fontWeight: 700 }}>{nbRdv} RDV</div>}
                    {isToday && <div style={{ fontSize: 9, fontWeight: 700, color: ACCENT, marginTop: 1 }}>AUJOURD'HUI</div>}
                  </div>
                );
              })}
            </div>

            {/* Lignes créneaux */}
            <div style={{ maxHeight: "calc(100vh - 400px)", overflowY: "auto" }}>
              {CRENEAUX.map((cr, ci) => (
                <div key={cr} style={{ display: "grid", gridTemplateColumns: `${HEADER_W}px repeat(5, ${COL_W}px)`, borderBottom: `1px solid ${colors.borderLight}`, minHeight: 48 }}>
                  {/* Heure */}
                  <div style={{ padding: "4px 8px", fontSize: 11, fontWeight: 700, color: colors.textMuted, textAlign: "right", borderRight: `1px solid ${colors.border}`, paddingTop: 8, backgroundColor: colors.bgSurface }}>
                    {cr}
                  </div>
                  {/* Cellules jour */}
                  {weekDates.map((d, di) => {
                    const iso = toISO(d);
                    const rdvsCell = grille[iso]?.[cr] ?? [];
                    const isToday = iso === todayISO;
                    return (
                      <div key={iso} style={{ borderRight: di < 4 ? `1px solid ${colors.borderLight}` : "none", padding: "3px 4px", backgroundColor: isToday ? "#F0F9FF" : "transparent", minHeight: 48 }}>
                        {rdvsCell.map((rdv) => {
                          const t = TRIAGE_CONFIG[rdv.triage] ?? TRIAGE_CONFIG.non_urgent;
                          const pat = rdv.patients;
                          return (
                            <div key={rdv.id} onClick={() => setPanelRdv(rdv)}
                              style={{ padding: "4px 7px", borderRadius: 6, marginBottom: 3, cursor: "pointer", backgroundColor: t.bg, borderLeft: `3px solid ${t.color}`, fontSize: 11 }}
                              onMouseEnter={(e) => e.currentTarget.style.opacity = "0.8"}
                              onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}>
                              <div style={{ fontWeight: 700, color: colors.navy, lineHeight: 1.3 }}>{pat ? `${pat.prenom} ${pat.nom}` : "—"}</div>
                              {rdv.medecin_nom && <div style={{ fontSize: 10, color: colors.textMuted }}>{rdv.medecin_nom}</div>}
                              {rdv.service && <div style={{ fontSize: 10, color: t.color, fontWeight: 600 }}>{rdv.service}</div>}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {loading && <div style={{ textAlign: "center", color: colors.textMuted, padding: 24 }}>Chargement...</div>}
    </Layout>
  );
}
