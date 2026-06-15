import { colors } from "../../theme";
import { useState, useEffect, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import Layout from "../../components/Layout";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useAuth } from "../../context/AuthContext";
import { usePatients } from "../../hooks/useSupabaseData";
import { insertVaccination, fetchVaccinationsPatient } from "../../hooks/useMutations";
import { supabase } from "../../supabaseClient";

const ACCENT = "#10B981";

// ─── Données OMS Poids (garçons 0-24 mois) — P3 / P50 / P97 ──────────────────
const OMS_POIDS = [
  { mois: 0,  p3: 2.5, p50: 3.3, p97: 4.4 },
  { mois: 1,  p3: 3.4, p50: 4.5, p97: 5.8 },
  { mois: 2,  p3: 4.4, p50: 5.6, p97: 7.1 },
  { mois: 3,  p3: 5.0, p50: 6.4, p97: 8.0 },
  { mois: 6,  p3: 6.4, p50: 7.9, p97: 9.8 },
  { mois: 9,  p3: 7.1, p50: 8.9, p97: 11.0 },
  { mois: 12, p3: 7.7, p50: 9.6, p97: 11.9 },
  { mois: 18, p3: 8.1, p50: 10.9, p97: 13.7 },
  { mois: 24, p3: 9.7, p50: 12.2, p97: 15.3 },
];

// ─── Données OMS Taille (garçons 0-24 mois) — P3 / P50 / P97 ─────────────────
const OMS_TAILLE = [
  { mois: 0,  p3: 46.1, p50: 49.9, p97: 53.7 },
  { mois: 1,  p3: 50.8, p50: 54.7, p97: 58.6 },
  { mois: 3,  p3: 57.3, p50: 61.4, p97: 65.5 },
  { mois: 6,  p3: 63.3, p50: 67.6, p97: 71.9 },
  { mois: 9,  p3: 68.0, p50: 72.3, p97: 76.9 },
  { mois: 12, p3: 71.7, p50: 75.7, p97: 80.2 },
  { mois: 18, p3: 76.9, p50: 82.3, p97: 87.7 },
  { mois: 24, p3: 82.3, p50: 87.8, p97: 93.4 },
];

// ─── Calendrier PEV (Programme Elargi de Vaccination) ────────────────────────
const CALENDRIER_PEV = [
  { id: "naissance_bcg",   age: "Naissance",  vaccin: "BCG",                           obligatoire: true },
  { id: "naissance_vpo0",  age: "Naissance",  vaccin: "VPO 0 (Antipolio oral)",        obligatoire: true },
  { id: "6sem_penta1",     age: "6 semaines", vaccin: "Pentavalent 1 (DTC-HepB-Hib)", obligatoire: true },
  { id: "6sem_vpo1",       age: "6 semaines", vaccin: "VPO 1",                         obligatoire: true },
  { id: "6sem_pcv1",       age: "6 semaines", vaccin: "PCV13 1 (Pneumocoque)",         obligatoire: true },
  { id: "6sem_rota1",      age: "6 semaines", vaccin: "Rotavirus 1",                   obligatoire: false },
  { id: "10sem_penta2",    age: "10 semaines",vaccin: "Pentavalent 2",                 obligatoire: true },
  { id: "10sem_vpo2",      age: "10 semaines",vaccin: "VPO 2",                         obligatoire: true },
  { id: "10sem_pcv2",      age: "10 semaines",vaccin: "PCV13 2",                       obligatoire: true },
  { id: "10sem_rota2",     age: "10 semaines",vaccin: "Rotavirus 2",                   obligatoire: false },
  { id: "14sem_penta3",    age: "14 semaines",vaccin: "Pentavalent 3",                 obligatoire: true },
  { id: "14sem_vpo3",      age: "14 semaines",vaccin: "VPO 3",                         obligatoire: true },
  { id: "14sem_pcv3",      age: "14 semaines",vaccin: "PCV13 3",                       obligatoire: true },
  { id: "9mois_vaa",       age: "9 mois",     vaccin: "VAA (Fievre jaune)",            obligatoire: true },
  { id: "9mois_var",       age: "9 mois",     vaccin: "VAR (Rougeole)",                obligatoire: true },
  { id: "18mois_rappel",   age: "18 mois",    vaccin: "Rougeole rappel",               obligatoire: true },
];

