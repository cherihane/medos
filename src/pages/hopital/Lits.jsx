import { colors } from "../../theme";
import { useState, useEffect, useCallback } from "react";
import { SERVICES_HOPITAL, SERVICE_COLORS } from "../../constants/hopital";
import Layout from "../../components/Layout";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useAuth } from "../../context/AuthContext";
import { usePatients } from "../../hooks/useSupabaseData";
import { supabase } from "../../supabaseClient";
import {
  fetchLitsOccupes,
  fetchConfigurationLits,
  upsertConfigurationLit,
  upsertHospitalisation,
  libererLit,
  updatePatient,
} from "../../hooks/useMutations";
import { openDocument, tableHTML, fetchEtabFromAuth } from "../../utils/MedOSDocument";

// ── Constantes ────────────────────────────────────────────────────────────────
const ACCENT = "#10B981";

// Alias depuis constantes partagees — on filtre les 5 services avec lits
const SERVICES     = ["Urgences", "Médecine générale", "Maternité", "Pédiatrie", "Chirurgie"];
const SERVICE_COLOR = SERVICE_COLORS;

function toISO(d) { return d.toISOString().slice(0, 10); }
const todayISO = toISO(new Date());

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function BarreProgression({ valeur, total, couleur }) {
  const pct = total > 0 ? Math.round((valeur / total) * 100) : 0;
  const c = pct > 90 ? "#EF4444" : pct > 70 ? "#F59E0B" : ACCENT;
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 4 }}>
        <span>{valeur} / {total} lits occupes</span>
        <span style={{ color: c }}>{pct}%</span>
      </div>
      <div style={{ height: 8, backgroundColor: "#F3F4F6", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, backgroundColor: c, borderRadius: 10, transition: "width 0.3s" }} />
      </div>
    </div>
  );
}

