import { colors } from "../../theme";
import { useState, useEffect, useCallback, useMemo } from "react";
import { SERVICES_HOPITAL } from "../../constants/hopital";
import Layout from "../../components/Layout";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useAuth } from "../../context/AuthContext";
import { usePatients } from "../../hooks/useSupabaseData";
import {
  insertConsultation,
  updateConsultation,
  fetchConsultationsJour,
} from "../../hooks/useMutations";
import { openDocument, tableHTML, fetchEtabFromAuth } from "../../utils/MedOSDocument";

// ── Constantes ────────────────────────────────────────────────────────────────
const ACCENT = "#10B981";

const SERVICES_LISTE = SERVICES_HOPITAL;

const TRIAGE_CONFIG = {
  urgent:      { label: "Urgent",      color: "#EF4444", bg: "#FEF2F2", seuil: 20 },
  semi_urgent: { label: "Semi-urgent", color: "#F59E0B", bg: "#FFFBEB", seuil: 60 },
  non_urgent:  { label: "Non urgent",  color: "#10B981", bg: "#DCFCE7", seuil: 120 },
};

const STATUT_CONFIG = {
  en_attente: { label: "En attente",  color: "#F59E0B", bg: "#FFFBEB" },
  en_cours:   { label: "En cours",    color: "#3B82F6", bg: "#EFF6FF" },
  termine:    { label: "Termine",     color: "#10B981", bg: "#F0FDF4" },
  annule:     { label: "Annule",      color: "#6B7280", bg: "#F3F4F6" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function minutesDepuis(ts) {
  if (!ts) return 0;
  return Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
}

function fmtMin(min) {
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
}

function fmtHeure(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function dureeMin(debut, fin) {
  if (!debut || !fin) return null;
  return Math.round((new Date(fin) - new Date(debut)) / 60000);
}

// ── Badge triage ──────────────────────────────────────────────────────────────
function TriageBadge({ triage }) {
  if (!triage) return null;
  const t = TRIAGE_CONFIG[triage];
  if (!t) return null;
  return (
    <span style={{ padding: "2px 8px", borderRadius: 8, fontSize: 10, fontWeight: 800, backgroundColor: t.bg, color: t.color }}>
      {t.label}
    </span>
  );
}

// ── Chrono live ───────────────────────────────────────────────────────────────
function ChronoCell({ depuis, triage, style }) {
  const [min, setMin] = useState(() => minutesDepuis(depuis));
  useEffect(() => {
    const t = setInterval(() => setMin(minutesDepuis(depuis)), 30000);
    return () => clearInterval(t);
  }, [depuis]);

  const seuil = triage ? TRIAGE_CONFIG[triage]?.seuil ?? 120 : 120;
  const enRetard = min > seuil;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: enRetard ? "#EF4444" : "#6B7280", ...style }}>
      {fmtMin(min)}
    </span>
  );
}

