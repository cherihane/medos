/**
 * Patients — Module Hôpital
 * v2 : services médicaux, comptes rendus, hover card, badges urgence, historique
 */
import { useState, useEffect, useCallback, useRef } from "react";
import Layout from "../../components/Layout";
import { usePatients, useMedicaments } from "../../hooks/useSupabaseData";
import { insertPatient, insertOrdonnance } from "../../hooks/useMutations";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../supabaseClient";
import { openDocument, tableHTML, infoGridHTML, alertBannerHTML, signatureRowHTML, etabFromAuth } from "../../utils/MedOSDocument";

// ── Constantes ────────────────────────────────────────────────────────────────
const ACCENT = "#10B981";

const SERVICES = [
  "Médecine générale", "Maternité", "Pédiatrie", "Cardiologie",
  "Chirurgie", "Urgences", "Neurologie", "Ophtalmologie",
];

const SERVICE_COLOR = {
  "Médecine générale": "#3B82F6", "Maternité": "#EC4899",
  "Pédiatrie": "#F59E0B",         "Cardiologie": "#EF4444",
  "Chirurgie": "#8B5CF6",         "Urgences": "#DC2626",
  "Neurologie": "#06B6D4",        "Ophtalmologie": "#10B981",
};

// antécédents qui déclenchent le badge ATTENTION
const ANTECEDENTS_CRITIQUES = [
  "diabète", "hypertension", "insuffisance", "epilepsie", "cancer",
  "hémophilie", "cirrhose", "insuffisance rénale", "asthme sévère", "vhb", "vih",
];