// ── Modal admettre ────────────────────────────────────────────────────────────
function ModalAdmettre({ patients, serviceInitial, etabId, onClose, onSaved }) {
  const [form, setForm] = useState({
    patient_id: "",
    service: serviceInitial ?? SERVICES[0],
    lit: "",
    chambre: "",
    date_entree: todayISO,
    date_sortie_prevue: "",
    notes: "",
  });
  const [filtre, setFiltre] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const patientsFiltres = patients
    .filter((p) => {
      const q = filtre.toLowerCase();
      return `${p.prenom} ${p.nom}`.toLowerCase().includes(q);
    })
    .slice(0, 80);

  const handleSave = async () => {
    if (!form.patient_id) { setErr("Selectionnez un patient."); return; }
    setSaving(true);
    try {
      await upsertHospitalisation(form.patient_id, {
        statut: "hospitalise",
        service: form.service,
        lit: form.lit || null,
        chambre: form.chambre || null,
        date_entree: form.date_entree || null,
        date_sortie_prevue: form.date_sortie_prevue || null,
        notes: form.notes || null,
        etablissement_id: etabId ?? null,
      });
      await updatePatient(form.patient_id, { statut: "hospitalise" });
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
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0A1628" }}>Admettre un patient</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF" }}>x</button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelSt}>Patient</label>
          <input style={{ ...inputSt, marginBottom: 6 }} placeholder="Rechercher..." value={filtre} onChange={(e) => setFiltre(e.target.value)} />
          <select style={inputSt} value={form.patient_id} onChange={(e) => set("patient_id")(e.target.value)}>
            <option value="">-- Selectionnez --</option>
            {patientsFiltres.map((p) => <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>)}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelSt}>Service</label>
            <select style={inputSt} value={form.service} onChange={(e) => set("service")(e.target.value)}>
              {SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={labelSt}>Lit n°</label>
            <input style={inputSt} type="number" value={form.lit} onChange={(e) => set("lit")(e.target.value)} placeholder="Ex: 12" />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelSt}>Chambre</label>
            <input style={inputSt} value={form.chambre} onChange={(e) => set("chambre")(e.target.value)} placeholder="Ex: 104A" />
          </div>
          <div>
            <label style={labelSt}>Date d'entree</label>
            <input style={inputSt} type="date" value={form.date_entree} onChange={(e) => set("date_entree")(e.target.value)} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelSt}>Date de sortie prevue</label>
          <input style={inputSt} type="date" value={form.date_sortie_prevue} onChange={(e) => set("date_sortie_prevue")(e.target.value)} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelSt}>Notes</label>
          <input style={inputSt} value={form.notes} onChange={(e) => set("notes")(e.target.value)} placeholder="Optionnel..." />
        </div>

        {err && <div style={{ padding: "8px 12px", background: "#FEF2F2", borderRadius: 8, fontSize: 12, color: "#DC2626", marginBottom: 12 }}>{err}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 11, background: "#F8FAFC", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 2, padding: 11, background: saving ? "#D1D5DB" : ACCENT, color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "Enregistrement..." : "Admettre"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal liberer ─────────────────────────────────────────────────────────────
function ModalLiberer({ hospi, onClose, onSaved }) {
  const { error: showError } = useToast();
  const nom = hospi.patients ? `${hospi.patients.prenom} ${hospi.patients.nom}` : "ce patient";
  const [form, setForm] = useState({
    date_sortie_reelle: new Date().toISOString().slice(0, 16),
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await libererLit(hospi.id, hospi.patient_id, form.date_sortie_reelle, form.notes || null);
      onSaved();
      onClose();
    } catch (e) { showError(e.message); setSaving(false); }
  };

  const inputSt = { width: "100%", padding: "9px 11px", border: "1.5px solid #E5E7EB", borderRadius: 9, fontSize: 13, outline: "none", boxSizing: "border-box", background: "white", color: "#0A1628" };
  const labelSt = { display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginBottom: 5 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 420, padding: "26px 28px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#0A1628" }}>Liberer un lit</h3>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "#374151" }}>Confirmer la sortie de <strong>{nom}</strong> ?</p>

        <div style={{ marginBottom: 14 }}>
          <label style={labelSt}>Date de sortie reelle</label>
          <input style={inputSt} type="datetime-local" value={form.date_sortie_reelle}
            onChange={(e) => setForm((f) => ({ ...f, date_sortie_reelle: e.target.value }))} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={labelSt}>Notes de sortie</label>
          <input style={inputSt} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optionnel..." />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 11, background: "#F8FAFC", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 2, padding: 11, background: saving ? "#D1D5DB" : "#EF4444", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "Enregistrement..." : "Confirmer la sortie"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal config capacite ─────────────────────────────────────────────────────
