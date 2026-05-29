import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import Layout from "../components/Layout";
import KpiCard from "../components/KpiCard";
import { kpiPharmacy, salesData, criticalStock } from "../data/staticData";

export default function DashboardPharmacie() {
  return (
    <Layout title="Dashboard Pharmacie">
      {/* KPIs */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {kpiPharmacy.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        {/* Sales Chart */}
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", minWidth: 0 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Ventes & Ordonnances (7 derniers jours)</h3>
          <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={salesData}>
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v, n) => n === "ventes" ? `${v.toLocaleString()} FCFA` : v} />
              <Bar dataKey="ventes" fill="#3B82F6" radius={[6, 6, 0, 0]} name="ventes" />
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>

        {/* Critical Stock */}
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>⚠️ Stock Critique</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {criticalStock.map((item) => (
              <div key={item.name}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{item.name}</span>
                  <span style={{ fontSize: 12, color: "#EF4444", fontWeight: 700 }}>{item.stock}/{item.min}</span>
                </div>
                <div style={{ height: 6, backgroundColor: "#FEE2E2", borderRadius: 4 }}>
                  <div style={{ height: "100%", width: `${Math.round((item.stock / item.min) * 100)}%`, backgroundColor: "#EF4444", borderRadius: 4 }} />
                </div>
                <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>{item.fournisseur}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ordonnances Line */}
      <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginTop: 20 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Tendance ordonnances</h3>
        <div style={{ width: "100%", height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={salesData}>
            <XAxis dataKey="day" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line type="monotone" dataKey="ordonnances" stroke="#10B981" strokeWidth={2.5} dot={{ fill: "#10B981", r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
        </div>
      </div>
    </Layout>
  );
}
