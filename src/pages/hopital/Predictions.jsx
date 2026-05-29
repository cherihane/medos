import Layout from "../../components/Layout";
import { aiPredictions } from "../../data/staticData";

const riskColor = { critique: "#EF4444", élevé: "#F59E0B", faible: "#10B981" };

const aiInsights = [
  { titre: "Tendance grippe saisonnière", desc: "Hausse de 34% des cas attendue dans les 2 prochaines semaines. Augmenter les stocks d'antiviraux.", impact: "élevé" },
  { titre: "Pic diabète — fin de mois", desc: "Pattern récurrent de +18% de consultations diabète en fin de mois. Préparer Metformine et insuline.", impact: "modéré" },
  { titre: "Rotation stock antibiotiques", desc: "L'Amoxicilline arrivera à expiration avant écoulement. Recommander redistribution au réseau.", impact: "faible" },
];

export default function Predictions() {
  return (
    <Layout title="Prédictions IA" subtitle="Anticipation de la demande médicamenteuse par intelligence artificielle">
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Prédictions actives", value: "12", color: "#10B981" },
          { label: "Précision modèle", value: "94.2%", color: "#3B82F6" },
          { label: "Alertes préventives", value: "4", color: "#F59E0B" },
          { label: "Données analysées", value: "180j", color: "#8B5CF6" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: "white", borderRadius: 14, padding: "18px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>
            Prévisions de demande — 7 jours
          </h3>
          {aiPredictions.map((p) => (
            <div key={p.medicament} style={{ padding: "14px", borderRadius: 10, backgroundColor: "#F8FAFC", border: `1px solid ${riskColor[p.risque]}22`, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: "#0A1628" }}>{p.medicament}</span>
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, backgroundColor: riskColor[p.risque] + "20", color: riskColor[p.risque], fontWeight: 700 }}>
                  {p.risque.toUpperCase()}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 6 }}>
                Demande prévue : <strong>{p.demandePrevue}</strong> unités · Stock actuel : <strong style={{ color: p.stock < 20 ? "#EF4444" : "#374151" }}>{p.stock}</strong>
              </div>
              <div style={{ height: 6, backgroundColor: "#E5E7EB", borderRadius: 4, marginBottom: 6 }}>
                <div style={{ height: "100%", width: `${Math.min(100, Math.round((p.stock / p.demandePrevue) * 100))}%`, backgroundColor: riskColor[p.risque], borderRadius: 4 }} />
              </div>
              <div style={{ fontSize: 12, color: "#3B82F6", fontWeight: 600 }}>Recommandation : {p.recommendation}</div>
            </div>
          ))}
        </div>

        <div>
          <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Insights IA</h3>
            {aiInsights.map((ins) => (
              <div key={ins.titre} style={{ padding: "14px", backgroundColor: "#F8FAFC", borderRadius: 10, marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#0A1628" }}>{ins.titre}</span>
                  <span style={{
                    fontSize: 10, padding: "2px 8px", borderRadius: 10, fontWeight: 700,
                    backgroundColor: ins.impact === "élevé" ? "#FEF2F2" : ins.impact === "modéré" ? "#FFFBEB" : "#DCFCE7",
                    color: ins.impact === "élevé" ? "#EF4444" : ins.impact === "modéré" ? "#D97706" : "#16A34A",
                  }}>
                    {ins.impact}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6 }}>{ins.desc}</div>
              </div>
            ))}
          </div>

          <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Commandes suggérées</h3>
            {aiPredictions.filter(p => p.risque !== "faible").map((p) => (
              <div key={p.medicament} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #F3F4F6" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0A1628" }}>{p.medicament}</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF" }}>{p.recommendation}</div>
                </div>
                <button style={{ padding: "6px 14px", backgroundColor: "#10B981", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  Commander
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
