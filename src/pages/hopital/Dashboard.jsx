import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import Layout from "../../components/Layout";
import KpiCard from "../../components/KpiCard";
import { kpiHospital, salesData } from "../../data/staticData";

export default function DashboardHopital() {
  return (
    <Layout title="Dashboard Hôpital" subtitle="Vue d'ensemble — Hôpital Central Abidjan">
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {kpiHospital.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Alertes actives</h3>
          {[
            { text: "Chambre froide B : 7.2°C — Seuil dépassé", level: "critique" },
            { text: "Salbutamol : rupture imminente (2 unités)", level: "critique" },
            { text: "3 ordonnances non validées depuis + 24h", level: "alerte" },
            { text: "Service urgences : capacité à 94%", level: "alerte" },
            { text: "Mise à jour formulaire disponible", level: "info" },
          ].map((a, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 10, marginBottom: 8,
              backgroundColor: a.level === "critique" ? "#FEF2F2" : a.level === "alerte" ? "#FFFBEB" : "#EFF6FF",
              borderLeft: `4px solid ${a.level === "critique" ? "#EF4444" : a.level === "alerte" ? "#F59E0B" : "#3B82F6"}`,
            }}>
              <span style={{ fontSize: 13, color: "#374151" }}>{a.text}</span>
            </div>
          ))}
        </div>

        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Occupation des services</h3>
          {[
            { service: "Urgences", pct: 94 },
            { service: "Médecine interne", pct: 76 },
            { service: "Pédiatrie", pct: 58 },
            { service: "Chirurgie", pct: 82 },
            { service: "Maternité", pct: 67 },
          ].map((s) => (
            <div key={s.service} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                <span style={{ color: "#374151", fontWeight: 500 }}>{s.service}</span>
                <span style={{ fontWeight: 700, color: s.pct > 90 ? "#EF4444" : "#374151" }}>{s.pct}%</span>
              </div>
              <div style={{ height: 7, backgroundColor: "#E5E7EB", borderRadius: 4 }}>
                <div style={{ height: "100%", width: `${s.pct}%`, backgroundColor: s.pct > 90 ? "#EF4444" : s.pct > 75 ? "#F59E0B" : "#10B981", borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginTop: 20, minWidth: 0 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Dispensation médicaments — 7 jours</h3>
        <div style={{ width: "100%", height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={salesData}>
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="ordonnances" stroke="#10B981" strokeWidth={2.5} dot={{ r: 4, fill: "#10B981" }} name="Dispensations" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Layout>
  );
}
