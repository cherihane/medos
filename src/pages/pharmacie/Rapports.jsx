import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import Layout from "../../components/Layout";
import { salesData } from "../../data/staticData";

const pieData = [
  { name: "Antibiotiques", value: 32 },
  { name: "Analgésiques", value: 28 },
  { name: "Cardio", value: 18 },
  { name: "Autres", value: 22 },
];

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6"];

const monthlyData = [
  { mois: "Août", ventes: 18500000 },
  { mois: "Sep", ventes: 21200000 },
  { mois: "Oct", ventes: 19800000 },
  { mois: "Nov", ventes: 24100000 },
  { mois: "Déc", ventes: 28700000 },
  { mois: "Jan", ventes: 22400000 },
];

export default function Rapports() {
  return (
    <Layout title="Rapports" subtitle="Analyses et indicateurs de performance">
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Chiffre d'affaires (mois)", value: "22 400 000 FCFA", pct: "+8.2%", color: "#3B82F6" },
          { label: "Marge brute", value: "6 720 000 FCFA", pct: "+5.1%", color: "#10B981" },
          { label: "Ordonnances traitées", value: "847", pct: "+12%", color: "#8B5CF6" },
          { label: "Taux de rupture", value: "3.2%", pct: "-0.8%", color: "#F59E0B" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: "white", borderRadius: 14, padding: "18px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 19, fontWeight: 800, color: "#0A1628" }}>{k.value}</div>
            <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>{k.label}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: k.pct.startsWith("+") ? "#10B981" : "#EF4444", marginTop: 4 }}>{k.pct} vs mois précédent</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 20 }}>
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", minWidth: 0 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Ventes mensuelles (6 derniers mois)</h3>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
                <Tooltip formatter={(v) => `${(v / 1000000).toFixed(1)}M FCFA`} />
                <Bar dataKey="ventes" fill="#3B82F6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Ventes par catégorie</h3>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <PieChart width={180} height={180}>
              <Pie data={pieData} cx={90} cy={90} innerRadius={50} outerRadius={80} dataKey="value">
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
            </PieChart>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            {pieData.map((d, i) => (
              <div key={d.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: COLORS[i], display: "inline-block" }} />
                  <span style={{ fontSize: 12, color: "#374151" }}>{d.name}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#0A1628" }}>{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Rapports disponibles</h3>
          <button style={{ padding: "7px 16px", backgroundColor: "#3B82F6", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Générer rapport
          </button>
        </div>
        {[
          { name: "Rapport mensuel — Janvier 2024", date: "01/02/2024", type: "Ventes", size: "2.4 MB" },
          { name: "Rapport d'inventaire — Décembre 2023", date: "05/01/2024", type: "Stock", size: "1.8 MB" },
          { name: "Rapport ordonnances — Q4 2023", date: "10/01/2024", type: "Ordonnances", size: "3.1 MB" },
          { name: "Rapport fournisseurs — 2023", date: "15/01/2024", type: "Achats", size: "1.2 MB" },
        ].map((r) => (
          <div key={r.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #F3F4F6" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#0A1628" }}>{r.name}</div>
              <div style={{ fontSize: 11, color: "#9CA3AF" }}>Généré le {r.date} · {r.size}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ padding: "3px 10px", backgroundColor: "#EFF6FF", color: "#2563EB", borderRadius: 8, fontSize: 11, fontWeight: 600 }}>{r.type}</span>
              <button style={{ padding: "6px 14px", backgroundColor: "#F8FAFC", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>
                Télécharger
              </button>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