// ─── Médicaments pédiatriques ─────────────────────────────────────────────────
const MEDICAMENTS_PED = [
  { nom: "Paracetamol", dose_mg_kg: 15, max_mg: 1000, freq: "3-4x/j", notes: "Ne pas depasser 60 mg/kg/j" },
  { nom: "Ibuprofene",  dose_mg_kg: 10, max_mg: 400,  freq: "3x/j",   notes: ">6 mois uniquement" },
  { nom: "Amoxicilline",dose_mg_kg: 50, max_mg: 3000, freq: "2-3x/j", notes: "Otite, pneumonie" },
  { nom: "Metronidazole",dose_mg_kg: 10, max_mg: 400, freq: "3x/j",   notes: "Infections anaerobies" },
  { nom: "Cotrimoxazole",dose_mg_kg: 5,  max_mg: 160, freq: "2x/j",   notes: "Dose en trimethoprime" },
  { nom: "Amoxicilline-Acide clavulanique", dose_mg_kg: 45, max_mg: 3000, freq: "2x/j", notes: "Infections severes" },
  { nom: "Artemether (paludisme)", dose_mg_kg: null, max_mg: null, freq: "2x/j x 3j",
    formes: [
      { tranche: "5 – 14 kg",  dose: "1 cp × 2/j × 3j" },
      { tranche: "15 – 24 kg", dose: "2 cp × 2/j × 3j" },
      { tranche: "25 – 34 kg", dose: "3 cp × 2/j × 3j" },
    ],
    notes: "Artemether-Lumefantrine 20/120 mg"
  },
];

