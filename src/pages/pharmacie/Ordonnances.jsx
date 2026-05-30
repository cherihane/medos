import { useState } from "react";
import Layout from "../../components/Layout";
import { useOrdonnances } from "../../hooks/useSupabaseData";

const statusStyle = {
  traitee:    { bg: "#DCFCE7", color: "#16A34A",  label: "Traitée" },
  en_attente: { bg: "#DBEAFE", color: "#2563EB",  label: "En attente" },
  validee:    { bg: "#EDE9FE", color: "#7C3AED",  label: "Validée" },
  refusee:    { bg: "#FEF2F2", color: "#EF4444",  label: "Refusée" },
  expiree:    { bg: "#F3F4F6", color: "#6B7280",  label: "Expirée" },
};

function fmt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

function SkeletonRow() {
  return (
    <tr style={{ borderBottom: "1px solid #F3F4F6", animation: "pulse 1.5s ease-in-out infinite" }}>
      {[100, 140, 120, 80, 70].map((w, i) => (
        <td key={i} style={{ padding: "13px 16px" }}>
          <div style={{ height: 13, width: w, backgroundColor: "#F3F4F6", borderRadius: 6 }} />
        </td>
      ))}
    </tr>
  );
}

export default function Ordonnances() {
  const { data: ordonnances, loading, error } = useOrdonnances();
  const [selected, setSelected] = useState(null);

  return (
    <Layout title="Ordonnances" subtitle="Traitement et validation des prescriptions médicales">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20 }}>
        {/* ── Liste ── */}
        <div style={{ backgroundColor: "white", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0A1628" }}>
              Ordonnances ({loading ? "…" : ordonnances.length})
            </h3>
            <button style={{ padding: "7px 14px", backgroundColor: "#3B82F6", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              + Nouvelle
            </button>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: "#F8FAFC" }}>
                {["Référence", "Patient", "Médecin", "Date", "Statut"].map((h) => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6B7280", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && [1,2,3,4,5].map((i) => <SkeletonRow key={i} />)}

              {error && !loading && (
                <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "#DC2626", fontSize: 13 }}>
                  Erreur : {error.message}
                </td></tr>
              )}

              {!loading && !error && ordonnances.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
                  Aucune ordonnance enregistrée
                </td></tr>
              )}

              {!loading && ordonnances.map((o) => {
                const s = statusStyle[o.statut] ?? statusStyle.en_attente;
                const patientNom = o.patients ? `${o.patients.prenom} ${o.patients.nom}` : "—";
                return (
                  <tr key={o.id} onClick={() => setSelected(o)}
                    style={{ borderBottom: "1px solid #F3F4F6", cursor: "pointer", backgroundColor: selected?.id === o.id ? "#EFF6FF" : "white" }}>
                    <td style={{ padding: "13px 16px", fontWeight: 600, color: "#3B82F6", fontSize: 12, fontFamily: "monospace" }}>{o.reference ?? o.id.slice(0,8).toUpperCase()}</td>
                    <td style={{ padding: "13px 16px", fontWeight: 600, color: "#0A1628" }}>{patientNom}</td>
                    <td style={{ padding: "13px 16px", color: "#6B7280" }}>{o.medecin_nom ?? "—"}</td>
                    <td style={{ padding: "13px 16px", color: "#6B7280", fontSize: 12 }}>{fmt(o.date_emission)}</td>
                    <td style={{ padding: "13px 16px" }}>
                      <span style={{ padding: "3px 10px", backgroundColor: s.bg, color: s.color, borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{s.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Détail ── */}
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          {!selected ? (
            <div style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, paddingTop: 60 }}>
              <div style={{ width: 48, height: 48, backgroundColor: "#F0F4FB", borderRadius: 12, margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              Sélectionnez une ordonnance
            </div>
          ) : (() => {
            const s = statusStyle[selected.statut] ?? statusStyle.en_attente;
            const patNom = selected.patients ? `${selected.patients.prenom} ${selected.patients.nom}` : "—";
            return (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                  <div>
                    <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 800, color: "#0A1628", fontFamily: "monospace" }}>
                      {selected.reference ?? selected.id.slice(0,8).toUpperCase()}
                    </h3>
                    <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 10, fontWeight: 700, backgroundColor: s.bg, color: s.color }}>{s.label}</span>
                  </div>
                  <span style={{ fontSize: 12, color: "#9CA3AF" }}>{fmt(selected.date_emission)}</span>
                </div>

                {[
                  { label: "Patient",       value: patNom },
                  { label: "Prescripteur",  value: selected.medecin_nom ?? "—" },
                  { label: "Émission",      value: fmt(selected.date_emission) },
                  { label: "Expiration",    value: fmt(selected.date_expiration) },
                ].map((f) => (
                  <div key={f.label} style={{ padding: "12px 14px", backgroundColor: "#F8FAFC", borderRadius: 10, marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 3 }}>{f.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0A1628" }}>{f.value}</div>
                  </div>
                ))}

                {selected.notes && (
                  <div style={{ padding: "12px 14px", backgroundColor: "#FFFBEB", borderRadius: 10, marginBottom: 16, fontSize: 13, color: "#92400E" }}>
                    {selected.notes}
                  </div>
                )}

                {selected.statut === "en_attente" && (
                  <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                    <button style={{ flex: 1, padding: "10px", backgroundColor: "#10B981", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                      Valider
                    </button>
                    <button style={{ flex: 1, padding: "10px", backgroundColor: "#FEF2F2", color: "#EF4444", border: "1px solid #FCA5A5", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                      Refuser
                    </button>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>
    </Layout>
  );
}
