import { useState } from "react";
import { colors } from "../theme";
import { useAuth } from "../context/AuthContext";
import { useAccesElargi } from "../context/AccesElargiContext";
import { useToast } from "../hooks/useToast";
import Toast from "./Toast";
import { ROLES_SECOURS_HOPITAL } from "../constants/hopital";

const STATUT_CONFIG = {
  en_attente:   { label: "En attente",           color: "#F59E0B", bg: "#FFFBEB" },
  approuve:     { label: "Approuvé",             color: "#10B981", bg: "#F0FDF4" },
  refuse:       { label: "Refusé",               color: "#DC2626", bg: "#FEF2F2" },
  auto_accorde: { label: "Auto-accordé",         color: "#7C3AED", bg: "#F5F3FF" },
  expire:       { label: "Expiré",               color: "#6B7280", bg: "#F3F4F6" },
};

function fmtHeure(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const inputSt = {
  width: "100%", padding: "9px 11px", border: `1.5px solid ${colors.border}`,
  borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box",
  color: colors.navy, backgroundColor: colors.bgCard,
};

export default function WidgetAccesElargi() {
  const { auth } = useAuth();
  const {
    demandeActive, demandes, mesRolesSecours, delaiMinutes, estDirection,
    demander, approuver, refuser, marquerRevue,
  } = useAccesElargi();
  const { toasts, success, error: showError } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [roleDemande, setRoleDemande] = useState("");
  const [motif, setMotif] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (auth?.role !== "hopital") return null;

  const optionsRole = mesRolesSecours?.length > 0 ? mesRolesSecours : ROLES_SECOURS_HOPITAL;
  const enAttente = demandes.filter((d) => d.statut === "en_attente");
  const aRevoir = demandes.filter((d) => d.revue_requise && !d.revue_faite);

  async function envoyerDemande() {
    setSubmitting(true);
    try {
      await demander(roleDemande, motif);
      success("Demande envoyée — Direction notifiée.");
      setRoleDemande(""); setMotif("");
    } catch (e) { showError(e.message); }
    setSubmitting(false);
  }

  async function handleApprouver(id) {
    try { await approuver(id); success("Accès approuvé."); }
    catch (e) { showError(e.message); }
  }
  async function handleRefuser(id) {
    try { await refuser(id); success("Demande refusée."); }
    catch (e) { showError(e.message); }
  }
  async function handleRevue(id) {
    try { await marquerRevue(id); success("Revue enregistrée."); }
    catch (e) { showError(e.message); }
  }

  return (
    <>
      <Toast toasts={toasts} />

      {/* Bandeau permanent — jamais masquable tant que l'accès est actif */}
      {demandeActive && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 3000,
          background: "#7C3AED", color: "white", textAlign: "center",
          padding: "8px 16px", fontSize: 13, fontWeight: 700,
        }}>
          Accès élargi actif ({demandeActive.role_demande}) jusqu'à {fmtHeure(demandeActive.accorde_jusqu_a)} — motif : {demandeActive.motif}
        </div>
      )}

      {/* Bouton flottant, toujours accessible */}
      <button
        onClick={() => setShowModal(true)}
        style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 2500,
          padding: "10px 16px", borderRadius: 999, border: "none",
          background: "#111827", color: "white", fontSize: 12, fontWeight: 700,
          cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
        }}
      >
        Demander un accès élargi{estDirection && enAttente.length > 0 ? ` (${enAttente.length} en attente)` : ""}
      </button>

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 3001, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: colors.bgCard, borderRadius: 16, width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto", padding: "22px 26px", boxShadow: "0 20px 60px rgba(0,0,0,0.22)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.navy }}>Accès élargi</h3>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted }}>×</button>
            </div>

            {/* Formulaire de demande — accessible à tout le monde */}
            <div style={{ marginBottom: 22, paddingBottom: 18, borderBottom: `1px solid ${colors.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy, marginBottom: 10 }}>Demander un accès élargi</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Rôle souhaité *</label>
                  <select value={roleDemande} onChange={(e) => setRoleDemande(e.target.value)} style={inputSt}>
                    <option value="">— Sélectionner —</option>
                    {optionsRole.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {mesRolesSecours?.length > 0 && (
                    <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>Rôles de secours pré-assignés par Direction.</div>
                  )}
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Motif *</label>
                  <textarea value={motif} onChange={(e) => setMotif(e.target.value)} rows={2} style={{ ...inputSt, resize: "vertical" }}
                    placeholder="Ex: Seul médecin de garde absent, urgence patient en salle 3" />
                </div>
                <div style={{ fontSize: 11, color: colors.textMuted }}>
                  Si Direction ne répond pas sous {delaiMinutes} minutes, l'accès sera accordé automatiquement pour une durée limitée, avec revue obligatoire de Direction.
                </div>
                <button onClick={envoyerDemande} disabled={submitting || !roleDemande || !motif.trim()}
                  style={{ padding: 11, background: (!roleDemande || !motif.trim()) ? colors.border : "#111827", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: (!roleDemande || !motif.trim()) ? "default" : "pointer" }}>
                  {submitting ? "Envoi…" : "Envoyer la demande"}
                </button>
              </div>
            </div>

            {/* Section Direction — approbation + revue obligatoire */}
            {estDirection && (
              <div style={{ marginBottom: 22, paddingBottom: 18, borderBottom: `1px solid ${colors.border}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy, marginBottom: 10 }}>Demandes en attente ({enAttente.length})</div>
                {enAttente.length === 0 ? (
                  <div style={{ fontSize: 12, color: colors.textMuted }}>Aucune demande en attente.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {enAttente.map((d) => (
                      <div key={d.id} style={{ border: `1.5px solid ${colors.border}`, borderRadius: 9, padding: "10px 12px" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: colors.navy }}>{d.demandeur_email} → {d.role_demande}</div>
                        <div style={{ fontSize: 12, color: colors.textSecondary, margin: "4px 0" }}>{d.motif}</div>
                        <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 8 }}>Demandé le {fmtHeure(d.created_at)}</div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => handleApprouver(d.id)} style={{ padding: "6px 12px", background: "#10B981", color: "white", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Approuver</button>
                          <button onClick={() => handleRefuser(d.id)} style={{ padding: "6px 12px", background: "#FEE2E2", color: "#DC2626", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Refuser</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {aRevoir.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#DC2626", marginBottom: 10 }}>Revue obligatoire — accès auto-accordés ({aRevoir.length})</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {aRevoir.map((d) => (
                        <div key={d.id} style={{ border: "1.5px solid #FCA5A5", background: "#FEF2F2", borderRadius: 9, padding: "10px 12px" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: colors.navy }}>{d.demandeur_email} → {d.role_demande}</div>
                          <div style={{ fontSize: 12, color: colors.textSecondary, margin: "4px 0" }}>{d.motif}</div>
                          <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 8 }}>
                            Auto-accordé jusqu'à {fmtHeure(d.accorde_jusqu_a)} — revue à faire avant le {fmtHeure(d.date_limite_revue)}
                          </div>
                          <button onClick={() => handleRevue(d.id)} style={{ padding: "6px 12px", background: "#111827", color: "white", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                            Marquer la revue comme faite
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Historique */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy, marginBottom: 10 }}>
                {estDirection ? "Historique de l'établissement" : "Mes demandes"}
              </div>
              {(estDirection ? demandes : demandes.filter((d) => d.demandeur_email === auth?.user?.email)).length === 0 ? (
                <div style={{ fontSize: 12, color: colors.textMuted }}>Aucune demande pour le moment.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
                  {(estDirection ? demandes : demandes.filter((d) => d.demandeur_email === auth?.user?.email)).map((d) => {
                    const cfg = STATUT_CONFIG[d.statut] ?? { label: d.statut, color: "#6B7280", bg: "#F3F4F6" };
                    return (
                      <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", borderRadius: 7, background: colors.bgSurface, fontSize: 12 }}>
                        <span>{estDirection ? `${d.demandeur_email} — ` : ""}{d.role_demande} <span style={{ color: colors.textMuted }}>({fmtHeure(d.created_at)})</span></span>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
