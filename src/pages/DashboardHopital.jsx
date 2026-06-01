import Layout from "../components/Layout";
import KpiCard from "../components/KpiCard";
import { useKpiHopital, useAlertes, useMedicamentsCritiques } from "../hooks/useSupabaseData";

const severiteStyle = {
  critique:    { bg: "#FEF2F2", border: "#EF4444", color: "#EF4444" },
  alerte:      { bg: "#FFFBEB", border: "#F59E0B", color: "#D97706" },
  info:        { bg: "#EFF6FF", border: "#3B82F6", color: "#2563EB" },
};

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function DashboardHopital() {
  const { data: kpi, loading: loadKpi }         = useKpiHopital();
  const { data: alertes, loading: loadAlertes }  = useAlertes(5);
  const { data: critiques, loading: loadCrit }   = useMedicamentsCritiques(4);

  const kpiCards = [
    {
      label: "Patients enregistres",
      value: loadKpi ? "…" : kpi?.patientsHospitalises ?? 0,
      color: "#10B981",
    },
    {
      label: "Consultations (ordonnances)",
      value: loadKpi ? "…" : kpi?.consultations ?? 0,
      color: "#3B82F6",
    },
    {
      label: "Stock total (unites)",
      value: loadKpi ? "…" : (kpi?.medicamentsDispenses ?? 0).toLocaleString("fr-FR"),
      color: "#8B5CF6",
    },
    {
      label: "Alertes critiques",
      value: loadKpi ? "…" : kpi?.alertesCritiques ?? 0,
      color: "#EF4444",
    },
  ];

  return (
    <Layout title="Dashboard Hopital">
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {kpiCards.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Medicaments a reapprovisionner */}
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>
            Medicaments a reapprovisionner
          </h3>
          {loadCrit ? (
            <div style={{ color: "#9CA3AF", fontSize: 13 }}>Chargement…</div>
          ) : critiques.length === 0 ? (
            <div style={{ padding: "16px", backgroundColor: "#F0FDF4", borderRadius: 10, color: "#16A34A", fontSize: 13, fontWeight: 600 }}>
              Tous les stocks sont au-dessus du seuil minimum.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {critiques.map((m) => {
                const manque = m.stock_minimum - m.stock_actuel;
                const niveau = m.stock_actuel === 0 ? "critique" : m.stock_actuel < m.stock_minimum * 0.5 ? "critique" : "alerte";
                return (
                  <div
                    key={m.id}
                    style={{
                      padding: "14px",
                      borderRadius: 10,
                      backgroundColor: niveau === "critique" ? "#FEF2F2" : "#FFFBEB",
                      border: `1px solid ${niveau === "critique" ? "#FCA5A5" : "#FCD34D"}`,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: "#0A1628" }}>{m.nom}</span>
                      <span style={{
                        fontSize: 11, padding: "2px 8px", borderRadius: 12, fontWeight: 700,
                        backgroundColor: niveau === "critique" ? "#FEE2E2" : "#FEF9C3",
                        color: niveau === "critique" ? "#EF4444" : "#A16207",
                      }}>
                        {niveau.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#6B7280" }}>
                      Stock actuel : <strong style={{ color: "#EF4444" }}>{m.stock_actuel}</strong>
                      {" / "}Minimum : <strong>{m.stock_minimum}</strong>
                      {" — "}<span style={{ color: "#3B82F6", fontWeight: 600 }}>Commander {manque} unites</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Alertes actives */}
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Alertes actives</h3>
          {loadAlertes ? (
            <div style={{ color: "#9CA3AF", fontSize: 13 }}>Chargement…</div>
          ) : alertes.length === 0 ? (
            <div style={{ padding: "16px", backgroundColor: "#F0FDF4", borderRadius: 10, color: "#16A34A", fontSize: 13, fontWeight: 600 }}>
              Aucune alerte active.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {alertes.map((a) => {
                const s = severiteStyle[a.severite] ?? severiteStyle.info;
                return (
                  <div
                    key={a.id}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 12,
                      padding: "12px 14px", borderRadius: 10,
                      backgroundColor: s.bg,
                      borderLeft: `4px solid ${s.border}`,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0A1628", marginBottom: 2 }}>
                        {a.titre}
                      </div>
                      {a.message && (
                        <div style={{ fontSize: 12, color: "#6B7280" }}>{a.message}</div>
                      )}
                      <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
                        {fmtDate(a.created_at)}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 11, padding: "2px 8px", borderRadius: 10, fontWeight: 700, flexShrink: 0,
                      backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}`,
                    }}>
                      {a.severite}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: 20, padding: "14px 16px", backgroundColor: "#F8FAFC", borderRadius: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0A1628", marginBottom: 8 }}>
              Total alertes non resolues : {loadKpi ? "…" : kpi?.totalAlertes ?? 0}
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
              <span style={{ color: "#EF4444", fontWeight: 700 }}>
                {loadKpi ? "…" : kpi?.alertesCritiques ?? 0} critiques
              </span>
              <span style={{ color: "#F59E0B", fontWeight: 700 }}>
                {loadKpi ? "…" : Math.max(0, (kpi?.totalAlertes ?? 0) - (kpi?.alertesCritiques ?? 0))} autres
              </span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
