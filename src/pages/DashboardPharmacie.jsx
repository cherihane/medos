import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import Layout from "../components/Layout";
import KpiCard from "../components/KpiCard";
import { useKpiPharmacie, useMedicamentsCritiques, useVentes7Jours } from "../hooks/useSupabaseData";

export default function DashboardPharmacie() {
  const { data: kpi, loading: loadKpi }      = useKpiPharmacie();
  const { data: critiques, loading: loadCrit } = useMedicamentsCritiques(5);
  const { data: salesData, loading: loadSales } = useVentes7Jours();

  const kpiCards = [
    {
      label: "Ventes du jour",
      value: loadKpi ? "…" : `${Math.round(kpi?.ventesJour ?? 0).toLocaleString("fr-FR")} FCFA`,
      color: "#10B981",
    },
    {
      label: "Ordonnances en attente",
      value: loadKpi ? "…" : kpi?.ordonnancesEnAttente ?? 0,
      color: "#3B82F6",
    },
    {
      label: "Produits en rupture",
      value: loadKpi ? "…" : kpi?.ruptures ?? 0,
      color: "#EF4444",
    },
    {
      label: "Patients enregistrés",
      value: loadKpi ? "…" : kpi?.totalPatients ?? 0,
      color: "#8B5CF6",
    },
  ];

  return (
    <Layout title="Dashboard Pharmacie">
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {kpiCards.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        {/* Graphique ventes 7 jours */}
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", minWidth: 0 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>
            Ventes et ordonnances — 7 derniers jours
          </h3>
          {loadSales ? (
            <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", fontSize: 13 }}>
              Chargement…
            </div>
          ) : salesData.every((d) => d.ventes === 0) ? (
            <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", fontSize: 13 }}>
              Aucune vente enregistrée sur les 7 derniers jours.
            </div>
          ) : (
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesData}>
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                  <Tooltip formatter={(v, n) => n === "ventes" ? `${v.toLocaleString("fr-FR")} FCFA` : v} />
                  <Bar dataKey="ventes" fill="#3B82F6" radius={[6, 6, 0, 0]} name="ventes" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Stock critique */}
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Stock critique</h3>
          {loadCrit ? (
            <div style={{ color: "#9CA3AF", fontSize: 13 }}>Chargement…</div>
          ) : critiques.length === 0 ? (
            <div style={{ color: "#10B981", fontSize: 13, fontWeight: 600 }}>Aucun stock en situation critique.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {critiques.map((item) => {
                const pct = item.stock_minimum > 0
                  ? Math.min(100, Math.round((item.stock_actuel / item.stock_minimum) * 100))
                  : 0;
                return (
                  <div key={item.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{item.nom}</span>
                      <span style={{ fontSize: 12, color: "#EF4444", fontWeight: 700 }}>
                        {item.stock_actuel}/{item.stock_minimum}
                      </span>
                    </div>
                    <div style={{ height: 6, backgroundColor: "#FEE2E2", borderRadius: 4 }}>
                      <div style={{ height: "100%", width: `${pct}%`, backgroundColor: "#EF4444", borderRadius: 4 }} />
                    </div>
                    <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>
                      {item.forme ?? item.categorie ?? "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Tendance ordonnances */}
      <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginTop: 20 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Tendance ordonnances</h3>
        {loadSales ? (
          <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", fontSize: 13 }}>
            Chargement…
          </div>
        ) : (
          <div style={{ width: "100%", height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesData}>
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="ordonnances"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  dot={{ fill: "#10B981", r: 4 }}
                  name="Ordonnances"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Layout>
  );
}
