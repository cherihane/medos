import { colors } from "../../theme";
import { useState, useEffect, useCallback } from "react";
import Layout from "../../components/Layout";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useAuth } from "../../context/AuthContext";
import { useMedicaments } from "../../hooks/useSupabaseData";
import { supabase } from "../../supabaseClient";
import { fetchOrdonnancesExpirantBientot, insertOrdonnance } from "../../hooks/useMutations";

const ACCENT = "#10B981";

function fmtDate(iso) { if (!iso) return "—"; return new Date(iso).toLocaleDateString("fr-FR"); }

function joursRestants(date_expiration) {
  if (!date_expiration) return null;
  return Math.ceil((new Date(date_expiration) - new Date()) / 86400000);
}

function BadgeExpiration({ diff }) {
  if (diff === null) return null;
  const cfg = diff < 0
    ? { label: "Expiree",             color: "#EF4444", bg: "#FEF2F2" }
    : diff === 0
    ? { label: "Expire aujourd'hui",  color: "#EF4444", bg: "#FEF2F2" }
    : diff <= 3
    ? { label: `Expire dans ${diff}j`, color: "#EF4444", bg: "#FEF2F2" }
    : { label: `Expire dans ${diff}j`, color: "#F59E0B", bg: "#FFFBEB" };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 10, backgroundColor: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

function envoyerSMSRenouvellement(patient, ordonnance) {
  const tel = patient?.telephone?.replace(/\s/g, "");
  if (!tel) return;
  const date = ordonnance.date_expiration ? new Date(ordonnance.date_expiration).toLocaleDateString("fr-FR") : "bientot";
  const corps = `Bonjour ${patient.prenom}, votre ordonnance expire le ${date}. Veuillez consulter pour un renouvellement.`;
  window.open(`sms:${tel}?body=${encodeURIComponent(corps)}`);
}

// Modal renouvellement légère (utilise insertOrdonnance directement)
function ModalRenouveler({ ordonnance, patient, etabId, medecinNom, medicaments, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [dateExp, setDateExp] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  });

  let lignesSource = [];
  try { lignesSource = JSON.parse(ordonnance.notes ?? "{}").lignes ?? []; } catch { /* */ }

  const handleSave = async () => {
    setSaving(true);
    try {
      const medecin = medecinNom ?? "";
      const ref = `ORD-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,"0")}-${Math.floor(1000+Math.random()*9000)}`;
      await insertOrdonnance({
        reference: ref,
        patient_id: patient?.id ?? ordonnance.patient_id,
        medecin_nom: medecin,
        date_emission: new Date().toISOString().slice(0, 10),
        date_expiration: dateExp || null,
        statut: "en_attente",
        notes: JSON.stringify({ lignes: lignesSource, instructions: "Renouvellement" }),
        ...(etabId ? { etablissement_id: etabId } : {}),
      });
      onSaved();
      onClose();
    } catch (e) { showError("Erreur : " + e.message); }
    finally { setSaving(false); }
  };

  const inputSt = { width: "100%", padding: "9px 12px", border: `1.5px solid ${colors.border}`, borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", color: colors.navy, backgroundColor: colors.bgCard };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: colors.bgCard, borderRadius: 16, width: "100%", maxWidth: 480, padding: "24px 28px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.navy }}>Renouveler l'ordonnance</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted }}>x</button>
        </div>

        <div style={{ backgroundColor: colors.bgSurface, borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13 }}>
          <div style={{ fontWeight: 700, color: colors.navy, marginBottom: 4 }}>{patient ? `${patient.prenom} ${patient.nom}` : "—"}</div>
          <div style={{ color: colors.textSecondary, marginBottom: 4 }}>Ordonnance : {ordonnance.reference ?? "—"} — Expirée le {fmtDate(ordonnance.date_expiration)}</div>
          {lignesSource.length > 0 && (
            <div style={{ fontSize: 12, color: colors.textSecondary }}>
              Medicaments : {lignesSource.map((l) => l.nom).filter(Boolean).join(", ") || "voir ordonnance"}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 5 }}>Nouvelle date d'expiration</label>
          <input style={{ ...inputSt, maxWidth: 200 }} type="date" value={dateExp} onChange={(e) => setDateExp(e.target.value)} />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px", background: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 9, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: "10px", background: saving ? "#D1D5DB" : ACCENT, color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "Enregistrement..." : "Renouveler"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Renouvellements() {
  const { auth } = useAuth();
  const { toasts, success, error: showError } = useToast();
  const { data: medicaments } = useMedicaments();
  const [etabId, setEtabId]                 = useState(auth?.etablissement_id ?? null);
  const [ordonnances, setOrdonnances]       = useState([]);
  const [loading, setLoading]               = useState(true);
  const [renouvellerModal, setRenouvellerModal] = useState(null);

  useEffect(() => {
    const resolve = async () => {
      let eid = auth?.etablissement_id;
      if (!eid && auth?.user?.email) {
        const { data } = await supabase.from("etablissements").select("id").eq("email", auth.user.email).maybeSingle();
        eid = data?.id ?? null;
      }
      if (!eid && auth?.user?.email) {
        const { data } = await supabase.from("membres_personnel").select("etablissement_id").eq("email", auth.user.email).eq("actif", true).maybeSingle();
        eid = data?.etablissement_id ?? null;
      }
      if (eid) setEtabId(eid);
    };
    resolve();
  }, [auth]);

  const load = useCallback(async () => {
    if (!etabId) return;
    setLoading(true);
    const data = await fetchOrdonnancesExpirantBientot(etabId, 7);
    setOrdonnances(data);
    setLoading(false);
  }, [etabId]);

  useEffect(() => { load(); }, [load]);

  const today = new Date().toISOString().slice(0, 10);
  const dans3j = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

  const expirees   = ordonnances.filter((o) => o.date_expiration < today);
  const dans3jours = ordonnances.filter((o) => o.date_expiration >= today && o.date_expiration <= dans3j);
  const dans7jours = ordonnances.filter((o) => o.date_expiration > dans3j);

  const medecinNom = auth?.user?.email ?? "";

  return (
    <Layout title="Renouvellements" subtitle="Ordonnances expirees ou expirant dans les 7 prochains jours">
      <Toast toasts={toasts} />

      {renouvellerModal && (
        <ModalRenouveler
          ordonnance={renouvellerModal.ordonnance}
          patient={renouvellerModal.patient}
          etabId={etabId}
          medecinNom={medecinNom}
          medicaments={medicaments}
          onClose={() => setRenouvellerModal(null)}
          onSaved={() => { load(); success("Ordonnance renouvelee"); }}
        />
      )}

      {/* KPIs */}
      <div className="kpi-row" style={{ marginBottom: 20 }}>
        {[
          { label: "Expirees",          value: loading ? "…" : expirees.length,    color: "#EF4444" },
          { label: "Expirent dans 3j",  value: loading ? "…" : dans3jours.length,  color: "#F59E0B" },
          { label: "Expirent dans 7j",  value: loading ? "…" : dans7jours.length,  color: "#D97706" },
          { label: "Total a renouveler",value: loading ? "…" : ordonnances.length, color: "#8B5CF6" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: colors.bgCard, padding: "16px 20px", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tableau */}
      <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div className="table-scroll">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ backgroundColor: colors.bgSurface }}>
                {["Patient","Dossier","Telephone","Ordonnance","Date expiration","Jours restants","Actions"].map((h) => (
                  <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: colors.textSecondary, borderBottom: `1px solid ${colors.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && [1,2,3].map((i) => (
                <tr key={i}>{[150,100,100,120,100,80,120].map((w,j) => <td key={j} style={{ padding: "12px 14px" }}><div style={{ height: 12, width: w, backgroundColor: colors.borderLight, borderRadius: 6 }} /></td>)}</tr>
              ))}
              {!loading && ordonnances.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: colors.textMuted }}>Aucune ordonnance a renouveler dans les 7 prochains jours.</td></tr>
              )}
              {!loading && ordonnances.map((o) => {
                const patient = o.patients ?? {};
                const diff    = joursRestants(o.date_expiration);
                return (
                  <tr key={o.id} style={{ borderBottom: `1px solid ${colors.borderLight}` }}>
                    <td style={{ padding: "11px 14px", fontWeight: 700, color: colors.navy }}>{patient.prenom} {patient.nom}</td>
                    <td style={{ padding: "11px 14px", fontFamily: "monospace", fontSize: 11, color: "#6B7280" }}>{patient.numero_dossier ?? "—"}</td>
                    <td style={{ padding: "11px 14px", color: colors.textSecondary }}>{patient.telephone ?? "—"}</td>
                    <td style={{ padding: "11px 14px", color: "#3B82F6", fontWeight: 600 }}>{o.reference ?? "—"}</td>
                    <td style={{ padding: "11px 14px" }}>{fmtDate(o.date_expiration)}</td>
                    <td style={{ padding: "11px 14px" }}><BadgeExpiration diff={diff} /></td>
                    <td style={{ padding: "11px 14px" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button
                          onClick={() => setRenouvellerModal({ ordonnance: o, patient })}
                          style={{ padding: "4px 10px", backgroundColor: "#DCFCE7", color: "#16A34A", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                          Renouveler
                        </button>
                        {patient.telephone && (
                          <button
                            onClick={() => envoyerSMSRenouvellement(patient, o)}
                            style={{ padding: "4px 10px", backgroundColor: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                            SMS rappel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
