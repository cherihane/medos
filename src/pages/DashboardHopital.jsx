import Layout from "../components/Layout";
import KpiCard from "../components/KpiCard";
import { kpiHospital, aiPredictions } from "../data/staticData";

const riskColor = { critique: "#EF4444", élevé: "#F59E0B", faible: "#10B981" };

export default function DashboardHopital() {
  return (
    <Layout title="Dashboard Hôpital">
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {kpiHospital.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* AI Predictions */}
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <span style={{ fontSize: 20 }}>🤖</span>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Prédictions IA — 7 prochains jours</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {aiPredictions.map((p) => (
              <div key={p.medicament} style={{ padding: "14px", borderRadius: 10, backgroundColor: "#F8FAFC", border: `1px solid ${riskColor[p.risque]}30` }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#0A1628" }}>{p.medicament}</span>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, backgroundColor: riskColor[p.risque] + "20", color: riskColor[p.risque], fontWeight: 700 }}>
                    {p.risque.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>
                  Demande prévue : <strong>{p.demandePrevue}</strong> | Stock actuel : <strong style={{ color: p.stock < 20 ? "#EF4444" : "#374151" }}>{p.stock}</strong>
                </div>
                <div style={{ fontSize: 12, color: "#3B82F6", fontWeight: 600 }}>→ {p.recommendation}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>🚨 Alertes actives</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { icon: "🌡️", text: "Chambre froide B : 7.2°C — Seuil dépassé", level: "critique" },
              { icon: "💊", text: "Salbutamol : rupture imminente (2 unités)", level: "critique" },
              { icon: "📋", text: "3 ordonnances non validées > 24h", level: "alerte" },
              { icon: "🏥", text: "Service urgences : capacité à 94%", level: "alerte" },
              { icon: "🔄", text: "Mise à jour formulaire disponible", level: "info" },
            ].map((a, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10,
                backgroundColor: a.level === "critique" ? "#FEF2F2" : a.level === "alerte" ? "#FFFBEB" : "#EFF6FF",
                borderLeft: `4px solid ${a.level === "critique" ? "#EF4444" : a.level === "alerte" ? "#F59E0B" : "#3B82F6"}`
              }}>
                <span style={{ fontSize: 18 }}>{a.icon}</span>
                <span style={{ fontSize: 13, color: "#374151" }}>{a.text}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20, padding: "16px", backgroundColor: "#F0F4FB", borderRadius: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0A1628", marginBottom: 10 }}>Occupation des services</div>
            {[
              { service: "Urgences", pct: 94 },
              { service: "Médecine interne", pct: 76 },
              { service: "Pédiatrie", pct: 58 },
              { service: "Chirurgie", pct: 82 },
            ].map((s) => (
              <div key={s.service} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: "#6B7280" }}>{s.service}</span>
                  <span style={{ fontWeight: 700, color: s.pct > 90 ? "#EF4444" : "#374151" }}>{s.pct}%</span>
                </div>
                <div style={{ height: 6, backgroundColor: "#E5E7EB", borderRadius: 4 }}>
                  <div style={{ height: "100%", width: `${s.pct}%`, backgroundColor: s.pct > 90 ? "#EF4444" : s.pct > 75 ? "#F59E0B" : "#10B981", borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