function ModalConfig({ service, capaciteActuelle, etabId, onClose, onSaved }) {
  const { error: showError } = useToast();
  const [capacite, setCapacite] = useState(capaciteActuelle ?? 10);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsertConfigurationLit(etabId, service, Number(capacite));
      onSaved();
      onClose();
    } catch (e) { showError(e.message); setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 360, padding: "26px 28px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "#0A1628" }}>Configuration — {service}</h3>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginBottom: 5 }}>Capacite totale (lits)</label>
          <input type="number" min={1} value={capacite} onChange={(e) => setCapacite(e.target.value)}
            style={{ width: "100%", padding: "9px 11px", border: "1.5px solid #E5E7EB", borderRadius: 9, fontSize: 16, fontWeight: 700, outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 11, background: "#F8FAFC", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 2, padding: 11, background: saving ? "#D1D5DB" : ACCENT, color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "Enregistrement..." : "Sauvegarder"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function Lits() {
  const { auth } = useAuth();
  const { toasts, success, error: showError } = useToast();
  const { data: patients } = usePatients(auth?.etablissement_id);
  const [lits, setLits] = useState([]);
  const [config, setConfig] = useState([]);
  const [loading, setLoading] = useState(true);
  const [etabId, setEtabId] = useState(auth?.etablissement_id ?? null);
  const [modalAdmettre, setModalAdmettre] = useState(null);
  const [modalLiberer, setModalLiberer] = useState(null);
  const [modalConfig, setModalConfig] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    let eid = auth?.etablissement_id;
    if (!eid && auth?.user?.email) {
      const { data } = await supabase.from("etablissements").select("id").eq("email", auth.user.email).maybeSingle();
      eid = data?.id ?? null;
    }
    if (eid) setEtabId(eid);
    const [litsData, configData] = await Promise.all([
      fetchLitsOccupes(eid),
      fetchConfigurationLits(eid),
    ]);
    setLits(litsData);
    setConfig(configData);
    setLoading(false);
  }, [auth]);

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    const channel = supabase.channel("lits-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "hospitalisations" }, () => { load(); })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [load]);

  const getCapacite = (service) => config.find((c) => c.service === service)?.capacite_totale ?? 10;

  const totalOccupes = lits.length;
  const totalLits    = SERVICES.reduce((acc, s) => acc + getCapacite(s), 0);
  const tauxGlobal   = totalLits > 0 ? Math.round((totalOccupes / totalLits) * 100) : 0;
  const couleurTaux  = tauxGlobal > 90 ? "#EF4444" : tauxGlobal > 70 ? "#F59E0B" : ACCENT;

  const handleImprimer = async () => {
    const etab = await fetchEtabFromAuth(auth);
    const syntheseRows = SERVICES.map((s) => {
      const occ = lits.filter((h) => h.service === s).length;
      const cap = getCapacite(s);
      return [s, String(cap), String(occ), String(cap - occ), `${cap > 0 ? Math.round((occ / cap) * 100) : 0}%`];
    });
    const detailRows = lits.map((h) => [
      h.patients ? `${h.patients.prenom} ${h.patients.nom}` : "—",
      h.service ?? "—",
      h.lit ?? "—",
      h.chambre ?? "—",
      h.date_entree ? new Date(h.date_entree).toLocaleDateString("fr-FR") : "—",
      h.date_sortie_prevue ? new Date(h.date_sortie_prevue).toLocaleDateString("fr-FR") : "—",
    ]);
    openDocument({
      titre: "Rapport d'occupation des lits",
      sousTitre: `Au ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`,
      etablissement: etab,
      sections: [
        { titre: "Synthese par service", html: tableHTML(["Service", "Capacite", "Occupes", "Libres", "Taux"], syntheseRows) },
        { titre: "Detail des hospitalisations", html: tableHTML(["Patient", "Service", "Lit", "Chambre", "Entree", "Sortie prevue"], detailRows) },
      ],
    });
  };

  return (
    <Layout title="Gestion des lits" subtitle="Occupation en temps reel — Admissions et sorties">
      <Toast toasts={toasts} />

      {modalAdmettre && (
        <ModalAdmettre
          patients={patients}
          serviceInitial={modalAdmettre.service}
          etabId={etabId}
          onClose={() => setModalAdmettre(null)}
          onSaved={() => { load(); success("Patient admis"); }}
        />
      )}
      {modalLiberer && (
        <ModalLiberer
          hospi={modalLiberer}
          onClose={() => setModalLiberer(null)}
          onSaved={() => { load(); success("Lit libere"); }}
        />
      )}
      {modalConfig && (
        <ModalConfig
          service={modalConfig.service}
          capaciteActuelle={modalConfig.capacite}
          etabId={etabId}
          onClose={() => setModalConfig(null)}
          onSaved={() => { load(); success("Configuration mise a jour"); }}
        />
      )}

      {/* KPI globaux */}
      <div className="kpi-row" style={{ marginBottom: 20 }}>
        {[
          { label: "Lits totaux",     value: loading ? "…" : totalLits,              color: "#6B7280" },
          { label: "Lits occupes",    value: loading ? "…" : totalOccupes,           color: "#EF4444" },
          { label: "Lits libres",     value: loading ? "…" : totalLits - totalOccupes, color: ACCENT },
          { label: "Taux d'occupation",value: loading ? "…" : `${tauxGlobal}%`,      color: couleurTaux },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: colors.bgCard, padding: "14px 20px", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Barre progression globale */}
      <div style={{ backgroundColor: colors.bgCard, borderRadius: 12, padding: "14px 20px", marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>Occupation globale</span>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={handleImprimer}
              style={{ padding: "6px 14px", background: colors.bgSurface, color: "#7C3AED", border: "1px solid #7C3AED", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Imprimer rapport
            </button>
          </div>
        </div>
        <div style={{ height: 10, backgroundColor: "#F3F4F6", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${tauxGlobal}%`, backgroundColor: couleurTaux, borderRadius: 10, transition: "width 0.3s" }} />
        </div>
        <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>{totalOccupes} / {totalLits} lits — {tauxGlobal}%</div>
      </div>

      {/* Grille services */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 16 }}>
        {SERVICES.map((service) => {
          const serviceColor = SERVICE_COLOR[service] ?? "#6B7280";
          const capacite = getCapacite(service);
          const occupes  = lits.filter((h) => h.service === service);
          const nbOcc    = occupes.length;

          return (
            <div key={service} style={{ backgroundColor: colors.bgCard, borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
              {/* Header service */}
              <div style={{ borderTop: `4px solid ${serviceColor}`, padding: "14px 18px 10px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: colors.navy }}>{service}</div>
                  <BarreProgression valeur={nbOcc} total={capacite} couleur={serviceColor} />
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: 12 }}>
                  <button
                    onClick={() => setModalConfig({ service, capacite })}
                    title="Configurer la capacite"
                    style={{ padding: "5px 8px", border: `1px solid ${colors.border}`, borderRadius: 7, background: colors.bgSurface, cursor: "pointer" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3"/>
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => setModalAdmettre({ service })}
                    style={{ padding: "5px 10px", border: "none", borderRadius: 7, background: serviceColor, color: "white", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    + Admettre
                  </button>
                </div>
              </div>

              {/* Liste patients hospitalises */}
              <div style={{ padding: "0 18px 14px" }}>
                {loading && <div style={{ height: 40, backgroundColor: colors.borderLight, borderRadius: 6, animation: "pulse 1.5s ease-in-out infinite" }} />}
                {!loading && occupes.length === 0 && (
                  <div style={{ fontSize: 12, color: colors.textMuted, textAlign: "center", padding: "14px 0" }}>Aucun patient hospitalise</div>
                )}
                {!loading && occupes.map((h) => {
                  const nom = h.patients ? `${h.patients.prenom} ${h.patients.nom}` : "—";
                  const sortieDepassee   = h.date_sortie_prevue && h.date_sortie_prevue < todayISO;
                  const sortieAujourdhui = h.date_sortie_prevue === todayISO;

                  return (
                    <div key={h.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", marginBottom: 6, backgroundColor: sortieDepassee ? "#FEF2F2" : "#F8FAFC", borderRadius: 8, borderLeft: `3px solid ${sortieDepassee ? "#EF4444" : sortieAujourdhui ? "#F59E0B" : serviceColor}` }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: colors.navy }}>{nom}</div>
                        <div style={{ fontSize: 11, color: colors.textSecondary }}>
                          Lit {h.lit ?? "?"} — Ch. {h.chambre ?? "?"} — Entree : {fmtDate(h.date_entree)}
                        </div>
                        {sortieDepassee && <span style={{ fontSize: 10, fontWeight: 800, color: "#EF4444" }}>Sortie depassee</span>}
                        {sortieAujourdhui && <span style={{ fontSize: 10, fontWeight: 800, color: "#D97706" }}>Sortie aujourd'hui</span>}
                      </div>
                      <button onClick={() => setModalLiberer(h)}
                        style={{ fontSize: 11, padding: "4px 10px", border: "none", borderRadius: 7, background: "#FEF2F2", color: "#EF4444", cursor: "pointer", fontWeight: 700, flexShrink: 0 }}>
                        Liberer
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </Layout>
  );
}
