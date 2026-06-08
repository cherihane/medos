/**
 * Patients — Module Hôpital
 * v3 : dossier médical chronologique, alertes interactions
 */
import { colors } from "../../theme";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import Layout from "../../components/Layout";
import { usePatientsPaginated, usePatientsStats, useMedicaments } from "../../hooks/useSupabaseData";
import Pagination from "../../components/Pagination";
import { insertPatient, insertOrdonnance, upsertHospitalisation, fetchHospitalisation, insertConstante, fetchConstantes, updatePatientTriage, insertNoteEvolution, fetchNotesEvolution, fetchPlanSoinsPatient, fetchPerfusionsPatient, insertAdministration, insertPlanSoins } from "../../hooks/useMutations";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../supabaseClient";
import { openDocument, tableHTML, infoGridHTML, alertBannerHTML, signatureRowHTML, fetchEtabFromAuth } from "../../utils/MedOSDocument";
import { INTERACTIONS_MEDICAMENTEUSES, CONTRE_INDICATIONS_ANTECEDENTS } from "../../data/interactions";
import { SERVICES_HOPITAL, SERVICE_COLORS } from "../../constants/hopital";

// ── Constantes ────────────────────────────────────────────────────────────────
const ACCENT = "#10B981";

// Alias locaux depuis constantes partagees
const SERVICES     = SERVICES_HOPITAL;
const SERVICE_COLOR = SERVICE_COLORS;

// ── Triage ────────────────────────────────────────────────────────────────────
const TRIAGE = {
  urgent:      { color: "#DC2626", bg: "#FEF2F2", label: "Urgent" },
  semi_urgent: { color: "#D97706", bg: "#FFFBEB", label: "Semi-urgent" },
  non_urgent:  { color: "#16A34A", bg: "#DCFCE7", label: "Non urgent" },
};

function TriageBadge({ triage }) {
  if (!triage) return null;
  const t = TRIAGE[triage];
  if (!t) return null;
  return (
    <span style={{ padding: "2px 8px", borderRadius: 8, fontSize: 10, fontWeight: 800, backgroundColor: t.bg, color: t.color }}>
      {t.label}
    </span>
  );
}

// ── Alertes constantes vitales ────────────────────────────────────────────────
function alerteConstante(key, value) {
  const v = Number(value);
  if (isNaN(v)) return null;
  const limites = {
    temperature:       { min: 35.5, max: 38.5, label: "Temperature" },
    tension_systolique: { min: 90,  max: 180,  label: "TA systolique" },
    tension_diastolique:{ min: 60,  max: 110,  label: "TA diastolique" },
    pouls:             { min: 50,   max: 120,  label: "Pouls" },
    saturation_o2:     { min: 92,   max: 100,  label: "SpO2" },
  };
  const lim = limites[key];
  if (!lim) return null;
  if (v < lim.min) return `${lim.label} trop bas (${v})`;
  if (v > lim.max) return `${lim.label} trop eleve (${v})`;
  return null;
}

// antécédents qui déclenchent le badge ATTENTION
const ANTECEDENTS_CRITIQUES = [
  "diabète", "hypertension", "insuffisance", "epilepsie", "cancer",
  "hémophilie", "cirrhose", "insuffisance rénale", "asthme sévère", "vhb", "vih",
];

// ── Styles partagés ───────────────────────────────────────────────────────────
const inputSt = {
  width: "100%", padding: "9px 12px", border: "1.5px solid var(--border)",
  borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box",
  color: colors.navy, backgroundColor: colors.bgCard,
};
const labelSt = { fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 5 };
const Spin = () => (
  <div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "white", borderRadius: "50%", animation: "spin .8s linear infinite", flexShrink: 0 }} />
);

