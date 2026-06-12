import { useState, useEffect, useCallback } from "react";
import { colors } from "../../theme";
import { useAuth } from "../../context/AuthContext";
import Layout from "../../components/Layout";
import { useToast } from "../../hooks/useToast";
import { supabase } from "../../supabaseClient";
import {
  fetchRegimesActifs,
  insertPrescriptionDietetique,
  updatePrescriptionDietetique,
  fetchPlateauxJour,
  updatePlateauRepas,
  fetchConstantes,
} from "../../hooks/useMutations";
import { openDocument, tableHTML, fetchEtabFromAuth } from "../../utils/MedOSDocument";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const ACCENT = "#10B981";

const REGIME_LABELS = {
  normal:          "Normal",
  diabetique:      "Diabétique",
  sans_sel:        "Sans sel",
  sans_sel_strict: "Sans sel strict",
  hyperproteine:   "Hyperprotéiné",
  hypocalorique:   "Hypocalorique",
  mixe:            "Mixé",
  liquide:         "Liquide",
  jejune:          "Jeûne",
  sonde_enterale:  "Sonde entérale",
  parenteral:      "Parentéral",
  personnalise:    "Personnalisé",
};

const TEXTURE_LABELS = {
  normal:  "Normal",
  hache:   "Haché",
  mixe:    "Mixé",
  liquide: "Liquide",
};

const MOMENTS = [
  { key: "petit_dejeuner", label: "Petit-déjeuner", heure: "07h" },
  { key: "dejeuner",       label: "Déjeuner",       heure: "12h" },
  { key: "diner",          label: "Dîner",           heure: "18h" },
];

const ANTECEDENTS_ALERTES = ["diabète", "diabetes", "insuffisance rénale", "hypertensi", "obésité"];

const inputSt = {
  width: "100%", padding: "9px 11px", border: `1.5px solid ${colors.border}`,
  borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box",
  color: colors.navy, backgroundColor: colors.bgCard,
};

