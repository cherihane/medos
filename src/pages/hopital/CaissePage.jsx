import { colors } from "../../theme";
import { useState, useEffect, useCallback } from "react";
import Layout from "../../components/Layout";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../supabaseClient";
import {
  fetchFacturesEnAttente, fetchJournalCaisse, updateFacture,
} from "../../hooks/useMutations";
import { openDocument, tableHTML, signatureRowHTML, fetchEtabFromAuth } from "../../utils/MedOSDocument";

const ACCENT = "#10B981";

const MODES_PAIEMENT = [
  "Especes",
  "MTN MoMo",
  "Airtel Money",
  "Orange Money",
  "Cheque",
  "Assurance",
];

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

function fmtHeure(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function fmtKFCFA(n) {
  if (!n) return "0 FCFA";
  return `${Number(n).toLocaleString("fr-FR")} FCFA`;
}

// ── Modal encaisser ────────────────────────────────────────────────────────────
function ModalEncaisser({ facture, patient, auth, onClose, onSaved }) {
  const [montant, setMontant] = useState(facture.reste_patient ?? facture.sous_total ?? 0);
  const [mode, setMode] = useState("Especes");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateFacture(facture.id, {
        statut: "payee",
        mode_paiement: mode,
        date_paiement: new Date().toISOString(),
      });

      // Impression du recu automatique
      const etab = await fetchEtabFromAuth(auth);
      openDocument({
        titre: "Recu de paiement",
        sousTitre: `Facture ${facture.numero_facture} — ${new Date().toLocaleDateString("fr-FR")}`,
        etablissement: etab,
        sections: [
          {
            titre: "Detail du paiement",
            html: tableHTML(
              ["Champ", "Valeur"],
              [
                ["Patient",         patient ? `${patient.prenom} ${patient.nom}` : "—"],
                ["Facture",         facture.numero_facture],
                ["Montant recu",    fmtKFCFA(montant)],
                ["Mode de paiement", mode],
                ["Date",            new Date().toLocaleDateString("fr-FR")],
                ["Heure",           new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })],
              ]
            ),
          },
          { titre: "", html: signatureRowHTML(["Caissier", "Cachet de l'etablissement"]) },
        ],
      });

      onSaved();
      onClose();
    } catch (e) {
      alert("Erreur : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const inputSt = { width: "100%", padding: "9px 11px", border: "1.5px solid #E5E7EB", borderRadius: 9, fontSize: 13, outline: "none", boxSizing: "border-box", background: "white", color: "#0A1628" };
  const labelSt = { display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginBottom: 5 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 440, padding: "26px 28px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0A1628" }}>Encaisser le paiement</div>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
              {patient ? `${patient.prenom} ${patient.nom}` : "—"} — {facture.numero_facture}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#9CA3AF" }}>x</button>
        </div>

        <div style={{ background: "#F0FDF4", borderRadius: 10, padding: "12px 16px", marginBottom: 20, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: "#374151" }}>Reste a payer</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: ACCENT }}>{fmtKFCFA(facture.reste_patient ?? facture.sous_total)}</span>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelSt}>Montant recu (FCFA)</label>
          <input style={inputSt} type="number" min="0" value={montant} onChange={(e) => setMontant(e.target.value)} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelSt}>Mode de paiement</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {MODES_PAIEMENT.map((m) => (
              <button key={m} onClick={() => setMode(m)}
                style={{ padding: "7px 4px", borderRadius: 8, border: `1.5px solid ${mode === m ? ACCENT : "#E5E7EB"}`,
                  backgroundColor: mode === m ? "#F0FDF4" : "white",
                  color: mode === m ? ACCENT : "#374151",
                  fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                {m}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 11, background: "#F8FAFC", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 2, padding: 11, background: saving ? "#D1D5DB" : ACCENT, color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "Enregistrement..." : "Encaisser + Imprimer le recu"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function CaissePage() {
  const { auth } = useAuth();
  const { toasts, success } = useToast();
  const [factures, setFactures] = useState([]);
  const [journal, setJournal] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalEncaisser, setModalEncaisser] = useState(null);
  const [etabId, setEtabId] = useState(auth?.etablissement_id ?? null);

  const todayISO = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    setLoading(true);
    let eid = auth?.etablissement_id;
    if (!eid && auth?.user?.email) {
      const { data } = await supabase.from("etablissements").select("id").eq("email", auth.user.email).maybeSingle();
      eid = data?.id ?? null;
    }
    if (eid) setEtabId(eid);
    const [f, j] = await Promise.all([
      fetchFacturesEnAttente(eid),
      fetchJournalCaisse(eid, todayISO),
    ]);
    setFactures(f);
    setJournal(j);
    setLoading(false);
  }, [auth, todayISO]);

  useEffect(() => { load(); }, [load]);

  const totalEncaisseJour  = journal.reduce((s, f) => s + (f.reste_patient ?? 0), 0);
  const montantEnAttente   = factures.reduce((s, f) => s + (f.reste_patient ?? 0), 0);
  const montantMoyen       = journal.length > 0 ? Math.round(totalEncaisseJour / journal.length) : 0;

  const handleImprimerJournal = async () => {
    const etab = await fetchEtabFromAuth(auth);
    const rows = journal.map((f) => {
      const p = f.patients;
      return [
        fmtHeure(f.date_paiement),
        p ? `${p.prenom} ${p.nom}` : "—",
        f.numero_facture,
        fmtKFCFA(f.reste_patient),
        f.mode_paiement ?? "—",
      ];
    });
    openDocument({
      titre: "Journal de caisse",
      sousTitre: `Du ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`,
      etablissement: etab,
      sections: [
        {
          titre: `Total encaisse : ${fmtKFCFA(totalEncaisseJour)} — ${journal.length} transactions`,
          html: tableHTML(["Heure", "Patient", "Facture", "Montant", "Mode"], rows),
        },
      ],
    });
  };

  return (
    <Layout title="Caisse" subtitle="Encaissement et journal de caisse">
      <Toast toasts={toasts} />

      {modalEncaisser && (
        <ModalEncaisser
          facture={modalEncaisser}
          patient={modalEncaisser.patients}
          auth={auth}
          onClose={() => setModalEncaisser(null)}
          onSaved={() => { load(); success("Paiement enregistre"); }}
        />
      )}

      {/* KPIs */}
      <div className="kpi-row" style={{ marginBottom: 20 }}>
        {[
          { label: "Factures en attente", value: loading ? "…" : factures.length,             color: "#EF4444" },
          { label: "Montant en attente",  value: loading ? "…" : fmtKFCFA(montantEnAttente),  color: "#F59E0B" },
          { label: "Encaisse aujourd'hui",value: loading ? "…" : fmtKFCFA(totalEncaisseJour), color: ACCENT },
          { label: "Transactions aujourd'hui", value: loading ? "…" : journal.length,          color: "#3B82F6" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: colors.bgCard, padding: "14px 20px", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: k.value.length > 8 ? 16 : 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Section 1 — Factures en attente */}
      <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 20, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${colors.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: colors.navy }}>Factures en attente de paiement</h3>
          <span style={{ fontSize: 11, fontWeight: 700, backgroundColor: factures.length > 0 ? "#FEF2F2" : "#F3F4F6", color: factures.length > 0 ? "#DC2626" : "#9CA3AF", padding: "2px 10px", borderRadius: 10 }}>
            {factures.length} en attente
          </span>
        </div>
        <div className="table-scroll">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: colors.bgSurface }}>
                {["Numero", "Patient", "Date", "Montant total", "Reste a payer", "Couverture", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontSize: 11, fontWeight: 800, color: colors.textSecondary, textTransform: "uppercase", borderBottom: `1px solid ${colors.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: colors.textMuted }}>Chargement...</td></tr>}
              {!loading && factures.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: colors.textMuted }}>Aucune facture en attente</td></tr>}
              {!loading && factures.map((f) => {
                const p = f.patients;
                return (
                  <tr key={f.id} style={{ borderBottom: `1px solid ${colors.borderLight}` }}>
                    <td style={{ padding: "11px 14px", fontWeight: 700, color: "#3B82F6", fontSize: 12 }}>{f.numero_facture}</td>
                    <td style={{ padding: "11px 14px", fontWeight: 600, color: colors.navy }}>{p ? `${p.prenom} ${p.nom}` : "—"}</td>
                    <td style={{ padding: "11px 14px", color: colors.textSecondary }}>{fmtDate(f.date_facture)}</td>
                    <td style={{ padding: "11px 14px", fontWeight: 600 }}>{fmtKFCFA(f.sous_total)}</td>
                    <td style={{ padding: "11px 14px", fontWeight: 800, color: "#EF4444" }}>{fmtKFCFA(f.reste_patient)}</td>
                    <td style={{ padding: "11px 14px", color: ACCENT }}>
                      {f.taux_couverture > 0 ? `${f.taux_couverture}% ${f.type_couverture ?? ""}` : "—"}
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <button onClick={() => setModalEncaisser(f)}
                        style={{ padding: "5px 14px", background: ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        Encaisser
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2 — Journal de caisse */}
      <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${colors.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: colors.navy }}>Journal de caisse du jour</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {journal.length > 0 && (
              <span style={{ fontSize: 12, color: colors.textSecondary }}>Montant moyen : {fmtKFCFA(montantMoyen)}</span>
            )}
            <button onClick={handleImprimerJournal}
              style={{ padding: "6px 14px", background: colors.bgSurface, color: "#7C3AED", border: "1px solid #7C3AED", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Imprimer le journal
            </button>
          </div>
        </div>
        <div className="table-scroll">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: colors.bgSurface }}>
                {["Heure", "Patient", "Facture", "Montant encaisse", "Mode de paiement"].map((h) => (
                  <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontSize: 11, fontWeight: 800, color: colors.textSecondary, textTransform: "uppercase", borderBottom: `1px solid ${colors.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: colors.textMuted }}>Chargement...</td></tr>}
              {!loading && journal.length === 0 && <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: colors.textMuted }}>Aucun paiement aujourd'hui</td></tr>}
              {!loading && journal.map((f) => {
                const p = f.patients;
                return (
                  <tr key={f.id} style={{ borderBottom: `1px solid ${colors.borderLight}` }}>
                    <td style={{ padding: "10px 14px", color: colors.textSecondary, fontSize: 12 }}>{fmtHeure(f.date_paiement)}</td>
                    <td style={{ padding: "10px 14px", fontWeight: 600, color: colors.navy }}>{p ? `${p.prenom} ${p.nom}` : "—"}</td>
                    <td style={{ padding: "10px 14px", color: "#3B82F6", fontSize: 12 }}>{f.numero_facture}</td>
                    <td style={{ padding: "10px 14px", fontWeight: 700, color: ACCENT }}>{fmtKFCFA(f.reste_patient)}</td>
                    <td style={{ padding: "10px 14px", color: colors.text }}>{f.mode_paiement ?? "—"}</td>
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
