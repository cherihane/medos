import { useState, useEffect, useCallback } from "react";
import { colors } from "../../theme";
import { useAuth } from "../../context/AuthContext";
import Layout from "../../components/Layout";
import { useToast } from "../../hooks/useToast";
import {
  fetchLotsRecents,
  insertLotSterilisation,
  updateLotSterilisation,
  fetchEquipementsSterilistion,
  upsertEquipementSterilisation,
  genererNumeroLot,
} from "../../hooks/useMutations";
import { openDocument, tableHTML, fetchEtabFromAuth } from "../../utils/MedOSDocument";
import { SERVICES_HOPITAL } from "../../constants/hopital";

const ACCENT = "#10B981";

const METHODE_DEFAUTS = {
  autoclave_134:  { temperature: 134, duree_min: 18,  pression_bar: 2.25, peremption_j: 30,  label: "Autoclave 134°C" },
  autoclave_121:  { temperature: 121, duree_min: 30,  pression_bar: 1.05, peremption_j: 30,  label: "Autoclave 121°C" },
  poupinel:       { temperature: 180, duree_min: 60,  pression_bar: null, peremption_j: 7,   label: "Poupinel 180°C" },
  glutaraldehyde: { temperature: 20,  duree_min: 600, pression_bar: null, peremption_j: 1,   label: "Glutaraldéhyde 2%" },
  plasma:         { temperature: 55,  duree_min: 75,  pression_bar: null, peremption_j: 180, label: "Plasma" },
};

const INDICATEUR_CONFIG = {
  conforme:     { label: "Conforme",     color: "#10B981", bg: "#F0FDF4" },
  non_conforme: { label: "Non conforme", color: "#DC2626", bg: "#FEF2F2" },
  non_verifie:  { label: "Non vérifié",  color: "#9CA3AF", bg: "#F3F4F6" },
};

const TEST_BIO_CONFIG = {
  negatif:     { label: "Négatif",    color: "#10B981", bg: "#F0FDF4" },
  en_attente:  { label: "En attente", color: "#F59E0B", bg: "#FFFBEB" },
  positif:     { label: "Positif",    color: "#DC2626", bg: "#FEF2F2" },
  non_fait:    { label: "Non fait",   color: "#9CA3AF", bg: "#F3F4F6" },
};

const STATUT_CONFIG = {
  en_attente_validation: { label: "En attente",    color: "#F59E0B", bg: "#FFFBEB" },
  valide:                { label: "Validé",         color: "#10B981", bg: "#F0FDF4" },
  distribue:             { label: "Distribué",      color: "#3B82F6", bg: "#EFF6FF" },
  non_conforme:          { label: "Non conforme",   color: "#DC2626", bg: "#FEF2F2" },
};

