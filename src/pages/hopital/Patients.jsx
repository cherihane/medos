/**
 * Patients — Module Hôpital
 *
 * - Liste patients avec recherche et filtre hospitalise/ambulatoire
 * - Ajout patient (numéro dossier PAT-2026-XXXXX auto-généré)
 * - Fiche patient : infos, historique ordonnances, allergies
 * - Nouvelle ordonnance depuis la fiche (lignes médicaments en JSON dans notes)
 */
import { useState, useEffect, useCallback } from "react";
import Layout from "../../components/Layout";
import { usePatients, useMedicaments } from "../../hooks/useSupabaseData";
import { insertPatient, insertOrdonnance } from "../../hooks/useMutations";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../supabaseClient";

// ── Styles partagés ───────────────────────────────────────────────────────────
const ACCENT  = "#10B981";
const inputSt = {
  width: "100%", padding: "9px 12px", border: "1.5px solid #E5E7EB",
  borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", color: "#0A1628", backgroundColor: "white",
};
const labelSt = { fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 };
const Spin    = () => (
  <div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "white", borderRadius: "50%", animation: "spin .8s linear infinite", flexShrink: 0 }} />
);

// ── Utilitaires ───────────────────────────────────────────────────────────────
function age(dateNaissance) {
  if (!dateNaissance) return "—";
  const ans = Math.floor((Date.now() - new Date(dateNaissance)) / (365.25 * 24 * 3600 * 1000));
  return `${ans} ans`;
}
function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}
function genDossier() {
  const y = new Date().getFullYear();
  const n = Math.floor(10000 + Math.random() * 90000);
  return `PAT-${y}-${n}`;
}

