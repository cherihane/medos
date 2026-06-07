import { colors } from "../../theme";
import { useState, useEffect } from "react";
import Layout from "../../components/Layout";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useAuth } from "../../context/AuthContext";
import {
  openDocument,
  tableHTML,
  infoGridHTML,
  signatureRowHTML,
  fetchEtabFromAuth,
} from "../../utils/MedOSDocument";
import {
  insertTransmissionGarde,
  fetchTransmissionsGarde,
  fetchLitsOccupes,
  fetchMembresPersonnel,
} from "../../hooks/useMutations";
import { SERVICES_HOPITAL } from "../../constants/hopital";

// ── Spinner ────────────────────────────────────────────────────────────────────
const Spin = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" style={{ animation: "spin 1s linear infinite", marginRight: 6 }}>
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
  </svg>
);

// ── Styles partagés ────────────────────────────────────────────────────────────
const labelSt = {
  fontSize: 12, fontWeight: 600, color: colors.text,
  display: "block", marginBottom: 4,
};

const inputSt = {
  width: "100%", padding: "9px 12px",
  border: `1.5px solid ${colors.border}`,
  borderRadius: 8, fontSize: 13,
  color: colors.text, backgroundColor: colors.bgCard,
  outline: "none", boxSizing: "border-box",
};