// ─── Modal Prescription ───────────────────────────────────────────────────────
function ModalPrescription({ etablissement_id, onClose, onSaved }) {
  const { success } = useToast();
  const [patients, setPatients] = useState([]);
  const [form, setForm] = useState({
    patient_id: "", type_regime: "normal", texture: "normal",
    restrictions_specifiques: "", objectif_calorique: "",
    date_debut: new Date().toISOString().slice(0, 10), date_fin: "",
    notes: "", prescripteur: "",
  });
  const auth = useAuth();

  useEffect(() => {
    supabase.from("hospitalisations")
      .select("patient_id, service, lit, chambre, patients(id, prenom, nom)")
      .eq("etablissement_id", etablissement_id)
      .eq("statut", "hospitalise")
      .then(({ data }) => setPatients(data ?? []));
    setForm((f) => ({ ...f, prescripteur: auth?.user?.email ?? "" }));
  }, []); // eslint-disable-line

  async function save() {
    if (!form.patient_id || !form.type_regime) return;
    // Désactiver l'ancien régime si existant
    await supabase.from("prescriptions_dietetiques")
      .update({ actif: false })
      .eq("patient_id", form.patient_id)
      .eq("actif", true);

    const hospi = patients.find((p) => p.patient_id === form.patient_id);
    const { error } = await insertPrescriptionDietetique({
      ...form,
      etablissement_id,
      hospitalisation_id: hospi?.id ?? null,
      objectif_calorique: form.objectif_calorique ? Number(form.objectif_calorique) : null,
      date_fin: form.date_fin || null,
      actif: true,
    });
    if (!error) { success("Prescription enregistrée"); onSaved(); onClose(); }
  }

  const TYPES = Object.entries(REGIME_LABELS);
  const TEXTURES = Object.entries(TEXTURE_LABELS);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: colors.bgCard, borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "93vh", overflowY: "auto", padding: "22px 26px", boxShadow: "0 20px 60px rgba(0,0,0,0.22)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.navy }}>Prescrire un régime alimentaire</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted }}>×</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Patient hospitalisé *</label>
            <select value={form.patient_id} onChange={(e) => setForm((f) => ({ ...f, patient_id: e.target.value }))} style={inputSt}>
              <option value="">— Sélectionner —</option>
              {patients.map((p) => (
                <option key={p.patient_id} value={p.patient_id}>
                  {p.patients?.nom} {p.patients?.prenom} — {p.service} Lit {p.lit}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 6 }}>Type de régime *</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {TYPES.map(([k, l]) => (
                <button key={k} onClick={() => setForm((f) => ({ ...f, type_regime: k }))}
                  style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer", border: `1.5px solid ${form.type_regime === k ? ACCENT : colors.border}`, background: form.type_regime === k ? "#F0FDF4" : colors.bgSurface, color: form.type_regime === k ? ACCENT : colors.text, fontWeight: form.type_regime === k ? 700 : 400 }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 6 }}>Texture</label>
            <div style={{ display: "flex", gap: 6 }}>
              {TEXTURES.map(([k, l]) => (
                <button key={k} onClick={() => setForm((f) => ({ ...f, texture: k }))}
                  style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer", border: `1.5px solid ${form.texture === k ? ACCENT : colors.border}`, background: form.texture === k ? "#F0FDF4" : colors.bgSurface, color: form.texture === k ? ACCENT : colors.text, fontWeight: form.texture === k ? 700 : 400 }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Restrictions spécifiques</label>
            <textarea value={form.restrictions_specifiques} onChange={(e) => setForm((f) => ({ ...f, restrictions_specifiques: e.target.value }))}
              rows={2} style={{ ...inputSt, resize: "vertical" }} placeholder="Ex: sans gluten, sans lactose..." />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Date début</label>
              <input type="date" value={form.date_debut} onChange={(e) => setForm((f) => ({ ...f, date_debut: e.target.value }))} style={inputSt} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Date fin (optionnel)</label>
              <input type="date" value={form.date_fin} onChange={(e) => setForm((f) => ({ ...f, date_fin: e.target.value }))} style={inputSt} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Objectif calorique (kcal/j)</label>
            <input type="number" value={form.objectif_calorique} onChange={(e) => setForm((f) => ({ ...f, objectif_calorique: e.target.value }))} style={inputSt} placeholder="Ex: 1800" />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Prescripteur</label>
            <input value={form.prescripteur} onChange={(e) => setForm((f) => ({ ...f, prescripteur: e.target.value }))} style={inputSt} />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} style={{ ...inputSt, resize: "vertical" }} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 11, background: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={save} style={{ flex: 2, padding: 11, background: ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Refus ──────────────────────────────────────────────────────────────
function ModalRefus({ plateau, onClose, onSaved }) {
  const [motif, setMotif] = useState("");
  const { success } = useToast();
  async function save() {
    await updatePlateauRepas(plateau.id, { statut: "refuse", motif_refus: motif });
    success("Refus enregistré");
    onSaved(); onClose();
  }
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1001, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: colors.bgCard, borderRadius: 14, padding: 24, width: 360, boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: colors.navy }}>Motif du refus</h3>
        <textarea value={motif} onChange={(e) => setMotif(e.target.value)} rows={3} style={{ ...inputSt, resize: "vertical" }} placeholder="Ex: Patient ne voulait pas manger, nausées..." />
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 9, background: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={save} style={{ flex: 1, padding: 9, background: "#DC2626", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

// ─── Onglet Régimes du jour ────────────────────────────────────────────────────
function OngletRegimesJour({ etablissement_id }) {
  const [dateISO, setDateISO] = useState(new Date().toISOString().slice(0, 10));
  const [plateaux, setPlateaux] = useState([]);
  const [regimes, setRegimes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refusModal, setRefusModal] = useState(null);
  const { success, error: toastError } = useToast();
  const auth = useAuth();

  const load = useCallback(async () => {
    setLoading(true);
    const [p, r] = await Promise.all([
      fetchPlateauxJour(etablissement_id, dateISO),
      fetchRegimesActifs(etablissement_id),
    ]);
    setPlateaux(p); setRegimes(r);
    setLoading(false);
  }, [etablissement_id, dateISO]);

  useEffect(() => { load(); }, [load]);

  function naviguerDate(delta) {
    const d = new Date(dateISO);
    d.setDate(d.getDate() + delta);
    setDateISO(d.toISOString().slice(0, 10));
  }

  async function genererPlateaux() {
    if (!etablissement_id) {
      toastError("Établissement non identifié. Veuillez vous déconnecter et vous reconnecter.");
      return;
    }

    const today = dateISO;
    const existing = plateaux.length > 0;
    if (existing) { toastError("Des plateaux existent déjà pour cette date."); return; }

    const regimesActifs = await fetchRegimesActifs(etablissement_id);
    const regimesHospitalises = regimesActifs.filter((r) => r.hospitalisations?.statut === "hospitalise");

    const rows = [];
    for (const regime of regimesHospitalises) {
      for (const m of MOMENTS) {
        rows.push({
          patient_id: regime.patient_id,
          etablissement_id,
          date_repas: today,
          moment: m.key,
          regime_applique: regime.type_regime,
          statut: regime.type_regime === "jejune" ? "jejune" : "planifie",
        });
      }
    }

    if (rows.length === 0) { toastError("Aucun patient hospitalisé avec régime actif."); return; }
    const { error } = await supabase.from("plateaux_repas").insert(rows);
    if (error) { toastError(`Erreur insertion: ${error.message}`); return; }
    success(`${rows.length} plateaux générés.`);
    load();
  }

  async function distribuer(plateau) {
    await updatePlateauRepas(plateau.id, {
      statut: "distribue",
      heure_distribution: new Date().toISOString(),
      distribue_par: auth?.user?.email ?? "",
    });
    success("Distribution enregistrée");
    load();
  }

  async function mettreEnJeune(plateau) {
    await updatePlateauRepas(plateau.id, { statut: "jejune", note_cuisiniere: "Jeûne pré-opératoire" });
    success("Jeûne enregistré");
    load();
  }

  async function imprimer() {
    const etab = await fetchEtabFromAuth(auth);
    const rows = plateaux.map((p) => [
      `${p.patients?.nom ?? ""} ${p.patients?.prenom ?? ""}`,
      MOMENTS.find((m) => m.key === p.moment)?.label ?? p.moment,
      REGIME_LABELS[p.regime_applique] ?? p.regime_applique ?? "—",
      p.statut,
    ]);
    openDocument({
      etablissement: etab,
      titre: `Bon de distribution repas — ${dateISO}`,
      sections: [{ titre: "Plateaux du jour", html: tableHTML(["Patient", "Repas", "Régime", "Statut"], rows) }],
    });
  }

  const nbJeune = plateaux.filter((p) => p.statut === "jejune").length;
  const nbRefus = plateaux.filter((p) => p.statut === "refuse").length;

  const STATUT_COLORS = { planifie: "#F59E0B", distribue: "#10B981", refuse: "#DC2626", jejune: "#6366F1" };
  const STATUT_LABELS = { planifie: "Planifié", distribue: "Distribué", refuse: "Refus", jejune: "Jeûne" };

  return (
    <div>
      {/* Header date */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={() => naviguerDate(-1)} style={{ padding: "7px 12px", border: `1px solid ${colors.border}`, borderRadius: 8, background: colors.bgSurface, cursor: "pointer", fontSize: 13 }}>&#8592; Hier</button>
        <span style={{ fontSize: 15, fontWeight: 700, color: colors.navy }}>
          {new Date(dateISO + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </span>
        <button onClick={() => naviguerDate(1)} style={{ padding: "7px 12px", border: `1px solid ${colors.border}`, borderRadius: 8, background: colors.bgSurface, cursor: "pointer", fontSize: 13 }}>Demain &#8594;</button>
        <button onClick={() => setDateISO(new Date().toISOString().slice(0, 10))} style={{ padding: "7px 12px", border: `1.5px solid ${ACCENT}`, borderRadius: 8, background: "#F0FDF4", color: ACCENT, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Aujourd'hui</button>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 18 }}>
        {[
          ["Régimes actifs", regimes.length, ACCENT],
          ["En jeûne", nbJeune, "#6366F1"],
          ["Refus", nbRefus, "#DC2626"],
          ["Plateaux planifiés", plateaux.filter((p) => p.statut === "planifie").length, "#F59E0B"],
        ].map(([l, v, c]) => (
          <div key={l} style={{ background: colors.bgCard, borderRadius: 12, padding: "12px 14px", borderTop: `3px solid ${c}`, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: c }}>{v}</div>
            <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        {plateaux.length === 0 && (
          <button
            onClick={genererPlateaux}
            disabled={!etablissement_id}
            style={{ padding: "9px 16px", background: etablissement_id ? ACCENT : "#9CA3AF", color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: etablissement_id ? "pointer" : "not-allowed", opacity: etablissement_id ? 1 : 0.6 }}
          >
            Générer les plateaux du jour
          </button>
        )}
        <button onClick={imprimer} style={{ padding: "9px 14px", background: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 9, fontSize: 13, cursor: "pointer" }}>
          Imprimer le bon de distribution
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: colors.textMuted, fontSize: 13 }}>Chargement...</div>
      ) : plateaux.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: colors.textMuted, fontSize: 13, background: colors.bgCard, borderRadius: 12 }}>
          Aucun plateau enregistré pour cette date. Cliquez sur "Générer les plateaux du jour".
        </div>
      ) : (
        MOMENTS.map((moment) => {
          const items = plateaux.filter((p) => p.moment === moment.key);
          if (items.length === 0) return null;
          return (
            <div key={moment.key} style={{ marginBottom: 24 }}>
              <h4 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: colors.navy, display: "flex", alignItems: "center", gap: 8 }}>
                {moment.label}
                <span style={{ fontSize: 11, color: colors.textMuted, fontWeight: 400 }}>{moment.heure}</span>
                <span style={{ fontSize: 11, background: "#F3F4F6", color: colors.text, borderRadius: 6, padding: "2px 8px" }}>{items.length} patients</span>
              </h4>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", background: colors.bgCard, borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#F8FAFC" }}>
                      {["Patient", "Régime", "Texture", "Statut", "Actions"].map((h) => (
                        <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: colors.textSecondary, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((p, i) => (
                      <tr key={p.id} style={{ borderTop: i > 0 ? `1px solid ${colors.border}` : "none" }}>
                        <td style={{ padding: "10px 12px", fontWeight: 600, color: colors.navy }}>
                          {p.patients?.nom} {p.patients?.prenom}
                        </td>
                        <td style={{ padding: "10px 12px", color: colors.text }}>
                          {REGIME_LABELS[p.regime_applique] ?? p.regime_applique ?? "—"}
                        </td>
                        <td style={{ padding: "10px 12px", color: colors.textSecondary }}>—</td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: `${STATUT_COLORS[p.statut]}20`, color: STATUT_COLORS[p.statut] }}>
                            {STATUT_LABELS[p.statut] ?? p.statut}
                          </span>
                          {p.motif_refus && <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{p.motif_refus}</div>}
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          {p.statut === "planifie" && (
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => distribuer(p)} style={{ padding: "5px 10px", background: ACCENT, color: "white", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Distribué</button>
                              <button onClick={() => setRefusModal(p)} style={{ padding: "5px 10px", background: "#FEE2E2", color: "#DC2626", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Refus</button>
                              <button onClick={() => mettreEnJeune(p)} style={{ padding: "5px 10px", background: "#EEF2FF", color: "#6366F1", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Jeûne</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}

      {refusModal && (
        <ModalRefus plateau={refusModal} onClose={() => setRefusModal(null)} onSaved={load} />
      )}
    </div>
  );
}

// ─── Onglet Prescriptions ─────────────────────────────────────────────────────
function OngletPrescriptions({ etablissement_id, role_interne }) {
  const [regimes, setRegimes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const { success } = useToast();

  const canPrescribe = ["Médecin", "Directeur", "medecin", "directeur"].some((r) => (role_interne ?? "").toLowerCase().includes(r.toLowerCase()));

  const load = useCallback(async () => {
    setLoading(true);
    const d = await fetchRegimesActifs(etablissement_id);
    setRegimes(d);
    setLoading(false);
  }, [etablissement_id]);

  useEffect(() => { load(); }, [load]);

  async function desactiver(id) {
    await updatePrescriptionDietetique(id, { actif: false });
    success("Régime désactivé");
    load();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: colors.textSecondary }}>{regimes.length} régime(s) actif(s)</span>
        {canPrescribe && (
          <button onClick={() => setShowModal(true)} style={{ padding: "9px 16px", background: ACCENT, color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            + Prescrire un régime
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: colors.textMuted, fontSize: 13 }}>Chargement...</div>
      ) : regimes.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: colors.textMuted, fontSize: 13, background: colors.bgCard, borderRadius: 12 }}>Aucune prescription active.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: colors.bgCard, borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#F8FAFC" }}>
                {["Patient", "Service / Lit", "Régime", "Texture", "Prescripteur", "Début", "Fin", ""].map((h) => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: colors.textSecondary, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {regimes.map((r, i) => (
                <tr key={r.id} style={{ borderTop: i > 0 ? `1px solid ${colors.border}` : "none" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 600, color: colors.navy }}>
                    {r.patients?.nom} {r.patients?.prenom}
                  </td>
                  <td style={{ padding: "10px 12px", color: colors.textSecondary, fontSize: 12 }}>
                    {r.hospitalisations?.service ?? "—"} {r.hospitalisations?.lit ? `— Lit ${r.hospitalisations.lit}` : ""}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: "#F0FDF4", color: ACCENT }}>
                      {REGIME_LABELS[r.type_regime] ?? r.type_regime}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", color: colors.text, fontSize: 12 }}>{TEXTURE_LABELS[r.texture] ?? r.texture ?? "Normal"}</td>
                  <td style={{ padding: "10px 12px", color: colors.textSecondary, fontSize: 12 }}>{r.prescripteur}</td>
                  <td style={{ padding: "10px 12px", color: colors.textSecondary, fontSize: 12 }}>{r.date_debut}</td>
                  <td style={{ padding: "10px 12px", color: colors.textSecondary, fontSize: 12 }}>{r.date_fin ?? "—"}</td>
                  <td style={{ padding: "8px 12px" }}>
                    {canPrescribe && (
                      <button onClick={() => desactiver(r.id)} style={{ padding: "4px 10px", background: "#FEF2F2", color: "#DC2626", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>Désactiver</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <ModalPrescription etablissement_id={etablissement_id} onClose={() => setShowModal(false)} onSaved={load} />
      )}
    </div>
  );
}

// ─── Onglet Suivi nutritionnel ─────────────────────────────────────────────────
function OngletSuiviNutritionnel({ etablissement_id }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: hospi } = await supabase
        .from("hospitalisations")
        .select("patient_id, service, date_entree, patients(id, prenom, nom), prescriptions_dietetiques(type_regime, actif)")
        .eq("etablissement_id", etablissement_id)
        .eq("statut", "hospitalise");

      if (!hospi) { setLoading(false); return; }

      const today = new Date();
      const enriched = await Promise.all(
        hospi
          .filter((h) => {
            const entree = new Date(h.date_entree);
            const jours = Math.floor((today - entree) / 86400000);
            return jours >= 3;
          })
          .map(async (h) => {
            const constantes = await fetchConstantes(h.patient_id, 30);
            const pesees = constantes.filter((c) => c.poids_kg != null).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            const regime = h.prescriptions_dietetiques?.find((p) => p.actif);
            return { ...h, pesees, regime };
          })
      );
      setPatients(enriched);
      setLoading(false);
    }
    load();
  }, [etablissement_id]);

  function evolutionPoids(pesees) {
    if (pesees.length < 2) return null;
    const debut = pesees[0].poids_kg;
    const fin = pesees[pesees.length - 1].poids_kg;
    return ((fin - debut) / debut * 100).toFixed(1);
  }

  function alerteNutrition(pesees) {
    const recent = pesees.filter((p) => {
      const d = new Date(p.created_at);
      return (new Date() - d) / 86400000 <= 7;
    });
    if (recent.length < 2) return null;
    const debut = recent[0].poids_kg;
    const fin = recent[recent.length - 1].poids_kg;
    const pct = ((fin - debut) / debut * 100);
    if (pct <= -10) return "critique";
    if (pct <= -5)  return "attention";
    return null;
  }

  return (
    <div>
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: colors.textMuted, fontSize: 13 }}>Chargement...</div>
      ) : patients.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: colors.textMuted, fontSize: 13, background: colors.bgCard, borderRadius: 12 }}>
          Aucun patient hospitalisé depuis plus de 3 jours.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {patients.map((p) => {
            const alerte = alerteNutrition(p.pesees);
            const evol = evolutionPoids(p.pesees);
            const chartData = p.pesees.map((c) => ({
              date: new Date(c.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
              poids: c.poids_kg,
            }));

            return (
              <div key={p.patient_id} style={{ background: colors.bgCard, borderRadius: 12, padding: "16px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: alerte === "critique" ? "1.5px solid #DC2626" : alerte === "attention" ? "1.5px solid #F59E0B" : `1px solid ${colors.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: colors.navy }}>{p.patients?.nom} {p.patients?.prenom}</div>
                    <div style={{ fontSize: 12, color: colors.textSecondary }}>
                      {p.service} — Régime : {p.regime ? (REGIME_LABELS[p.regime.type_regime] ?? p.regime.type_regime) : "Non prescrit"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {evol !== null && (
                      <span style={{ fontSize: 12, fontWeight: 700, color: Number(evol) < 0 ? "#DC2626" : ACCENT }}>
                        {Number(evol) >= 0 ? "+" : ""}{evol}%
                      </span>
                    )}
                    {alerte === "critique" && <span style={{ padding: "3px 9px", background: "#FEE2E2", color: "#DC2626", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>Dénutrition — alerter le médecin</span>}
                    {alerte === "attention" && <span style={{ padding: "3px 9px", background: "#FFFBEB", color: "#D97706", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>Perte de poids significative</span>}
                  </div>
                </div>
                {chartData.length >= 2 ? (
                  <div style={{ height: 80 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10 }} width={35} />
                        <Tooltip formatter={(v) => [`${v} kg`, "Poids"]} />
                        <Line type="monotone" dataKey="poids" stroke={alerte === "critique" ? "#DC2626" : ACCENT} strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: colors.textMuted, padding: "8px 0" }}>
                    {p.pesees.length === 0 ? "Aucune pesée enregistrée." : "Pesée unique — deux points minimum pour afficher la courbe."}
                    {p.pesees.length === 1 && <span style={{ marginLeft: 8, fontWeight: 600 }}>{p.pesees[0].poids_kg} kg</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function Dietetique() {
  const { auth } = useAuth();
  const etabId = auth?.etablissement_id ?? null;
  const role_interne = auth?.role_interne ?? "";
  const [onglet, setOnglet] = useState("jour");

  const ONGLETS = [
    { key: "jour",          label: "Régimes du jour" },
    { key: "prescriptions", label: "Prescriptions" },
    { key: "suivi",         label: "Suivi nutritionnel" },
  ];

  return (
    <Layout title="Diététique" subtitle="Gestion des régimes alimentaires et suivi nutritionnel">
      <div style={{ display: "flex", gap: 0, borderBottom: `2px solid ${colors.border}`, marginBottom: 24 }}>
        {ONGLETS.map(({ key, label }) => (
          <button key={key} onClick={() => setOnglet(key)}
            style={{ padding: "11px 18px", background: "none", border: "none", borderBottom: onglet === key ? `2px solid ${ACCENT}` : "2px solid transparent", fontSize: 13, fontWeight: onglet === key ? 700 : 400, color: onglet === key ? ACCENT : "#6B7280", cursor: "pointer", marginBottom: -2, whiteSpace: "nowrap" }}>
            {label}
          </button>
        ))}
      </div>

      {onglet === "jour"          && <OngletRegimesJour etablissement_id={etabId} />}
      {onglet === "prescriptions" && <OngletPrescriptions etablissement_id={etabId} role_interne={role_interne} />}
      {onglet === "suivi"         && <OngletSuiviNutritionnel etablissement_id={etabId} />}
    </Layout>
  );
}
