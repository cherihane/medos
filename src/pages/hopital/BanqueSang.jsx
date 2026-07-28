import { useState, useEffect, useCallback } from "react";
import { colors } from "../../theme";
import { useAuth } from "../../context/AuthContext";
import Layout from "../../components/Layout";
import { useToast } from "../../hooks/useToast";
import { usePatients } from "../../hooks/useSupabaseData";
import {
  fetchPochesSang,
  insertPocheSang,
  genererNumeroPoche,
  reserverPocheSang,
  annulerReservationPocheSang,
  ecarterPocheSang,
  transfuserPocheSang,
  updatePatient,
} from "../../hooks/useMutations";
import { GROUPES_SANGUINS, estCompatible } from "../../utils/compatibiliteSanguine";

const ACCENT = "#B91C1C";
const SEUIL_BAS = 2; // poches disponibles minimum par groupe avant alerte — seuil hospitalier standard, ajustable si besoin réel constaté

const STATUT_CONFIG = {
  disponible: { label: "Disponible", color: "#10B981", bg: "#F0FDF4" },
  reservee:   { label: "Réservée",   color: "#F59E0B", bg: "#FFFBEB" },
  transfusee: { label: "Transfusée", color: "#6B7280", bg: "#F3F4F6" },
  ecartee:    { label: "Écartée",    color: "#DC2626", bg: "#FEF2F2" },
};

const inputSt = {
  width: "100%", padding: "9px 11px", border: `1.5px solid ${colors.border}`,
  borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box",
  color: colors.navy, backgroundColor: colors.bgCard,
};

