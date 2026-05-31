import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import Layout from "../../components/Layout";
import PredictionsIA from "../../components/PredictionsIA";

const forecastData = [
  { mois: "Jan", reel: 22400000, prevision: 23000000 },
  { mois: "Fév", prevision: 25000000 },
  { mois: "Mar", prevision: 28000000 },
  { mois: "Avr", prevision: 26500000 },
  { mois: "Mai", prevision: 31000000 },
  { mois: "Jun", prevision: 29000000 },
];

const prodData = [
  { name: "Paracétamol", actuel: 12450, prevu: 15000 },
  { name: "Amoxicilline", actuel: 8200, prevu: 10000 },
  { name: "Ibuprofène", actuel: 6800, prevu: 7500 },
  { name: "Vitamine C", actuel: 18000, prevu: 20000 },
  { name: "Metformine", actuel: 4200, prevu: 6000 },
];

export default function Previsions() {
  return (
    <Layout title="Prévisions" subtitle="Anticipation de la demande et planification des approvisionnements">
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {[
          { label: "CA prévu (Fév)", value: "25M FCFA", color: "#F59E0B" },
          { label: "Croissance estimée", value: "+11.6%", color: "#10B981" },
          { label: "Commandes prévisionnelles", value: "184", color: "#3B82F6" },
          { label: "Couverture stock", value: "18 jours", color: "#8B5CF6" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: "white", borderRadius: 14, padding: "18px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 20, minWidth: 0 }}>
        <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Prévisions CA — 6 prochains mois (FCFA)</h3>
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={forecastData}>
              <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
              <Tooltip formatter={(v) => `${(v / 1000000).toFixed(1)}M FCFA`} />
              <Line type="monotone" dataKey="reel" stroke="#F59E0B" strokeWidth={2.5} dot={{ r: 5, fill: "#F59E0B" }} name="Réel" />
              <Line type="monotone" dataKey="prevision" stroke="#D97706" strokeWidth={2} strokeDasharray="7 4" dot={{ r: 4 }} name="Prévision IA" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <PredictionsIA />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", minWidth: 0 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Volume prévu vs actuel (unités)</h3>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={prodData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="actuel" fill="#F59E0B" radius={[0, 4, 4, 0]} name="Actuel" />
                <Bar dataKey="prevu" fill="#FDE68A" radius={[0, 4, 4, 0]} name="Prévu" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Actions recommandées</h3>
          {[
            { action: "Commander Paracétamol 1g", motif: "Demande prévue +24% en février", urgence: "haute" },
            { action: "Réduire stock Ibuprofène", motif: "Surstock prévu de 18%", urgence: "normale" },
            { action: "Anticiper rupture Metformine", motif: "Demande +42% sur 3 mois", urgence: "haute" },
            { action: "Renégocier tarifs Vitamine C", motif: "Volume x1.5 prévu sur 6 mois", urgence: "faible" },
          ].map((a, i) => (
            <div key={i} style={{ padding: "12px 14px", backgroundColor: a.urgence === "haute" ? "#FEF2F2" : a.urgence === "normale" ? "#FFFBEB" : "#F0F9FF", borderRadius: 10, marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#0A1628", marginBottom: 3 }}>{a.action}</div>
              <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 8 }}>{a.motif}</div>
              <button style={{ padding: "4px 12px", backgroundColor: "#F59E0B", color: "white", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                Agir
              </button>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
