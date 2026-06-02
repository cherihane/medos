import Layout from "../../components/Layout";
import { useMedicamentsCritiques, useMedicaments } from "../../hooks/useSupabaseData";

const riskColor = { critique: "#EF4444", alerte: "#F59E0B", normal: "#10B981" };

const aiInsights = [
  { titre: "Tendance grippe saisonnière", desc: "Hausse de 34% des cas attendue dans les 2 prochaines semaines. Augmenter les stocks d'antiviraux.", impact: "élevé" },
  { titre: "Pic diabète — fin de mois", desc: "Pattern récurrent de +18% de consultations diabète en fin de mois. Préparer Metformine et insuline.", impact: "modéré" },
  { titre: "Rotation stock antibiotiques", desc: "L'Amoxicilline arrivera à expiration avant écoulement. Recommander redistribution au réseau.", impact: "faible" },
];

function getRisque(m) {
  if (!m.stock_minimum || m.stock_minimum === 0) return "normal";
  const ratio = m.stock_actuel / m.stock_minimum;
  if (ratio <= 0.3) return "critique";
  if (ratio <= 0.6) return "alerte";
  return "normal";
}

export default function Predictions() {
  const { data: critiques, loading } = useMedicamentsCritiques(20);
  const { data: allMeds } = useMedicaments();

  // Build predictions from critiques meds
  const predictions = critiques.map((m) => ({
    medicament: m.nom,
    risque: getRisque(m),
    stock: m.stock_actuel ?? 0,
    demandePrevue: m.stock_minimum ?? 20,
    recommendation: `Commander ${Math.max(0, (m.stock_minimum ?? 0) * 3 - (m.stock_actuel ?? 0))} unités`,
  }));

  return (
    <Layout title="Prédictions IA" subtitle="Anticipation de la demande médicamenteuse par intelligence artificielle">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <div className="kpi-row">
        {[
          { label: "Produits à surveiller", value: loading ? "…" : predictions.length,                                            color: "#10B981" },
          { label: "Critiques",             value: loading ? "…" : predictions.filter(p => p.risque === "critique").length,       color: "#EF4444" },
          { label: "En alerte",             value: loading ? "…" : predictions.filter(p => p.risque === "alerte").length,         color: "#F59E0B" },
          { label: "Total médicaments",     value: loading ? "…" : allMeds.length,                                                color: "#8B5CF6" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: "white", borderRadius: 14, padding: "18px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div className="dash-grid-2">
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Produits en tension — stock critique</h3>
          {loading && [1,2,3].map((i) => (
            <div key={i} style={{ height: 80, backgroundColor: "#F8FAFC", borderRadius: 10, marginBottom: 12, animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
          {!loading && predictions.length === 0 && (
            <div style={{ color: "#9CA3AF", fontSize: 13, textAlign: "center", padding: 24 }}>Aucun produit en tension</div>
          )}
          {!loading && predictions.map((p) => {
            const col = riskColor[p.risque];
            const pct = Math.min(100, Math.round((p.stock / p.demandePrevue) * 100));
            return (
              <div key={p.medicament} style={{ padding: "14px", borderRadius: 10, backgroundColor: "#F8FAFC", border: `1px solid ${col}22`, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#0A1628" }}>{p.medicament}</span>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, backgroundColor: col + "20", color: col, fontWeight: 700 }}>{p.risque.toUpperCase()}</span>
                </div>
                <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 6 }}>
                  Stock actuel : <strong style={{ color: p.stock < 10 ? "#EF4444" : "#374151" }}>{p.stock}</strong> · Seuil : <strong>{p.demandePrevue}</strong>
                </div>
                <div style={{ height: 6, backgroundColor: "#E5E7EB", borderRadius: 4, marginBottom: 6 }}>
                  <div style={{ height: "100%", width: `${pct}%`, backgroundColor: col, borderRadius: 4 }} />
                </div>
                <div style={{ fontSize: 12, color: "#3B82F6", fontWeight: 600 }}>Recommandation : {p.recommendation}</div>
              </div>
            );
          })}
        </div>

        <div>
          <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Insights IA</h3>
            {[
              { titre: "Tendance ruptures de stock", desc: "Des médicaments essentiels sont en dessous du seuil minimum. Planifier les commandes immédiatement.", impact: "élevé" },
              { titre: "Optimisation des achats", desc: "Regrouper les commandes par fournisseur pour réduire les coûts logistiques.", impact: "modéré" },
              { titre: "Rotation des lots", desc: "Vérifier les dates d'expiration des lots en stock pour éviter les pertes.", impact: "faible" },
            ].map((ins) => (
              <div key={ins.titre} style={{ padding: "14px", backgroundColor: "#F8FAFC", borderRadius: 10, marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#0A1628" }}>{ins.titre}</span>
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, fontWeight: 700, backgroundColor: ins.impact === "élevé" ? "#FEF2F2" : ins.impact === "modéré" ? "#FFFBEB" : "#DCFCE7", color: ins.impact === "élevé" ? "#EF4444" : ins.impact === "modéré" ? "#D97706" : "#16A34A" }}>{ins.impact}</span>
                </div>
                <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6 }}>{ins.desc}</div>
              </div>
            ))}
          </div>

          <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Commandes suggérées</h3>
            {!loading && predictions.filter(p => p.risque !== "normal").map((p) => (
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
            {!loading && predictions.filter(p => p.risque !== "normal").length === 0 && (
              <div style={{ color: "#9CA3AF", fontSize: 13, textAlign: "center", padding: 16 }}>Aucune commande urgente</div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