function Badge({ cfg }) {
  if (!cfg) return null;
  return (
    <span style={{ padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

function joursAvant(dateStr) {
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

// ─── Modal Réception d'une poche ────────────────────────────────────────────
function ModalReception({ etablissement_id, onClose, onSaved }) {
  const { success, error: showError } = useToast();
  const [form, setForm] = useState({
    groupe_sanguin: "O+", volume_ml: 450, origine: "Don du sang",
    date_peremption: (() => { const d = new Date(); d.setDate(d.getDate() + 42); return d.toISOString().slice(0, 10); })(),
  });

  async function save() {
    if (!form.date_peremption) return;
    try {
      const numero = genererNumeroPoche();
      await insertPocheSang({
        ...form,
        etablissement_id,
        numero_poche: numero,
        volume_ml: Number(form.volume_ml) || null,
        statut: "disponible",
      });
      success(`Poche ${numero} réceptionnée`);
      onSaved(); onClose();
    } catch (e) { showError(e.message); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: colors.bgCard, borderRadius: 16, width: "100%", maxWidth: 460, padding: "22px 26px", boxShadow: "0 20px 60px rgba(0,0,0,0.22)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.navy }}>Réceptionner une poche</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted }}>×</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 6 }}>Groupe sanguin *</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {GROUPES_SANGUINS.map((g) => (
                <button key={g} onClick={() => setForm((f) => ({ ...f, groupe_sanguin: g }))}
                  style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer", border: `1.5px solid ${form.groupe_sanguin === g ? ACCENT : colors.border}`, background: form.groupe_sanguin === g ? "#FEF2F2" : colors.bgSurface, color: form.groupe_sanguin === g ? ACCENT : colors.text, fontWeight: form.groupe_sanguin === g ? 700 : 400 }}>
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div className="form-row-2">
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Volume (mL)</label>
              <input type="number" value={form.volume_ml} onChange={(e) => setForm((f) => ({ ...f, volume_ml: e.target.value }))} style={inputSt} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Date de péremption *</label>
              <input type="date" value={form.date_peremption} onChange={(e) => setForm((f) => ({ ...f, date_peremption: e.target.value }))} style={inputSt} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Origine</label>
            <input value={form.origine} onChange={(e) => setForm((f) => ({ ...f, origine: e.target.value }))} style={inputSt} placeholder="Ex: Don du sang, Banque nationale" />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 11, background: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={save} style={{ flex: 2, padding: 11, background: ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Réceptionner</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Réservation pour un patient ──────────────────────────────────────
// Design : affiche TOUTES les poches disponibles (pas seulement les
// compatibles) avec un badge Compatible/INCOMPATIBLE — permet de démontrer et
// tester explicitement le blocage, plutôt que de le rendre invisible en ne
// montrant que les poches déjà filtrées.
function ModalReservation({ etablissement_id, patients, poches, onClose, onSaved }) {
  const { auth } = useAuth();
  const { success, error: showError } = useToast();
  const [patientId, setPatientId] = useState("");
  const [groupePatientForm, setGroupePatientForm] = useState("");
  const [savingGroupe, setSavingGroupe] = useState(false);
  const [selectedPocheId, setSelectedPocheId] = useState("");
  const [blocageMsg, setBlocageMsg] = useState("");

  const patient = patients.find((p) => p.id === patientId) ?? null;
  const groupePatient = patient?.groupe_sanguin ?? null;
  const disponibles = poches.filter((p) => p.statut === "disponible");
  const selectedPoche = disponibles.find((p) => p.id === selectedPocheId) ?? null;

  useEffect(() => {
    setSelectedPocheId("");
    setBlocageMsg("");
    setGroupePatientForm("");
  }, [patientId]);

  async function enregistrerGroupePatient() {
    if (!groupePatientForm) return;
    setSavingGroupe(true);
    try {
      await updatePatient(patientId, { groupe_sanguin: groupePatientForm });
      success("Groupe sanguin du patient enregistré");
      patient.groupe_sanguin = groupePatientForm; // reflet immédiat local, la liste se rafraîchira via onSaved plus tard
    } catch (e) { showError(e.message); }
    setSavingGroupe(false);
  }

  async function confirmerReservation() {
    setBlocageMsg("");
    if (!groupePatient) {
      setBlocageMsg("Le groupe sanguin du patient doit être renseigné et enregistré avant toute réservation.");
      return;
    }
    if (!selectedPoche) return;
    if (!estCompatible(groupePatient, selectedPoche.groupe_sanguin)) {
      setBlocageMsg(`Groupe incompatible : patient ${groupePatient} / poche ${selectedPoche.groupe_sanguin} — réservation bloquée.`);
      return;
    }
    try {
      await reserverPocheSang(selectedPoche.id, { patient_id: patientId, reserve_par: auth?.user?.email ?? "" });
      success(`Poche ${selectedPoche.numero_poche} réservée pour ${patient.prenom} ${patient.nom}`);
      onSaved(); onClose();
    } catch (e) { showError(e.message); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: colors.bgCard, borderRadius: 16, width: "100%", maxWidth: 620, maxHeight: "93vh", overflowY: "auto", padding: "22px 26px", boxShadow: "0 20px 60px rgba(0,0,0,0.22)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.navy }}>Réserver une poche pour un patient</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted }}>×</button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Patient *</label>
          <select value={patientId} onChange={(e) => setPatientId(e.target.value)} style={inputSt}>
            <option value="">— Sélectionner un patient —</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>{p.prenom} {p.nom}{p.groupe_sanguin ? ` (${p.groupe_sanguin})` : " (groupe inconnu)"}</option>
            ))}
          </select>
        </div>

        {patient && !groupePatient && (
          <div style={{ background: "#FFFBEB", border: "1.5px solid #F59E0B", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#B45309", marginBottom: 8 }}>
              Groupe sanguin inconnu — obligatoire avant toute réservation.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <select value={groupePatientForm} onChange={(e) => setGroupePatientForm(e.target.value)} style={{ ...inputSt, flex: 1 }}>
                <option value="">— Groupe du patient —</option>
                {GROUPES_SANGUINS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              <button onClick={enregistrerGroupePatient} disabled={!groupePatientForm || savingGroupe}
                style={{ padding: "0 16px", background: groupePatientForm ? ACCENT : colors.border, color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: groupePatientForm ? "pointer" : "default" }}>
                Enregistrer
              </button>
            </div>
          </div>
        )}

        {patient && groupePatient && (
          <>
            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10 }}>
              Groupe du patient : <strong style={{ color: colors.navy }}>{groupePatient}</strong> — {disponibles.length} poche(s) disponible(s) au total
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflowY: "auto", marginBottom: 14 }}>
              {disponibles.length === 0 && (
                <div style={{ textAlign: "center", padding: 20, color: colors.textMuted, fontSize: 13 }}>Aucune poche disponible actuellement.</div>
              )}
              {disponibles.map((p) => {
                const compat = estCompatible(groupePatient, p.groupe_sanguin);
                return (
                  <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 9, border: `1.5px solid ${selectedPocheId === p.id ? ACCENT : colors.border}`, cursor: "pointer", background: selectedPocheId === p.id ? "#FEF2F2" : colors.bgSurface }}>
                    <input type="radio" name="poche" checked={selectedPocheId === p.id} onChange={() => setSelectedPocheId(p.id)} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>{p.numero_poche} — {p.groupe_sanguin}</div>
                      <div style={{ fontSize: 11, color: colors.textMuted }}>Péremption : {p.date_peremption}</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 6, background: compat ? "#F0FDF4" : "#FEF2F2", color: compat ? "#16A34A" : "#DC2626" }}>
                      {compat ? "Compatible" : "INCOMPATIBLE"}
                    </span>
                  </label>
                );
              })}
            </div>
          </>
        )}

        {blocageMsg && (
          <div style={{ background: "#FEF2F2", border: "1.5px solid #DC2626", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, fontWeight: 700, color: "#DC2626" }}>
            {blocageMsg}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 11, background: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={confirmerReservation} disabled={!selectedPoche || !groupePatient}
            style={{ flex: 2, padding: 11, background: (!selectedPoche || !groupePatient) ? colors.border : ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: (!selectedPoche || !groupePatient) ? "default" : "pointer" }}>
            Réserver cette poche
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Transfusion (double confirmation explicite) ─────────────────────
function ModalTransfusion({ poche, onClose, onSaved }) {
  const { auth } = useAuth();
  const { success, error: showError } = useToast();
  const [notes, setNotes] = useState("");
  const [confirme, setConfirme] = useState(false);

  const groupePatient = poche.patients?.groupe_sanguin ?? null;
  const compat = groupePatient ? estCompatible(groupePatient, poche.groupe_sanguin) : false;

  async function valider() {
    if (!confirme) return;
    try {
      await transfuserPocheSang(poche, {
        groupe_sanguin_patient: groupePatient ?? "inconnu",
        effectue_par: auth?.user?.email ?? "",
        notes,
      });
      success(`Transfusion enregistrée — poche ${poche.numero_poche}`);
      onSaved(); onClose();
    } catch (e) { showError(e.message); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1001, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: colors.bgCard, borderRadius: 16, width: "100%", maxWidth: 480, padding: "22px 26px", boxShadow: "0 20px 60px rgba(0,0,0,0.22)" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: colors.navy }}>Confirmer la transfusion</h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          <div style={{ background: colors.bgSurface, borderRadius: 10, padding: "14px", textAlign: "center", border: `1.5px solid ${colors.border}` }}>
            <div style={{ fontSize: 10, color: colors.textMuted, marginBottom: 6, textTransform: "uppercase", fontWeight: 700 }}>Patient</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy, marginBottom: 4 }}>{poche.patients?.prenom} {poche.patients?.nom}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: colors.navy }}>{groupePatient ?? "INCONNU"}</div>
          </div>
          <div style={{ background: colors.bgSurface, borderRadius: 10, padding: "14px", textAlign: "center", border: `1.5px solid ${colors.border}` }}>
            <div style={{ fontSize: 10, color: colors.textMuted, marginBottom: 6, textTransform: "uppercase", fontWeight: 700 }}>Poche {poche.numero_poche}</div>
            <div style={{ fontSize: 13, color: colors.textMuted, marginBottom: 4 }}>Péremption {poche.date_peremption}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: colors.navy }}>{poche.groupe_sanguin}</div>
          </div>
        </div>

        <div style={{ background: compat ? "#F0FDF4" : "#FEF2F2", border: `1.5px solid ${compat ? "#16A34A" : "#DC2626"}`, borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 12, fontWeight: 700, color: compat ? "#16A34A" : "#DC2626" }}>
          {groupePatient ? (compat ? "Groupes compatibles." : "GROUPES INCOMPATIBLES — la transfusion sera bloquée en base.") : "Groupe du patient inconnu — la transfusion sera bloquée en base."}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ ...inputSt, resize: "vertical" }} />
        </div>

        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 18, cursor: "pointer" }}>
          <input type="checkbox" checked={confirme} onChange={(e) => setConfirme(e.target.checked)} style={{ marginTop: 2 }} />
          <span style={{ fontSize: 12, color: colors.text }}>
            Je confirme avoir vérifié que le groupe du patient ({groupePatient ?? "inconnu"}) et celui de la poche ({poche.groupe_sanguin}) affichés ci-dessus, et je valide la transfusion réelle de cette poche.
          </span>
        </label>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 11, background: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={valider} disabled={!confirme}
            style={{ flex: 2, padding: 11, background: confirme ? ACCENT : colors.border, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: confirme ? "pointer" : "default" }}>
            Confirmer la transfusion
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Carte poche ─────────────────────────────────────────────────────────────
function CartePoche({ poche, canManageInventaire, canReserver, onReserver, onTransfuser, onAction }) {
  const { success, error: showError } = useToast();
  const perimeDans = joursAvant(poche.date_peremption);
  const perime = perimeDans < 0;
  const bientotPerime = !perime && perimeDans <= 7;

  async function annulerReservation() {
    try { await annulerReservationPocheSang(poche.id); success("Réservation annulée"); onAction(); }
    catch (e) { showError(e.message); }
  }
  async function ecarter() {
    if (!window.confirm(`Écarter définitivement la poche ${poche.numero_poche} du stock (péremption, contrôle qualité) ?`)) return;
    try { await ecarterPocheSang(poche.id); success("Poche écartée"); onAction(); }
    catch (e) { showError(e.message); }
  }

  return (
    <div style={{ background: colors.bgCard, borderRadius: 12, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: perime ? "1.5px solid #DC2626" : `1px solid ${colors.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: colors.navy }}>{poche.groupe_sanguin} — {poche.numero_poche}</div>
          <div style={{ fontSize: 12, color: colors.textSecondary }}>
            Péremption : <span style={{ color: perime ? "#DC2626" : bientotPerime ? "#F59E0B" : colors.textSecondary, fontWeight: (perime || bientotPerime) ? 700 : 400 }}>
              {poche.date_peremption}{perime ? " (PÉRIMÉE)" : bientotPerime ? ` (${perimeDans}j)` : ""}
            </span>
          </div>
        </div>
        <Badge cfg={STATUT_CONFIG[poche.statut]} />
      </div>

      {poche.patient_id && (
        <div style={{ fontSize: 12, color: colors.text, marginBottom: 8 }}>
          Patient : <strong>{poche.patients?.prenom} {poche.patients?.nom}</strong>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {poche.statut === "disponible" && canReserver && (
          <button onClick={onReserver} style={{ padding: "5px 11px", background: ACCENT, color: "white", border: "none", borderRadius: 7, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Réserver pour un patient</button>
        )}
        {poche.statut === "reservee" && canReserver && (
          <button onClick={annulerReservation} style={{ padding: "5px 11px", background: "#FEF3C7", color: "#B45309", border: "none", borderRadius: 7, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Annuler la réservation</button>
        )}
        {(poche.statut === "reservee") && canManageInventaire && (
          <button onClick={() => onTransfuser(poche)} style={{ padding: "5px 11px", background: "#111827", color: "white", border: "none", borderRadius: 7, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Transfuser</button>
        )}
        {["disponible", "reservee"].includes(poche.statut) && canManageInventaire && (
          <button onClick={ecarter} style={{ padding: "5px 11px", background: "#FEE2E2", color: "#DC2626", border: "none", borderRadius: 7, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Écarter</button>
        )}
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function BanqueSang() {
  const { auth } = useAuth();
  const etabId = auth?.etablissement_id ?? null;
  const roleInterne = auth?.role_interne ?? null;
  const accesComplet = !roleInterne || roleInterne === "Directeur";
  const isLaborantin = accesComplet || roleInterne === "Laborantin";
  const isMedecin = accesComplet || roleInterne === "Médecin";
  const canManageInventaire = isLaborantin; // réception, écarter, transfuser
  const canReserver = isLaborantin || isMedecin;

  const { data: patients } = usePatients(etabId);
  const [poches, setPoches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtreGroupe, setFiltreGroupe] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("disponible");
  const [showReception, setShowReception] = useState(false);
  const [showReservation, setShowReservation] = useState(false);
  const [transfusionPoche, setTransfusionPoche] = useState(null);

  const load = useCallback(async () => {
    if (!etabId) return;
    setLoading(true);
    const d = await fetchPochesSang(etabId);
    setPoches(d);
    setLoading(false);
  }, [etabId]);

  useEffect(() => { load(); }, [load]);

  const stockParGroupe = GROUPES_SANGUINS.map((g) => ({
    groupe: g,
    disponibles: poches.filter((p) => p.groupe_sanguin === g && p.statut === "disponible").length,
  }));

  const pochesBientotPerimees = poches.filter((p) =>
    ["disponible", "reservee"].includes(p.statut) && joursAvant(p.date_peremption) >= 0 && joursAvant(p.date_peremption) <= 7
  );
  const pochesPerimees = poches.filter((p) =>
    ["disponible", "reservee"].includes(p.statut) && joursAvant(p.date_peremption) < 0
  );
  const groupesStockBas = stockParGroupe.filter((s) => s.disponibles <= SEUIL_BAS);

  const filtered = poches.filter((p) => {
    if (filtreGroupe && p.groupe_sanguin !== filtreGroupe) return false;
    if (filtreStatut !== "tous" && p.statut !== filtreStatut) return false;
    return true;
  });

  return (
    <Layout title="Banque de sang" subtitle="Stock de poches par groupe sanguin, réservation et transfusion">
      {!canManageInventaire && (
        <div style={{ backgroundColor: "#EFF6FF", border: "1.5px solid #BFDBFE", borderRadius: 10, padding: "10px 16px", marginBottom: 18, fontSize: 13, color: "#1D4ED8", fontWeight: 600 }}>
          Accès en lecture et réservation. Seul le Laborantin (ou la Direction) peut réceptionner, transfuser ou écarter une poche.
        </div>
      )}

      {/* Stock par groupe */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 10, marginBottom: 18 }}>
        {stockParGroupe.map((s) => {
          const bas = s.disponibles <= SEUIL_BAS;
          return (
            <div key={s.groupe} style={{ background: colors.bgCard, borderRadius: 12, padding: "12px 10px", textAlign: "center", borderTop: `3px solid ${bas ? "#DC2626" : ACCENT}`, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: colors.textSecondary }}>{s.groupe}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: bas ? "#DC2626" : colors.navy }}>{s.disponibles}</div>
            </div>
          );
        })}
      </div>

      {(groupesStockBas.length > 0 || pochesBientotPerimees.length > 0 || pochesPerimees.length > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
          {groupesStockBas.length > 0 && (
            <div style={{ background: "#FEF2F2", border: "1.5px solid #DC2626", borderRadius: 10, padding: "10px 16px", fontSize: 12, fontWeight: 700, color: "#DC2626" }}>
              Stock bas ({SEUIL_BAS} poche(s) ou moins) : {groupesStockBas.map((s) => `${s.groupe} (${s.disponibles})`).join(", ")}
            </div>
          )}
          {pochesPerimees.length > 0 && (
            <div style={{ background: "#FEF2F2", border: "1.5px solid #DC2626", borderRadius: 10, padding: "10px 16px", fontSize: 12, fontWeight: 700, color: "#DC2626" }}>
              {pochesPerimees.length} poche(s) périmée(s) encore en stock — à écarter immédiatement.
            </div>
          )}
          {pochesBientotPerimees.length > 0 && (
            <div style={{ background: "#FFFBEB", border: "1.5px solid #F59E0B", borderRadius: 10, padding: "10px 16px", fontSize: 12, fontWeight: 700, color: "#B45309" }}>
              {pochesBientotPerimees.length} poche(s) périment dans 7 jours ou moins.
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        {canManageInventaire && (
          <button onClick={() => setShowReception(true)} style={{ padding: "9px 16px", background: ACCENT, color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            + Réceptionner une poche
          </button>
        )}
        {canReserver && (
          <button onClick={() => setShowReservation(true)} style={{ padding: "9px 16px", background: "#111827", color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Réserver pour un patient
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <select value={filtreGroupe} onChange={(e) => setFiltreGroupe(e.target.value)} style={{ ...inputSt, width: "auto", minWidth: 140 }}>
          <option value="">Tous les groupes</option>
          {GROUPES_SANGUINS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} style={{ ...inputSt, width: "auto", minWidth: 160 }}>
          <option value="tous">Tous les statuts</option>
          {Object.entries(STATUT_CONFIG).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
        </select>
        <span style={{ fontSize: 12, color: colors.textMuted, marginLeft: "auto" }}>{filtered.length} poche(s)</span>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: colors.textMuted, fontSize: 13 }}>Chargement...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: colors.textMuted, fontSize: 13, background: colors.bgCard, borderRadius: 12 }}>Aucune poche pour ce filtre.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {filtered.map((p) => (
            <CartePoche key={p.id} poche={p} canManageInventaire={canManageInventaire} canReserver={canReserver}
              onReserver={() => setShowReservation(true)} onTransfuser={setTransfusionPoche} onAction={load} />
          ))}
        </div>
      )}

      {showReception && <ModalReception etablissement_id={etabId} onClose={() => setShowReception(false)} onSaved={load} />}
      {showReservation && (
        <ModalReservation etablissement_id={etabId} patients={patients ?? []} poches={poches}
          onClose={() => setShowReservation(false)} onSaved={load} />
      )}
      {transfusionPoche && (
        <ModalTransfusion poche={transfusionPoche} onClose={() => setTransfusionPoche(null)} onSaved={load} />
      )}
    </Layout>
  );
}