const EQUIP_STATUT = {
  operationnel: { label: "Opérationnel", color: "#10B981" },
  maintenance:  { label: "Maintenance",  color: "#F59E0B" },
  en_panne:     { label: "En panne",     color: "#DC2626" },
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

// ─── Modal Nouveau Cycle ──────────────────────────────────────────────────────
function ModalNouveauCycle({ etablissement_id, equipements, onClose, onSaved }) {
  const { success } = useToast();
  const auth = useAuth();
  const [form, setForm] = useState({
    description_contenu: "", nombre_sets: 1, service_destinataire: "",
    methode: "autoclave_134", equipement_id: "",
    temperature: 134, duree_min: 18, pression_bar: 2.25,
    indicateur_chimique: "non_verifie", test_biologique: "non_fait",
    date_peremption_sterilite: "",
    operateur: "", notes: "",
  });

  useEffect(() => {
    setForm((f) => ({ ...f, operateur: auth?.user?.email ?? "" }));
  }, []); // eslint-disable-line

  function setMethode(m) {
    const def = METHODE_DEFAUTS[m];
    const perem = new Date();
    perem.setDate(perem.getDate() + def.peremption_j);
    setForm((f) => ({
      ...f, methode: m,
      temperature: def.temperature,
      duree_min: def.duree_min,
      pression_bar: def.pression_bar ?? "",
      date_peremption_sterilite: perem.toISOString().slice(0, 10),
    }));
  }

  useEffect(() => { setMethode("autoclave_134"); }, []); // eslint-disable-line

  async function save() {
    if (!form.description_contenu) return;
    const numero = await genererNumeroLot(etablissement_id);
    const { error } = await insertLotSterilisation({
      ...form,
      etablissement_id,
      numero_lot: numero,
      date_sterilisation: new Date().toISOString(),
      pression_bar: form.pression_bar !== "" ? Number(form.pression_bar) : null,
      nombre_sets: Number(form.nombre_sets) || 1,
      equipement_id: form.equipement_id || null,
      date_peremption_sterilite: form.date_peremption_sterilite || null,
    });
    if (!error) { success(`Lot ${numero} enregistré`); onSaved(); onClose(); }
  }

  const methodes = Object.entries(METHODE_DEFAUTS);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: colors.bgCard, borderRadius: 16, width: "100%", maxWidth: 600, maxHeight: "93vh", overflowY: "auto", padding: "22px 26px", boxShadow: "0 20px 60px rgba(0,0,0,0.22)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.navy }}>Enregistrer un cycle de stérilisation</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted }}>×</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Description du contenu *</label>
            <textarea value={form.description_contenu} onChange={(e) => setForm((f) => ({ ...f, description_contenu: e.target.value }))}
              rows={2} style={{ ...inputSt, resize: "vertical" }}
              placeholder="Ex: 2 sets chirurgie générale (8 pinces, 2 bistouris, 4 compresses)" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Nombre de sets</label>
              <input type="number" min={1} value={form.nombre_sets} onChange={(e) => setForm((f) => ({ ...f, nombre_sets: e.target.value }))} style={inputSt} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Service destinataire</label>
              <select value={form.service_destinataire} onChange={(e) => setForm((f) => ({ ...f, service_destinataire: e.target.value }))} style={inputSt}>
                <option value="">— Tous services —</option>
                {SERVICES_HOPITAL.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 6 }}>Méthode de stérilisation *</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {methodes.map(([k, def]) => (
                <button key={k} onClick={() => setMethode(k)}
                  style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer", border: `1.5px solid ${form.methode === k ? ACCENT : colors.border}`, background: form.methode === k ? "#F0FDF4" : colors.bgSurface, color: form.methode === k ? ACCENT : colors.text, fontWeight: form.methode === k ? 700 : 400 }}>
                  {def.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Équipement utilisé</label>
            <select value={form.equipement_id} onChange={(e) => setForm((f) => ({ ...f, equipement_id: e.target.value }))} style={inputSt}>
              <option value="">— Sélectionner —</option>
              {equipements.filter((e) => e.statut === "operationnel").map((e) => (
                <option key={e.id} value={e.id}>{e.nom} ({e.type})</option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Température (°C)</label>
              <input type="number" value={form.temperature} onChange={(e) => setForm((f) => ({ ...f, temperature: e.target.value }))} style={inputSt} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Durée (min)</label>
              <input type="number" value={form.duree_min} onChange={(e) => setForm((f) => ({ ...f, duree_min: e.target.value }))} style={inputSt} />
            </div>
            {form.methode.startsWith("autoclave") && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Pression (bar)</label>
                <input type="number" step="0.01" value={form.pression_bar} onChange={(e) => setForm((f) => ({ ...f, pression_bar: e.target.value }))} style={inputSt} />
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 6 }}>Indicateur chimique</label>
              <div style={{ display: "flex", gap: 6 }}>
                {Object.entries(INDICATEUR_CONFIG).map(([k, c]) => (
                  <button key={k} onClick={() => setForm((f) => ({ ...f, indicateur_chimique: k }))}
                    style={{ flex: 1, padding: "6px 8px", borderRadius: 8, fontSize: 11, cursor: "pointer", border: `1.5px solid ${form.indicateur_chimique === k ? c.color : colors.border}`, background: form.indicateur_chimique === k ? c.bg : colors.bgSurface, color: form.indicateur_chimique === k ? c.color : colors.text, fontWeight: form.indicateur_chimique === k ? 700 : 400 }}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 6 }}>Test biologique</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {Object.entries(TEST_BIO_CONFIG).map(([k, c]) => (
                  <button key={k} onClick={() => setForm((f) => ({ ...f, test_biologique: k }))}
                    style={{ padding: "5px 8px", borderRadius: 8, fontSize: 11, cursor: "pointer", border: `1.5px solid ${form.test_biologique === k ? c.color : colors.border}`, background: form.test_biologique === k ? c.bg : colors.bgSurface, color: form.test_biologique === k ? c.color : colors.text, fontWeight: form.test_biologique === k ? 700 : 400 }}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Péremption de la stérilité</label>
            <input type="date" value={form.date_peremption_sterilite} onChange={(e) => setForm((f) => ({ ...f, date_peremption_sterilite: e.target.value }))} style={inputSt} />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Opérateur</label>
            <input value={form.operateur} onChange={(e) => setForm((f) => ({ ...f, operateur: e.target.value }))} style={inputSt} />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} style={{ ...inputSt, resize: "vertical" }} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 11, background: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={save} style={{ flex: 2, padding: 11, background: ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Enregistrer le cycle</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Maintenance ────────────────────────────────────────────────────────
function ModalMaintenance({ equip, onClose, onSaved }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const { success } = useToast();
  async function save() {
    await upsertEquipementSterilisation({ id: equip.id, statut: "operationnel", date_derniere_maintenance: date });
    success("Maintenance enregistrée");
    onSaved(); onClose();
  }
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1001, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: colors.bgCard, borderRadius: 14, padding: 24, width: 360, boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: colors.navy }}>Maintenance — {equip.nom}</h3>
        <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Date de maintenance</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputSt} />
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 9, background: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={save} style={{ flex: 1, padding: 9, background: ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Ajouter équipement ─────────────────────────────────────────────────
function ModalAjouterEquipement({ etablissement_id, onClose, onSaved }) {
  const [form, setForm] = useState({ nom: "", type: "autoclave", numero_serie: "" });
  const { success } = useToast();
  async function save() {
    if (!form.nom) return;
    await upsertEquipementSterilisation({ ...form, etablissement_id, statut: "operationnel" });
    success("Équipement ajouté");
    onSaved(); onClose();
  }
  const TYPES = ["autoclave", "poupinel", "chimique", "plasma"];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1001, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: colors.bgCard, borderRadius: 14, padding: 24, width: 400, boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: colors.navy }}>Ajouter un équipement</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Nom *</label>
            <input value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} style={inputSt} placeholder="Ex: Autoclave 1" />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Type</label>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} style={inputSt}>
              {TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Numéro de série</label>
            <input value={form.numero_serie} onChange={(e) => setForm((f) => ({ ...f, numero_serie: e.target.value }))} style={inputSt} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 9, background: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={save} style={{ flex: 1, padding: 9, background: ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Ajouter</button>
        </div>
      </div>
    </div>
  );
}

// ─── Carte lot ────────────────────────────────────────────────────────────────
function CarteLot({ lot, onAction }) {
  const { success } = useToast();
  const auth = useAuth();
  const canValider = lot.indicateur_chimique === "conforme" && ["negatif", "non_fait"].includes(lot.test_biologique);

  async function action(type) {
    if (type === "valider") {
      await updateLotSterilisation(lot.id, { statut: "valide", valide_par: auth?.user?.email ?? "" });
      success("Lot validé");
    } else if (type === "distribuer") {
      await updateLotSterilisation(lot.id, { statut: "distribue" });
      success("Lot distribué");
    } else if (type === "non_conforme") {
      await updateLotSterilisation(lot.id, { statut: "non_conforme" });
      success("Lot marqué non conforme");
    }
    onAction();
  }

  async function imprimer() {
    const methodeLabel = METHODE_DEFAUTS[lot.methode]?.label ?? lot.methode;
    openDocument({
      etablissement: null,
      titre: `Etiquette stérilisation — ${lot.numero_lot}`,
      sections: [{
        titre: "Informations lot",
        html: `<table style="width:100%;border-collapse:collapse;font-size:12px">
          <tr><td style="padding:6px;border:1px solid #e5e7eb;font-weight:600">N° lot</td><td style="padding:6px;border:1px solid #e5e7eb">${lot.numero_lot}</td></tr>
          <tr><td style="padding:6px;border:1px solid #e5e7eb;font-weight:600">Contenu</td><td style="padding:6px;border:1px solid #e5e7eb">${lot.description_contenu}</td></tr>
          <tr><td style="padding:6px;border:1px solid #e5e7eb;font-weight:600">Méthode</td><td style="padding:6px;border:1px solid #e5e7eb">${methodeLabel}</td></tr>
          <tr><td style="padding:6px;border:1px solid #e5e7eb;font-weight:600">Date stérilisation</td><td style="padding:6px;border:1px solid #e5e7eb">${new Date(lot.date_sterilisation).toLocaleString("fr-FR")}</td></tr>
          <tr><td style="padding:6px;border:1px solid #e5e7eb;font-weight:600">Péremption stérilité</td><td style="padding:6px;border:1px solid #e5e7eb">${lot.date_peremption_sterilite ?? "Non définie"}</td></tr>
          <tr><td style="padding:6px;border:1px solid #e5e7eb;font-weight:600">Opérateur</td><td style="padding:6px;border:1px solid #e5e7eb">${lot.operateur}</td></tr>
        </table>`,
      }],
    });
  }

  const isPerime = lot.date_peremption_sterilite && new Date(lot.date_peremption_sterilite) < new Date();

  return (
    <div style={{ background: colors.bgCard, borderRadius: 12, padding: "16px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: lot.statut === "non_conforme" ? "1.5px solid #DC2626" : isPerime ? "1.5px solid #DC2626" : `1px solid ${colors.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: colors.navy, marginBottom: 2 }}>{lot.numero_lot}</div>
          <div style={{ fontSize: 12, color: colors.textSecondary }}>{lot.description_contenu}</div>
        </div>
        <Badge cfg={STATUT_CONFIG[lot.statut]} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8, marginBottom: 12 }}>
        {[
          ["Méthode", METHODE_DEFAUTS[lot.methode]?.label ?? lot.methode],
          ["Équipement", lot.equipements_sterilisation?.nom ?? "—"],
          ["Service dest.", lot.service_destinataire || "—"],
          ["Opérateur", lot.operateur],
          ["Péremption", lot.date_peremption_sterilite ? (isPerime ? `PÉRIMÉ (${lot.date_peremption_sterilite})` : lot.date_peremption_sterilite) : "—"],
        ].map(([l, v]) => (
          <div key={l}>
            <div style={{ fontSize: 10, color: colors.textMuted }}>{l}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: isPerime && l === "Péremption" ? "#DC2626" : colors.text }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: colors.textSecondary }}>
          Indicateur chimique : <Badge cfg={INDICATEUR_CONFIG[lot.indicateur_chimique]} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: colors.textSecondary }}>
          Test biologique : <Badge cfg={TEST_BIO_CONFIG[lot.test_biologique]} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {lot.statut === "en_attente_validation" && (
          <>
            {canValider && <button onClick={() => action("valider")} style={{ padding: "5px 11px", background: ACCENT, color: "white", border: "none", borderRadius: 7, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Valider</button>}
            <button onClick={() => action("non_conforme")} style={{ padding: "5px 11px", background: "#FEE2E2", color: "#DC2626", border: "none", borderRadius: 7, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Non conforme</button>
          </>
        )}
        {lot.statut === "valide" && (
          <button onClick={() => action("distribuer")} style={{ padding: "5px 11px", background: "#EFF6FF", color: "#3B82F6", border: "none", borderRadius: 7, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Distribuer</button>
        )}
        <button onClick={imprimer} style={{ padding: "5px 11px", background: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 7, fontSize: 12, cursor: "pointer" }}>Imprimer l'étiquette</button>
      </div>
    </div>
  );
}

// ─── Onglet Lots du jour ──────────────────────────────────────────────────────
function OngletLotsJour({ etablissement_id, equipements, loadEquip }) {
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const todayISO = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    setLoading(true);
    const all = await fetchLotsRecents(etablissement_id, 200);
    setLots(all.filter((l) => l.created_at?.slice(0, 10) === todayISO));
    setLoading(false);
  }, [etablissement_id, todayISO]);

  useEffect(() => { load(); }, [load]);

  const nbValides    = lots.filter((l) => l.statut === "valide").length;
  const nbAttente    = lots.filter((l) => l.statut === "en_attente_validation").length;
  const nbNonConf    = lots.filter((l) => l.statut === "non_conforme").length;
  const nbPerimSoon  = lots.filter((l) => {
    if (!l.date_peremption_sterilite || l.statut !== "valide") return false;
    const diff = (new Date(l.date_peremption_sterilite) - new Date()) / 86400000;
    return diff >= 0 && diff <= 7;
  }).length;

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 18 }}>
        {[
          ["Validés", nbValides, ACCENT],
          ["En attente", nbAttente, "#F59E0B"],
          ["Non conformes", nbNonConf, "#DC2626"],
          ["Périme dans 7j", nbPerimSoon, "#F59E0B"],
        ].map(([l, v, c]) => (
          <div key={l} style={{ background: colors.bgCard, borderRadius: 12, padding: "12px 14px", borderTop: `3px solid ${c}`, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: c }}>{v}</div>
            <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 18 }}>
        <button onClick={() => setShowModal(true)} style={{ padding: "9px 16px", background: ACCENT, color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          + Enregistrer un cycle de stérilisation
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: colors.textMuted, fontSize: 13 }}>Chargement...</div>
      ) : lots.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: colors.textMuted, fontSize: 13, background: colors.bgCard, borderRadius: 12 }}>Aucun cycle enregistré aujourd'hui.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {lots.map((l) => <CarteLot key={l.id} lot={l} onAction={load} />)}
        </div>
      )}

      {showModal && (
        <ModalNouveauCycle etablissement_id={etablissement_id} equipements={equipements} onClose={() => setShowModal(false)} onSaved={load} />
      )}
    </div>
  );
}

// ─── Onglet Historique ────────────────────────────────────────────────────────
function OngletHistorique({ etablissement_id }) {
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtreStatut, setFiltreStatut] = useState("tous");
  const [filtreService, setFiltreService] = useState("");
  const auth = useAuth();

  const load = useCallback(async () => {
    setLoading(true);
    const d = await fetchLotsRecents(etablissement_id, 200);
    setLots(d);
    setLoading(false);
  }, [etablissement_id]);

  useEffect(() => { load(); }, [load]);

  const lotsPerimes = lots.filter((l) =>
    l.statut === "valide" &&
    l.date_peremption_sterilite &&
    new Date(l.date_peremption_sterilite) < new Date()
  );

  const filtered = lots.filter((l) => {
    if (filtreStatut !== "tous" && l.statut !== filtreStatut) return false;
    if (filtreService && l.service_destinataire !== filtreService) return false;
    return true;
  });

  async function exporter() {
    const etab = await fetchEtabFromAuth(auth);
    const rows = filtered.map((l) => [
      l.numero_lot,
      new Date(l.date_sterilisation).toLocaleDateString("fr-FR"),
      l.description_contenu.slice(0, 40),
      METHODE_DEFAUTS[l.methode]?.label ?? l.methode,
      l.equipements_sterilisation?.nom ?? "—",
      l.operateur,
      INDICATEUR_CONFIG[l.indicateur_chimique]?.label ?? l.indicateur_chimique,
      TEST_BIO_CONFIG[l.test_biologique]?.label ?? l.test_biologique,
      STATUT_CONFIG[l.statut]?.label ?? l.statut,
      l.date_peremption_sterilite ?? "—",
    ]);
    openDocument({
      etablissement: etab,
      titre: "Registre de stérilisation",
      sections: [{ titre: `${filtered.length} lots`, html: tableHTML(["N° Lot", "Date", "Contenu", "Méthode", "Équipement", "Opérateur", "Indicateur", "Test bio", "Statut", "Péremption"], rows) }],
    });
  }

  return (
    <div>
      {lotsPerimes.length > 0 && (
        <div style={{ background: "#FEF2F2", border: "1.5px solid #DC2626", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#DC2626" }}>
            {lotsPerimes.length} lot(s) validé(s) ont dépassé leur date de péremption de stérilité. Retirer du stock immédiatement.
          </span>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} style={{ ...inputSt, width: "auto", minWidth: 160 }}>
          <option value="tous">Tous les statuts</option>
          {Object.entries(STATUT_CONFIG).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
        </select>
        <select value={filtreService} onChange={(e) => setFiltreService(e.target.value)} style={{ ...inputSt, width: "auto", minWidth: 180 }}>
          <option value="">Tous les services</option>
          {SERVICES_HOPITAL.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={exporter} style={{ padding: "9px 14px", background: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 9, fontSize: 13, cursor: "pointer" }}>
          Exporter le registre
        </button>
        <span style={{ fontSize: 12, color: colors.textMuted, marginLeft: "auto" }}>{filtered.length} résultat(s)</span>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: colors.textMuted, fontSize: 13 }}>Chargement...</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: colors.bgCard, borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#F8FAFC" }}>
                {["N° Lot", "Date", "Contenu", "Méthode", "Opérateur", "Indicateur", "Test bio", "Statut", "Péremption"].map((h) => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: colors.textSecondary, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((l, i) => {
                const isPerime = l.date_peremption_sterilite && new Date(l.date_peremption_sterilite) < new Date();
                return (
                  <tr key={l.id} style={{ borderTop: i > 0 ? `1px solid ${colors.border}` : "none" }}>
                    <td style={{ padding: "9px 12px", fontWeight: 700, color: colors.navy }}>{l.numero_lot}</td>
                    <td style={{ padding: "9px 12px", color: colors.textSecondary }}>{new Date(l.date_sterilisation).toLocaleDateString("fr-FR")}</td>
                    <td style={{ padding: "9px 12px", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.description_contenu}</td>
                    <td style={{ padding: "9px 12px" }}>{METHODE_DEFAUTS[l.methode]?.label ?? l.methode}</td>
                    <td style={{ padding: "9px 12px", color: colors.textSecondary }}>{l.operateur}</td>
                    <td style={{ padding: "9px 12px" }}><Badge cfg={INDICATEUR_CONFIG[l.indicateur_chimique]} /></td>
                    <td style={{ padding: "9px 12px" }}><Badge cfg={TEST_BIO_CONFIG[l.test_biologique]} /></td>
                    <td style={{ padding: "9px 12px" }}><Badge cfg={STATUT_CONFIG[l.statut]} /></td>
                    <td style={{ padding: "9px 12px", color: isPerime ? "#DC2626" : colors.text, fontWeight: isPerime ? 700 : 400 }}>
                      {l.date_peremption_sterilite ?? "—"}
                    </td>
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

// ─── Onglet Équipements ───────────────────────────────────────────────────────
function OngletEquipements({ etablissement_id, equipements, reload }) {
  const [maintenanceModal, setMaintenanceModal] = useState(null);
  const [ajoutModal, setAjoutModal] = useState(false);
  const { success } = useToast();

  async function signalerPanne(equip) {
    await upsertEquipementSterilisation({ id: equip.id, statut: "en_panne" });
    success("Panne signalée");
    reload();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={() => setAjoutModal(true)} style={{ padding: "9px 16px", background: ACCENT, color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          + Ajouter un équipement
        </button>
      </div>

      {equipements.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: colors.textMuted, fontSize: 13, background: colors.bgCard, borderRadius: 12 }}>Aucun équipement enregistré.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {equipements.map((e) => {
            const sc = EQUIP_STATUT[e.statut] ?? { label: e.statut, color: "#6B7280" };
            return (
              <div key={e.id} style={{ background: colors.bgCard, borderRadius: 12, padding: "16px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: `1px solid ${colors.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: colors.navy }}>{e.nom}</div>
                    <div style={{ fontSize: 12, color: colors.textSecondary }}>{e.type} {e.numero_serie ? `— ${e.numero_serie}` : ""}</div>
                  </div>
                  <span style={{ padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: `${sc.color}18`, color: sc.color }}>{sc.label}</span>
                </div>
                {e.date_derniere_maintenance && (
                  <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 10 }}>
                    Dernière maintenance : {new Date(e.date_derniere_maintenance).toLocaleDateString("fr-FR")}
                  </div>
                )}
                <div style={{ display: "flex", gap: 6 }}>
                  {e.statut !== "en_panne" && (
                    <button onClick={() => signalerPanne(e)} style={{ padding: "5px 10px", background: "#FEE2E2", color: "#DC2626", border: "none", borderRadius: 7, fontSize: 11, cursor: "pointer" }}>Signaler une panne</button>
                  )}
                  <button onClick={() => setMaintenanceModal(e)} style={{ padding: "5px 10px", background: "#F0FDF4", color: ACCENT, border: "none", borderRadius: 7, fontSize: 11, cursor: "pointer" }}>Maintenance effectuée</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {maintenanceModal && <ModalMaintenance equip={maintenanceModal} onClose={() => setMaintenanceModal(null)} onSaved={reload} />}
      {ajoutModal && <ModalAjouterEquipement etablissement_id={etablissement_id} onClose={() => setAjoutModal(false)} onSaved={reload} />}
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function Sterilisation() {
  const { auth } = useAuth();
  const etabId = auth?.etablissement_id ?? null;
  const [onglet, setOnglet] = useState("jour");
  const [equipements, setEquipements] = useState([]);

  const loadEquip = useCallback(async () => {
    if (!etabId) return;
    const d = await fetchEquipementsSterilistion(etabId);
    setEquipements(d);
  }, [etabId]);

  useEffect(() => { loadEquip(); }, [loadEquip]);

  const ONGLETS = [
    { key: "jour",        label: "Lots du jour" },
    { key: "historique",  label: "Historique" },
    { key: "equipements", label: "Équipements" },
  ];

  return (
    <Layout title="Stérilisation" subtitle="Traçabilité des cycles de stérilisation des instruments">
      <div style={{ display: "flex", gap: 0, borderBottom: `2px solid ${colors.border}`, marginBottom: 24 }}>
        {ONGLETS.map(({ key, label }) => (
          <button key={key} onClick={() => setOnglet(key)}
            style={{ padding: "11px 18px", background: "none", border: "none", borderBottom: onglet === key ? `2px solid ${ACCENT}` : "2px solid transparent", fontSize: 13, fontWeight: onglet === key ? 700 : 400, color: onglet === key ? ACCENT : "#6B7280", cursor: "pointer", marginBottom: -2, whiteSpace: "nowrap" }}>
            {label}
          </button>
        ))}
      </div>

      {onglet === "jour"        && <OngletLotsJour etablissement_id={etabId} equipements={equipements} loadEquip={loadEquip} />}
      {onglet === "historique"  && <OngletHistorique etablissement_id={etabId} />}
      {onglet === "equipements" && <OngletEquipements etablissement_id={etabId} equipements={equipements} reload={loadEquip} />}
    </Layout>
  );
}
