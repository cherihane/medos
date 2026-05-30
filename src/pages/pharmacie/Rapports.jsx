import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import Layout from "../../components/Layout";
import { useMedicaments, useAlertes, usePatients } from "../../hooks/useSupabaseData";

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#EC4899"];

export default function Rapports() {
  const { data: medicaments, loading: loadMed } = useMedicaments();
  const { data: alertes, loading: loadAlt } = useAlertes(50);
  const { data: patients, loading: loadPat } = usePatients();

  const loading = loadMed || loadAlt || loadPat;

  // Répartition par catégorie
  const byCategorie = medicaments.reduce((acc, m) => {
    const cat = m.categorie ?? "Autres";
    acc[cat] = (acc[cat] ?? 0) + 1;
    return acc;
  }, {});
  const pieData = Object.entries(byCategorie)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value]) => ({ name, value }));

  // Stock par catégorie (barres)
  const stockData = Object.entries(
    medicaments.reduce((acc, m) => {
      const cat = m.categorie ?? "Autres";
      acc[cat] = (acc[cat] ?? 0) + (m.stock_actuel ?? 0);
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([cat, stock]) => ({ cat: cat.slice(0, 10), stock }));

  // Alertes par type
  const byType = alertes.reduce((acc, a) => {
    acc[a.type] = (acc[a.type] ?? 0) + 1;
    return acc;
  }, {});

  const ruptures    = medicaments.filter((m) => m.stock_actuel < m.stock_minimum).length;
  const critiques   = alertes.filter((a) => a.severite === "critique").length;
  const totalPatients = patients.length;

  const kpis = [
    { label: "Médicaments référencés", value: loading ? "…" : medicaments.length,  pct: "+0%",  color: "#3B82F6" },
    { label: "Produits en rupture",    value: loading ? "…" : ruptures,             pct: ruptures > 0 ? `${ruptures} ⚠` : "OK", color: "#EF4444" },
    { label: "Patients enregistrés",   value: loading ? "…" : totalPatients,        pct: "+0",   color: "#8B5CF6" },
    { label: "Alertes actives",        value: loading ? "…" : alertes.length,       pct: critiques > 0 ? `${critiques} critiques` : "OK", color: "#F59E0B" },
  ];

  const rapportsDispo = [
    { name: "Inventaire complet médicaments",    date: new Date().toLocaleDateString("fr-FR"), pages: `${medicaments.length} produits` },
    { name: "État des stocks critiques",          date: new Date().toLocaleDateString("fr-FR"), pages: `${ruptures} ruptures` },
    { name: "Registre patients",                  date: new Date().toLocaleDateString("fr-FR"), pages: `${totalPatients} patients` },
    { name: "Tableau de bord alertes",            date: new Date().toLocaleDateString("fr-FR"), pages: `${alertes.length} alertes` },
  ];

  return (
    <Layout title="Rapports" subtitle="Analyses et indicateurs de performance">
      {/* ── KPI ── */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ backgroundColor: "white", padding: "18px 22px", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{k.label}</div>
            <div style={{ fontSize: 11, color: k.color, marginTop: 4, fontWeight: 600 }}>{k.pct}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* Stock par catégorie */}
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", minWidth: 0 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Stock par catégorie</h3>
          {loading ? (
            <div style={{ height: 220, backgroundColor: "#F8FAFC", borderRadius: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
          ) : (
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stockData}>
                  <XAxis dataKey="cat" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v} unités`, "Stock"]} />
                  <Bar dataKey="stock" fill="#3B82F6" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Répartition catégories */}
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Catégories</h3>
          {loading ? (
            <div style={{ height: 160, backgroundColor: "#F8FAFC", borderRadius: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
          ) : (
            <>
              <div style={{ width: "100%", height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value">
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                {pieData.map((d, i) => (
                  <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: COLORS[i % COLORS.length] }} />
                    <span style={{ fontSize: 11, color: "#6B7280" }}>{d.name} ({d.value})</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Alertes par type + rapports */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Alertes par type</h3>
          {loading ? (
            [1,2,3].map((i) => <div key={i} style={{ height: 36, backgroundColor: "#F8FAFC", borderRadius: 8, marginBottom: 8, animation: "pulse 1.5s ease-in-out infinite" }} />)
          ) : Object.entries(byType).length === 0 ? (
            <div style={{ color: "#9CA3AF", fontSize: 13 }}>Aucune alerte active</div>
          ) : (
            Object.entries(byType).map(([type, count]) => (
              <div key={type} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", backgroundColor: "#F8FAFC", borderRadius: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#374151", textTransform: "capitalize" }}>{type}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#EF4444" }}>{count}</span>
              </div>
            ))
          )}
        </div>

        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Rapports disponibles</h3>
          {rapportsDispo.map((r) => (
            <div key={r.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: "1px solid #F3F4F6" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0A1628" }}>{r.name}</div>
                <div style={{ fontSize: 11, color: "#9CA3AF" }}>{r.date} · {r.pages}</div>
              </div>
              <button style={{ padding: "6px 14px", backgroundColor: "#F8FAFC", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>
                Exporter
              </button>
            </div>
          ))}
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </Layout>
  );
}