// ── Utilitaires ───────────────────────────────────────────────────────────────
function age(d) {
  if (!d) return "—";
  return `${Math.floor((Date.now() - new Date(d)) / (365.25 * 864e5))} ans`;
}
function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}
function genDossier() {
  return `PAT-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
}
function hasCriticalAntecedents(patient) {
  return (patient.antecedents ?? []).some((a) =>
    ANTECEDENTS_CRITIQUES.some((k) => a.toLowerCase().includes(k))
  );
}
function hasAllergies(patient) {
  return (patient.allergies ?? []).length > 0;
}

// ── Impression ordonnance ─────────────────────────────────────────────────────
async function printOrdonnance({ ordonnance, patient, hopitalNom, medecinNom, lignes, instr, auth }) {
  const etab = await fetchEtabFromAuth(auth) ?? { nom: hopitalNom, ville: "", type: "Hôpital" };
  const ref  = ordonnance.reference ?? "—";
  const emis = fmtDate(ordonnance.date_emission);
  const exp  = ordonnance.date_expiration ? `Expire le ${fmtDate(ordonnance.date_expiration)}` : null;

  openDocument({
    titre: "Ordonnance médicale",
    sousTitre: `Réf. ${ref} — Émise le ${emis}${exp ? ` · ${exp}` : ""}`,
    etablissement: etab,
    sections: [
      {
        titre: "Patient",
        html:
          infoGridHTML([
            { label: "Nom complet",       value: `${patient.prenom} ${patient.nom}` },
            { label: "Date de naissance", value: `${fmtDate(patient.date_naissance)} (${age(patient.date_naissance)})` },
            { label: "N° Dossier",        value: `<span style="font-family:monospace">${patient.numero_dossier ?? "—"}</span>` },
          ]) +
          (patient.allergies?.length > 0
            ? alertBannerHTML(`Contre-indications : ${patient.allergies.join(", ")}`, "danger")
            : ""),
      },
      {
        titre: "Médecin prescripteur",
        html: infoGridHTML([
          { label: "Médecin",         value: medecinNom ?? ordonnance.medecin_nom ?? "—" },
          { label: "Établissement",   value: hopitalNom },
        ], 2),
      },
      {
        titre: "Médicaments prescrits",
        html:
          tableHTML(["Médicament", "Posologie", "Durée"], lignes.map((l) => [l.nom, l.posologie, l.duree || "—"])) +
          (instr ? `<div style="margin-top:10px;padding:10px 14px;background:#FFFBEB;border-left:3px solid #F59E0B;border-radius:0 6px 6px 0;font-size:12px;color:#374151"><strong>Instructions :</strong> ${instr}</div>` : ""),
      },
      { titre: "", html: signatureRowHTML(["Date et signature du médecin", "Cachet de l'établissement"]) },
    ],
  });
}

// ── Impression fiche patient ──────────────────────────────────────────────────
async function printFichePatient({ patient, ordonnances, comptes, auth }) {
  const etab = await fetchEtabFromAuth(auth);
  openDocument({
    titre: "Dossier patient",
    sousTitre: `N° ${patient.numero_dossier ?? "—"} — Édité le ${new Date().toLocaleDateString("fr-FR")}`,
    etablissement: etab,
    sections: [
      {
        titre: "Informations personnelles",
        html: infoGridHTML([
          { label: "Nom complet",       value: `${patient.prenom} ${patient.nom}` },
          { label: "Date de naissance", value: `${fmtDate(patient.date_naissance)} (${age(patient.date_naissance)})` },
          { label: "Sexe",              value: patient.genre === "M" ? "Masculin" : patient.genre === "F" ? "Féminin" : patient.genre ?? "—" },
          { label: "Groupe sanguin",    value: patient.groupe_sanguin ?? "—" },
          { label: "Téléphone",         value: patient.telephone ?? "—" },
          { label: "Adresse",           value: patient.adresse ?? "—" },
          { label: "Service",           value: patient.service ?? "Médecine générale" },
          { label: "Statut",            value: patient.statut === "hospitalise" ? "Hospitalisé" : "Ambulatoire" },
          { label: "Médecin référent",  value: patient.medecin_referent ? `Dr. ${patient.medecin_referent}` : "—" },
          { label: "Dernière visite",   value: fmtDate(patient.derniere_visite) },
        ]),
      },
      ...(patient.allergies?.length > 0 ? [{
        titre: "Allergies et contre-indications",
        html: alertBannerHTML(`Contre-indications : ${patient.allergies.join(", ")}`, "danger"),
      }] : []),
      ...(patient.antecedents?.length > 0 ? [{
        titre: "Antécédents médicaux",
        html: `<div style="padding:12px 16px;background:#F8FAFC;border-radius:8px;font-size:13px;color:#374151">${patient.antecedents.join(" · ")}</div>`,
      }] : []),
      ...(ordonnances.length > 0 ? [{
        titre: `Ordonnances (${ordonnances.length})`,
        html: tableHTML(
          ["Réf.", "Date émission", "Médecin", "Statut"],
          ordonnances.map((o) => [
            `<span style="font-family:monospace">${o.reference ?? "—"}</span>`,
            fmtDate(o.date_emission),
            o.medecin_nom ?? "—",
            o.statut?.replace("_", " ") ?? "—",
          ])
        ),
      }] : []),
      ...(comptes.length > 0 ? [{
        titre: `Comptes rendus (${comptes.length})`,
        html: tableHTML(
          ["Date", "Médecin", "Motif", "Diagnostic"],
          comptes.map((c) => [
            fmtDate(c.date_consultation),
            `Dr. ${c.medecin}`,
            c.motif ?? "—",
            (c.diagnostic ?? "—").slice(0, 80) + ((c.diagnostic?.length ?? 0) > 80 ? "…" : ""),
          ])
        ),
      }] : []),
    ],
  });
}

// ── Envoi SMS ─────────────────────────────────────────────────────────────────
function envoyerSMSOrdonnance(patient, lignes, onError) {
  const tel = (patient.telephone ?? "").replace(/\s/g, "");
  if (!tel) { onError && onError("Aucun numéro de téléphone enregistré pour ce patient."); return; }
  const corps = [
    `Ordonnance MedOS — ${patient.prenom} ${patient.nom}`,
    ...lignes.map((l) => `- ${l.nom} : ${l.posologie}${l.duree ? ` (${l.duree})` : ""}`),
    "Presentez ce message en pharmacie.",
  ].join("\n");
  window.open(`sms:${tel}?body=${encodeURIComponent(corps)}`);
}

function envoyerSMSRendezVous(patient, dateRdv, medecinNom, hopitalNom, onError) {
  const tel = (patient.telephone ?? "").replace(/\s/g, "");
  if (!tel) { onError && onError("Aucun numéro de téléphone enregistré pour ce patient."); return; }
  const corps = [
    `Rappel MedOS — Rendez-vous medical`,
    `Patient : ${patient.prenom} ${patient.nom}`,
    `Date : ${fmtDate(dateRdv)}`,
    `Medecin : Dr. ${medecinNom}`,
    `Lieu : ${hopitalNom}`,
    `Merci de confirmer votre presence.`,
  ].join("\n");
  window.open(`sms:${tel}?body=${encodeURIComponent(corps)}`);
}

// ── Mutation locale comptes_rendus ────────────────────────────────────────────
async function insertCompteRendu(fields) {
  const { data, error } = await supabase.from("comptes_rendus").insert(fields).select().single();
  if (error) throw new Error(error.message);
  return data;
}

// ── Modal Nouveau patient ─────────────────────────────────────────────────────
function ModalNouveauPatient({ etablissement_id, medecinNom, onClose, onSaved, onDoublonSelected }) {
  const [form, setForm] = useState({
    prenom: "", nom: "", date_naissance: "", genre: "",
    adresse: "", telephone: "", groupe_sanguin: "",
    allergies: "", antecedents: "", medecin_referent: medecinNom ?? "",
    statut: "ambulatoire", service: "Médecine générale",
    assurance: "", numero_assurance: "",
  });
  const [dossier]           = useState(genDossier);
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState(null);
  const [doublons, setDoublons] = useState([]);
  const [checkingDoublon, setCheckingDoublon] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Détection de doublons en temps réel
  useEffect(() => {
    const prenom = form.prenom.trim();
    const nom    = form.nom.trim();
    const tel    = form.telephone.trim();
    if (prenom.length < 2 && nom.length < 2 && tel.length < 8) { setDoublons([]); return; }
    const timer = setTimeout(async () => {
      setCheckingDoublon(true);
      let q = supabase.from("patients").select("id, prenom, nom, date_naissance, telephone, numero_dossier");
      if (tel.length >= 8) {
        q = q.or(`telephone.eq.${tel},and(prenom.ilike.%${prenom}%,nom.ilike.%${nom}%)`);
      } else {
        q = q.ilike("nom", `%${nom}%`).ilike("prenom", `%${prenom}%`);
      }
      if (etablissement_id) q = q.eq("etablissement_id", etablissement_id);
      const { data } = await q.limit(5);
      setDoublons(data ?? []);
      setCheckingDoublon(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [form.prenom, form.nom, form.telephone]); // eslint-disable-line

  const handleSave = async () => {
    setErr(null);
    if (!form.prenom.trim() || !form.nom.trim()) { setErr("Prénom et nom sont obligatoires."); return; }
    setSaving(true);
    try {
      await insertPatient({
        prenom: form.prenom.trim(), nom: form.nom.trim(),
        date_naissance: form.date_naissance || null,
        genre: form.genre || null,
        adresse: form.adresse.trim() || null,
        telephone: form.telephone.trim() || null,
        groupe_sanguin: form.groupe_sanguin || null,
        allergies: form.allergies ? form.allergies.split(",").map((s) => s.trim()).filter(Boolean) : [],
        antecedents: form.antecedents ? form.antecedents.split(",").map((s) => s.trim()).filter(Boolean) : [],
        medecin_referent: form.medecin_referent.trim() || null,
        statut: form.statut, service: form.service,
        numero_dossier: dossier,
        assurance: form.assurance.trim() || null,
        numero_assurance: form.numero_assurance.trim() || null,
        derniere_visite: new Date().toISOString().slice(0, 10),
        ...(etablissement_id ? { etablissement_id } : {}),
      });
      onSaved();
    } catch (e) { setErr(e.message); setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 620, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ padding: "22px 26px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: colors.navy }}>Nouveau patient</h3>
              <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 3 }}>
                Dossier : <span style={{ fontFamily: "monospace", fontWeight: 700, color: ACCENT }}>{dossier}</span>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted }}>×</button>
          </div>
        </div>

        <div style={{ overflowY: "auto", padding: "0 26px 10px", flexGrow: 1, display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="form-row-2">
            <div><label style={labelSt}>Prénom <span style={{ color: "#EF4444" }}>*</span></label><input style={inputSt} value={form.prenom} onChange={(e) => set("prenom", e.target.value)} placeholder="Prénom" /></div>
            <div><label style={labelSt}>Nom <span style={{ color: "#EF4444" }}>*</span></label><input style={inputSt} value={form.nom} onChange={(e) => set("nom", e.target.value)} placeholder="Nom de famille" /></div>
          </div>

          {/* Détection doublons */}
          {checkingDoublon && <div style={{ fontSize: 11, color: colors.textMuted }}>Vérification des doublons...</div>}
          {!checkingDoublon && doublons.length > 0 && (
            <div style={{ padding: "12px 14px", backgroundColor: "#FFFBEB", borderRadius: 8, border: "1.5px solid #F59E0B" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#92400E", marginBottom: 8 }}>
                Patient(s) similaire(s) detecte(s) — verifier avant de creer :
              </div>
              {doublons.map((d) => (
                <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderTop: "1px solid #FDE68A", fontSize: 12 }}>
                  <div>
                    <strong style={{ color: colors.navy }}>{d.prenom} {d.nom}</strong>
                    <span style={{ color: colors.textMuted, marginLeft: 8 }}>
                      {d.date_naissance ? `ne(e) le ${new Date(d.date_naissance).toLocaleDateString("fr-FR")}` : ""}
                      {d.telephone ? ` — ${d.telephone}` : ""}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "#6B7280", fontFamily: "monospace" }}>{d.numero_dossier}</span>
                    {onDoublonSelected && (
                      <button type="button" onClick={() => { onDoublonSelected(d); onClose(); }}
                        style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, backgroundColor: ACCENT, color: "white", border: "none", cursor: "pointer", fontWeight: 600 }}>
                        Ouvrir ce dossier
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 11, color: "#92400E", marginTop: 6 }}>
                Si c'est un nouveau patient different, vous pouvez continuer l'enregistrement.
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div><label style={labelSt}>Date de naissance</label><input style={inputSt} type="date" value={form.date_naissance} onChange={(e) => set("date_naissance", e.target.value)} /></div>
            <div>
              <label style={labelSt}>Sexe</label>
              <select style={{ ...inputSt, cursor: "pointer" }} value={form.genre} onChange={(e) => set("genre", e.target.value)}>
                <option value="">—</option><option value="M">Masculin</option><option value="F">Féminin</option><option value="Autre">Autre</option>
              </select>
            </div>
            <div>
              <label style={labelSt}>Groupe sanguin</label>
              <select style={{ ...inputSt, cursor: "pointer" }} value={form.groupe_sanguin} onChange={(e) => set("groupe_sanguin", e.target.value)}>
                <option value="">—</option>
                {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map((g) => <option key={g}>{g}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row-2">
            <div><label style={labelSt}>Téléphone</label><input style={inputSt} value={form.telephone} onChange={(e) => set("telephone", e.target.value)} placeholder="+225 07 00 00 00 00" /></div>
            <div><label style={labelSt}>Adresse</label><input style={inputSt} value={form.adresse} onChange={(e) => set("adresse", e.target.value)} placeholder="Quartier, ville" /></div>
          </div>
          <div className="form-row-2">
            <div><label style={labelSt}>Assurance / Mutuelle</label><input style={inputSt} value={form.assurance} onChange={(e) => set("assurance", e.target.value)} placeholder="Ex : CNPS, UAM, Saham..." /></div>
            <div><label style={labelSt}>Numero de carte assurance</label><input style={inputSt} value={form.numero_assurance} onChange={(e) => set("numero_assurance", e.target.value)} placeholder="Ex : ASS-2026-00123" /></div>
          </div>
          <div>
            <label style={labelSt}>Allergies connues <span style={{ fontSize: 10, fontWeight: 400, color: colors.textMuted }}>— séparez par des virgules</span></label>
            <input style={{ ...inputSt, borderColor: form.allergies ? "#FCA5A5" : "#E5E7EB" }} value={form.allergies} onChange={(e) => set("allergies", e.target.value)} placeholder="Ex : Pénicilline, Aspirine, Latex" />
          </div>
          <div>
            <label style={labelSt}>Antécédents médicaux <span style={{ fontSize: 10, fontWeight: 400, color: colors.textMuted }}>— séparez par des virgules</span></label>
            <input style={inputSt} value={form.antecedents} onChange={(e) => set("antecedents", e.target.value)} placeholder="Ex : Diabète type 2, Hypertension" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div><label style={labelSt}>Médecin référent</label><input style={inputSt} value={form.medecin_referent} onChange={(e) => set("medecin_referent", e.target.value)} placeholder="Dr. Nom" /></div>
            <div>
              <label style={labelSt}>Statut</label>
              <select style={{ ...inputSt, cursor: "pointer" }} value={form.statut} onChange={(e) => set("statut", e.target.value)}>
                <option value="ambulatoire">Ambulatoire</option><option value="hospitalise">Hospitalisé</option>
              </select>
            </div>
            <div>
              <label style={labelSt}>Service</label>
              <select style={{ ...inputSt, cursor: "pointer" }} value={form.service} onChange={(e) => set("service", e.target.value)}>
                {SERVICES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          {err && <div style={{ padding: "8px 12px", background: "#FEF2F2", borderRadius: 8, fontSize: 12, color: "#DC2626" }}>{err}</div>}
        </div>

        <div style={{ display: "flex", gap: 10, padding: "16px 26px", borderTop: "1px solid var(--border-light)", flexShrink: 0 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 11, background: "#F8FAFC", color: colors.text, border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 11, background: saving ? "#E5E7EB" : ACCENT, color: saving ? "#9CA3AF" : "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {saving ? <><Spin />Enregistrement…</> : "Enregistrer le patient"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Nouvelle ordonnance ─────────────────────────────────────────────────
const LIGNE_ORD = () => ({ id: Date.now() + Math.random(), medicament_id: "", posologie: "", duree: "" });

function getStatutOrdonnance(ordonnance) {
  if (!ordonnance.date_expiration) return null;
  const diff = Math.ceil((new Date(ordonnance.date_expiration) - new Date()) / 86400000);
  if (diff < 0) return { label: "Expiree",             color: "#EF4444", bg: "#FEF2F2" };
  if (diff <= 7) return { label: `Expire dans ${diff}j`, color: "#F59E0B", bg: "#FFFBEB" };
  return { label: `Valide ${diff}j`,                    color: "#10B981", bg: "#F0FDF4" };
}

function ModalNouvelleOrdonnance({ patient, etablissement_id, medecinNom, medicaments, onClose, onSaved, lignesInitiales = null }) {
  const [lignes, setLignes]          = useState(() => {
    if (lignesInitiales && lignesInitiales.length > 0) {
      return lignesInitiales.map((l) => ({
        id: Date.now() + Math.random(),
        medicament_id: l.medicament_id ?? "",
        posologie: l.posologie ?? "",
        duree: l.duree ?? "",
      }));
    }
    return [LIGNE_ORD()];
  });
  const [dateExpiration, setDateExp] = useState("");
  const [instructions, setInstr]     = useState("");
  const [saving, setSaving]          = useState(false);
  const [err, setErr]                = useState(null);

  const setLigne = (id, k, v) => setLignes((ls) => ls.map((l) => l.id === id ? { ...l, [k]: v } : l));

  // Alertes interactions calculées en temps réel
  const lignesAvecNom = useMemo(() => lignes.map((l) => {
    const med = medicaments.find((m) => m.id === l.medicament_id);
    return { ...l, nom: med?.nom ?? "" };
  }), [lignes, medicaments]);

  const warnings = useMemo(() => checkInteractions(lignesAvecNom, patient?.antecedents), [lignesAvecNom, patient]);

  const handleSave = async () => {
    setErr(null);
    const valides = lignes.filter((l) => l.medicament_id && l.posologie.trim());
    if (!valides.length) { setErr("Ajoutez au moins un médicament avec posologie."); return; }
    if (warnings.some((w) => w.niveau === "contre-indication")) {
      const ok = window.confirm("Des contre-indications ont ete detectees. Confirmer quand meme ?");
      if (!ok) return;
    }
    setSaving(true);
    try {
      const lignesDetail = valides.map((l) => {
        const med = medicaments.find((m) => m.id === l.medicament_id);
        return { medicament_id: l.medicament_id, nom: med?.nom ?? "", posologie: l.posologie.trim(), duree: l.duree.trim() };
      });
      await insertOrdonnance({
        patient_id: patient.id, medecin_nom: medecinNom ?? "Non précisé",
        date_emission: new Date().toISOString().slice(0, 10),
        date_expiration: dateExpiration || null, statut: "en_attente",
        notes: JSON.stringify({ lignes: lignesDetail, instructions: instructions.trim() || null }),
        ...(etablissement_id ? { etablissement_id } : {}),
      });
      onSaved();
    } catch (e) { setErr(e.message); setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 620, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ padding: "22px 26px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: colors.navy }}>Nouvelle ordonnance</h3>
              <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 3 }}>{patient.prenom} {patient.nom}</div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted }}>×</button>
          </div>
          <div className="form-row-2" style={{ marginBottom: 14 }}>
            <div><label style={labelSt}>Médecin prescripteur</label><input style={{ ...inputSt, background: "#F8FAFC", color: colors.textSecondary }} value={medecinNom ?? "Non précisé"} readOnly /></div>
            <div><label style={labelSt}>Date d'expiration</label><input style={inputSt} type="date" value={dateExpiration} onChange={(e) => setDateExp(e.target.value)} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 0.8fr 32px", gap: 8, padding: "8px 10px", background: "#F8FAFC", borderRadius: "8px 8px 0 0", border: "1px solid var(--border)", borderBottom: "none" }}>
            {["Médicament", "Posologie", "Durée", ""].map((h) => <div key={h} style={{ fontSize: 11, fontWeight: 700, color: colors.textSecondary, textTransform: "uppercase" }}>{h}</div>)}
          </div>
        </div>
        <div style={{ overflowY: "auto", flexGrow: 1, padding: "0 26px" }}>
          <div style={{ border: "1px solid var(--border)", borderTop: "none", borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
            {lignes.map((l, i) => (
              <div key={l.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 0.8fr 32px", gap: 8, padding: "8px 10px", borderBottom: i < lignes.length - 1 ? "1px solid var(--border-light)" : "none", alignItems: "center", background: i % 2 === 0 ? "white" : "#FAFAFA" }}>
                <select value={l.medicament_id} onChange={(e) => setLigne(l.id, "medicament_id", e.target.value)} style={{ ...inputSt, fontSize: 12, padding: "7px 9px", background: "white" }}>
                  <option value="">— Médicament —</option>
                  {medicaments.map((m) => <option key={m.id} value={m.id}>{m.nom}{m.dosage ? ` ${m.dosage}` : ""}</option>)}
                </select>
                <input style={{ ...inputSt, fontSize: 12, padding: "7px 9px" }} value={l.posologie} onChange={(e) => setLigne(l.id, "posologie", e.target.value)} placeholder="1 cp × 3/j" />
                <input style={{ ...inputSt, fontSize: 12, padding: "7px 9px" }} value={l.duree} onChange={(e) => setLigne(l.id, "duree", e.target.value)} placeholder="7 jours" />
                <button onClick={() => lignes.length > 1 && setLignes((ls) => ls.filter((x) => x.id !== l.id))} disabled={lignes.length === 1}
                  style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: lignes.length === 1 ? "#F8FAFC" : "#FEF2F2", border: "none", borderRadius: 6, cursor: lignes.length === 1 ? "not-allowed" : "pointer", color: lignes.length === 1 ? "#D1D5DB" : "#EF4444", fontSize: 16 }}>×</button>
              </div>
            ))}
          </div>
          <button onClick={() => setLignes((ls) => [...ls, LIGNE_ORD()])} style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, padding: "6px 13px", background: "white", border: "1.5px dashed #10B981", borderRadius: 8, fontSize: 12, color: "#10B981", fontWeight: 600, cursor: "pointer" }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            Ajouter un médicament
          </button>
          <div style={{ marginTop: 12, marginBottom: 4 }}>
            <label style={labelSt}>Instructions complémentaires</label>
            <input style={inputSt} value={instructions} onChange={(e) => setInstr(e.target.value)} placeholder="À prendre avec de la nourriture, éviter le soleil…" />
          </div>
          {/* Alertes interactions */}
          {warnings.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {warnings.map((w, i) => (
                <div key={i} style={{ padding: "10px 14px", marginBottom: 6, borderRadius: 8,
                  borderLeft: `4px solid ${w.niveau === "contre-indication" ? "#EF4444" : "#F59E0B"}`,
                  backgroundColor: w.niveau === "contre-indication" ? "#FEF2F2" : "#FFFBEB",
                  fontSize: 12, color: w.niveau === "contre-indication" ? "#DC2626" : "#92400E" }}>
                  <strong>{w.niveau === "contre-indication" ? "Contre-indication" : "Precaution"} :</strong> {w.message}
                </div>
              ))}
            </div>
          )}
          {err && <div style={{ marginTop: 10, padding: "8px 12px", background: "#FEF2F2", borderRadius: 8, fontSize: 12, color: "#DC2626" }}>{err}</div>}
        </div>
        <div style={{ display: "flex", gap: 10, padding: "14px 26px", borderTop: "1px solid var(--border-light)", flexShrink: 0 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 11, background: "#F8FAFC", color: colors.text, border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 11, background: saving ? "#E5E7EB" : ACCENT, color: saving ? "#9CA3AF" : "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {saving ? <><Spin />Enregistrement…</> : "Créer l'ordonnance"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Nouveau compte rendu ────────────────────────────────────────────────
function ModalNouveauCompteRendu({ patient, etablissement_id, medecinNom, onClose, onSaved }) {
  const [form, setForm] = useState({
    medecin: medecinNom ?? "", date_consultation: new Date().toISOString().slice(0, 10),
    motif: "", examen_clinique: "", diagnostic: "", traitement: "", prochain_rdv: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setErr(null);
    if (!form.motif.trim()) { setErr("Le motif de consultation est obligatoire."); return; }
    if (!form.diagnostic.trim()) { setErr("Le diagnostic est obligatoire."); return; }
    setSaving(true);
    try {
      await insertCompteRendu({
        patient_id: patient.id,
        medecin: form.medecin.trim() || "Non précisé",
        date_consultation: form.date_consultation,
        motif: form.motif.trim(),
        examen_clinique: form.examen_clinique.trim() || null,
        diagnostic: form.diagnostic.trim(),
        traitement: form.traitement.trim() || null,
        prochain_rdv: form.prochain_rdv || null,
        ...(etablissement_id ? { etablissement_id } : {}),
      });
      onSaved();
    } catch (e) { setErr(e.message); setSaving(false); }
  };

  const textareaSt = { ...inputSt, resize: "vertical", minHeight: 72, fontFamily: "inherit" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 640, maxHeight: "92vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ padding: "22px 26px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: colors.navy }}>Nouveau compte rendu</h3>
              <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 3 }}>{patient.prenom} {patient.nom} — {patient.numero_dossier ?? ""}</div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted }}>×</button>
          </div>
        </div>

        <div style={{ overflowY: "auto", padding: "0 26px 10px", flexGrow: 1, display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="form-row-2">
            <div><label style={labelSt}>Médecin <span style={{ color: "#EF4444" }}>*</span></label><input style={inputSt} value={form.medecin} onChange={(e) => set("medecin", e.target.value)} placeholder="Dr. Nom Prénom" /></div>
            <div><label style={labelSt}>Date de consultation</label><input style={inputSt} type="date" value={form.date_consultation} onChange={(e) => set("date_consultation", e.target.value)} /></div>
          </div>
          <div>
            <label style={labelSt}>Motif de consultation <span style={{ color: "#EF4444" }}>*</span></label>
            <input style={inputSt} value={form.motif} onChange={(e) => set("motif", e.target.value)} placeholder="Douleurs abdominales, fièvre, contrôle de suivi…" />
          </div>
          <div>
            <label style={labelSt}>Examen clinique</label>
            <textarea style={textareaSt} value={form.examen_clinique} onChange={(e) => set("examen_clinique", e.target.value)} placeholder="Résultats de l'examen physique, constantes vitales, observations…" />
          </div>
          <div>
            <label style={labelSt}>Diagnostic <span style={{ color: "#EF4444" }}>*</span></label>
            <textarea style={{ ...textareaSt, borderColor: form.diagnostic ? "#6EE7B7" : "#E5E7EB" }} value={form.diagnostic} onChange={(e) => set("diagnostic", e.target.value)} placeholder="Diagnostic principal et différentiel…" />
          </div>
          <div>
            <label style={labelSt}>Traitement prescrit</label>
            <textarea style={textareaSt} value={form.traitement} onChange={(e) => set("traitement", e.target.value)} placeholder="Médicaments, posologies, durée, mesures hygiéno-diététiques…" />
          </div>
          <div>
            <label style={labelSt}>Prochain rendez-vous</label>
            <input style={inputSt} type="date" value={form.prochain_rdv} onChange={(e) => set("prochain_rdv", e.target.value)} />
          </div>
          {err && <div style={{ padding: "8px 12px", background: "#FEF2F2", borderRadius: 8, fontSize: 12, color: "#DC2626" }}>{err}</div>}
        </div>

        <div style={{ display: "flex", gap: 10, padding: "16px 26px", borderTop: "1px solid var(--border-light)", flexShrink: 0 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 11, background: "#F8FAFC", color: colors.text, border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 11, background: saving ? "#E5E7EB" : ACCENT, color: saving ? "#9CA3AF" : "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {saving ? <><Spin />Enregistrement…</> : "Enregistrer le compte rendu"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Fiche patient ─────────────────────────────────────────────────────────────
const STATUT_ORD = {
  en_attente: { bg: "#FFFBEB", color: "#D97706" }, validee: { bg: "#DCFCE7", color: "#16A34A" },
  traitee: { bg: "#DBEAFE", color: "#2563EB" },    refusee: { bg: "#FEF2F2", color: "#EF4444" },
  expiree: { bg: "#F3F4F6", color: colors.textMuted },
};

// ── Dossier médical — agrégation chronologique ─────────────────────────────
async function fetchDossierMedical(patient_id) {
  const [cRes, oRes, hRes, cvRes, dRes, fRes, eRes, nRes] = await Promise.all([
    supabase.from("consultations").select("*").eq("patient_id", patient_id).order("created_at", { ascending: false }),
    supabase.from("ordonnances").select("*").eq("patient_id", patient_id).order("date_emission", { ascending: false }),
    supabase.from("hospitalisations").select("*").eq("patient_id", patient_id).order("date_entree", { ascending: false }),
    supabase.from("constantes_vitales").select("*").eq("patient_id", patient_id).order("created_at", { ascending: false }),
    supabase.from("dispensations").select("*, medicaments(nom)").eq("patient_id", patient_id).order("created_at", { ascending: false }),
    supabase.from("factures_hopital").select("*").eq("patient_id", patient_id).order("date_facture", { ascending: false }),
    supabase.from("examens").select("*").eq("patient_id", patient_id).order("created_at", { ascending: false }),
    supabase.from("notes_evolution").select("*").eq("patient_id", patient_id).order("created_at", { ascending: false }),
  ]);
  const events = [
    ...(cRes.data  ?? []).map((e) => ({ ...e, _type: "consultation",    _date: e.created_at })),
    ...(oRes.data  ?? []).map((e) => ({ ...e, _type: "ordonnance",      _date: e.date_emission ?? e.created_at })),
    ...(hRes.data  ?? []).map((e) => ({ ...e, _type: "hospitalisation", _date: e.date_entree  ?? e.created_at })),
    ...(cvRes.data ?? []).map((e) => ({ ...e, _type: "constante",       _date: e.created_at })),
    ...(dRes.data  ?? []).map((e) => ({ ...e, _type: "dispensation",    _date: e.created_at })),
    ...(fRes.data  ?? []).map((e) => ({ ...e, _type: "facture",         _date: e.date_facture ?? e.created_at })),
    ...(eRes.data  ?? []).map((e) => ({ ...e, _type: "examen",          _date: e.created_at })),
    ...(nRes.data  ?? []).map((e) => ({ ...e, _type: "note_evolution",  _date: e.created_at })),
  ].sort((a, b) => new Date(b._date) - new Date(a._date));
  return events;
}

const DOSSIER_TYPES = {
  consultation:    { label: "Consultation",    color: "#10B981" },
  ordonnance:      { label: "Ordonnance",      color: "#3B82F6" },
  hospitalisation: { label: "Hospitalisation", color: "#EF4444" },
  constante:       { label: "Constante",       color: "#F59E0B" },
  dispensation:    { label: "Dispensation",    color: "#8B5CF6" },
  facture:         { label: "Facture",         color: "#6B7280" },
  examen:          { label: "Examen",          color: "#06B6D4" },
  note_evolution:  { label: "Note evolution",  color: "#0891B2" },
};

function fmtDateEvt(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function EventCard({ evt, onRenouveler }) {
  const cfg = DOSSIER_TYPES[evt._type] ?? { label: evt._type, color: "#6B7280" };
  let content = null;

  if (evt._type === "consultation") {
    content = (
      <>
        <div style={{ fontSize: 12 }}><strong>Service :</strong> {evt.service} {evt.medecin_nom ? `— ${evt.medecin_nom}` : ""}</div>
        {evt.motif && <div style={{ fontSize: 12 }}><strong>Motif :</strong> {evt.motif}</div>}
        <div style={{ fontSize: 12 }}><strong>Statut :</strong> {evt.statut}</div>
      </>
    );
  } else if (evt._type === "ordonnance") {
    let lignes = [];
    try { lignes = JSON.parse(evt.notes ?? "{}").lignes ?? []; } catch { /* noop */ }
    const statutOrd = getStatutOrdonnance(evt);
    content = (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12 }}><strong>Ref :</strong> {evt.reference ?? "—"} — <strong>Statut :</strong> {evt.statut}</div>
          {statutOrd && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 8, backgroundColor: statutOrd.bg, color: statutOrd.color }}>
              {statutOrd.label}
            </span>
          )}
          {statutOrd && (statutOrd.color === "#EF4444" || statutOrd.color === "#F59E0B") && onRenouveler && (
            <button onClick={() => onRenouveler(evt)} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, backgroundColor: "#10B981", color: "white", border: "none", cursor: "pointer", fontWeight: 600 }}>
              Renouveler
            </button>
          )}
        </div>
        {lignes.length > 0 && <div style={{ fontSize: 12 }}>{lignes.map((l) => `${l.nom} ${l.posologie}`).join(", ")}</div>}
      </>
    );
  } else if (evt._type === "hospitalisation") {
    content = (
      <>
        <div style={{ fontSize: 12 }}><strong>Service :</strong> {evt.service ?? "—"} — Lit {evt.lit ?? "?"} Ch. {evt.chambre ?? "?"}</div>
        <div style={{ fontSize: 12 }}><strong>Entree :</strong> {fmtDateEvt(evt.date_entree)} — <strong>Sortie prevue :</strong> {fmtDateEvt(evt.date_sortie_prevue)}</div>
        <div style={{ fontSize: 12 }}><strong>Statut :</strong> {evt.statut}</div>
      </>
    );
  } else if (evt._type === "constante") {
    const alertes = [
      evt.temperature < 36 || evt.temperature > 38.5 ? "T: " + evt.temperature + "C" : null,
      evt.pouls < 50 || evt.pouls > 100 ? "Pouls: " + evt.pouls : null,
      evt.saturation_o2 < 95 ? "SpO2: " + evt.saturation_o2 + "%" : null,
    ].filter(Boolean);
    content = (
      <>
        <div style={{ fontSize: 12, display: "flex", flexWrap: "wrap", gap: 10 }}>
          {evt.temperature  != null && <span>T: {evt.temperature}C</span>}
          {evt.tension_systolique != null && <span>TA: {evt.tension_systolique}/{evt.tension_diastolique}</span>}
          {evt.pouls != null && <span>Pouls: {evt.pouls}</span>}
          {evt.saturation_o2 != null && <span>SpO2: {evt.saturation_o2}%</span>}
        </div>
        {alertes.length > 0 && (
          <div style={{ fontSize: 11, color: "#EF4444", fontWeight: 700, marginTop: 3 }}>Hors normes: {alertes.join(" | ")}</div>
        )}
      </>
    );
  } else if (evt._type === "dispensation") {
    content = (
      <div style={{ fontSize: 12 }}>
        <strong>Medicament :</strong> {evt.medicaments?.nom ?? "—"} — <strong>Qte :</strong> {evt.quantite} — <strong>Voie :</strong> {evt.voie ?? "—"}
        {evt.prescripteur && <span> — <strong>Prescrit par :</strong> {evt.prescripteur}</span>}
      </div>
    );
  } else if (evt._type === "facture") {
    content = (
      <div style={{ fontSize: 12 }}>
        <strong>Facture :</strong> {evt.numero_facture ?? "—"} — <strong>Montant :</strong> {(evt.montant_total ?? 0).toLocaleString("fr-FR")} FCFA — <strong>Statut :</strong> {evt.statut}
      </div>
    );
  } else if (evt._type === "examen") {
    content = (
      <>
        <div style={{ fontSize: 12 }}><strong>{evt.type_examen}</strong>{evt.libelle ? ` — ${evt.libelle}` : ""} {evt.urgence ? <span style={{ color: "#EF4444", fontWeight: 700 }}>URGENT</span> : ""}</div>
        {evt.resultat_texte && <div style={{ fontSize: 12 }}><strong>Resultat :</strong> {evt.resultat_texte.slice(0, 80)}{evt.resultat_texte.length > 80 ? "…" : ""}</div>}
        {evt.interpretation && <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 6, backgroundColor: evt.interpretation === "normal" ? "#DCFCE7" : evt.interpretation === "critique" ? "#FEF2F2" : "#FEF3C7", color: evt.interpretation === "normal" ? "#16A34A" : evt.interpretation === "critique" ? "#DC2626" : "#D97706" }}>{evt.interpretation}</span>}
      </>
    );
  } else if (evt._type === "note_evolution") {
    const NOTE_BADGE = { evolution: { label: "Evolution", color: "#2563EB", bg: "#DBEAFE" }, observation: { label: "Observation", color: "#D97706", bg: "#FEF3C7" }, transmission: { label: "Transmission", color: "#7C3AED", bg: "#EDE9FE" }, sortie: { label: "Sortie", color: "#16A34A", bg: "#DCFCE7" } };
    const nb = NOTE_BADGE[evt.type] ?? NOTE_BADGE.evolution;
    content = (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <strong style={{ fontSize: 12 }}>{evt.auteur}</strong>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 6, backgroundColor: nb.bg, color: nb.color }}>{nb.label}</span>
        </div>
        <div style={{ fontSize: 12, color: "#374151" }}>{(evt.contenu ?? "").slice(0, 80)}{(evt.contenu ?? "").length > 80 ? "…" : ""}</div>
      </>
    );
  }

  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
      <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: cfg.color, marginTop: 3 }} />
        <div style={{ width: 2, flex: 1, backgroundColor: "#E5E7EB", marginTop: 4 }} />
      </div>
      <div style={{ flex: 1, background: "white", border: `1px solid #F3F4F6`, borderRadius: 10, padding: "10px 14px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: cfg.color, textTransform: "uppercase", letterSpacing: "0.04em" }}>{cfg.label}</span>
          <span style={{ fontSize: 11, color: "#9CA3AF" }}>{fmtDateEvt(evt._date)}</span>
        </div>
        {content}
      </div>
    </div>
  );
}