// ── Modal enregistrer arrivee ─────────────────────────────────────────────────
function ModalArrivee({ patients, etabId, medecinNom, onClose, onSaved }) {
  const [filtre, setFiltre] = useState("");
  const [form, setForm] = useState({
    patient_id: "",
    service: SERVICES_LISTE[0],
    type: "consultation",
    motif: "",
    medecin_nom: medecinNom ?? "",
    triage: "",
    date_rdv: "",
    heure_rdv: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const patientsFiltres = useMemo(() => {
    const q = filtre.toLowerCase();
    return patients.filter((p) =>
      `${p.prenom} ${p.nom}`.toLowerCase().includes(q) ||
      (p.numero_dossier ?? "").toLowerCase().includes(q)
    ).slice(0, 80);
  }, [patients, filtre]);

  const handleSave = async () => {
    if (!form.patient_id) { setErr("Selectionnez un patient."); return; }
    if (!form.triage) { setErr("Le triage est obligatoire."); return; }
    setSaving(true);
    try {
      await insertConsultation({
        ...form,
        etablissement_id: etabId ?? null,
        heure_arrivee: new Date().toISOString(),
        statut: "en_attente",
        date_rdv: form.type === "rdv" ? form.date_rdv || null : null,
        heure_rdv: form.type === "rdv" ? form.heure_rdv || null : null,
      });
      onSaved();
      onClose();
    } catch (e) { setErr(e.message); setSaving(false); }
  };

  const inputSt = { width: "100%", padding: "9px 11px", border: "1.5px solid #E5E7EB", borderRadius: 9, fontSize: 13, outline: "none", boxSizing: "border-box", background: "white", color: "#0A1628" };
  const labelSt = { display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginBottom: 5 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "90vh", overflow: "auto", padding: "26px 28px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0A1628" }}>Enregistrer une arrivee</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF" }}>x</button>
        </div>

        {/* Patient */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelSt}>Patient</label>
          <input style={{ ...inputSt, marginBottom: 6 }} placeholder="Rechercher..." value={filtre} onChange={(e) => setFiltre(e.target.value)} />
          <select style={inputSt} value={form.patient_id} onChange={(e) => set("patient_id")(e.target.value)}>
            <option value="">-- Selectionnez un patient --</option>
            {patientsFiltres.map((p) => (
              <option key={p.id} value={p.id}>{p.prenom} {p.nom}{p.numero_dossier ? ` — ${p.numero_dossier}` : ""}</option>
            ))}
          </select>
        </div>

        {/* Service + Medecin */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelSt}>Service</label>
            <select style={inputSt} value={form.service} onChange={(e) => set("service")(e.target.value)}>
              {SERVICES_LISTE.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={labelSt}>Medecin</label>
            <input style={inputSt} value={form.medecin_nom} onChange={(e) => set("medecin_nom")(e.target.value)} placeholder="Dr. Nom" />
          </div>
        </div>

        {/* Type */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelSt}>Type</label>
          <div style={{ display: "flex", gap: 8 }}>
            {[["consultation", "Consultation"], ["urgence", "Urgence"], ["rdv", "Rendez-vous"]].map(([v, l]) => (
              <button key={v} onClick={() => set("type")(v)}
                style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: `1.5px solid ${form.type === v ? ACCENT : "#E5E7EB"}`,
                  backgroundColor: form.type === v ? "#F0FDF4" : "white",
                  color: form.type === v ? ACCENT : "#374151", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* RDV dates */}
        {form.type === "rdv" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelSt}>Date RDV</label>
              <input style={inputSt} type="date" value={form.date_rdv} onChange={(e) => set("date_rdv")(e.target.value)} />
            </div>
            <div>
              <label style={labelSt}>Heure RDV</label>
              <input style={inputSt} type="time" value={form.heure_rdv} onChange={(e) => set("heure_rdv")(e.target.value)} />
            </div>
          </div>
        )}

        {/* Motif */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelSt}>Motif</label>
          <input style={inputSt} value={form.motif} onChange={(e) => set("motif")(e.target.value)} placeholder="Fievre, douleur abdominale..." />
        </div>

        {/* Triage */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelSt}>Triage *</label>
          <div style={{ display: "flex", gap: 8 }}>
            {Object.entries(TRIAGE_CONFIG).map(([v, t]) => (
              <button key={v} onClick={() => set("triage")(v)}
                style={{ flex: 1, padding: "9px 0", borderRadius: 8,
                  border: `2px solid ${form.triage === v ? t.color : "#E5E7EB"}`,
                  backgroundColor: form.triage === v ? t.bg : "white",
                  color: form.triage === v ? t.color : "#374151",
                  fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {err && <div style={{ padding: "8px 12px", background: "#FEF2F2", borderRadius: 8, fontSize: 12, color: "#DC2626", marginBottom: 12 }}>{err}</div>}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 11, background: "#F8FAFC", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 2, padding: 11, background: saving ? "#D1D5DB" : ACCENT, color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "Enregistrement..." : "Enregistrer l'arrivee"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Carte consultation ────────────────────────────────────────────────────────
function CarteConsultation({ c, onAppeler, onTerminer }) {
  const nom = c.patients ? `${c.patients.prenom} ${c.patients.nom}` : "Patient inconnu";
  const now  = new Date();

  return (
    <div style={{
      background: "white", borderRadius: 10, padding: "12px 14px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.08)", marginBottom: 8,
      borderLeft: `3px solid ${c.triage ? TRIAGE_CONFIG[c.triage]?.color : "#E5E7EB"}`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#0A1628" }}>{nom}</div>
        <TriageBadge triage={c.triage} />
      </div>
      <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 4 }}>{c.service}{c.medecin_nom ? ` — ${c.medecin_nom}` : ""}</div>
      {c.motif && <div style={{ fontSize: 12, color: "#374151", marginBottom: 6, fontStyle: "italic" }}>{c.motif}</div>}

      {c.statut === "en_attente" && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 11, color: "#6B7280" }}>
            Arrivee : {fmtHeure(c.heure_arrivee)} — <ChronoCell depuis={c.heure_arrivee} triage={c.triage} />
          </div>
          <button onClick={() => onAppeler(c)}
            style={{ padding: "5px 12px", background: "#3B82F6", color: "white", border: "none", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            Appeler
          </button>
        </div>
      )}

      {c.statut === "en_cours" && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 11, color: "#6B7280" }}>
            Debut : {fmtHeure(c.heure_debut)} — <ChronoCell depuis={c.heure_debut} triage={null} />
          </div>
          <button onClick={() => onTerminer(c)}
            style={{ padding: "5px 12px", background: ACCENT, color: "white", border: "none", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            Terminer
          </button>
        </div>
      )}

      {c.statut === "termine" && (
        <div style={{ fontSize: 11, color: "#6B7280" }}>
          {fmtHeure(c.heure_debut)} — {fmtHeure(c.heure_fin)}
          {dureeMin(c.heure_debut, c.heure_fin) !== null && (
            <span style={{ marginLeft: 6, fontWeight: 700, color: ACCENT }}>{fmtMin(dureeMin(c.heure_debut, c.heure_fin))}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Colonne Kanban ────────────────────────────────────────────────────────────
function Colonne({ titre, count, bgHeader, borderColor, children }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 280, maxWidth: 420 }}>
      <div style={{ background: bgHeader, borderTop: `3px solid ${borderColor}`, borderRadius: "10px 10px 0 0", padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: "#0A1628" }}>{titre}</span>
        <span style={{ background: borderColor, color: "white", fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 10 }}>{count}</span>
      </div>
      <div style={{ background: bgHeader, borderRadius: "0 0 10px 10px", padding: "8px 10px", flex: 1, minHeight: 200, maxHeight: "calc(100vh - 340px)", overflowY: "auto" }}>
        {children}
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function Consultations() {
  const { auth } = useAuth();
  const { toasts, success } = useToast();
  const { data: patients } = usePatients();
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filtreService, setFiltreService] = useState("Tous");
  const [etabId, setEtabId] = useState(auth?.etablissement_id ?? null);
  const [tick, setTick] = useState(0);

  // Chrono global toutes les 30s
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const todayISO = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    setLoading(true);
    let eid = auth?.etablissement_id;
    if (!eid && auth?.user?.email) {
      const { data } = await import("../../supabaseClient").then((m) =>
        m.supabase.from("etablissements").select("id").eq("email", auth.user.email).maybeSingle()
      );
      eid = data?.id ?? null;
    }
    if (eid) setEtabId(eid);
    const data = await fetchConsultationsJour(eid, todayISO);
    setConsultations(data);
    setLoading(false);
  }, [auth, todayISO]);

  useEffect(() => { load(); }, [load]);

  const ri = auth?.role_interne;
  const [voirTout, setVoirTout] = useState(ri !== "Médecin");

  const filtrees = useMemo(() => {
    let r = filtreService === "Tous" ? consultations : consultations.filter((c) => c.service === filtreService);
    if (ri === "Médecin" && !voirTout) {
      const emailPrefix = (auth?.user?.email ?? "").split("@")[0].toLowerCase();
      r = r.filter((c) => (c.medecin_nom ?? "").toLowerCase().includes(emailPrefix));
    }
    return r;
  }, [consultations, filtreService, ri, voirTout, auth]);

  const enAttente = filtrees.filter((c) => c.statut === "en_attente");
  const enCours   = filtrees.filter((c) => c.statut === "en_cours");
  const termines  = filtrees.filter((c) => c.statut === "termine");

  // KPIs
  const tempsAttenteTotal = enCours.reduce((acc, c) => acc + minutesDepuis(c.heure_arrivee), 0);
  const tempsAttenteMoyen = enCours.length > 0 ? Math.round(tempsAttenteTotal / enCours.length) : 0;

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

  const handleImprimer = async () => {
    const etab = await fetchEtabFromAuth(auth);
    const rows = consultations.map((c) => {
      const nom = c.patients ? `${c.patients.prenom} ${c.patients.nom}` : "—";
      const d = dureeMin(c.heure_debut, c.heure_fin);
      return [nom, c.service, c.medecin_nom ?? "—", fmtHeure(c.heure_arrivee), STATUT_CONFIG[c.statut]?.label ?? c.statut, d ? fmtMin(d) : "—"];
    });
    openDocument({
      titre: "Journal des consultations",
      sousTitre: new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
      etablissement: etab,
      sections: [{
        titre: "Consultations du jour",
        html: tableHTML(["Patient", "Service", "Medecin", "Arrivee", "Statut", "Duree"], rows),
      }],
    });
  };

  return (
    <Layout title="Consultations" subtitle="File d'attente — Tableau de bord du jour">
      <Toast toasts={toasts} />

      {showModal && (
        <ModalArrivee
          patients={patients}
          etabId={etabId}
          medecinNom={auth?.user?.email ?? ""}
          onClose={() => setShowModal(false)}
          onSaved={() => { load(); success("Arrivee enregistree"); }}
        />
      )}

      {/* KPI */}
      <div className="kpi-row" style={{ marginBottom: 20 }}>
        {[
          { label: "En attente",          value: loading ? "…" : enAttente.length, color: "#F59E0B" },
          { label: "En cours",            value: loading ? "…" : enCours.length,   color: "#3B82F6" },
          { label: "Termines aujourd'hui",value: loading ? "…" : termines.length,  color: ACCENT },
          { label: "Temps d'attente moy", value: loading ? "…" : fmtMin(tempsAttenteMoyen), color: "#8B5CF6" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: colors.bgCard, padding: "14px 20px", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Banniere filtre medecin */}
      {ri === "Médecin" && !voirTout && (
        <div style={{ padding: "8px 16px", backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 10, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: "#2563EB" }}>
          <span>Affichage de vos consultations uniquement</span>
          <button onClick={() => setVoirTout(true)} style={{ padding: "4px 12px", background: "#3B82F6", color: "white", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Voir tout</button>
        </div>
      )}
      {ri === "Médecin" && voirTout && (
        <div style={{ padding: "8px 16px", backgroundColor: "#F3F4F6", borderRadius: 10, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: "#374151" }}>
          <span>Affichage de toutes les consultations du service</span>
          <button onClick={() => setVoirTout(false)} style={{ padding: "4px 12px", background: "#E5E7EB", color: "#374151", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Mes consultations</button>
        </div>
      )}

      {/* Barre actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <select
          value={filtreService}
          onChange={(e) => setFiltreService(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13, background: "white", color: "#0A1628" }}
        >
          <option value="Tous">Tous les services</option>
          {SERVICES_LISTE.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleImprimer}
            style={{ padding: "8px 16px", background: colors.bgCard, color: "#7C3AED", border: "1px solid #7C3AED", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Imprimer le journal
          </button>
          <button onClick={() => setShowModal(true)}
            style={{ padding: "8px 16px", background: ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            + Enregistrer une arrivee
          </button>
        </div>
      </div>

      {/* Kanban */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: colors.textMuted }}>Chargement...</div>
      ) : (
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", overflowX: "auto" }}>
          <Colonne titre="En attente" count={enAttente.length} bgHeader="#FFFBEB" borderColor="#F59E0B">
            {enAttente.length === 0 && <div style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", paddingTop: 24 }}>Aucun patient en attente</div>}
            {enAttente.map((c) => (
              <CarteConsultation key={c.id} c={c} onAppeler={handleAppeler} onTerminer={handleTerminer} />
            ))}
          </Colonne>

          <Colonne titre="En cours" count={enCours.length} bgHeader="#EFF6FF" borderColor="#3B82F6">
            {enCours.length === 0 && <div style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", paddingTop: 24 }}>Aucune consultation en cours</div>}
            {enCours.map((c) => (
              <CarteConsultation key={c.id} c={c} onAppeler={handleAppeler} onTerminer={handleTerminer} />
            ))}
          </Colonne>

          <Colonne titre="Termines aujourd'hui" count={termines.length} bgHeader="#F0FDF4" borderColor={ACCENT}>
            {termines.length === 0 && <div style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", paddingTop: 24 }}>Aucune consultation terminee</div>}
            {termines.map((c) => (
              <CarteConsultation key={c.id} c={c} onAppeler={handleAppeler} onTerminer={handleTerminer} />
            ))}
          </Colonne>
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </Layout>
  );
}