// ── Modal Nouveau patient ─────────────────────────────────────────────────────
function ModalNouveauPatient({ etablissement_id, medecinNom, onClose, onSaved }) {
  const initForm = {
    prenom: "", nom: "", date_naissance: "", genre: "",
    adresse: "", telephone: "", groupe_sanguin: "",
    allergies: "", antecedents: "", medecin_referent: medecinNom ?? "",
    statut: "ambulatoire",
  };
  const [form, setForm]     = useState(initForm);
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
        prenom:           form.prenom.trim(),
        nom:              form.nom.trim(),
        date_naissance:   form.date_naissance || null,
        genre:            form.genre || null,
        adresse:          form.adresse.trim() || null,
        telephone:        form.telephone.trim() || null,
        groupe_sanguin:   form.groupe_sanguin || null,
        allergies:        form.allergies ? form.allergies.split(",").map((s) => s.trim()).filter(Boolean) : [],
        antecedents:      form.antecedents ? form.antecedents.split(",").map((s) => s.trim()).filter(Boolean) : [],
        medecin_referent: form.medecin_referent.trim() || null,
        statut:           form.statut,
        numero_dossier:   dossier,
        derniere_visite:  new Date().toISOString().slice(0, 10),
        ...(etablissement_id ? { etablissement_id } : {}),
      });
      onSaved();
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 600, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ padding: "22px 26px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0A1628" }}>Nouveau patient</h3>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 3 }}>
                Dossier : <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#10B981" }}>{dossier}</span>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF" }}>×</button>
          </div>
        </div>

        <div style={{ overflowY: "auto", padding: "0 26px 10px", flexGrow: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Identité */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelSt}>Prénom <span style={{ color: "#EF4444" }}>*</span></label>
                <input style={inputSt} value={form.prenom} onChange={(e) => set("prenom", e.target.value)} placeholder="Prénom" />
              </div>
              <div>
                <label style={labelSt}>Nom <span style={{ color: "#EF4444" }}>*</span></label>
                <input style={inputSt} value={form.nom} onChange={(e) => set("nom", e.target.value)} placeholder="Nom de famille" />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelSt}>Date de naissance</label>
                <input style={inputSt} type="date" value={form.date_naissance} onChange={(e) => set("date_naissance", e.target.value)} />
              </div>
              <div>
                <label style={labelSt}>Sexe</label>
                <select style={{ ...inputSt, cursor: "pointer" }} value={form.genre} onChange={(e) => set("genre", e.target.value)}>
                  <option value="">—</option>
                  <option value="M">Masculin</option>
                  <option value="F">Féminin</option>
                  <option value="Autre">Autre</option>
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

            {/* Contact */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelSt}>Téléphone</label>
                <input style={inputSt} value={form.telephone} onChange={(e) => set("telephone", e.target.value)} placeholder="+225 07 00 00 00 00" />
              </div>
              <div>
                <label style={labelSt}>Adresse</label>
                <input style={inputSt} value={form.adresse} onChange={(e) => set("adresse", e.target.value)} placeholder="Quartier, ville" />
              </div>
            </div>

            {/* Médical */}
            <div>
              <label style={labelSt}>Allergies connues <span style={{ fontSize: 10, fontWeight: 400, color: "#9CA3AF" }}>— séparez par des virgules</span></label>
              <input style={{ ...inputSt, borderColor: form.allergies ? "#FCA5A5" : "#E5E7EB" }} value={form.allergies} onChange={(e) => set("allergies", e.target.value)} placeholder="Ex : Pénicilline, Aspirine, Latex" />
            </div>
            <div>
              <label style={labelSt}>Antécédents médicaux <span style={{ fontSize: 10, fontWeight: 400, color: "#9CA3AF" }}>— séparez par des virgules</span></label>
              <input style={inputSt} value={form.antecedents} onChange={(e) => set("antecedents", e.target.value)} placeholder="Ex : Diabète type 2, Hypertension" />
            </div>

            {/* Prise en charge */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelSt}>Médecin référent</label>
                <input style={inputSt} value={form.medecin_referent} onChange={(e) => set("medecin_referent", e.target.value)} placeholder="Dr. Nom Prénom" />
              </div>
              <div>
                <label style={labelSt}>Statut</label>
                <select style={{ ...inputSt, cursor: "pointer" }} value={form.statut} onChange={(e) => set("statut", e.target.value)}>
                  <option value="ambulatoire">Ambulatoire</option>
                  <option value="hospitalise">Hospitalisé</option>
                </select>
              </div>
            </div>
          </div>

          {err && <div style={{ marginTop: 12, padding: "8px 12px", background: "#FEF2F2", borderRadius: 8, fontSize: 12, color: "#DC2626" }}>{err}</div>}
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
  const [lignes, setLignes]           = useState([LIGNE_ORD()]);
  const [dateExpiration, setDateExp]  = useState("");
  const [instructions, setInstr]      = useState("");
  const [saving, setSaving]           = useState(false);
  const [err, setErr]                 = useState(null);

  const setLigne = (id, k, v) => setLignes((ls) => ls.map((l) => l.id === id ? { ...l, [k]: v } : l));
  const addLigne  = () => setLignes((ls) => [...ls, LIGNE_ORD()]);
  const delLigne  = (id) => setLignes((ls) => ls.filter((l) => l.id !== id));

  const handleSave = async () => {
    setErr(null);
    const valides = lignes.filter((l) => l.medicament_id && l.posologie.trim());
    if (valides.length === 0) { setErr("Ajoutez au moins un médicament avec posologie."); return; }
    setSaving(true);
    try {
      const lignesDetail = valides.map((l) => {
        const med = medicaments.find((m) => m.id === l.medicament_id);
        return { medicament_id: l.medicament_id, nom: med?.nom ?? "", posologie: l.posologie.trim(), duree: l.duree.trim() };
      });
      await insertOrdonnance({
        patient_id:       patient.id,
        medecin_nom:      medecinNom ?? "Non précisé",
        date_emission:    new Date().toISOString().slice(0, 10),
        date_expiration:  dateExpiration || null,
        statut:           "en_attente",
        notes:            JSON.stringify({ lignes: lignesDetail, instructions: instructions.trim() || null }),
        ...(etablissement_id ? { etablissement_id } : {}),
      });
      onSaved();
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
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
            <div>
              <label style={labelSt}>Médecin prescripteur</label>
              <input style={{ ...inputSt, background: "#F8FAFC", color: "#6B7280" }} value={medecinNom ?? "Non précisé"} readOnly />
            </div>
            <div>
              <label style={labelSt}>Date d'expiration</label>
              <input style={inputSt} type="date" value={dateExpiration} onChange={(e) => setDateExp(e.target.value)} />
            </div>
          </div>

          {/* En-tête tableau */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 0.8fr 32px", gap: 8, padding: "8px 10px", background: "#F8FAFC", borderRadius: "8px 8px 0 0", border: "1px solid #E5E7EB", borderBottom: "none" }}>
            {["Médicament", "Posologie", "Durée", ""].map((h) => (
              <div key={h} style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase" }}>{h}</div>
            ))}
          </div>
        </div>

        {/* Lignes */}
        <div style={{ overflowY: "auto", flexGrow: 1, padding: "0 26px" }}>
          <div style={{ border: "1px solid #E5E7EB", borderTop: "none", borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
            {lignes.map((l, i) => (
              <div key={l.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 0.8fr 32px", gap: 8, padding: "8px 10px", borderBottom: i < lignes.length - 1 ? "1px solid #F3F4F6" : "none", alignItems: "center", background: i % 2 === 0 ? "white" : "#FAFAFA" }}>
                <select value={l.medicament_id} onChange={(e) => setLigne(l.id, "medicament_id", e.target.value)}
                  style={{ ...inputSt, fontSize: 12, padding: "7px 9px", background: "white" }}>
                  <option value="">— Médicament —</option>
                  {medicaments.map((m) => <option key={m.id} value={m.id}>{m.nom}{m.dosage ? ` ${m.dosage}` : ""}</option>)}
                </select>
                <input style={{ ...inputSt, fontSize: 12, padding: "7px 9px" }} value={l.posologie}
                  onChange={(e) => setLigne(l.id, "posologie", e.target.value)} placeholder="1 cp × 3/j" />
                <input style={{ ...inputSt, fontSize: 12, padding: "7px 9px" }} value={l.duree}
                  onChange={(e) => setLigne(l.id, "duree", e.target.value)} placeholder="7 jours" />
                <button onClick={() => lignes.length > 1 && delLigne(l.id)} disabled={lignes.length === 1}
                  style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: lignes.length === 1 ? "#F8FAFC" : "#FEF2F2", border: "none", borderRadius: 6, cursor: lignes.length === 1 ? "not-allowed" : "pointer", color: lignes.length === 1 ? "#D1D5DB" : "#EF4444", fontSize: 16 }}>×</button>
              </div>
            ))}
          </div>
          <button onClick={addLigne} style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, padding: "6px 13px", background: "white", border: "1.5px dashed #10B981", borderRadius: 8, fontSize: 12, color: "#10B981", fontWeight: 600, cursor: "pointer" }}>
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

// ── Fiche patient ─────────────────────────────────────────────────────────────
function FichePatient({ patient, etablissement_id, medecinNom, medicaments, onClose, onPatientUpdated }) {
  const [ordonnances, setOrdonnances]   = useState([]);
  const [loadOrd, setLoadOrd]           = useState(true);
  const [showOrd, setShowOrd]           = useState(false);
  const [onglet, setOnglet]             = useState("infos"); // infos | ordonnances

  const chargerOrdonnances = useCallback(async () => {
    setLoadOrd(true);
    try {
      const { data } = await supabase
        .from("ordonnances")
        .select("id, reference, statut, date_emission, date_expiration, medecin_nom, notes")
        .eq("patient_id", patient.id)
        .order("date_emission", { ascending: false });
      setOrdonnances(data ?? []);
    } catch { /* silencieux */ }
    finally { setLoadOrd(false); }
  }, [patient.id]);

  useEffect(() => { chargerOrdonnances(); }, [chargerOrdonnances]);

  const statutOrdColor = { en_attente: { bg: "#FFFBEB", color: "#D97706" }, validee: { bg: "#DCFCE7", color: "#16A34A" }, traitee: { bg: "#DBEAFE", color: "#2563EB" }, refusee: { bg: "#FEF2F2", color: "#EF4444" }, expiree: { bg: "#F3F4F6", color: "#9CA3AF" } };

  const parseLignes = (notes) => {
    try { const p = JSON.parse(notes); return p.lignes ?? []; } catch { return []; }
  };
  const parseInstr = (notes) => {
    try { const p = JSON.parse(notes); return p.instructions ?? null; } catch { return null; }
  };

  return (
    <>
      {showOrd && (
        <ModalNouvelleOrdonnance
          patient={patient}
          etablissement_id={etablissement_id}
          medecinNom={medecinNom}
          medicaments={medicaments}
          onClose={() => setShowOrd(false)}
          onSaved={() => { setShowOrd(false); chargerOrdonnances(); onPatientUpdated(); }}
        />
      )}

      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 700, maxHeight: "92vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>

          {/* ── Header ── */}
          <div style={{ padding: "20px 26px", background: "linear-gradient(135deg, #0A1628 0%, #10B981 150%)", flexShrink: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: "white" }}>
                  {patient.prenom[0]}{patient.nom[0]}
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "white" }}>{patient.prenom} {patient.nom}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>
                    {patient.numero_dossier && <span style={{ fontFamily: "monospace", marginRight: 12 }}>{patient.numero_dossier}</span>}
                    {age(patient.date_naissance)}
                    {patient.genre ? ` · ${patient.genre === "M" ? "Masculin" : patient.genre === "F" ? "Féminin" : "Autre"}` : ""}
                    {patient.groupe_sanguin ? ` · ${patient.groupe_sanguin}` : ""}
                  </div>
                </div>
              </div>
              <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "white", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <span style={{ padding: "3px 10px", background: patient.statut === "hospitalise" ? "#EF4444" : "#10B981", color: "white", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                {patient.statut === "hospitalise" ? "Hospitalisé" : "Ambulatoire"}
              </span>
              {patient.medecin_referent && (
                <span style={{ padding: "3px 10px", background: "rgba(255,255,255,0.15)", color: "white", borderRadius: 20, fontSize: 11 }}>Dr. {patient.medecin_referent}</span>
              )}
            </div>
          </div>

          {/* ── Allergies (toujours visibles) ── */}
          {patient.allergies?.length > 0 && (
            <div style={{ padding: "10px 26px", background: "#FEF2F2", borderBottom: "1px solid #FECACA", flexShrink: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#DC2626" }}>Allergies : </span>
              {patient.allergies.map((a) => (
                <span key={a} style={{ display: "inline-block", margin: "0 4px 2px 0", padding: "2px 8px", background: "#FEE2E2", color: "#DC2626", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{a}</span>
              ))}
            </div>
          )}

          {/* ── Onglets ── */}
          <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #E5E7EB", flexShrink: 0, padding: "0 26px" }}>
            {[["infos", "Informations"], ["ordonnances", `Ordonnances (${ordonnances.length})`]].map(([key, label]) => (
              <button key={key} onClick={() => setOnglet(key)} style={{ padding: "12px 16px", background: "none", border: "none", borderBottom: onglet === key ? `2px solid ${ACCENT}` : "2px solid transparent", fontSize: 13, fontWeight: onglet === key ? 700 : 400, color: onglet === key ? ACCENT : "#6B7280", cursor: "pointer", marginBottom: -1 }}>
                {label}
              </button>
            ))}
          </div>

          {/* ── Contenu ── */}
          <div style={{ overflowY: "auto", flexGrow: 1, padding: "20px 26px" }}>

            {onglet === "infos" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Informations personnelles */}
                <div>
                  <h4 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "#0A1628" }}>Informations personnelles</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {[
                      ["Date de naissance", fmtDate(patient.date_naissance)],
                      ["Téléphone", patient.telephone || "—"],
                      ["Adresse", patient.adresse || "—"],
                      ["Dernière visite", fmtDate(patient.derniere_visite)],
                    ].map(([lbl, val]) => (
                      <div key={lbl} style={{ padding: "10px 14px", background: "#F8FAFC", borderRadius: 8 }}>
                        <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 3 }}>{lbl}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#0A1628" }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Antécédents */}
                {patient.antecedents?.length > 0 && (
                  <div>
                    <h4 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#0A1628" }}>Antécédents médicaux</h4>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {patient.antecedents.map((a) => (
                        <span key={a} style={{ padding: "4px 10px", background: "#FFFBEB", color: "#D97706", borderRadius: 6, fontSize: 12, fontWeight: 600 }}>{a}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Contre-indications */}
                {patient.allergies?.length > 0 && (
                  <div>
                    <h4 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#DC2626" }}>Allergies et contre-indications</h4>
                    <div style={{ padding: "12px 16px", background: "#FEF2F2", borderRadius: 10, border: "1px solid #FECACA" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {patient.allergies.map((a) => (
                          <span key={a} style={{ padding: "4px 10px", background: "#FEE2E2", color: "#DC2626", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>{a}</span>
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 8 }}>Vérifiez systématiquement les contre-indications avant toute prescription.</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {onglet === "ordonnances" && (
              <div>
                {loadOrd ? (
                  [1,2,3].map((i) => <div key={i} style={{ height: 60, background: "#F8FAFC", borderRadius: 10, marginBottom: 10, animation: "pulse 1.5s ease-in-out infinite" }} />)
                ) : ordonnances.length === 0 ? (
                  <div style={{ padding: "40px 0", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Aucune ordonnance pour ce patient</div>
                ) : ordonnances.map((o) => {
                  const s = statutOrdColor[o.statut] ?? statutOrdColor.en_attente;
                  const lignes = parseLignes(o.notes);
                  const instr  = parseInstr(o.notes);
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
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Actions ── */}
          <div style={{ padding: "14px 26px", borderTop: "1px solid #F3F4F6", display: "flex", gap: 10, flexShrink: 0 }}>
            <button onClick={onClose} style={{ padding: "9px 18px", background: "#F8FAFC", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 9, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Fermer</button>
            <button
              onClick={() => { setShowOrd(true); setOnglet("ordonnances"); }}
              style={{ padding: "9px 18px", background: ACCENT, color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              Nouvelle ordonnance
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function PatientsHopital() {
  const { auth }                        = useAuth();
  const { data: patients, loading, refetch } = usePatients();
  const { data: medicaments }           = useMedicaments();
  const [recherche, setRecherche]       = useState("");
  const [filtre, setFiltre]             = useState("tous");
  const [showNouv, setShowNouv]         = useState(false);
  const [fichePatient, setFichePatient] = useState(null);
  const [toast, setToast]               = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  const etablissement_id = auth?.etablissement_id ?? null;
  const medecinNom       = auth?.user?.user_metadata?.display_name ?? auth?.structure ?? null;

  const filtered = patients
    .filter((p) => filtre === "tous" || p.statut === filtre)
    .filter((p) => {
      const q = recherche.toLowerCase();
      return !q || `${p.prenom} ${p.nom}`.toLowerCase().includes(q) || (p.numero_dossier ?? "").toLowerCase().includes(q);
    });

  const nbHospitalises  = patients.filter((p) => p.statut === "hospitalise").length;
  const nbAmbulat       = patients.filter((p) => p.statut === "ambulatoire" || !p.statut).length;

  return (
    <Layout title="Patients" subtitle="Gestion des dossiers patients et ordonnances">
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, background: ACCENT, color: "white", padding: "12px 20px", borderRadius: 10, fontWeight: 600, fontSize: 13, zIndex: 2000, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
          {toast}
        </div>
      )}

      {showNouv && (
        <ModalNouveauPatient
          etablissement_id={etablissement_id}
          medecinNom={medecinNom}
          onClose={() => setShowNouv(false)}
          onSaved={() => { setShowNouv(false); refetch(); showToast("Patient enregistré."); }}
        />
      )}

      {fichePatient && (
        <FichePatient
          patient={fichePatient}
          etablissement_id={etablissement_id}
          medecinNom={medecinNom}
          medicaments={medicaments}
          onClose={() => setFichePatient(null)}
          onPatientUpdated={() => { refetch(); showToast("Ordonnance créée."); }}
        />
      )}

      {/* ── KPI ── */}
      <div style={{ display: "flex", gap: 16, marginBottom: 22 }}>
        {[
          { label: "Total patients",   value: loading ? "…" : patients.length,  color: "#10B981" },
          { label: "Hospitalisés",     value: loading ? "…" : nbHospitalises,   color: "#EF4444" },
          { label: "Ambulatoires",     value: loading ? "…" : nbAmbulat,        color: "#3B82F6" },
          { label: "Groupes sanguins", value: loading ? "…" : [...new Set(patients.map((p) => p.groupe_sanguin).filter(Boolean))].length, color: "#8B5CF6" },
        ].map((k) => (
          <div key={k.label} style={{ flex: 1, background: "white", borderRadius: 14, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── Barre d'actions ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher par nom ou n° dossier…"
          style={{ flex: 1, minWidth: 220, padding: "9px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 13, outline: "none", color: "#0A1628" }}
        />

        {/* Filtres */}
        <div style={{ display: "flex", gap: 6 }}>
          {[["tous","Tous"], ["hospitalise","Hospitalisés"], ["ambulatoire","Ambulatoires"]].map(([val, label]) => (
            <button key={val} onClick={() => setFiltre(val)}
              style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: filtre === val ? 700 : 500, cursor: "pointer", border: `1.5px solid ${filtre === val ? ACCENT : "#E5E7EB"}`, background: filtre === val ? "#DCFCE7" : "white", color: filtre === val ? ACCENT : "#6B7280" }}>
              {label}
            </button>
          ))}
        </div>

        <button onClick={() => setShowNouv(true)}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", background: ACCENT, color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Ajouter un patient
        </button>
      </div>

      {/* ── Tableau ── */}
      <div style={{ background: "white", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        {/* En-tête */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1.4fr 1.2fr 1.4fr", gap: 0, padding: "11px 20px", background: "#F8FAFC", borderBottom: "1px solid #E5E7EB" }}>
          {["Nom / Prénom", "Âge", "Sexe", "Gr. sanguin", "N° dossier", "Dernière visite", "Médecin référent"].map((h) => (
            <div key={h} style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.4 }}>{h}</div>
          ))}
        </div>

        {/* Skeleton */}
        {loading && [1,2,3,4,5].map((i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1.4fr 1.2fr 1.4fr", padding: "14px 20px", borderBottom: "1px solid #F3F4F6", gap: 0, alignItems: "center" }}>
            {[1,2,3,4,5,6,7].map((j) => <div key={j} style={{ height: 13, background: "#F3F4F6", borderRadius: 4, animation: "pulse 1.5s ease-in-out infinite", marginRight: 14 }} />)}
          </div>
        ))}

        {/* Vide */}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: "48px 20px", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
            {recherche || filtre !== "tous" ? "Aucun patient ne correspond à cette recherche" : "Aucun patient enregistré"}
          </div>
        )}

        {/* Lignes */}
        {!loading && filtered.map((p, i) => (
          <div
            key={p.id}
            onClick={() => setFichePatient(p)}
            style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1.4fr 1.2fr 1.4fr", gap: 0, padding: "13px 20px", borderBottom: i < filtered.length - 1 ? "1px solid #F3F4F6" : "none", alignItems: "center", cursor: "pointer", transition: "background .15s", animation: "fadeIn .2s ease" }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#F8FAFC"}
            onMouseLeave={(e) => e.currentTarget.style.background = "white"}
          >
            {/* Nom */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#DCFCE7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: ACCENT, flexShrink: 0 }}>
                {p.prenom?.[0]}{p.nom?.[0]}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0A1628" }}>{p.prenom} {p.nom}</div>
                <div style={{ fontSize: 11, color: p.statut === "hospitalise" ? "#EF4444" : "#9CA3AF" }}>
                  {p.statut === "hospitalise" ? "Hospitalisé" : "Ambulatoire"}
                </div>
              </div>
            </div>

            <div style={{ fontSize: 13, color: "#374151" }}>{age(p.date_naissance)}</div>
            <div style={{ fontSize: 13, color: "#6B7280" }}>{p.genre === "M" ? "Masculin" : p.genre === "F" ? "Féminin" : p.genre ?? "—"}</div>
            <div>
              {p.groupe_sanguin
                ? <span style={{ padding: "2px 8px", background: "#FEE2E2", color: "#DC2626", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{p.groupe_sanguin}</span>
                : <span style={{ color: "#9CA3AF", fontSize: 13 }}>—</span>}
            </div>
            <div style={{ fontSize: 12, fontFamily: "monospace", color: "#6B7280" }}>{p.numero_dossier ?? "—"}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{fmtDate(p.derniere_visite)}</div>
            <div style={{ fontSize: 12, color: "#374151" }}>{p.medecin_referent ? `Dr. ${p.medecin_referent}` : "—"}</div>
          </div>
        ))}
      </div>

      {/* Compteur */}
      {!loading && (
        <div style={{ marginTop: 10, fontSize: 12, color: "#9CA3AF", textAlign: "right" }}>
          {filtered.length} patient{filtered.length !== 1 ? "s" : ""} affiché{filtered.length !== 1 ? "s" : ""}
          {filtre !== "tous" || recherche ? ` sur ${patients.length} au total` : ""}
        </div>
      )}
    </Layout>
  );
}