// ── Styles partagés ───────────────────────────────────────────────────────────
const inputSt = {
  width: "100%", padding: "9px 12px", border: "1.5px solid #E5E7EB",
  borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box",
  color: "#0A1628", backgroundColor: "white",
};
const labelSt = { fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 };
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
function printOrdonnance({ ordonnance, patient, hopitalNom, medecinNom, lignes, instr, auth }) {
  const etab = etabFromAuth(auth) ?? { nom: hopitalNom, ville: "", type: "Hôpital" };
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
function printFichePatient({ patient, ordonnances, comptes, auth }) {
  const etab = etabFromAuth(auth);
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
function envoyerSMSOrdonnance(patient, lignes) {
  const tel = (patient.telephone ?? "").replace(/\s/g, "");
  if (!tel) { alert("Aucun numéro de téléphone enregistré pour ce patient."); return; }
  const corps = [
    `Ordonnance MedOS — ${patient.prenom} ${patient.nom}`,
    ...lignes.map((l) => `- ${l.nom} : ${l.posologie}${l.duree ? ` (${l.duree})` : ""}`),
    "Presentez ce message en pharmacie.",
  ].join("\n");
  window.open(`sms:${tel}?body=${encodeURIComponent(corps)}`);
}

function envoyerSMSRendezVous(patient, dateRdv, medecinNom, hopitalNom) {
  const tel = (patient.telephone ?? "").replace(/\s/g, "");
  if (!tel) { alert("Aucun numéro de téléphone enregistré pour ce patient."); return; }
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
function ModalNouveauPatient({ etablissement_id, medecinNom, onClose, onSaved }) {
  const [form, setForm] = useState({
    prenom: "", nom: "", date_naissance: "", genre: "",
    adresse: "", telephone: "", groupe_sanguin: "",
    allergies: "", antecedents: "", medecin_referent: medecinNom ?? "",
    statut: "ambulatoire", service: "Médecine générale",
  });
  const [dossier]           = useState(genDossier);
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

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
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0A1628" }}>Nouveau patient</h3>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 3 }}>
                Dossier : <span style={{ fontFamily: "monospace", fontWeight: 700, color: ACCENT }}>{dossier}</span>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF" }}>×</button>
          </div>
        </div>

        <div style={{ overflowY: "auto", padding: "0 26px 10px", flexGrow: 1, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={labelSt}>Prénom <span style={{ color: "#EF4444" }}>*</span></label><input style={inputSt} value={form.prenom} onChange={(e) => set("prenom", e.target.value)} placeholder="Prénom" /></div>
            <div><label style={labelSt}>Nom <span style={{ color: "#EF4444" }}>*</span></label><input style={inputSt} value={form.nom} onChange={(e) => set("nom", e.target.value)} placeholder="Nom de famille" /></div>
          </div>
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={labelSt}>Téléphone</label><input style={inputSt} value={form.telephone} onChange={(e) => set("telephone", e.target.value)} placeholder="+225 07 00 00 00 00" /></div>
            <div><label style={labelSt}>Adresse</label><input style={inputSt} value={form.adresse} onChange={(e) => set("adresse", e.target.value)} placeholder="Quartier, ville" /></div>
          </div>
          <div>
            <label style={labelSt}>Allergies connues <span style={{ fontSize: 10, fontWeight: 400, color: "#9CA3AF" }}>— séparez par des virgules</span></label>
            <input style={{ ...inputSt, borderColor: form.allergies ? "#FCA5A5" : "#E5E7EB" }} value={form.allergies} onChange={(e) => set("allergies", e.target.value)} placeholder="Ex : Pénicilline, Aspirine, Latex" />
          </div>
          <div>
            <label style={labelSt}>Antécédents médicaux <span style={{ fontSize: 10, fontWeight: 400, color: "#9CA3AF" }}>— séparez par des virgules</span></label>
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

        <div style={{ display: "flex", gap: 10, padding: "16px 26px", borderTop: "1px solid #F3F4F6", flexShrink: 0 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 11, background: "#F8FAFC", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Annuler</button>
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

function ModalNouvelleOrdonnance({ patient, etablissement_id, medecinNom, medicaments, onClose, onSaved }) {
  const [lignes, setLignes]          = useState([LIGNE_ORD()]);
  const [dateExpiration, setDateExp] = useState("");
  const [instructions, setInstr]     = useState("");
  const [saving, setSaving]          = useState(false);
  const [err, setErr]                = useState(null);

  const setLigne = (id, k, v) => setLignes((ls) => ls.map((l) => l.id === id ? { ...l, [k]: v } : l));

  const handleSave = async () => {
    setErr(null);
    const valides = lignes.filter((l) => l.medicament_id && l.posologie.trim());
    if (!valides.length) { setErr("Ajoutez au moins un médicament avec posologie."); return; }
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
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0A1628" }}>Nouvelle ordonnance</h3>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 3 }}>{patient.prenom} {patient.nom}</div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF" }}>×</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div><label style={labelSt}>Médecin prescripteur</label><input style={{ ...inputSt, background: "#F8FAFC", color: "#6B7280" }} value={medecinNom ?? "Non précisé"} readOnly /></div>
            <div><label style={labelSt}>Date d'expiration</label><input style={inputSt} type="date" value={dateExpiration} onChange={(e) => setDateExp(e.target.value)} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 0.8fr 32px", gap: 8, padding: "8px 10px", background: "#F8FAFC", borderRadius: "8px 8px 0 0", border: "1px solid #E5E7EB", borderBottom: "none" }}>
            {["Médicament", "Posologie", "Durée", ""].map((h) => <div key={h} style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase" }}>{h}</div>)}
          </div>
        </div>
        <div style={{ overflowY: "auto", flexGrow: 1, padding: "0 26px" }}>
          <div style={{ border: "1px solid #E5E7EB", borderTop: "none", borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
            {lignes.map((l, i) => (
              <div key={l.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 0.8fr 32px", gap: 8, padding: "8px 10px", borderBottom: i < lignes.length - 1 ? "1px solid #F3F4F6" : "none", alignItems: "center", background: i % 2 === 0 ? "white" : "#FAFAFA" }}>
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
          {err && <div style={{ marginTop: 10, padding: "8px 12px", background: "#FEF2F2", borderRadius: 8, fontSize: 12, color: "#DC2626" }}>{err}</div>}
        </div>
        <div style={{ display: "flex", gap: 10, padding: "14px 26px", borderTop: "1px solid #F3F4F6", flexShrink: 0 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 11, background: "#F8FAFC", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Annuler</button>
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
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0A1628" }}>Nouveau compte rendu</h3>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 3 }}>{patient.prenom} {patient.nom} — {patient.numero_dossier ?? ""}</div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF" }}>×</button>
          </div>
        </div>

        <div style={{ overflowY: "auto", padding: "0 26px 10px", flexGrow: 1, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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

        <div style={{ display: "flex", gap: 10, padding: "16px 26px", borderTop: "1px solid #F3F4F6", flexShrink: 0 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 11, background: "#F8FAFC", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Annuler</button>
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
  expiree: { bg: "#F3F4F6", color: "#9CA3AF" },
};

function FichePatient({ patient, etablissement_id, medecinNom, hopitalNom, medicaments, onClose, onPatientUpdated, auth }) {
  const [onglet, setOnglet]           = useState("infos");
  const [ordonnances, setOrdonnances] = useState([]);
  const [comptes, setComptes]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showOrd, setShowOrd]         = useState(false);
  const [showCR, setShowCR]           = useState(false);
  const [detailCR, setDetailCR]       = useState(null);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: ords }, { data: crs }] = await Promise.all([
        supabase.from("ordonnances").select("id, reference, statut, date_emission, date_expiration, medecin_nom, notes").eq("patient_id", patient.id).order("date_emission", { ascending: false }),
        supabase.from("comptes_rendus").select("*").eq("patient_id", patient.id).order("date_consultation", { ascending: false }),
      ]);
      setOrdonnances(ords ?? []);
      setComptes(crs ?? []);
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

  const svcColor = SERVICE_COLOR[patient.service] ?? "#6B7280";
  const onglets  = [
    ["infos", "Informations"],
    ["ordonnances", `Ordonnances (${ordonnances.length})`],
    ["comptes", `Comptes rendus (${comptes.length})`],
    ["historique", `Historique (${historique.length})`],
  ];

  return (
    <>
      {showOrd && <ModalNouvelleOrdonnance patient={patient} etablissement_id={etablissement_id} medecinNom={medecinNom} medicaments={medicaments} onClose={() => setShowOrd(false)} onSaved={() => { setShowOrd(false); charger(); onPatientUpdated("Ordonnance créée."); }} />}
      {showCR  && <ModalNouveauCompteRendu patient={patient} etablissement_id={etablissement_id} medecinNom={medecinNom} onClose={() => setShowCR(false)} onSaved={() => { setShowCR(false); charger(); onPatientUpdated("Compte rendu enregistré."); }} />}

      {/* Détail compte rendu */}
      {detailCR && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "88vh", overflow: "auto", padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Compte rendu du {fmtDate(detailCR.date_consultation)}</div>
                <div style={{ fontSize: 12, color: "#6B7280" }}>Dr. {detailCR.medecin}</div>
              </div>
              <button onClick={() => setDetailCR(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF" }}>×</button>
            </div>
            {[["Motif", detailCR.motif], ["Examen clinique", detailCR.examen_clinique], ["Diagnostic", detailCR.diagnostic], ["Traitement prescrit", detailCR.traitement]].map(([lbl, val]) => val ? (
              <div key={lbl} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", marginBottom: 4 }}>{lbl}</div>
                <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, padding: "10px 14px", background: "#F8FAFC", borderRadius: 8 }}>{val}</div>
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
          <div style={{ display: "flex", borderBottom: "1px solid #E5E7EB", flexShrink: 0, padding: "0 26px", overflowX: "auto" }}>
            {onglets.map(([key, label]) => (
              <button key={key} onClick={() => setOnglet(key)} style={{ padding: "12px 14px", background: "none", border: "none", borderBottom: onglet === key ? `2px solid ${ACCENT}` : "2px solid transparent", fontSize: 13, fontWeight: onglet === key ? 700 : 400, color: onglet === key ? ACCENT : "#6B7280", cursor: "pointer", marginBottom: -1, whiteSpace: "nowrap" }}>
                {label}
              </button>
            ))}
          </div>

          {/* Contenu */}
          <div style={{ overflowY: "auto", flexGrow: 1, padding: "20px 26px" }}>

            {/* ── Informations ── */}
            {onglet === "infos" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div>
                  <h4 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "#0A1628" }}>Informations personnelles</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {[["Date de naissance", fmtDate(patient.date_naissance)], ["Téléphone", patient.telephone || "—"], ["Adresse", patient.adresse || "—"], ["Dernière visite", fmtDate(patient.derniere_visite)], ["Service", patient.service ?? "—"], ["Statut", patient.statut === "hospitalise" ? "Hospitalisé" : "Ambulatoire"]].map(([lbl, val]) => (
                      <div key={lbl} style={{ padding: "10px 14px", background: "#F8FAFC", borderRadius: 8 }}>
                        <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 3 }}>{lbl}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#0A1628" }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {patient.antecedents?.length > 0 && (
                  <div>
                    <h4 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#0A1628" }}>Antécédents médicaux</h4>
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
                      <div style={{ fontSize: 11, color: "#9CA3AF" }}>Vérifiez systématiquement avant toute prescription.</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Ordonnances ── */}
            {onglet === "ordonnances" && (
              <div>
                {loading ? [1,2,3].map((i) => <div key={i} style={{ height: 70, background: "#F8FAFC", borderRadius: 10, marginBottom: 10, animation: "pulse 1.5s ease-in-out infinite" }} />) :
                 ordonnances.length === 0 ? <div style={{ padding: "40px 0", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Aucune ordonnance enregistrée</div> :
                 ordonnances.map((o) => {
                  const s = STATUT_ORD[o.statut] ?? STATUT_ORD.en_attente;
                  const lignes = parseLignes(o.notes); const instr = parseInstr(o.notes);
                  return (
                    <div key={o.id} style={{ border: "1px solid #E5E7EB", borderRadius: 10, marginBottom: 12, overflow: "hidden" }}>
                      <div style={{ padding: "10px 14px", background: "#F8FAFC", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 700, color: "#374151" }}>{o.reference}</span>
                          <span style={{ fontSize: 11, color: "#9CA3AF", marginLeft: 12 }}>Émise le {fmtDate(o.date_emission)}</span>
                          {o.date_expiration && <span style={{ fontSize: 11, color: "#9CA3AF", marginLeft: 8 }}>· Expire le {fmtDate(o.date_expiration)}</span>}
                        </div>
                        <span style={{ padding: "2px 8px", background: s.bg, color: s.color, borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{o.statut.replace("_", " ")}</span>
                      </div>
                      {lignes.length > 0 && (
                        <div style={{ padding: "10px 14px" }}>
                          {lignes.map((l, i) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < lignes.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: "#0A1628" }}>{l.nom}</span>
                              <span style={{ fontSize: 12, color: "#6B7280" }}>{l.posologie}{l.duree ? ` — ${l.duree}` : ""}</span>
                            </div>
                          ))}
                          {instr && <div style={{ marginTop: 8, fontSize: 12, color: "#6B7280", fontStyle: "italic" }}>{instr}</div>}
                        </div>
                      )}
                      {/* Actions ordonnance */}
                      <div style={{ padding: "8px 14px", borderTop: "1px solid #F3F4F6", background: "white", display: "flex", gap: 8 }}>
                        <button
                          onClick={() => printOrdonnance({ ordonnance: o, patient, hopitalNom: hopitalNom ?? "Hôpital", medecinNom, lignes, instr, auth })}
                          style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", background: "#0A1628", color: "white", border: "none", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                          Imprimer l'ordonnance
                        </button>
                        {patient.telephone && (
                          <button
                            onClick={() => envoyerSMSOrdonnance(patient, lignes)}
                            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", background: "white", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
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
                 comptes.length === 0 ? <div style={{ padding: "40px 0", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Aucun compte rendu enregistré</div> :
                 comptes.map((c) => (
                  <div key={c.id} style={{ border: "1px solid #E5E7EB", borderRadius: 10, marginBottom: 12, overflow: "hidden" }}>
                    <div style={{ padding: "10px 14px", background: "#F8FAFC", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#0A1628" }}>{fmtDate(c.date_consultation)}</span>
                        <span style={{ fontSize: 12, color: "#6B7280", marginLeft: 10 }}>Dr. {c.medecin}</span>
                      </div>
                      {c.prochain_rdv && <span style={{ fontSize: 11, color: ACCENT, fontWeight: 600 }}>RDV : {fmtDate(c.prochain_rdv)}</span>}
                    </div>
                    {/* Résumé 3 lignes */}
                    <div style={{ padding: "10px 14px" }}>
                      {c.motif && <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}><strong style={{ color: "#374151" }}>Motif :</strong> {c.motif}</div>}
                      {c.diagnostic && <div style={{ fontSize: 12, color: "#374151", marginBottom: 4, fontWeight: 600 }}>{c.diagnostic.slice(0, 120)}{c.diagnostic.length > 120 ? "…" : ""}</div>}
                      {c.traitement && <div style={{ fontSize: 12, color: "#6B7280" }}>{c.traitement.slice(0, 100)}{c.traitement.length > 100 ? "…" : ""}</div>}
                      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                        <button onClick={() => setDetailCR(c)} style={{ padding: "4px 12px", background: "white", border: "1px solid #E5E7EB", borderRadius: 6, fontSize: 11, color: "#374151", cursor: "pointer", fontWeight: 600 }}>
                          Voir le détail complet
                        </button>
                        {c.prochain_rdv && patient.telephone && (
                          <button
                            onClick={() => envoyerSMSRendezVous(patient, c.prochain_rdv, c.medecin, hopitalNom ?? "Hôpital")}
                            style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 12px", background: "white", border: "1px solid #E5E7EB", borderRadius: 6, fontSize: 11, color: "#374151", cursor: "pointer", fontWeight: 600 }}>
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
                 historique.length === 0 ? <div style={{ padding: "40px 0", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Aucun événement dans l'historique</div> :
                 historique.map(({ type, date, item }, idx) => (
                  <div key={item.id} style={{ display: "flex", gap: 14, marginBottom: 12, animation: "fadeIn .2s ease" }}>
                    {/* Ligne de temps */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: type === "ordonnance" ? "#3B82F6" : ACCENT, marginTop: 6, flexShrink: 0 }} />
                      {idx < historique.length - 1 && <div style={{ width: 2, background: "#E5E7EB", flexGrow: 1, marginTop: 4 }} />}
                    </div>
                    <div style={{ flex: 1, paddingBottom: 8 }}>
                      <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 3 }}>{fmtDate(date)}</div>
                      {type === "ordonnance" ? (
                        <div style={{ padding: "8px 12px", background: "#EFF6FF", borderRadius: 8, border: "1px solid #BFDBFE" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#2563EB" }}>Ordonnance</span>
                          <span style={{ fontSize: 11, color: "#6B7280", marginLeft: 10 }}>{item.reference} · {item.statut.replace("_", " ")}</span>
                          {parseLignes(item.notes).length > 0 && <div style={{ fontSize: 12, color: "#374151", marginTop: 4 }}>{parseLignes(item.notes).map((l) => l.nom).join(", ")}</div>}
                        </div>
                      ) : (
                        <div style={{ padding: "8px 12px", background: "#ECFDF5", borderRadius: 8, border: "1px solid #A7F3D0" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#065F46" }}>Compte rendu</span>
                          <span style={{ fontSize: 11, color: "#6B7280", marginLeft: 10 }}>Dr. {item.medecin}</span>
                          {item.motif && <div style={{ fontSize: 12, color: "#374151", marginTop: 3 }}>{item.motif}</div>}
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
          <div style={{ padding: "14px 26px", borderTop: "1px solid #F3F4F6", display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
            <button onClick={onClose} style={{ padding: "9px 16px", background: "#F8FAFC", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 9, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Fermer</button>
            <button onClick={() => printFichePatient({ patient, ordonnances, comptes, auth })} style={{ padding: "9px 16px", background: "#1D4ED8", color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Imprimer la fiche</button>
            <button onClick={() => { setShowCR(true); setOnglet("comptes"); }} style={{ padding: "9px 16px", background: "#0A1628", color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              Nouveau compte rendu
            </button>
            <button onClick={() => { setShowOrd(true); setOnglet("ordonnances"); }} style={{ padding: "9px 16px", background: ACCENT, color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              Nouvelle ordonnance
            </button>
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
      boxShadow: "0 8px 32px rgba(0,0,0,0.18)", border: "1px solid #E5E7EB",
      animation: "fadeIn .15s ease",
    }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #F3F4F6" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#0A1628" }}>{patient.prenom} {patient.nom}</div>
        <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{patient.numero_dossier ?? ""} · {age(patient.date_naissance)}</div>
        <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap" }}>
          <span style={{ padding: "2px 7px", background: svcColor, color: "white", borderRadius: 5, fontSize: 10, fontWeight: 600 }}>{patient.service ?? "Méd. générale"}</span>
          {patient.groupe_sanguin && <span style={{ padding: "2px 7px", background: "#FEE2E2", color: "#DC2626", borderRadius: 5, fontSize: 10, fontWeight: 700 }}>{patient.groupe_sanguin}</span>}
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
        <div style={{ padding: "8px 16px", borderBottom: "1px solid #F3F4F6" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#D97706", textTransform: "uppercase", marginBottom: 4 }}>Antécédents</div>
          <div style={{ fontSize: 11, color: "#374151" }}>{patient.antecedents.slice(0, 3).join(", ")}{patient.antecedents.length > 3 ? "…" : ""}</div>
        </div>
      )}
      <div style={{ padding: "8px 16px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", marginBottom: 3 }}>Dernière visite</div>
        <div style={{ fontSize: 12, color: "#374151", fontWeight: 600 }}>{fmtDate(patient.derniere_visite)}</div>
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
      style={{ display: "grid", gridTemplateColumns: "2.4fr 0.7fr 0.7fr 0.7fr 1.2fr 1fr 1.2fr", gap: 0, padding: "13px 20px", borderBottom: isLast ? "none" : "1px solid #F3F4F6", alignItems: "center", cursor: "pointer", transition: "background .12s", background: hovered ? "#F8FAFC" : urgent ? "#FFFAFA" : "white", animation: "fadeIn .2s ease" }}
    >
      {hovered && <HoverCard patient={patient} anchorRef={rowRef} />}

      {/* Nom + badges */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: urgent ? "#FEE2E2" : "#DCFCE7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: urgent ? "#DC2626" : ACCENT, flexShrink: 0 }}>
          {patient.prenom?.[0]}{patient.nom?.[0]}
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#0A1628" }}>{patient.prenom} {patient.nom}</span>
            {urgent    && <span style={{ padding: "1px 6px", background: "#DC2626", color: "white", borderRadius: 5, fontSize: 9, fontWeight: 800, letterSpacing: 0.5 }}>URGENT</span>}
            {attention && <span style={{ padding: "1px 6px", background: "#D97706", color: "white", borderRadius: 5, fontSize: 9, fontWeight: 800, letterSpacing: 0.5 }}>ATTENTION</span>}
          </div>
          <div style={{ fontSize: 11, color: patient.statut === "hospitalise" ? "#EF4444" : "#9CA3AF", marginTop: 1 }}>
            {patient.statut === "hospitalise" ? "Hospitalisé" : "Ambulatoire"}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 13, color: "#374151" }}>{age(patient.date_naissance)}</div>
      <div style={{ fontSize: 13, color: "#6B7280" }}>{patient.genre === "M" ? "M" : patient.genre === "F" ? "F" : patient.genre ?? "—"}</div>
      <div>
        {patient.groupe_sanguin
          ? <span style={{ padding: "2px 7px", background: "#FEE2E2", color: "#DC2626", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{patient.groupe_sanguin}</span>
          : <span style={{ color: "#9CA3AF", fontSize: 13 }}>—</span>}
      </div>
      <div>
        <span style={{ padding: "2px 8px", background: svcColor + "20", color: svcColor, borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{patient.service ?? "Méd. générale"}</span>
      </div>
      <div style={{ fontSize: 12, color: "#6B7280" }}>{fmtDate(patient.derniere_visite)}</div>
      <div style={{ fontSize: 12, color: "#374151" }}>{patient.medecin_referent ? `Dr. ${patient.medecin_referent}` : "—"}</div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function PatientsHopital() {
  const { auth }                             = useAuth();
  const { data: patients, loading, refetch } = usePatients();
  const { data: medicaments }                = useMedicaments();
  const [recherche, setRecherche]            = useState("");
  const [filtreStatut, setFiltreStatut]      = useState("tous");
  const [filtreService, setFiltreService]    = useState("tous");
  const [showNouv, setShowNouv]              = useState(false);
  const [fichePatient, setFichePatient]      = useState(null);
  const [toast, setToast]                    = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  const etablissement_id = auth?.etablissement_id ?? null;
  const medecinNom       = auth?.user?.user_metadata?.display_name ?? auth?.structure ?? null;
  const hopitalNom       = auth?.structure ?? "Hôpital";

  const filtered = patients
    .filter((p) => filtreStatut === "tous"    || p.statut  === filtreStatut)
    .filter((p) => filtreService === "tous"   || (p.service ?? "Médecine générale") === filtreService)
    .filter((p) => {
      const q = recherche.toLowerCase();
      return !q || `${p.prenom} ${p.nom}`.toLowerCase().includes(q) || (p.numero_dossier ?? "").toLowerCase().includes(q);
    });

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

      {showNouv && <ModalNouveauPatient etablissement_id={etablissement_id} medecinNom={medecinNom} onClose={() => setShowNouv(false)} onSaved={() => { setShowNouv(false); refetch(); showToast("Patient enregistré."); }} />}
      {fichePatient && <FichePatient patient={fichePatient} etablissement_id={etablissement_id} medecinNom={medecinNom} hopitalNom={hopitalNom} medicaments={medicaments} onClose={() => setFichePatient(null)} onPatientUpdated={(msg) => { refetch(); showToast(msg); }} auth={auth} />}

      {/* KPI */}
      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { label: "Total patients",    value: loading ? "…" : patients.length,                                       color: ACCENT },
          { label: "Hospitalisés",      value: loading ? "…" : patients.filter((p) => p.statut === "hospitalise").length, color: "#EF4444" },
          { label: "Ambulatoires",      value: loading ? "…" : patients.filter((p) => p.statut !== "hospitalise").length, color: "#3B82F6" },
          { label: "Alertes allergies", value: loading ? "…" : patients.filter(hasAllergies).length,                  color: "#DC2626" },
        ].map((k) => (
          <div key={k.label} style={{ flex: 1, minWidth: 130, background: "white", borderRadius: 14, padding: "15px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Barre d'actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher par nom ou n° dossier…"
          style={{ flex: 1, minWidth: 200, padding: "9px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 13, outline: "none", color: "#0A1628" }} />

        {/* Filtre statut */}
        <div style={{ display: "flex", gap: 5 }}>
          {[["tous","Tous"], ["hospitalise","Hospitalisés"], ["ambulatoire","Ambulatoires"]].map(([v, l]) => (
            <button key={v} onClick={() => setFiltreStatut(v)} style={{ padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: filtreStatut === v ? 700 : 500, cursor: "pointer", border: `1.5px solid ${filtreStatut === v ? ACCENT : "#E5E7EB"}`, background: filtreStatut === v ? "#DCFCE7" : "white", color: filtreStatut === v ? ACCENT : "#6B7280" }}>{l}</button>
          ))}
        </div>

        {/* Filtre service */}
        <select value={filtreService} onChange={(e) => setFiltreService(e.target.value)}
          style={{ padding: "8px 12px", border: "1.5px solid #E5E7EB", borderRadius: 9, fontSize: 12, color: filtreService === "tous" ? "#6B7280" : "#0A1628", fontWeight: filtreService === "tous" ? 400 : 600, outline: "none", cursor: "pointer", background: "white" }}>
          <option value="tous">Tous les services</option>
          {SERVICES.map((s) => <option key={s}>{s}</option>)}
        </select>

        <button onClick={() => setShowNouv(true)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", background: ACCENT, color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Ajouter un patient
        </button>
      </div>

      {/* Tableau groupé par service */}
      {loading ? (
        <div style={{ background: "white", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          {[1,2,3,4,5].map((i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "2.4fr 0.7fr 0.7fr 0.7fr 1.2fr 1fr 1.2fr", padding: "14px 20px", borderBottom: "1px solid #F3F4F6", gap: 0, alignItems: "center" }}>
              {[1,2,3,4,5,6,7].map((j) => <div key={j} style={{ height: 13, background: "#F3F4F6", borderRadius: 4, animation: "pulse 1.5s ease-in-out infinite", marginRight: 14 }} />)}
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "white", borderRadius: 16, padding: "48px 20px", textAlign: "center", color: "#9CA3AF", fontSize: 13, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          {recherche || filtreStatut !== "tous" || filtreService !== "tous" ? "Aucun patient ne correspond" : "Aucun patient enregistré"}
        </div>
      ) : groupes.map(({ service, liste }) => (
        <div key={service ?? "all"} style={{ marginBottom: service ? 20 : 0 }}>
          {/* En-tête de groupe */}
          {service && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: SERVICE_COLOR[service] ?? "#6B7280" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#0A1628" }}>{service}</span>
              <span style={{ fontSize: 12, color: "#6B7280" }}>{liste.length} patient{liste.length !== 1 ? "s" : ""}</span>
            </div>
          )}

          <div style={{ background: "white", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
            {/* Colonnes */}
            <div style={{ display: "grid", gridTemplateColumns: "2.4fr 0.7fr 0.7fr 0.7fr 1.2fr 1fr 1.2fr", gap: 0, padding: "10px 20px", background: "#F8FAFC", borderBottom: "1px solid #E5E7EB" }}>
              {["Nom / Prénom", "Âge", "Sexe", "Gr.sang.", "Service", "Dernière visite", "Médecin réf."].map((h) => (
                <div key={h} style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.4 }}>{h}</div>
              ))}
            </div>
            {liste.map((p, i) => (
              <PatientRow key={p.id} patient={p} onOpen={() => setFichePatient(p)} isLast={i === liste.length - 1} />
            ))}
          </div>
        </div>
      ))}

      {!loading && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#9CA3AF", textAlign: "right" }}>
          {filtered.length} patient{filtered.length !== 1 ? "s" : ""}{filtreService !== "tous" || filtreStatut !== "tous" || recherche ? ` sur ${patients.length} au total` : ""}
        </div>
      )}
    </Layout>
  );
}