// ─── Onglet 1 — Courbes de croissance ─────────────────────────────────────────
function OngletCourbesCroissance({ patient, etabId }) {
  const [constantes, setConstantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeGraphe, setTypeGraphe] = useState("poids");

  useEffect(() => {
    if (!patient) { setLoading(false); return; }
    supabase.from("constantes_vitales").select("created_at, poids, taille")
      .eq("patient_id", patient.id)
      .not("poids", "is", null)
      .order("created_at")
      .then(({ data }) => { setConstantes(data ?? []); setLoading(false); });
  }, [patient?.id]);

  if (!patient) return (
    <div style={{ textAlign: "center", color: colors.textMuted, padding: "40px 0", fontSize: 13 }}>
      Selectionnez un patient pour afficher sa courbe de croissance.
    </div>
  );

  const dateNaissance = patient.date_naissance ? new Date(patient.date_naissance) : null;

  const mesures = constantes
    .filter((c) => typeGraphe === "poids" ? c.poids != null : c.taille != null)
    .map((c) => {
      const mois = dateNaissance ? Math.round((new Date(c.created_at) - dateNaissance) / (30.4375 * 86400000)) : null;
      return { mois, valeur: typeGraphe === "poids" ? c.poids : c.taille };
    })
    .filter((m) => m.mois != null && m.mois >= 0);

  const referentiel = typeGraphe === "poids" ? OMS_POIDS : OMS_TAILLE;

  const donnees = referentiel.map((r) => {
    const mesure = mesures.find((m) => Math.abs(m.mois - r.mois) <= 1);
    return { ...r, mesure: mesure?.valeur ?? null };
  });

  const unite = typeGraphe === "poids" ? "kg" : "cm";
  const label = typeGraphe === "poids" ? "Poids" : "Taille";

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[["poids", "Poids (kg)"], ["taille", "Taille (cm)"]].map(([k, l]) => (
          <button key={k} onClick={() => setTypeGraphe(k)} style={{ padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: typeGraphe === k ? `2px solid ${ACCENT}` : "1.5px solid var(--border)", backgroundColor: typeGraphe === k ? "#DCFCE7" : colors.bgSurface, color: typeGraphe === k ? "#16A34A" : colors.textSecondary }}>
            {l}
          </button>
        ))}
      </div>

      <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: colors.navy }}>Courbe de croissance — {patient.prenom} {patient.nom}</h3>
          <div style={{ display: "flex", gap: 16, fontSize: 11 }}>
            {[["#DC2626", "P3 — Limite inferieure"], ["#374151", "P50 — Mediane"], ["#2563EB", "P97 — Limite superieure"], [ACCENT, "Mesures reelles"]].map(([c, l]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 12, height: 2, backgroundColor: c, borderRadius: 1 }} />
                <span style={{ color: colors.textMuted }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
        {loading ? (
          <div style={{ height: 280, backgroundColor: colors.bgSurface, borderRadius: 8 }} />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={donnees} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="mois" tickFormatter={(v) => `${v}m`} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v} ${unite}`} />
              <Tooltip formatter={(v, name) => [v ? `${v} ${unite}` : "—", name]} labelFormatter={(v) => `${v} mois`} />
              <Line type="monotone" dataKey="p3"  stroke="#DC2626" strokeWidth={1.5} dot={false} strokeDasharray="4 4" name="P3"  />
              <Line type="monotone" dataKey="p50" stroke="#374151" strokeWidth={2}   dot={false} name="P50" />
              <Line type="monotone" dataKey="p97" stroke="#2563EB" strokeWidth={1.5} dot={false} strokeDasharray="4 4" name="P97" />
              <Line type="monotone" dataKey="mesure" stroke={ACCENT} strokeWidth={2.5} dot={{ fill: ACCENT, r: 5 }} connectNulls={false} name={label} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {mesures.length === 0 && (
        <div style={{ padding: "14px 18px", backgroundColor: "#FFFBEB", borderRadius: 10, fontSize: 13, color: "#92400E" }}>
          Aucune mesure de {label.toLowerCase()} disponible. Enregistrez les constantes vitales du patient pour alimenter la courbe.
        </div>
      )}

      {mesures.length > 0 && (
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: colors.bgSurface }}>
                {["Date", "Age (mois)", label + " (" + unite + ")", "Percentile approximatif"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: colors.textSecondary, textTransform: "uppercase", borderBottom: `1px solid ${colors.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mesures.map((m, i) => {
                const ref = referentiel.find((r) => Math.abs(r.mois - m.mois) <= 2);
                let percentileLabel = "—"; let percentileColor = "#374151";
                if (ref) {
                  if (m.valeur < ref.p3)       { percentileLabel = "< P3 (Insuffisant)"; percentileColor = "#DC2626"; }
                  else if (m.valeur < ref.p50)  { percentileLabel = "P3–P50 (Normal bas)"; percentileColor = "#D97706"; }
                  else if (m.valeur <= ref.p97) { percentileLabel = "P50–P97 (Normal)"; percentileColor = "#16A34A"; }
                  else                           { percentileLabel = "> P97 (Eleve)"; percentileColor = "#2563EB"; }
                }
                return (
                  <tr key={i} style={{ borderBottom: `1px solid ${colors.borderLight}` }}>
                    <td style={{ padding: "10px 14px", color: colors.navy }}>{new Date(constantes[i]?.created_at).toLocaleDateString("fr-FR")}</td>
                    <td style={{ padding: "10px 14px", color: colors.text }}>{m.mois} mois</td>
                    <td style={{ padding: "10px 14px", fontWeight: 700, color: colors.navy }}>{m.valeur} {unite}</td>
                    <td style={{ padding: "10px 14px" }}><span style={{ fontSize: 11, fontWeight: 700, color: percentileColor }}>{percentileLabel}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Onglet 2 — Carnet vaccinal ───────────────────────────────────────────────
function OngletCarnetVaccinal({ patient, etabId, medecinNom }) {
  const { success, error: toastError } = useToast();
  const [vaccinations, setVaccinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  const charger = useCallback(async () => {
    if (!patient) { setLoading(false); return; }
    setLoading(true);
    const data = await fetchVaccinationsPatient(patient.id);
    setVaccinations(data);
    setLoading(false);
  }, [patient?.id]);

  useEffect(() => { charger(); }, [charger]);

  if (!patient) return (
    <div style={{ textAlign: "center", color: colors.textMuted, padding: "40px 0", fontSize: 13 }}>
      Selectionnez un patient pour afficher son carnet vaccinal.
    </div>
  );

  const estFait = (vaccId) => vaccinations.some((v) => v.vaccin_id === vaccId);

  const handleToggle = async (item) => {
    if (estFait(item.id)) return;
    setSaving(item.id);
    try {
      await insertVaccination({
        patient_id: patient.id,
        etablissement_id: etabId ?? null,
        vaccin_id: item.id,
        vaccin_nom: item.vaccin,
        age_prevu: item.age,
        date_administration: new Date().toISOString().slice(0, 10),
        administre_par: medecinNom ?? null,
      });
      success(`${item.vaccin} enregistre`);
      charger();
    } catch (e) { toastError("Erreur : " + e.message); }
    finally { setSaving(null); }
  };

  const ages = [...new Set(CALENDRIER_PEV.map((c) => c.age))];
  const nbFait = CALENDRIER_PEV.filter((c) => estFait(c.id)).length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: colors.navy }}>Carnet vaccinal — {patient.prenom} {patient.nom}</div>
          <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>Programme Elargi de Vaccination (PEV)</div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: nbFait === CALENDRIER_PEV.length ? "#16A34A" : "#F59E0B" }}>
          {nbFait} / {CALENDRIER_PEV.length} vaccines
        </div>
      </div>

      <div style={{ marginBottom: 12, height: 8, backgroundColor: colors.borderLight, borderRadius: 6 }}>
        <div style={{ height: "100%", width: `${Math.round((nbFait / CALENDRIER_PEV.length) * 100)}%`, backgroundColor: ACCENT, borderRadius: 6, transition: "width 0.4s" }} />
      </div>

      {loading ? (
        <div style={{ textAlign: "center", color: colors.textMuted, padding: "32px 0" }}>Chargement...</div>
      ) : (
        ages.map((age) => {
          const vaccinsAge = CALENDRIER_PEV.filter((c) => c.age === age);
          return (
            <div key={age} style={{ backgroundColor: colors.bgCard, borderRadius: 12, padding: "16px 20px", marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy, marginBottom: 10, borderBottom: `1px solid ${colors.border}`, paddingBottom: 8 }}>{age}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {vaccinsAge.map((item) => {
                  const fait = estFait(item.id);
                  const rec = vaccinations.find((v) => v.vaccin_id === item.id);
                  return (
                    <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: fait ? ACCENT : colors.bgSurface, border: `2px solid ${fait ? ACCENT : colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {fait && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, color: colors.navy, fontWeight: fait ? 700 : 400 }}>{item.vaccin}</div>
                          {rec && <div style={{ fontSize: 11, color: colors.textMuted }}>Administre le {new Date(rec.date_administration).toLocaleDateString("fr-FR")}{rec.administre_par ? ` par ${rec.administre_par}` : ""}</div>}
                        </div>
                      </div>
                      {!fait && (
                        <button onClick={() => handleToggle(item)} disabled={saving === item.id} style={{ padding: "5px 12px", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: saving === item.id ? "wait" : "pointer", backgroundColor: item.obligatoire ? "#DCFCE7" : "#EFF6FF", color: item.obligatoire ? "#16A34A" : "#2563EB", border: "none" }}>
                          {saving === item.id ? "..." : "Administrer"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── Onglet 3 — Calcul de doses ───────────────────────────────────────────────
function OngletCalculDoses({ patient }) {
  const [poids, setPoids] = useState(patient?.poids ? String(patient.poids) : "");
  const [medicamentIdx, setMedicamentIdx] = useState(0);

  const med = MEDICAMENTS_PED[medicamentIdx];
  const p = parseFloat(poids);
  const doseMg = !isNaN(p) && p > 0 && med.dose_mg_kg ? Math.min(p * med.dose_mg_kg, med.max_mg ?? Infinity) : null;
  const doseArrondie = doseMg ? Math.round(doseMg * 10) / 10 : null;

  const inpSt = { padding: "10px 12px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box", color: colors.navy, backgroundColor: colors.bgCard, width: "100%" };

  return (
    <div style={{ maxWidth: 520 }}>
      <h3 style={{ margin: "0 0 20px", fontSize: 14, fontWeight: 700, color: colors.navy }}>Calcul de doses pediatriques</h3>

      <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }}>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Poids de l'enfant (kg)</label>
          <input style={inpSt} type="number" step="0.1" min="1" max="80" value={poids} onChange={(e) => setPoids(e.target.value)} placeholder="Ex : 12.5" />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Medicament</label>
          <select style={inpSt} value={medicamentIdx} onChange={(e) => setMedicamentIdx(Number(e.target.value))}>
            {MEDICAMENTS_PED.map((m, i) => <option key={i} value={i}>{m.nom}</option>)}
          </select>
        </div>
      </div>

      {/* Résultat */}
      <div style={{ backgroundColor: doseArrondie ? "#DCFCE7" : colors.bgSurface, borderRadius: 14, padding: "20px 24px", border: `2px solid ${doseArrondie ? ACCENT : colors.border}`, marginBottom: 16 }}>
        {!poids || isNaN(p) || p <= 0 ? (
          <div style={{ textAlign: "center", color: colors.textMuted, fontSize: 13 }}>Entrez le poids de l'enfant pour calculer la dose</div>
        ) : med.formes ? (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginBottom: 12 }}>Posologie selon le poids</div>
            {med.formes.map((f, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: i < med.formes.length - 1 ? `1px solid ${colors.border}` : "none" }}>
                <span style={{ fontSize: 13, color: colors.text }}>{f.tranche}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>{f.dose}</span>
              </div>
            ))}
          </>
        ) : (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginBottom: 6 }}>Dose recommandee</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: doseArrondie ? "#16A34A" : colors.navy, marginBottom: 4 }}>
              {doseArrondie} mg
            </div>
            <div style={{ fontSize: 13, color: colors.textSecondary }}>
              {med.dose_mg_kg} mg/kg × {p} kg = {doseArrondie} mg · {med.freq}
            </div>
            {med.max_mg && p * med.dose_mg_kg >= med.max_mg && (
              <div style={{ marginTop: 8, padding: "6px 10px", backgroundColor: "#FFFBEB", borderRadius: 8, fontSize: 12, color: "#D97706", fontWeight: 600 }}>
                Dose plafonnee a {med.max_mg} mg (dose adulte maximale)
              </div>
            )}
          </>
        )}
      </div>

      {med.notes && (
        <div style={{ padding: "12px 16px", backgroundColor: "#EFF6FF", borderRadius: 10, fontSize: 12, color: "#2563EB" }}>
          <strong>Note :</strong> {med.notes}
        </div>
      )}

      <div style={{ marginTop: 20, backgroundColor: "#FEF2F2", borderRadius: 10, padding: "12px 16px", fontSize: 12, color: "#92400E" }}>
        <strong>Avertissement :</strong> Ces calculs sont indicatifs. Verifiez toujours avec un medecin et adaptez selon la pathologie, la fonction renale et le formulaire therapeutique de l'etablissement.
      </div>
    </div>
  );
}

// ─── Page principale ───────────────────────────────────────────────────────────
export default function Pediatrie() {
  const { auth } = useAuth();
  const { toasts } = useToast();
  const { data: patients } = usePatients();
  const etabId = auth?.etablissement_id ?? null;
  const medecinNom = auth?.user?.email?.split("@")[0] ?? null;

  const [onglet, setOnglet] = useState("courbes");
  const [patientId, setPatientId] = useState("");
  const [filtre, setFiltre] = useState("");

  const patient = patients.find((p) => p.id === patientId) ?? null;

  const patientsFiltres = patients
    .filter((p) => {
      const q = filtre.toLowerCase();
      return !q || `${p.prenom} ${p.nom}`.toLowerCase().includes(q) || (p.numero_dossier ?? "").includes(q);
    })
    .filter((p) => {
      if (!p.date_naissance) return true;
      const ageAns = (Date.now() - new Date(p.date_naissance)) / (365.25 * 86400000);
      return ageAns < 18;
    })
    .slice(0, 60);

  const ONGLETS = [
    { key: "courbes", label: "Courbes de croissance" },
    { key: "vaccins", label: "Carnet vaccinal"       },
    { key: "doses",   label: "Calcul de doses"       },
  ];

  const inputSt = { padding: "9px 12px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", color: colors.navy, backgroundColor: colors.bgCard };

  return (
    <Layout title="Pediatrie" subtitle="Suivi de croissance, carnet vaccinal et calcul de doses">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <Toast toasts={toasts} />

      {/* Sélecteur de patient */}
      <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy, marginBottom: 12 }}>Patient</div>
        <div style={{ display: "flex", gap: 10 }}>
          <input style={{ ...inputSt, flex: 1 }} placeholder="Rechercher par nom ou dossier..." value={filtre} onChange={(e) => setFiltre(e.target.value)} />
          <select style={{ ...inputSt, flex: 2 }} value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            <option value="">-- Selectionner un patient --</option>
            {patientsFiltres.map((p) => (
              <option key={p.id} value={p.id}>
                {p.prenom} {p.nom}{p.date_naissance ? ` — ${Math.floor((Date.now() - new Date(p.date_naissance)) / (365.25 * 86400000))} ans` : ""}{p.numero_dossier ? ` (${p.numero_dossier})` : ""}
              </option>
            ))}
          </select>
        </div>
        {patient && (
          <div style={{ marginTop: 10, padding: "8px 12px", backgroundColor: colors.bgSurface, borderRadius: 8, fontSize: 12, color: colors.textSecondary }}>
            {patient.prenom} {patient.nom} · {patient.genre === "M" ? "Garcon" : patient.genre === "F" ? "Fille" : "Genre non precise"} · {patient.date_naissance ? new Date(patient.date_naissance).toLocaleDateString("fr-FR") : "DDN non precisee"} · {patient.groupe_sanguin ?? "Groupe sanguin inconnu"}
          </div>
        )}
      </div>

      {/* Onglets */}
      <div style={{ display: "flex", gap: 2, marginBottom: 24, borderBottom: `2px solid ${colors.border}` }}>
        {ONGLETS.map((o) => (
          <button key={o.key} onClick={() => setOnglet(o.key)} style={{ padding: "10px 18px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: onglet === o.key ? 800 : 400, color: onglet === o.key ? ACCENT : colors.textSecondary, borderBottom: onglet === o.key ? `3px solid ${ACCENT}` : "3px solid transparent", marginBottom: -2, whiteSpace: "nowrap" }}>
            {o.label}
          </button>
        ))}
      </div>

      {onglet === "courbes" && <OngletCourbesCroissance patient={patient} etabId={etabId} />}
      {onglet === "vaccins" && <OngletCarnetVaccinal patient={patient} etabId={etabId} medecinNom={medecinNom} />}
      {onglet === "doses"   && <OngletCalculDoses patient={patient} />}
    </Layout>
  );
}