// ── Alertes interactions medicamenteuses ──────────────────────────────────────
function checkInteractions(lignes, antecedents) {
  const warnings = [];
  const noms = lignes.map((l) => (l.nom || "").toLowerCase());
  INTERACTIONS_MEDICAMENTEUSES.forEach(({ meds, niveau, message }) => {
    const match0 = noms.some((n) => n.includes(meds[0]));
    const match1 = noms.some((n) => n.includes(meds[1]));
    if (match0 && match1) warnings.push({ niveau, message });
  });
  const ants = (antecedents ?? []).map((a) => a.toLowerCase());
  CONTRE_INDICATIONS_ANTECEDENTS.forEach(({ antecedent, medicaments, message }) => {
    const hasAnt = ants.some((a) => a.includes(antecedent));
    const hasMed = medicaments.some((m) => noms.some((n) => n.includes(m)));
    if (hasAnt && hasMed) warnings.push({ niveau: "contre-indication", message });
  });
  return warnings;
}

function FichePatient({ patient, etablissement_id, medecinNom, hopitalNom, medicaments, onClose, onPatientUpdated, auth }) {
  const [onglet, setOnglet]           = useState("dossier");
  const [ordonnances, setOrdonnances] = useState([]);
  const [comptes, setComptes]         = useState([]);
  const [constantes, setConstantes]   = useState([]);
  const [hospi, setHospi]             = useState(null);
  const [dossier, setDossier]         = useState([]);
  const [filtreDossier, setFiltreDossier] = useState("Tous");
  const [loading, setLoading]         = useState(true);
  const [showOrd, setShowOrd]         = useState(false);
  const [ordRenouveler, setOrdRenouveler] = useState(null);
  const [showCR, setShowCR]           = useState(false);
  const [detailCR, setDetailCR]       = useState(null);
  const [smsError, setSmsError]       = useState(null);
  // Constantes form
  const [constForm, setConstForm]     = useState({ temperature: "", tension_systolique: "", tension_diastolique: "", pouls: "", saturation_o2: "", poids: "", taille: "", notes: "" });
  const [savingConst, setSavingConst] = useState(false);
  const [constAlertes, setConstAlertes] = useState([]);
  // Hospitalisation form
  const [hospiForm, setHospiForm]     = useState({ statut: "ambulatoire", service: patient.service ?? "Medecine generale", chambre: "", lit: "", date_entree: "", date_sortie_prevue: "", motif_hospitalisation: "" });
  const [savingHospi, setSavingHospi] = useState(false);
  // Soins
  const [planSoins, setPlanSoins]     = useState([]);
  const [perfusions, setPerfusions]   = useState([]);
  const [loadingSoins, setLoadingSoins] = useState(false);
  const [hospiSaved, setHospiSaved]   = useState(false);
  // Notes d'evolution
  const [notes, setNotes]             = useState([]);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteForm, setNoteForm]       = useState({ auteur: medecinNom ?? "", type: "evolution", contenu: "" });
  const [savingNote, setSavingNote]   = useState(false);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: ords }, { data: crs }, constData, hospiData, dossierData, notesData] = await Promise.all([
        supabase.from("ordonnances").select("id, reference, statut, date_emission, date_expiration, medecin_nom, notes").eq("patient_id", patient.id).order("date_emission", { ascending: false }),
        supabase.from("comptes_rendus").select("*").eq("patient_id", patient.id).order("date_consultation", { ascending: false }),
        fetchConstantes(patient.id),
        fetchHospitalisation(patient.id),
        fetchDossierMedical(patient.id),
        fetchNotesEvolution(patient.id),
      ]);
      setOrdonnances(ords ?? []);
      setComptes(crs ?? []);
      setConstantes(constData);
      setDossier(dossierData);
      setNotes(notesData);
      if (hospiData) {
        setHospi(hospiData);
        setHospiForm((f) => ({ ...f, statut: hospiData.statut ?? "ambulatoire", chambre: hospiData.chambre ?? "", lit: hospiData.lit ?? "", date_entree: hospiData.date_entree ?? "", date_sortie_prevue: hospiData.date_sortie_prevue ?? "", motif_hospitalisation: hospiData.motif_hospitalisation ?? "" }));
      }
    } catch { /* silencieux */ }
    finally { setLoading(false); }
  }, [patient.id]);

  useEffect(() => { charger(); }, [charger]);

  const parseLignes = (notes) => { try { return JSON.parse(notes).lignes ?? []; } catch { return []; } };
  const parseInstr  = (notes) => { try { return JSON.parse(notes).instructions ?? null; } catch { return null; } };

  // Historique unifié
  const historique = [
    ...ordonnances.map((o) => ({ type: "ordonnance", date: o.date_emission, item: o })),
    ...comptes.map((c)     => ({ type: "compte_rendu", date: c.date_consultation, item: c })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  // Sauvegarder constantes
  const handleSaveConst = async () => {
    setSavingConst(true);
    const alertes = Object.entries(constForm)
      .map(([k, v]) => alerteConstante(k, v))
      .filter(Boolean);
    setConstAlertes(alertes);
    try {
      const payload = {
        patient_id: patient.id,
        etablissement_id: etablissement_id ?? null,
        saisi_par: medecinNom ?? null,
        notes: constForm.notes || null,
      };
      ["temperature","tension_systolique","tension_diastolique","pouls","saturation_o2","poids","taille"].forEach((k) => {
        if (constForm[k] !== "") payload[k] = Number(constForm[k]);
      });
      await insertConstante(payload);
      const fresh = await fetchConstantes(patient.id);
      setConstantes(fresh);
      setConstForm({ temperature: "", tension_systolique: "", tension_diastolique: "", pouls: "", saturation_o2: "", poids: "", taille: "", notes: "" });
    } catch (e) { alert("Erreur : " + e.message); }
    finally { setSavingConst(false); }
  };

  // Sauvegarder hospitalisation
  const handleSaveHospi = async () => {
    setSavingHospi(true);
    try {
      await upsertHospitalisation(patient.id, { ...hospiForm, etablissement_id: etablissement_id ?? null });
      setHospiSaved(true);
      setTimeout(() => setHospiSaved(false), 2000);
      charger();
      onPatientUpdated("Statut d'hospitalisation mis a jour.");
    } catch (e) { alert("Erreur : " + e.message); }
    finally { setSavingHospi(false); }
  };

  const svcColor = SERVICE_COLOR[patient.service] ?? "#6B7280";
  const dossierFiltres = filtreDossier === "Tous" ? dossier : dossier.filter((e) => e._type === filtreDossier);

  const ri = auth?.role_interne;
  const peutVoirDossier    = !ri || ri === "Médecin" || ri === "Directeur";
  const peutVoirConst      = !ri || ri === "Médecin" || ri === "Infirmière" || ri === "Directeur" || ri === "Aide-soignant";
  const peutVoirOrd        = !ri || ri === "Médecin" || ri === "Pharmacien hospitalier" || ri === "Directeur";
  const peutVoirHospi      = !ri || ["Médecin", "Infirmière", "Aide-soignant", "Directeur"].includes(ri);
  const peutVoirComptes    = !ri || ri === "Médecin" || ri === "Directeur";
  const peutVoirHistorique = !ri || ["Secrétaire médicale", "Caissier", "Directeur"].includes(ri);
  const peutSaisirConst    = !ri || ri === "Médecin" || ri === "Infirmière" || ri === "Directeur";
  const peutCreerOrd       = !ri || ri === "Médecin" || ri === "Directeur";
  const peutVoirSoins      = !ri || ri === "Médecin" || ri === "Infirmière" || ri === "Directeur";

  // Charger soins quand l'onglet est ouvert
  useEffect(() => {
    if (onglet !== "soins" || !patient?.id) return;
    setLoadingSoins(true);
    Promise.all([fetchPlanSoinsPatient(patient.id), fetchPerfusionsPatient(patient.id)])
      .then(([ps, pf]) => { setPlanSoins(ps); setPerfusions(pf); })
      .finally(() => setLoadingSoins(false));
  }, [onglet, patient?.id]); // eslint-disable-line

  const onglets = [
    ...(peutVoirDossier    ? [["dossier", `Dossier (${dossier.length})`]] : []),
    ...(ri !== "Caissier"  ? [["infos", "Informations"]] : []),
    ...(peutVoirHospi      ? [["hospitalisation", "Hospitalisation"]] : []),
    ...(peutVoirConst      ? [["constantes", `Constantes (${constantes.length})`]] : []),
    ...(peutVoirSoins      ? [["soins", "Soins"]] : []),
    ...(peutVoirOrd        ? [["ordonnances", `Ordonnances (${ordonnances.length})`]] : []),
    ...(peutVoirComptes    ? [["comptes", `Comptes rendus (${comptes.length})`]] : []),
    ...(peutVoirHistorique ? [["historique", `Historique (${historique.length})`]] : []),
    ["qrcode", "QR Code"],
  ];

  return (
    <>
      {showOrd && <ModalNouvelleOrdonnance patient={patient} etablissement_id={etablissement_id} medecinNom={medecinNom} medicaments={medicaments} onClose={() => setShowOrd(false)} onSaved={() => { setShowOrd(false); charger(); onPatientUpdated("Ordonnance créée."); }} />}
      {ordRenouveler && <ModalNouvelleOrdonnance patient={patient} etablissement_id={etablissement_id} medecinNom={medecinNom} medicaments={medicaments} lignesInitiales={(() => { try { return JSON.parse(ordRenouveler.notes ?? "{}").lignes ?? []; } catch { return []; } })()} onClose={() => setOrdRenouveler(null)} onSaved={() => { setOrdRenouveler(null); charger(); onPatientUpdated("Ordonnance renouvelee."); }} />}
      {showCR  && <ModalNouveauCompteRendu patient={patient} etablissement_id={etablissement_id} medecinNom={medecinNom} onClose={() => setShowCR(false)} onSaved={() => { setShowCR(false); charger(); onPatientUpdated("Compte rendu enregistré."); }} />}

      {/* Détail compte rendu */}
      {detailCR && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "88vh", overflow: "auto", padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: colors.navy }}>Compte rendu du {fmtDate(detailCR.date_consultation)}</div>
                <div style={{ fontSize: 12, color: colors.textSecondary }}>Dr. {detailCR.medecin}</div>
              </div>
              <button onClick={() => setDetailCR(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted }}>×</button>
            </div>
            {[["Motif", detailCR.motif], ["Examen clinique", detailCR.examen_clinique], ["Diagnostic", detailCR.diagnostic], ["Traitement prescrit", detailCR.traitement]].map(([lbl, val]) => val ? (
              <div key={lbl} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, textTransform: "uppercase", marginBottom: 4 }}>{lbl}</div>
                <div style={{ fontSize: 13, color: colors.text, lineHeight: 1.6, padding: "10px 14px", background: "#F8FAFC", borderRadius: 8 }}>{val}</div>
              </div>
            ) : null)}
            {detailCR.prochain_rdv && (
              <div style={{ padding: "10px 14px", background: "#DCFCE7", borderRadius: 8, fontSize: 13, color: "#065F46", fontWeight: 600 }}>
                Prochain rendez-vous : {fmtDate(detailCR.prochain_rdv)}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 720, maxHeight: "92vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>

          {/* Header */}
          <div style={{ padding: "20px 26px", background: "linear-gradient(135deg, #0A1628 0%, #10B981 150%)", flexShrink: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: "white" }}>
                  {patient.prenom?.[0]}{patient.nom?.[0]}
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "white" }}>{patient.prenom} {patient.nom}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>
                    {patient.numero_dossier && <span style={{ fontFamily: "monospace", marginRight: 12 }}>{patient.numero_dossier}</span>}
                    {age(patient.date_naissance)}{patient.genre ? ` · ${patient.genre === "M" ? "M" : patient.genre === "F" ? "F" : "A"}` : ""}{patient.groupe_sanguin ? ` · ${patient.groupe_sanguin}` : ""}
                  </div>
                </div>
              </div>
              <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "white", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
              <span style={{ padding: "3px 10px", background: patient.statut === "hospitalise" ? "#EF4444" : ACCENT, color: "white", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                {patient.statut === "hospitalise" ? "Hospitalisé" : "Ambulatoire"}
              </span>
              <span style={{ padding: "3px 10px", background: svcColor, color: "white", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{patient.service ?? "Médecine générale"}</span>
              {patient.medecin_referent && <span style={{ padding: "3px 10px", background: "rgba(255,255,255,0.15)", color: "white", borderRadius: 20, fontSize: 11 }}>Dr. {patient.medecin_referent}</span>}
              {hasAllergies(patient) && <span style={{ padding: "3px 10px", background: "#DC2626", color: "white", borderRadius: 20, fontSize: 11, fontWeight: 800, letterSpacing: 0.5 }}>URGENT — Allergies</span>}
              {hasCriticalAntecedents(patient) && !hasAllergies(patient) && <span style={{ padding: "3px 10px", background: "#D97706", color: "white", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>ATTENTION — Antécédents</span>}
            </div>
          </div>

          {/* Bandeau allergies */}
          {patient.allergies?.length > 0 && (
            <div style={{ padding: "9px 26px", background: "#FEF2F2", borderBottom: "1px solid #FECACA", flexShrink: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#DC2626" }}>Contre-indications : </span>
              {patient.allergies.map((a) => <span key={a} style={{ display: "inline-block", margin: "0 4px 2px 0", padding: "2px 8px", background: "#FEE2E2", color: "#DC2626", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{a}</span>)}
            </div>
          )}

          {/* Onglets */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)", flexShrink: 0, padding: "0 26px", overflowX: "auto" }}>
            {onglets.map(([key, label]) => (
              <button key={key} onClick={() => setOnglet(key)} style={{ padding: "12px 14px", background: "none", border: "none", borderBottom: onglet === key ? `2px solid ${ACCENT}` : "2px solid transparent", fontSize: 13, fontWeight: onglet === key ? 700 : 400, color: onglet === key ? ACCENT : "#6B7280", cursor: "pointer", marginBottom: -1, whiteSpace: "nowrap" }}>
                {label}
              </button>
            ))}
          </div>

          {/* Contenu */}
          <div style={{ overflowY: "auto", flexGrow: 1, padding: "20px 26px" }}>
            {smsError && (
              <div style={{ marginBottom: 12, padding: "10px 14px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 13, color: "#DC2626" }}>
                {smsError}
              </div>
            )}

            {/* ── Dossier médical ── */}
            {onglet === "dossier" && (
              <div>
                {/* Filtres par type */}
                <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
                  {["Tous", ...Object.keys(DOSSIER_TYPES)].map((t) => (
                    <button key={t} onClick={() => setFiltreDossier(t)}
                      style={{ padding: "4px 12px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700,
                        backgroundColor: filtreDossier === t ? (DOSSIER_TYPES[t]?.color ?? ACCENT) : "#F3F4F6",
                        color: filtreDossier === t ? "white" : "#374151" }}>
                      {DOSSIER_TYPES[t]?.label ?? "Tous"}
                    </button>
                  ))}
                </div>
                {/* Bouton imprimer dossier */}
                <div style={{ marginBottom: 16 }}>
                  <button
                    onClick={async () => {
                      const etab = await fetchEtabFromAuth(auth);
                      const sections = [];
                      const infoRows = [["Prenom", patient.prenom], ["Nom", patient.nom], ["Date naissance", patient.date_naissance ?? "—"], ["Groupe sanguin", patient.groupe_sanguin ?? "—"]];
                      sections.push({ titre: "Informations patient", html: tableHTML(["Champ", "Valeur"], infoRows) });
                      if ((patient.antecedents ?? []).length > 0) {
                        sections.push({ titre: "Antecedents", html: alertBannerHTML(patient.antecedents.join(", "), "warning") });
                      }
                      Object.entries(DOSSIER_TYPES).forEach(([t, cfg]) => {
                        const evts = dossier.filter((e) => e._type === t);
                        if (evts.length === 0) return;
                        let rows = [];
                        if (t === "consultation") rows = evts.map((e) => [fmtDateEvt(e._date), e.service, e.medecin_nom ?? "—", e.motif ?? "—", e.statut]);
                        else if (t === "ordonnance") rows = evts.map((e) => [fmtDateEvt(e._date), e.reference ?? "—", e.statut]);
                        else if (t === "hospitalisation") rows = evts.map((e) => [fmtDateEvt(e._date), e.service ?? "—", `Lit ${e.lit ?? "?"} Ch.${e.chambre ?? "?"}`, e.statut]);
                        else if (t === "constante") rows = evts.map((e) => [fmtDateEvt(e._date), e.temperature ?? "—", `${e.tension_systolique ?? "—"}/${e.tension_diastolique ?? "—"}`, e.pouls ?? "—", e.saturation_o2 ?? "—"]);
                        else if (t === "examen") rows = evts.map((e) => [fmtDateEvt(e._date), e.type_examen, e.statut, e.interpretation ?? "—"]);
                        else if (t === "facture") rows = evts.map((e) => [fmtDateEvt(e._date), e.numero_facture ?? "—", String(e.montant_total ?? 0), e.statut]);
                        else rows = evts.map((e) => [fmtDateEvt(e._date), JSON.stringify(e).slice(0, 60)]);
                        const headers = t === "constante" ? ["Date", "Temp.", "TA", "Pouls", "SpO2"] : t === "examen" ? ["Date", "Type", "Statut", "Interpretation"] : t === "facture" ? ["Date", "Reference", "Montant", "Statut"] : ["Date", ...Array(rows[0]?.length - 1 ?? 0).fill("—")];
                        sections.push({ titre: cfg.label, html: tableHTML(headers, rows) });
                      });
                      openDocument({ titre: `Dossier medical — ${patient.prenom} ${patient.nom}`, etablissement: etab, sections });
                    }}
                    style={{ padding: "6px 14px", background: "#1D4ED8", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    Imprimer le dossier complet
                  </button>
                </div>
                {/* Timeline */}
                {loading && <div style={{ color: colors.textMuted, fontSize: 13 }}>Chargement...</div>}
                {!loading && dossierFiltres.length === 0 && <div style={{ fontSize: 13, color: colors.textMuted }}>Aucun evenement dans le dossier</div>}
                {!loading && dossierFiltres.map((evt, i) => <EventCard key={evt.id ?? i} evt={evt} onRenouveler={evt._type === "ordonnance" ? setOrdRenouveler : undefined} />)}
              </div>
            )}

            {/* ── Informations ── */}
            {onglet === "infos" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div>
                  <h4 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: colors.navy }}>Informations personnelles</h4>
                  <div className="form-row-2" style={{ gap: 10 }}>
                    {[["Date de naissance", fmtDate(patient.date_naissance)], ["Téléphone", patient.telephone || "—"], ["Adresse", patient.adresse || "—"], ["Dernière visite", fmtDate(patient.derniere_visite)], ["Service", patient.service ?? "—"], ["Statut", patient.statut === "hospitalise" ? "Hospitalisé" : "Ambulatoire"]].map(([lbl, val]) => (
                      <div key={lbl} style={{ padding: "10px 14px", background: "#F8FAFC", borderRadius: 8 }}>
                        <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 3 }}>{lbl}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: colors.navy }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {patient.antecedents?.length > 0 && (
                  <div>
                    <h4 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: colors.navy }}>Antécédents médicaux</h4>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {patient.antecedents.map((a) => {
                        const crit = ANTECEDENTS_CRITIQUES.some((k) => a.toLowerCase().includes(k));
                        return <span key={a} style={{ padding: "4px 10px", background: crit ? "#FFFBEB" : "#F3F4F6", color: crit ? "#D97706" : "#374151", borderRadius: 6, fontSize: 12, fontWeight: crit ? 700 : 500 }}>{a}</span>;
                      })}
                    </div>
                  </div>
                )}
                {patient.allergies?.length > 0 && (
                  <div>
                    <h4 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#DC2626" }}>Allergies et contre-indications</h4>
                    <div style={{ padding: "12px 16px", background: "#FEF2F2", borderRadius: 10, border: "1px solid #FECACA" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                        {patient.allergies.map((a) => <span key={a} style={{ padding: "4px 10px", background: "#FEE2E2", color: "#DC2626", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>{a}</span>)}
                      </div>
                      <div style={{ fontSize: 11, color: colors.textMuted }}>Vérifiez systématiquement avant toute prescription.</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Hospitalisation ── */}
            {onglet === "hospitalisation" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <h4 style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: colors.navy }}>Statut et affectation</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Statut</label>
                    <select value={hospiForm.statut} onChange={(e) => setHospiForm((f) => ({ ...f, statut: e.target.value }))} style={{ width: "100%", padding: "9px 12px", border: `1.5px solid ${colors.border}`, borderRadius: 8, fontSize: 13, outline: "none", backgroundColor: colors.bgCard, color: colors.navy }}>
                      <option value="ambulatoire">Ambulatoire</option>
                      <option value="hospitalise">Hospitalise</option>
                      <option value="sorti">Sorti</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Service</label>
                    <select value={hospiForm.service} onChange={(e) => setHospiForm((f) => ({ ...f, service: e.target.value }))} style={{ width: "100%", padding: "9px 12px", border: `1.5px solid ${colors.border}`, borderRadius: 8, fontSize: 13, outline: "none", backgroundColor: colors.bgCard, color: colors.navy }}>
                      {SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Chambre</label>
                    <input value={hospiForm.chambre} onChange={(e) => setHospiForm((f) => ({ ...f, chambre: e.target.value }))} placeholder="Ex: B12" style={{ width: "100%", padding: "9px 12px", border: `1.5px solid ${colors.border}`, borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", backgroundColor: colors.bgCard, color: colors.navy }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Lit</label>
                    <input value={hospiForm.lit} onChange={(e) => setHospiForm((f) => ({ ...f, lit: e.target.value }))} placeholder="Ex: 3" style={{ width: "100%", padding: "9px 12px", border: `1.5px solid ${colors.border}`, borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", backgroundColor: colors.bgCard, color: colors.navy }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Date d'entree</label>
                    <input type="date" value={hospiForm.date_entree} onChange={(e) => setHospiForm((f) => ({ ...f, date_entree: e.target.value }))} style={{ width: "100%", padding: "9px 12px", border: `1.5px solid ${colors.border}`, borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", backgroundColor: colors.bgCard, color: colors.navy }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Sortie prevue</label>
                    <input type="date" value={hospiForm.date_sortie_prevue} onChange={(e) => setHospiForm((f) => ({ ...f, date_sortie_prevue: e.target.value }))} style={{ width: "100%", padding: "9px 12px", border: `1.5px solid ${colors.border}`, borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", backgroundColor: colors.bgCard, color: colors.navy }} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Motif d'hospitalisation</label>
                  <textarea value={hospiForm.motif_hospitalisation} onChange={(e) => setHospiForm((f) => ({ ...f, motif_hospitalisation: e.target.value }))} rows={3} style={{ width: "100%", padding: "9px 12px", border: `1.5px solid ${colors.border}`, borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", resize: "vertical", backgroundColor: colors.bgCard, color: colors.navy }} />
                </div>
                {hospiForm.statut === "hospitalise" && (
                  <div style={{ padding: "10px 14px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 12, color: "#DC2626", fontWeight: 600 }}>
                    Ce patient sera marque comme hospitalise — verifiez que chambre et lit sont renseignes.
                  </div>
                )}
                <button onClick={handleSaveHospi} disabled={savingHospi} style={{ padding: "10px 20px", backgroundColor: ACCENT, color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", alignSelf: "flex-start" }}>
                  {savingHospi ? "Enregistrement..." : hospiSaved ? "Sauvegarde !" : "Enregistrer le statut"}
                </button>

                {/* ── Notes d'evolution (si hospitalise) ── */}
                {hospi?.statut === "hospitalise" && (() => {
                  const NOTE_TYPE_CFG = {
                    evolution:    { label: "Evolution quotidienne", badge: "Evolution",    color: "#2563EB", bg: "#DBEAFE" },
                    observation:  { label: "Observation",           badge: "Observation",  color: "#D97706", bg: "#FEF3C7" },
                    transmission: { label: "Transmission infirmiere",badge: "Transmission",color: "#7C3AED", bg: "#EDE9FE" },
                    sortie:       { label: "Note de sortie",        badge: "Sortie",       color: "#16A34A", bg: "#DCFCE7" },
                  };
                  const handleSaveNote = async () => {
                    if (!noteForm.contenu.trim()) return alert("Le contenu est obligatoire.");
                    setSavingNote(true);
                    try {
                      await insertNoteEvolution({
                        patient_id: patient.id,
                        hospitalisation_id: hospi.id,
                        etablissement_id: etablissement_id ?? null,
                        auteur: noteForm.auteur || medecinNom || "Inconnu",
                        contenu: noteForm.contenu,
                        type: noteForm.type,
                      });
                      setNoteForm((f) => ({ ...f, contenu: "" }));
                      setShowNoteForm(false);
                      charger();
                    } catch (e) { alert(e.message); }
                    finally { setSavingNote(false); }
                  };
                  const handleImprimerJournal = async () => {
                    const etab = await fetchEtabFromAuth(auth);
                    const rows = notes.map((n) => [
                      new Date(n.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
                      n.auteur,
                      NOTE_TYPE_CFG[n.type]?.badge ?? n.type,
                      n.contenu,
                    ]);
                    openDocument({
                      titre: "Journal d'hospitalisation",
                      sousTitre: `${patient.prenom} ${patient.nom} — ${hospi.service ?? "—"} — Lit ${hospi.lit ?? "?"}`,
                      etablissement: etab,
                      sections: [
                        { titre: "Informations", html: infoGridHTML([
                          { label: "Patient",        value: `${patient.prenom} ${patient.nom}` },
                          { label: "Service",        value: hospi.service ?? "—" },
                          { label: "Lit",            value: `${hospi.lit ?? "?"} — Ch. ${hospi.chambre ?? "?"}` },
                          { label: "Date entree",    value: hospi.date_entree ? new Date(hospi.date_entree).toLocaleDateString("fr-FR") : "—" },
                          { label: "Sortie prevue",  value: hospi.date_sortie_prevue ? new Date(hospi.date_sortie_prevue).toLocaleDateString("fr-FR") : "—" },
                        ]) },
                        rows.length > 0
                          ? { titre: "Notes d'evolution", html: tableHTML(["Date", "Auteur", "Type", "Note"], rows) }
                          : { titre: "Notes", html: "<p>Aucune note enregistree.</p>" },
                        { titre: "", html: signatureRowHTML(["Medecin referent", "Chef de service"]) },
                      ],
                    });
                  };

                  return (
                    <div style={{ marginTop: 24, borderTop: `1px solid ${colors.borderLight}`, paddingTop: 20 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: colors.navy }}>Journal d'hospitalisation</h4>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={handleImprimerJournal} style={{ fontSize: 11, padding: "4px 10px", border: "none", borderRadius: 7, background: "#EFF6FF", color: "#2563EB", cursor: "pointer", fontWeight: 600 }}>Imprimer le journal</button>
                          <button onClick={() => setShowNoteForm(true)} style={{ fontSize: 11, padding: "4px 10px", border: "none", borderRadius: 7, background: ACCENT, color: "white", cursor: "pointer", fontWeight: 700 }}>+ Ajouter une note</button>
                        </div>
                      </div>

                      {showNoteForm && (
                        <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "14px 16px", marginBottom: 16, border: "1px solid #E5E7EB" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                            <div>
                              <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", display: "block", marginBottom: 4 }}>Auteur</label>
                              <input value={noteForm.auteur} onChange={(e) => setNoteForm((f) => ({ ...f, auteur: e.target.value }))}
                                style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 12, outline: "none", boxSizing: "border-box" }} />
                            </div>
                            <div>
                              <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", display: "block", marginBottom: 4 }}>Type</label>
                              <select value={noteForm.type} onChange={(e) => setNoteForm((f) => ({ ...f, type: e.target.value }))}
                                style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 12, outline: "none", background: "white" }}>
                                {Object.entries(NOTE_TYPE_CFG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                              </select>
                            </div>
                          </div>
                          <div style={{ marginBottom: 10 }}>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", display: "block", marginBottom: 4 }}>Contenu *</label>
                            <textarea value={noteForm.contenu} onChange={(e) => setNoteForm((f) => ({ ...f, contenu: e.target.value }))}
                              style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 12, outline: "none", boxSizing: "border-box", resize: "vertical", minHeight: 120 }}
                              placeholder="Etat du patient, observations, prescriptions..." />
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => setShowNoteForm(false)} style={{ flex: 1, padding: "7px 0", background: "#F3F4F6", border: "none", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>Annuler</button>
                            <button onClick={handleSaveNote} disabled={savingNote} style={{ flex: 2, padding: "7px 0", background: savingNote ? "#D1D5DB" : ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: savingNote ? "wait" : "pointer" }}>
                              {savingNote ? "Enregistrement..." : "Enregistrer la note"}
                            </button>
                          </div>
                        </div>
                      )}

                      {notes.length === 0 && <div style={{ fontSize: 12, color: colors.textMuted, fontStyle: "italic" }}>Aucune note enregistree.</div>}
                      {notes.map((n, i) => {
                        const cfg = NOTE_TYPE_CFG[n.type] ?? NOTE_TYPE_CFG.evolution;
                        return (
                          <div key={n.id} style={{ paddingBottom: 12, marginBottom: 12, borderBottom: i < notes.length - 1 ? `1px solid ${colors.borderLight}` : "none" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                              <span style={{ fontSize: 11, color: colors.textMuted }}>
                                {new Date(n.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </span>
                              <span style={{ fontSize: 11, fontWeight: 800, color: cfg.color, backgroundColor: cfg.bg, padding: "1px 7px", borderRadius: 6 }}>{cfg.badge}</span>
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: colors.navy, marginBottom: 2 }}>{n.auteur}</div>
                            <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{n.contenu}</div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ── Constantes vitales ── */}
            {onglet === "constantes" && (
              <div>
                <h4 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: colors.navy }}>Saisir les constantes</h4>
                {constAlertes.length > 0 && (
                  <div style={{ padding: "10px 14px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 12, color: "#DC2626", marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>Valeurs critiques detectees :</div>
                    {constAlertes.map((a) => <div key={a}>• {a}</div>)}
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                  {[
                    { key: "temperature", label: "Temperature (°C)", placeholder: "37.2" },
                    { key: "pouls", label: "Pouls (bpm)", placeholder: "72" },
                    { key: "tension_systolique", label: "TA systolique (mmHg)", placeholder: "120" },
                    { key: "tension_diastolique", label: "TA diastolique (mmHg)", placeholder: "80" },
                    { key: "saturation_o2", label: "SpO2 (%)", placeholder: "98" },
                    { key: "poids", label: "Poids (kg)", placeholder: "70" },
                    { key: "taille", label: "Taille (cm)", placeholder: "170" },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: colors.text, display: "block", marginBottom: 3 }}>{label}</label>
                      <input type="number" step="0.1" value={constForm[key]} onChange={(e) => setConstForm((f) => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} style={{ width: "100%", padding: "8px 10px", border: `1.5px solid ${constForm[key] && alerteConstante(key, constForm[key]) ? "#EF4444" : colors.border}`, borderRadius: 7, fontSize: 13, outline: "none", boxSizing: "border-box", backgroundColor: colors.bgCard, color: colors.navy }} />
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: colors.text, display: "block", marginBottom: 3 }}>Notes</label>
                  <input value={constForm.notes} onChange={(e) => setConstForm((f) => ({ ...f, notes: e.target.value }))} style={{ width: "100%", padding: "8px 10px", border: `1.5px solid ${colors.border}`, borderRadius: 7, fontSize: 13, outline: "none", boxSizing: "border-box", backgroundColor: colors.bgCard, color: colors.navy }} />
                </div>
                {peutSaisirConst && (
                  <button onClick={handleSaveConst} disabled={savingConst} style={{ padding: "8px 20px", backgroundColor: ACCENT, color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 20 }}>
                    {savingConst ? "Enregistrement..." : "Enregistrer les constantes"}
                  </button>
                )}

                {/* Historique constantes */}
                {constantes.length > 0 && (
                  <>
                    <h4 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: colors.navy }}>Historique ({constantes.length} mesures)</h4>
                    {/* Graphique temperature + pouls */}
                    {constantes.some((c) => c.temperature || c.pouls) && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 6 }}>Temperature °C (rouge) / Pouls bpm (bleu) — 10 dernieres mesures</div>
                        <ResponsiveContainer width="100%" height={140}>
                          <LineChart data={[...constantes].reverse().slice(0, 10).map((c) => ({ date: new Date(c.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }), temp: c.temperature, pouls: c.pouls }))}>
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip />
                            <Line type="monotone" dataKey="temp" stroke="#EF4444" dot={false} name="Temp °C" />
                            <Line type="monotone" dataKey="pouls" stroke="#3B82F6" dot={false} name="Pouls bpm" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {constantes.slice(0, 8).map((c) => (
                        <div key={c.id} style={{ display: "flex", gap: 8, padding: "8px 12px", backgroundColor: colors.bgSurface, borderRadius: 8, fontSize: 12, flexWrap: "wrap" }}>
                          <span style={{ color: colors.textMuted, minWidth: 80 }}>{new Date(c.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                          {c.temperature && <span style={{ color: "#EF4444" }}>T: {c.temperature}°C</span>}
                          {(c.tension_systolique || c.tension_diastolique) && <span style={{ color: "#8B5CF6" }}>TA: {c.tension_systolique}/{c.tension_diastolique} mmHg</span>}
                          {c.pouls && <span style={{ color: "#3B82F6" }}>Pouls: {c.pouls} bpm</span>}
                          {c.saturation_o2 && <span style={{ color: c.saturation_o2 < 92 ? "#EF4444" : "#10B981" }}>SpO2: {c.saturation_o2}%</span>}
                          {c.poids && <span style={{ color: colors.text }}>Poids: {c.poids} kg</span>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── QR Code ── */}
            {onglet === "qrcode" && (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <h4 style={{ margin: "0 0 20px", fontSize: 13, fontWeight: 700, color: colors.navy }}>QR Code — Dossier patient</h4>
                <div style={{ display: "inline-block", padding: 20, backgroundColor: "white", borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.1)", marginBottom: 20 }}>
                  <QRCodeSVG
                    value={`MEDOS-PATIENT:${patient.id}:${patient.numero_dossier ?? ""}:${patient.prenom ?? ""} ${patient.nom ?? ""}`}
                    size={200}
                    level="M"
                    includeMargin={false}
                  />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy, marginBottom: 4 }}>{patient.prenom} {patient.nom}</div>
                {patient.numero_dossier && (
                  <div style={{ fontSize: 12, color: colors.textSecondary, fontFamily: "monospace", marginBottom: 16 }}>{patient.numero_dossier}</div>
                )}
                <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 20, maxWidth: 340, margin: "0 auto 20px" }}>
                  Ce QR code contient l'identifiant unique du dossier patient. Le scanner permet d'ouvrir directement sa fiche dans MedOS.
                </div>
                <button
                  onClick={() => window.print()}
                  style={{ padding: "9px 20px", backgroundColor: ACCENT, color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >
                  Imprimer le QR Code
                </button>
              </div>
            )}

            {/* ── Soins ── */}
            {onglet === "soins" && (
              <div style={{ padding: "16px 0" }}>
                {loadingSoins && <div style={{ textAlign: "center", color: colors.textMuted, padding: 24 }}>Chargement...</div>}
                {!loadingSoins && (
                  <>
                    {/* Plan de soins actif */}
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy, marginBottom: 10 }}>Plan de soins actif</div>
                      {planSoins.length === 0
                        ? <div style={{ fontSize: 13, color: colors.textMuted, padding: "12px 0" }}>Aucun medicament dans le plan de soins.</div>
                        : planSoins.map((ps) => (
                          <div key={ps.id} style={{ padding: "10px 14px", backgroundColor: colors.bgSurface, borderRadius: 10, marginBottom: 8, borderLeft: `3px solid ${ACCENT}` }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>{ps.medicament_nom}</div>
                            <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{ps.dose} · {ps.voie} · Horaires : {(ps.horaires ?? []).join(", ")}</div>
                            {ps.prescripteur && <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>Prescripteur : {ps.prescripteur}</div>}
                          </div>
                        ))
                      }
                      {peutCreerOrd && (
                        <button
                          onClick={async () => {
                            const medicament_nom = window.prompt("Medicament :");
                            if (!medicament_nom) return;
                            const dose = window.prompt("Dose :") || "1";
                            const voie = window.prompt("Voie (Oral/IV/IM/SC) :") || "Oral";
                            await insertPlanSoins({ patient_id: patient.id, etablissement_id: etablissement_id ?? null, medicament_nom, dose, voie, horaires: ["08:00","20:00"], date_debut: new Date().toISOString().slice(0,10), prescripteur: medecinNom || null, actif: true });
                            setLoadingSoins(true);
                            fetchPlanSoinsPatient(patient.id).then(setPlanSoins).finally(() => setLoadingSoins(false));
                          }}
                          style={{ padding: "6px 14px", backgroundColor: ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", marginTop: 6 }}>
                          + Ajouter au plan de soins
                        </button>
                      )}
                    </div>
                    {/* Perfusions */}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy, marginBottom: 10 }}>Perfusions actives et recentes</div>
                      {perfusions.length === 0
                        ? <div style={{ fontSize: 13, color: colors.textMuted, padding: "12px 0" }}>Aucune perfusion enregistree.</div>
                        : perfusions.map((p) => (
                          <div key={p.id} style={{ padding: "10px 14px", backgroundColor: p.statut === "en_cours" ? "#EFF6FF" : colors.bgSurface, borderRadius: 10, marginBottom: 8, borderLeft: `3px solid ${p.statut === "en_cours" ? "#3B82F6" : "#D1D5DB"}` }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>{p.type_solute} {p.volume_ml}mL</div>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 6, backgroundColor: p.statut === "en_cours" ? "#DBEAFE" : "#F3F4F6", color: p.statut === "en_cours" ? "#2563EB" : "#6B7280" }}>{p.statut}</span>
                            </div>
                            <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                              {p.debit_ml_h ? `${p.debit_ml_h}mL/h · ` : ""}
                              Debut : {new Date(p.heure_debut).toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                              {p.heure_fin_prevue ? ` · Fin prevue : ${new Date(p.heure_fin_prevue).toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}
                            </div>
                          </div>
                        ))
                      }
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Ordonnances ── */}
            {onglet === "ordonnances" && (
              <div>
                {loading ? [1,2,3].map((i) => <div key={i} style={{ height: 70, background: "#F8FAFC", borderRadius: 10, marginBottom: 10, animation: "pulse 1.5s ease-in-out infinite" }} />) :
                 ordonnances.length === 0 ? <div style={{ padding: "40px 0", textAlign: "center", color: colors.textMuted, fontSize: 13 }}>Aucune ordonnance enregistrée</div> :
                 ordonnances.map((o) => {
                  const s = STATUT_ORD[o.statut] ?? STATUT_ORD.en_attente;
                  const lignes = parseLignes(o.notes); const instr = parseInstr(o.notes);
                  return (
                    <div key={o.id} style={{ border: "1px solid var(--border)", borderRadius: 10, marginBottom: 12, overflow: "hidden" }}>
                      <div style={{ padding: "10px 14px", background: "#F8FAFC", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 700, color: colors.text }}>{o.reference}</span>
                          <span style={{ fontSize: 11, color: colors.textMuted, marginLeft: 12 }}>Émise le {fmtDate(o.date_emission)}</span>
                          {o.date_expiration && <span style={{ fontSize: 11, color: colors.textMuted, marginLeft: 8 }}>· Expire le {fmtDate(o.date_expiration)}</span>}
                        </div>
                        <span style={{ padding: "2px 8px", background: s.bg, color: s.color, borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{o.statut.replace("_", " ")}</span>
                      </div>
                      {lignes.length > 0 && (
                        <div style={{ padding: "10px 14px" }}>
                          {lignes.map((l, i) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < lignes.length - 1 ? "1px solid var(--border-light)" : "none" }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: colors.navy }}>{l.nom}</span>
                              <span style={{ fontSize: 12, color: colors.textSecondary }}>{l.posologie}{l.duree ? ` — ${l.duree}` : ""}</span>
                            </div>
                          ))}
                          {instr && <div style={{ marginTop: 8, fontSize: 12, color: colors.textSecondary, fontStyle: "italic" }}>{instr}</div>}
                        </div>
                      )}
                      {/* Actions ordonnance */}
                      <div style={{ padding: "8px 14px", borderTop: "1px solid var(--border-light)", background: "white", display: "flex", gap: 8 }}>
                        <button
                          onClick={() => printOrdonnance({ ordonnance: o, patient, hopitalNom: hopitalNom ?? "Hôpital", medecinNom, lignes, instr, auth })}
                          style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", background: "#0A1628", color: "white", border: "none", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                          Imprimer l'ordonnance
                        </button>
                        {patient.telephone && (
                          <button
                            onClick={() => { setSmsError(null); envoyerSMSOrdonnance(patient, lignes, setSmsError); }}
                            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", background: "white", color: colors.text, border: "1px solid var(--border)", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                            Envoyer par SMS
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Comptes rendus ── */}
            {onglet === "comptes" && (
              <div>
                {loading ? [1,2].map((i) => <div key={i} style={{ height: 90, background: "#F8FAFC", borderRadius: 10, marginBottom: 10, animation: "pulse 1.5s ease-in-out infinite" }} />) :
                 comptes.length === 0 ? <div style={{ padding: "40px 0", textAlign: "center", color: colors.textMuted, fontSize: 13 }}>Aucun compte rendu enregistré</div> :
                 comptes.map((c) => (
                  <div key={c.id} style={{ border: "1px solid var(--border)", borderRadius: 10, marginBottom: 12, overflow: "hidden" }}>
                    <div style={{ padding: "10px 14px", background: "#F8FAFC", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>{fmtDate(c.date_consultation)}</span>
                        <span style={{ fontSize: 12, color: colors.textSecondary, marginLeft: 10 }}>Dr. {c.medecin}</span>
                      </div>
                      {c.prochain_rdv && <span style={{ fontSize: 11, color: ACCENT, fontWeight: 600 }}>RDV : {fmtDate(c.prochain_rdv)}</span>}
                    </div>
                    {/* Résumé 3 lignes */}
                    <div style={{ padding: "10px 14px" }}>
                      {c.motif && <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}><strong style={{ color: colors.text }}>Motif :</strong> {c.motif}</div>}
                      {c.diagnostic && <div style={{ fontSize: 12, color: colors.text, marginBottom: 4, fontWeight: 600 }}>{c.diagnostic.slice(0, 120)}{c.diagnostic.length > 120 ? "…" : ""}</div>}
                      {c.traitement && <div style={{ fontSize: 12, color: colors.textSecondary }}>{c.traitement.slice(0, 100)}{c.traitement.length > 100 ? "…" : ""}</div>}
                      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                        <button onClick={() => setDetailCR(c)} style={{ padding: "4px 12px", background: "white", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11, color: colors.text, cursor: "pointer", fontWeight: 600 }}>
                          Voir le détail complet
                        </button>
                        {c.prochain_rdv && patient.telephone && (
                          <button
                            onClick={() => { setSmsError(null); envoyerSMSRendezVous(patient, c.prochain_rdv, c.medecin, hopitalNom ?? "Hôpital", setSmsError); }}
                            style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 12px", background: "white", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11, color: colors.text, cursor: "pointer", fontWeight: 600 }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                            SMS rappel RDV
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Historique ── */}
            {onglet === "historique" && (
              <div>
                {loading ? [1,2,3,4].map((i) => <div key={i} style={{ height: 56, background: "#F8FAFC", borderRadius: 8, marginBottom: 8, animation: "pulse 1.5s ease-in-out infinite" }} />) :
                 historique.length === 0 ? <div style={{ padding: "40px 0", textAlign: "center", color: colors.textMuted, fontSize: 13 }}>Aucun événement dans l'historique</div> :
                 historique.map(({ type, date, item }, idx) => (
                  <div key={item.id} style={{ display: "flex", gap: 14, marginBottom: 12, animation: "fadeIn .2s ease" }}>
                    {/* Ligne de temps */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: type === "ordonnance" ? "#3B82F6" : ACCENT, marginTop: 6, flexShrink: 0 }} />
                      {idx < historique.length - 1 && <div style={{ width: 2, background: "#E5E7EB", flexGrow: 1, marginTop: 4 }} />}
                    </div>
                    <div style={{ flex: 1, paddingBottom: 8 }}>
                      <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 3 }}>{fmtDate(date)}</div>
                      {type === "ordonnance" ? (
                        <div style={{ padding: "8px 12px", background: "#EFF6FF", borderRadius: 8, border: "1px solid #BFDBFE" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#2563EB" }}>Ordonnance</span>
                          <span style={{ fontSize: 11, color: colors.textSecondary, marginLeft: 10 }}>{item.reference} · {item.statut.replace("_", " ")}</span>
                          {parseLignes(item.notes).length > 0 && <div style={{ fontSize: 12, color: colors.text, marginTop: 4 }}>{parseLignes(item.notes).map((l) => l.nom).join(", ")}</div>}
                        </div>
                      ) : (
                        <div style={{ padding: "8px 12px", background: "#ECFDF5", borderRadius: 8, border: "1px solid #A7F3D0" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#065F46" }}>Compte rendu</span>
                          <span style={{ fontSize: 11, color: colors.textSecondary, marginLeft: 10 }}>Dr. {item.medecin}</span>
                          {item.motif && <div style={{ fontSize: 12, color: colors.text, marginTop: 3 }}>{item.motif}</div>}
                          {item.diagnostic && <div style={{ fontSize: 12, color: "#065F46", fontWeight: 600, marginTop: 2 }}>{item.diagnostic.slice(0, 80)}{item.diagnostic.length > 80 ? "…" : ""}</div>}
                          {item.prochain_rdv && <div style={{ fontSize: 11, color: ACCENT, marginTop: 3, fontWeight: 600 }}>RDV : {fmtDate(item.prochain_rdv)}</div>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ padding: "14px 26px", borderTop: "1px solid var(--border-light)", display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
            <button onClick={onClose} style={{ padding: "9px 16px", background: "#F8FAFC", color: colors.text, border: "1px solid var(--border)", borderRadius: 9, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Fermer</button>
            <button onClick={() => printFichePatient({ patient, ordonnances, comptes, auth })} style={{ padding: "9px 16px", background: "#1D4ED8", color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Imprimer la fiche</button>
            {peutVoirComptes && (
              <button onClick={() => { setShowCR(true); setOnglet("comptes"); }} style={{ padding: "9px 16px", background: "#0A1628", color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                Nouveau compte rendu
              </button>
            )}
            {peutCreerOrd && (
              <button onClick={() => { setShowOrd(true); setOnglet("ordonnances"); }} style={{ padding: "9px 16px", background: ACCENT, color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                Nouvelle ordonnance
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Hover card ────────────────────────────────────────────────────────────────
function HoverCard({ patient, anchorRef }) {
  const svcColor = SERVICE_COLOR[patient.service] ?? "#6B7280";
  return (
    <div style={{
      position: "fixed", zIndex: 800, pointerEvents: "none",
      top: (anchorRef.current?.getBoundingClientRect().top ?? 0) - 8,
      left: (anchorRef.current?.getBoundingClientRect().right ?? 0) + 12,
      width: 280, background: "white", borderRadius: 12,
      boxShadow: "0 8px 32px rgba(0,0,0,0.18)", border: "1px solid var(--border)",
      animation: "fadeIn .15s ease",
    }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-light)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>{patient.prenom} {patient.nom}</div>
        <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{patient.numero_dossier ?? ""} · {age(patient.date_naissance)}</div>
        <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap" }}>
          <span style={{ padding: "2px 7px", background: svcColor, color: "white", borderRadius: 5, fontSize: 10, fontWeight: 600 }}>{patient.service ?? "Méd. générale"}</span>
          {patient.groupe_sanguin && <span style={{ padding: "2px 7px", background: "#FEE2E2", color: "#DC2626", borderRadius: 5, fontSize: 10, fontWeight: 700 }}>{patient.groupe_sanguin}</span>}
          {patient.assurance && <span style={{ padding: "2px 6px", fontSize: 10, fontWeight: 600, backgroundColor: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE", borderRadius: 4 }}>{patient.assurance}</span>}
        </div>
      </div>
      {patient.allergies?.length > 0 && (
        <div style={{ padding: "8px 16px", background: "#FEF2F2", borderBottom: "1px solid #FECACA" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#DC2626", textTransform: "uppercase", marginBottom: 4 }}>Allergies</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {patient.allergies.map((a) => <span key={a} style={{ padding: "2px 7px", background: "#FEE2E2", color: "#DC2626", borderRadius: 5, fontSize: 10, fontWeight: 700 }}>{a}</span>)}
          </div>
        </div>
      )}
      {patient.antecedents?.length > 0 && (
        <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--border-light)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#D97706", textTransform: "uppercase", marginBottom: 4 }}>Antécédents</div>
          <div style={{ fontSize: 11, color: colors.text }}>{patient.antecedents.slice(0, 3).join(", ")}{patient.antecedents.length > 3 ? "…" : ""}</div>
        </div>
      )}
      <div style={{ padding: "8px 16px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: colors.textMuted, textTransform: "uppercase", marginBottom: 3 }}>Dernière visite</div>
        <div style={{ fontSize: 12, color: colors.text, fontWeight: 600 }}>{fmtDate(patient.derniere_visite)}</div>
      </div>
    </div>
  );
}

// ── Ligne patient ─────────────────────────────────────────────────────────────
function PatientRow({ patient, onOpen, isLast }) {
  const [hovered, setHovered] = useState(false);
  const rowRef                = useRef(null);
  const timerRef              = useRef(null);
  const urgent    = hasAllergies(patient);
  const attention = !urgent && hasCriticalAntecedents(patient);
  const svcColor  = SERVICE_COLOR[patient.service] ?? "#6B7280";

  return (
    <div
      ref={rowRef}
      onClick={onOpen}
      onMouseEnter={() => { timerRef.current = setTimeout(() => setHovered(true), 600); }}
      onMouseLeave={() => { clearTimeout(timerRef.current); setHovered(false); }}
      style={{ display: "grid", gridTemplateColumns: "2.4fr 0.7fr 0.7fr 0.7fr 1.2fr 1fr 1.2fr", gap: 0, padding: "13px 20px", borderBottom: isLast ? "none" : "1px solid var(--border-light)", alignItems: "center", cursor: "pointer", transition: "background .12s", background: hovered ? "#F8FAFC" : urgent ? "#FFFAFA" : "white", animation: "fadeIn .2s ease" }}
    >
      {hovered && <HoverCard patient={patient} anchorRef={rowRef} />}

      {/* Nom + badges */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: urgent ? "#FEE2E2" : "#DCFCE7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: urgent ? "#DC2626" : ACCENT, flexShrink: 0 }}>
          {patient.prenom?.[0]}{patient.nom?.[0]}
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>{patient.prenom} {patient.nom}</span>
            {urgent    && <span style={{ padding: "1px 6px", background: "#DC2626", color: "white", borderRadius: 5, fontSize: 9, fontWeight: 800, letterSpacing: 0.5 }}>URGENT</span>}
            {attention && <span style={{ padding: "1px 6px", background: "#D97706", color: "white", borderRadius: 5, fontSize: 9, fontWeight: 800, letterSpacing: 0.5 }}>ATTENTION</span>}
            <TriageBadge triage={patient.triage} />
          </div>
          <div style={{ fontSize: 11, color: patient.statut === "hospitalise" ? "#EF4444" : "#9CA3AF", marginTop: 1 }}>
            {patient.statut === "hospitalise" ? "Hospitalisé" : "Ambulatoire"}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 13, color: colors.text }}>{age(patient.date_naissance)}</div>
      <div style={{ fontSize: 13, color: colors.textSecondary }}>{patient.genre === "M" ? "M" : patient.genre === "F" ? "F" : patient.genre ?? "—"}</div>
      <div>
        {patient.groupe_sanguin
          ? <span style={{ padding: "2px 7px", background: "#FEE2E2", color: "#DC2626", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{patient.groupe_sanguin}</span>
          : <span style={{ color: colors.textMuted, fontSize: 13 }}>—</span>}
      </div>
      <div>
        <span style={{ padding: "2px 8px", background: svcColor + "20", color: svcColor, borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{patient.service ?? "Méd. générale"}</span>
      </div>
      <div style={{ fontSize: 12, color: colors.textSecondary }}>{fmtDate(patient.derniere_visite)}</div>
      <div style={{ fontSize: 12, color: colors.text }}>{patient.medecin_referent ? `Dr. ${patient.medecin_referent}` : "—"}</div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function PatientsHopital() {
  const { auth }                             = useAuth();
  const [recherche, setRecherche]            = useState("");
  const [filtreStatut, setFiltreStatut]      = useState("tous");
  const { data: patients, loading, total, page, setPage, totalPages, refetch } = usePatientsPaginated(recherche);
  const patientStats = usePatientsStats();
  const { data: medicaments }                = useMedicaments();
  const [filtreService, setFiltreService]    = useState("tous");
  const [filtreTriage, setFiltreTriage]      = useState("tous");
  const [showNouv, setShowNouv]              = useState(false);
  const [fichePatient, setFichePatient]      = useState(null);
  const [toast, setToast]                    = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  const etablissement_id = auth?.etablissement_id ?? null;
  const medecinNom       = auth?.user?.user_metadata?.display_name ?? auth?.structure ?? null;
  const hopitalNom       = auth?.structure ?? "Hôpital";

  const filtered = useMemo(() => patients
    .filter((p) => filtreStatut === "tous"    || p.statut  === filtreStatut)
    .filter((p) => filtreService === "tous"   || (p.service ?? "Médecine générale") === filtreService)
    .filter((p) => filtreTriage === "tous"    || p.triage  === filtreTriage)
    .filter((p) => {
      const q = recherche.toLowerCase().trim();
      if (!q) return true;
      return (
        `${p.prenom} ${p.nom}`.toLowerCase().includes(q) ||
        `${p.nom} ${p.prenom}`.toLowerCase().includes(q) ||
        (p.numero_dossier ?? "").toLowerCase().includes(q) ||
        (p.telephone ?? "").replace(/\s/g, "").includes(q.replace(/\s/g, "")) ||
        (p.date_naissance ?? "").includes(q) ||
        (p.assurance ?? "").toLowerCase().includes(q)
      );
    }), [patients, filtreStatut, filtreService, filtreTriage, recherche]);

  // Groupement par service (uniquement si filtre = "tous")
  const afficherGroupes = filtreService === "tous" && !recherche;
  const groupes = afficherGroupes
    ? SERVICES.reduce((acc, svc) => {
        const liste = filtered.filter((p) => (p.service ?? "Médecine générale") === svc);
        if (liste.length > 0) acc.push({ service: svc, liste });
        return acc;
      }, [])
    : [{ service: null, liste: filtered }];

  return (
    <Layout title="Patients" subtitle="Gestion des dossiers patients, comptes rendus et ordonnances">
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {toast && <div style={{ position: "fixed", top: 20, right: 20, background: ACCENT, color: "white", padding: "12px 20px", borderRadius: 10, fontWeight: 600, fontSize: 13, zIndex: 2000, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>{toast}</div>}

      {showNouv && <ModalNouveauPatient etablissement_id={etablissement_id} medecinNom={medecinNom} onClose={() => setShowNouv(false)} onSaved={() => { setShowNouv(false); refetch(); showToast("Patient enregistré."); }} onDoublonSelected={(p) => { setShowNouv(false); setFichePatient(p); }} />}
      {fichePatient && <FichePatient patient={fichePatient} etablissement_id={etablissement_id} medecinNom={medecinNom} hopitalNom={hopitalNom} medicaments={medicaments} onClose={() => setFichePatient(null)} onPatientUpdated={(msg) => { refetch(); showToast(msg); }} auth={auth} />}

      {/* KPI */}
      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { label: "Total patients",    value: patientStats.loading ? "…" : patientStats.total,        color: ACCENT },
          { label: "Hospitalisés",      value: patientStats.loading ? "…" : patientStats.hospitalise,  color: "#EF4444" },
          { label: "Ambulatoires",      value: patientStats.loading ? "…" : patientStats.ambulatoire,  color: "#3B82F6" },
          { label: "Alertes allergies", value: patientStats.loading ? "…" : patientStats.avecAllergies, color: "#DC2626" },
        ].map((k) => (
          <div key={k.label} style={{ flex: 1, minWidth: 130, background: "white", borderRadius: 14, padding: "15px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Barre d'actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher par nom, prénom, n° dossier, téléphone, assurance..."
          style={{ flex: 1, minWidth: 200, padding: "9px 14px", border: "1.5px solid var(--border)", borderRadius: 10, fontSize: 13, outline: "none", color: colors.navy }} />

        {/* Filtre statut */}
        <div style={{ display: "flex", gap: 5 }}>
          {[["tous","Tous"], ["hospitalise","Hospitalisés"], ["ambulatoire","Ambulatoires"]].map(([v, l]) => (
            <button key={v} onClick={() => setFiltreStatut(v)} style={{ padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: filtreStatut === v ? 700 : 500, cursor: "pointer", border: `1.5px solid ${filtreStatut === v ? ACCENT : "#E5E7EB"}`, background: filtreStatut === v ? "#DCFCE7" : "white", color: filtreStatut === v ? ACCENT : "#6B7280" }}>{l}</button>
          ))}
        </div>

        {/* Filtre service */}
        <select value={filtreService} onChange={(e) => setFiltreService(e.target.value)}
          style={{ padding: "8px 12px", border: "1.5px solid var(--border)", borderRadius: 9, fontSize: 12, color: filtreService === "tous" ? "#6B7280" : "#0A1628", fontWeight: filtreService === "tous" ? 400 : 600, outline: "none", cursor: "pointer", background: "white" }}>
          <option value="tous">Tous les services</option>
          {SERVICES.map((s) => <option key={s}>{s}</option>)}
        </select>

        {/* Filtre triage */}
        <div style={{ display: "flex", gap: 5 }}>
          {[["tous", "Tous", "#6B7280"], ["urgent", "Urgent", "#DC2626"], ["semi_urgent", "Semi-urgent", "#D97706"], ["non_urgent", "Non urgent", "#16A34A"]].map(([v, l, c]) => (
            <button key={v} onClick={() => setFiltreTriage(v)} style={{ padding: "6px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", border: `1.5px solid ${filtreTriage === v ? c : colors.border}`, backgroundColor: filtreTriage === v ? c + "18" : colors.bgCard, color: filtreTriage === v ? c : colors.textSecondary }}>{l}</button>
          ))}
        </div>

        <button onClick={() => setShowNouv(true)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", background: ACCENT, color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Ajouter un patient
        </button>
      </div>

      {/* Tableau groupé par service */}
      {loading ? (
        <div style={{ background: "white", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          {[1,2,3,4,5].map((i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "2.4fr 0.7fr 0.7fr 0.7fr 1.2fr 1fr 1.2fr", padding: "14px 20px", borderBottom: "1px solid var(--border-light)", gap: 0, alignItems: "center" }}>
              {[1,2,3,4,5,6,7].map((j) => <div key={j} style={{ height: 13, background: "#F3F4F6", borderRadius: 4, animation: "pulse 1.5s ease-in-out infinite", marginRight: 14 }} />)}
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "white", borderRadius: 16, padding: "48px 20px", textAlign: "center", color: colors.textMuted, fontSize: 13, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          {recherche || filtreStatut !== "tous" || filtreService !== "tous" ? "Aucun patient ne correspond" : "Aucun patient enregistré"}
        </div>
      ) : groupes.map(({ service, liste }) => (
        <div key={service ?? "all"} style={{ marginBottom: service ? 20 : 0 }}>
          {/* En-tête de groupe */}
          {service && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: SERVICE_COLOR[service] ?? "#6B7280" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>{service}</span>
              <span style={{ fontSize: 12, color: colors.textSecondary }}>{liste.length} patient{liste.length !== 1 ? "s" : ""}</span>
            </div>
          )}

          <div style={{ background: "white", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
            {/* Colonnes */}
            <div style={{ display: "grid", gridTemplateColumns: "2.4fr 0.7fr 0.7fr 0.7fr 1.2fr 1fr 1.2fr", gap: 0, padding: "10px 20px", background: "#F8FAFC", borderBottom: "1px solid var(--border)" }}>
              {["Nom / Prénom", "Âge", "Sexe", "Gr.sang.", "Service", "Dernière visite", "Médecin réf."].map((h) => (
                <div key={h} style={{ fontSize: 10, fontWeight: 700, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.4 }}>{h}</div>
              ))}
            </div>
            {liste.map((p, i) => (
              <PatientRow key={p.id} patient={p} onOpen={() => setFichePatient(p)} isLast={i === liste.length - 1} />
            ))}
          </div>
        </div>
      ))}

      <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
    </Layout>
  );
}