// ── Composant principal ────────────────────────────────────────────────────────
export default function TransmissionGarde() {
  const { auth } = useAuth();
  const { toasts, success, error: showError } = useToast();

  // Données
  const [litsOccupes, setLitsOccupes]   = useState([]);
  const [medecins, setMedecins]         = useState([]);
  const [historique, setHistorique]     = useState([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);

  // Formulaire
  const [serviceFiltre, setServiceFiltre]   = useState("");
  const [medecinEntrant, setMedecinEntrant] = useState("");
  const [messageGeneral, setMessageGeneral] = useState("");
  const [signalements, setSignalements]     = useState({});
  // signalements : { hosp_id: { nom, lit, chambre, service, message } }

  // Onglets
  const [onglet, setOnglet] = useState("nouvelle");

  // ── Chargement ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!auth?.etablissement_id) return;
    load();
  }, [auth?.etablissement_id]); // eslint-disable-line

  async function load() {
    setLoading(true);
    try {
      const [lits, membres, hist] = await Promise.all([
        fetchLitsOccupes(auth.etablissement_id),
        fetchMembresPersonnel(auth.etablissement_id),
        fetchTransmissionsGarde(auth.etablissement_id),
      ]);
      setLitsOccupes(lits ?? []);
      setMedecins((membres ?? []).filter((m) => m.role_interne === "Médecin"));
      setHistorique(hist ?? []);
    } catch (e) {
      showError("Erreur de chargement : " + e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Patients filtrés ──────────────────────────────────────────────────────────
  const patientsFiltres = serviceFiltre
    ? litsOccupes.filter((h) => h.service === serviceFiltre)
    : litsOccupes;

  // ── Signalements ──────────────────────────────────────────────────────────────
  function toggleSignalement(hosp) {
    setSignalements((prev) => {
      if (prev[hosp.id]) {
        const next = { ...prev };
        delete next[hosp.id];
        return next;
      }
      return {
        ...prev,
        [hosp.id]: {
          nom: `${hosp.patients?.prenom ?? ""} ${hosp.patients?.nom ?? ""}`.trim() || "Patient inconnu",
          lit: hosp.lit ? `Lit ${hosp.lit}` : "—",
          chambre: hosp.chambre ?? "—",
          service: hosp.service ?? "—",
          message: "",
        },
      };
    });
  }

  function setMessageSignalement(id, msg) {
    setSignalements((prev) => ({
      ...prev,
      [id]: { ...prev[id], message: msg },
    }));
  }

  // ── Validation ────────────────────────────────────────────────────────────────
  async function handleValider() {
    if (!messageGeneral.trim() && Object.keys(signalements).length === 0) {
      showError("Ajoutez un message general ou selectionnez au moins un patient.");
      return;
    }
    setSaving(true);
    try {
      const patients_critiques = Object.values(signalements);

      const transmission = await insertTransmissionGarde({
        etablissement_id: auth.etablissement_id,
        medecin_sortant:  auth.user?.email ?? "Inconnu",
        medecin_entrant:  medecinEntrant || null,
        service:          serviceFiltre || null,
        message_general:  messageGeneral.trim() || null,
        patients_critiques,
      });

      success("Transmission enregistree.");
      await imprimerTransmission(transmission, patients_critiques);

      // Reset
      setMessageGeneral("");
      setMedecinEntrant("");
      setSignalements({});

      // Rafraîchir historique et basculer
      const hist = await fetchTransmissionsGarde(auth.etablissement_id);
      setHistorique(hist ?? []);
      setOnglet("historique");
    } catch (e) {
      showError("Erreur : " + e.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Impression ────────────────────────────────────────────────────────────────
  async function imprimerTransmission(t, patients_critiques) {
    const etab = await fetchEtabFromAuth(auth);
    const dateHeure = new Date(t?.created_at ?? Date.now()).toLocaleString("fr-FR", {
      day: "2-digit", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

    const rows = patients_critiques.map((p) => [
      p.nom || "—", p.lit || "—", p.chambre || "—",
      p.service || "—", p.message || "Aucune consigne",
    ]);

    openDocument({
      titre: "Fiche de transmission de garde",
      sousTitre: dateHeure,
      etablissement: etab,
      sections: [
        {
          titre: "Informations",
          html: infoGridHTML([
            { label: "Medecin sortant", value: t?.medecin_sortant ?? auth.user?.email ?? "—" },
            { label: "Medecin entrant",  value: t?.medecin_entrant ?? "A determiner" },
            { label: "Service",          value: t?.service ?? "Tous services" },
            { label: "Date / Heure",     value: dateHeure },
          ]),
        },
        {
          titre: "Message general",
          html: `<p style="font-size:13px;line-height:1.7;color:#374151">${
            t?.message_general
              ? t.message_general.replace(/\n/g, "<br/>")
              : "Aucun message particulier."
          }</p>`,
        },
        {
          titre: `Patients a surveiller (${patients_critiques.length})`,
          html: patients_critiques.length === 0
            ? "<p style='color:#6B7280;font-size:13px'>Aucun patient signale.</p>"
            : tableHTML(["Patient", "Lit", "Chambre", "Service", "Consignes"], rows),
        },
        { titre: "", html: signatureRowHTML(["Medecin sortant", "Medecin entrant"]) },
      ],
    });
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Layout title="Transmission de garde" subtitle="Passation entre medecins">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: colors.textMuted, fontSize: 14 }}>
          Chargement...
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Transmission de garde" subtitle="Passation entre medecins — horodatee et imprimable">
      <Toast toasts={toasts} />

      {/* Onglets */}
      <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: `2px solid ${colors.border}` }}>
        {[
          { key: "nouvelle",   label: "Nouvelle transmission" },
          { key: "historique", label: `Historique (${historique.length})` },
        ].map((t) => (
          <button key={t.key} onClick={() => setOnglet(t.key)} style={{
            padding: "10px 20px", border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 700, backgroundColor: "transparent",
            color: onglet === t.key ? "#10B981" : colors.textMuted,
            borderBottom: onglet === t.key ? "2px solid #10B981" : "2px solid transparent",
            marginBottom: -2,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── ONGLET NOUVELLE TRANSMISSION ──────────────────────────────────────── */}
      {onglet === "nouvelle" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

          {/* Colonne gauche — Formulaire */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Infos transmission */}
            <div style={{ backgroundColor: colors.bgCard, borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy, marginBottom: 14 }}>
                Informations de la transmission
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelSt}>Medecin sortant</label>
                <div style={{ ...inputSt, backgroundColor: colors.bgSurface, color: colors.textMuted }}>
                  {auth.user?.email ?? "—"}
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelSt}>Medecin entrant</label>
                <select value={medecinEntrant} onChange={(e) => setMedecinEntrant(e.target.value)}
                  style={{ ...inputSt, cursor: "pointer" }}>
                  <option value="">— Selectionner (optionnel) —</option>
                  {medecins.map((m) => (
                    <option key={m.id} value={m.email}>{m.email}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelSt}>Filtrer par service</label>
                <select value={serviceFiltre} onChange={(e) => setServiceFiltre(e.target.value)}
                  style={{ ...inputSt, cursor: "pointer" }}>
                  <option value="">Tous les services</option>
                  {SERVICES_HOPITAL.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Message général */}
            <div style={{ backgroundColor: colors.bgCard, borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <label style={{ ...labelSt, fontSize: 13, marginBottom: 8 }}>
                Message general pour le service
              </label>
              <textarea
                value={messageGeneral}
                onChange={(e) => setMessageGeneral(e.target.value)}
                placeholder="Ex : Generateur en panne salle 3. Patient sous surveillance rapprochee en salle 2. Stock de serum physiologique a renouveler..."
                rows={5}
                style={{ ...inputSt, resize: "vertical", lineHeight: 1.6 }}
              />
            </div>

            {/* Bouton valider */}
            <button onClick={handleValider} disabled={saving} style={{
              padding: "13px 20px",
              backgroundColor: saving ? "#E5E7EB" : "#10B981",
              color: saving ? "#9CA3AF" : "white",
              border: "none", borderRadius: 10,
              fontSize: 14, fontWeight: 700,
              cursor: saving ? "wait" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {saving ? <><Spin />Enregistrement...</> : "Valider et imprimer la fiche"}
            </button>
          </div>

          {/* Colonne droite — Patients */}
          <div style={{ backgroundColor: colors.bgCard, borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>
                Patients hospitalises a signaler
              </div>
              <div style={{ fontSize: 12, color: colors.textMuted }}>
                {Object.keys(signalements).length} signale(s)
              </div>
            </div>

            {patientsFiltres.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: colors.textMuted, fontSize: 13 }}>
                Aucun patient hospitalise{serviceFiltre ? ` en ${serviceFiltre}` : ""}.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 520, overflowY: "auto" }}>
                {patientsFiltres.map((hosp) => {
                  const estSignale = !!signalements[hosp.id];
                  const nomPatient = `${hosp.patients?.prenom ?? ""} ${hosp.patients?.nom ?? ""}`.trim() || "Patient inconnu";
                  const tc = hosp.patients?.triage;
                  const triageCfg = tc === "urgent"
                    ? { bg: "#FEF2F2", color: "#DC2626", label: "Urgent" }
                    : tc === "semi_urgent"
                    ? { bg: "#FFFBEB", color: "#D97706", label: "Semi-urgent" }
                    : null;

                  return (
                    <div key={hosp.id} style={{
                      borderRadius: 10,
                      border: `1.5px solid ${estSignale ? "#10B981" : colors.border}`,
                      backgroundColor: estSignale ? "#F0FDF4" : colors.bgSurface,
                      padding: 14,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: estSignale ? 10 : 0 }}>
                        <input type="checkbox" checked={estSignale}
                          onChange={() => toggleSignalement(hosp)}
                          style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#10B981" }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>{nomPatient}</div>
                          <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                            {hosp.service ?? "—"}
                            {hosp.lit ? ` · Lit ${hosp.lit}` : ""}
                            {hosp.chambre ? ` · Ch. ${hosp.chambre}` : ""}
                          </div>
                        </div>
                        {triageCfg && (
                          <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, fontWeight: 700, backgroundColor: triageCfg.bg, color: triageCfg.color }}>
                            {triageCfg.label}
                          </span>
                        )}
                      </div>

                      {estSignale && (
                        <textarea
                          value={signalements[hosp.id]?.message ?? ""}
                          onChange={(e) => setMessageSignalement(hosp.id, e.target.value)}
                          placeholder="Consignes de surveillance... (Ex : Surveiller TA toutes les 2h, renouveler perfusion a 18h)"
                          rows={3}
                          style={{ ...inputSt, resize: "vertical", fontSize: 12, lineHeight: 1.5, backgroundColor: "white" }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ONGLET HISTORIQUE ─────────────────────────────────────────────────── */}
      {onglet === "historique" && (
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy, marginBottom: 16 }}>
            Transmissions recentes
          </div>

          {historique.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: colors.textMuted, fontSize: 13 }}>
              Aucune transmission enregistree.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {historique.map((t) => {
                const patients = Array.isArray(t.patients_critiques) ? t.patients_critiques : [];
                return (
                  <div key={t.id} style={{
                    borderRadius: 10, border: `1px solid ${colors.border}`,
                    backgroundColor: colors.bgSurface, padding: 16,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>
                          {t.medecin_sortant}
                          {t.medecin_entrant && (
                            <span style={{ color: colors.textMuted, fontWeight: 400 }}> → {t.medecin_entrant}</span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 3 }}>
                          {new Date(t.created_at).toLocaleString("fr-FR", {
                            day: "2-digit", month: "long", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                          {t.service ? ` · ${t.service}` : ""}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {patients.length > 0 && (
                          <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, backgroundColor: "#FEF3C7", color: "#92400E", fontWeight: 600 }}>
                            {patients.length} patient(s)
                          </span>
                        )}
                        <button onClick={() => imprimerTransmission(t, patients)} style={{
                          padding: "5px 12px", fontSize: 11, fontWeight: 600,
                          backgroundColor: "#10B981", color: "white",
                          border: "none", borderRadius: 6, cursor: "pointer",
                        }}>
                          Reimprimer
                        </button>
                      </div>
                    </div>

                    {t.message_general && (
                      <div style={{
                        fontSize: 12, color: colors.text, lineHeight: 1.6,
                        marginBottom: patients.length > 0 ? 10 : 0,
                        padding: "8px 10px", backgroundColor: colors.bgCard,
                        borderRadius: 6, borderLeft: "3px solid #10B981",
                      }}>
                        {t.message_general}
                      </div>
                    )}

                    {patients.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {patients.map((p, i) => (
                          <div key={i} style={{
                            fontSize: 12, color: colors.text,
                            padding: "6px 10px", backgroundColor: colors.bgCard,
                            borderRadius: 6, borderLeft: "3px solid #F59E0B",
                          }}>
                            <strong>{p.nom}</strong>
                            {p.lit && <span style={{ color: colors.textMuted }}> · {p.lit}</span>}
                            {p.service && <span style={{ color: colors.textMuted }}> · {p.service}</span>}
                            {p.message && <div style={{ marginTop: 3, color: "#78350F" }}>{p.message}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </Layout>
  );
}
