import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import Layout from "../components/Layout";
import KpiCard from "../components/KpiCard";
import { kpiDistributor, networkClients, salesData } from "../data/staticData";

export default function DashboardDistributeur() {
  const forecastData = [
    { mois: "Fév", reel: null, prevision: 28000000 },
    { mois: "Mar", reel: null, prevision: 31000000 },
    { mois: "Avr", reel: null, prevision: 27000000 },
    { mois: "Mai", reel: 25000000, prevision: 26000000 },
    { mois: "Jun", reel: 27500000, prevision: 28500000 },
    { mois: "Jul", reel: 24800000, prevision: 25000000 },
  ];

  return (
    <Layout title="Dashboard Distributeur">
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {kpiDistributor.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Network Clients */}
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>🗺️ Réseau clients</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {networkClients.map((c) => (
              <div key={c.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", backgroundColor: "#F8FAFC", borderRadius: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: c.status === "actif" ? "#10B981" : "#9CA3AF" }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#0A1628" }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: "#9CA3AF" }}>{c.ville}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#0A1628" }}>{c.ca}M FCFA</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF" }}>{c.commandes} cmd</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Forecast */}
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", minWidth: 0 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>📈 Prévisions de ventes (FCFA)</h3>
          <div style={{ width: "100%", height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={forecastData}>
              <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
              <Tooltip formatter={(v) => `${(v / 1000000).toFixed(1)}M FCFA`} />
              <Line type="monotone" dataKey="reel" stroke="#3B82F6" strokeWidth={2.5} dot={{ r: 4 }} name="Réel" />
              <Line type="monotone" dataKey="prevision" stroke="#F59E0B" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3 }} name="Prévision" />
            </LineChart>
          </ResponsiveContainer>
          </div>

          <div style={{ marginTop: 20 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: "#0A1628", margin: "0 0 12px" }}>Top produits commandés</h4>
            {[
              { name: "Paracétamol 1g", pct: 85, qte: "12 450 boîtes" },
              { name: "Amoxicilline 500mg", pct: 72, qte: "8 200 boîtes" },
              { name: "Ibuprofène 400mg", pct: 64, qte: "6 800 boîtes" },
              { name: "Vitamine C 500mg", pct: 91, qte: "18 000 comprimés" },
            ].map((p) => (
              <div key={p.name} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: "#374151" }}>{p.name}</span>
                  <span style={{ color: "#6B7280" }}>{p.qte}</span>
                </div>
                <div style={{ height: 5, backgroundColor: "#E5E7EB", borderRadius: 4 }}>
                  <div style={{ height: "100%", width: `${p.pct}%`, backgroundColor: "#3B82F6", borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginTop: 20 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Dernières commandes</h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: "#F8FAFC" }}>
              {["N° Commande", "Client", "Ville", "Montant", "Date", "Statut"].map((h) => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6B7280", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { cmd: "CMD-2024-156", client: "Pharmacie Lumière", ville: "Abidjan", montant: "342 000 FCFA", date: "15 Jan", status: "livré" },
              { cmd: "CMD-2024-155", client: "Hôpital Central", ville: "Yamoussoukro", montant: "1 820 000 FCFA", date: "15 Jan", status: "en cours" },
              { cmd: "CMD-2024-154", client: "Clinique du Nord", ville: "Bouaké", montant: "245 500 FCFA", date: "14 Jan", status: "préparation" },
              { cmd: "CMD-2024-153", client: "Centre de Santé", ville: "Daloa", montant: "98 200 FCFA", date: "14 Jan", status: "livré" },
            ].map((r) => (
              <tr key={r.cmd} style={{ borderBottom: "1px solid #F3F4F6" }}>
                <td style={{ padding: "12px 14px", fontWeight: 600, color: "#3B82F6" }}>{r.cmd}</td>
                <td style={{ padding: "12px 14px", color: "#374151" }}>{r.client}</td>
                <td style={{ padding: "12px 14px", color: "#6B7280" }}>{r.ville}</td>
                <td style={{ padding: "12px 14px", fontWeight: 700, color: "#0A1628" }}>{r.montant}</td>
                <td style={{ padding: "12px 14px", color: "#6B7280" }}>{r.date}</td>
                <td style={{ padding: "12px 14px" }}>
                  <span style={{
                    padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700,
                    backgroundColor: r.status === "livré" ? "#DCFCE7" : r.status === "en cours" ? "#DBEAFE" : "#FEF9C3",
                    color: r.status === "livré" ? "#16A34A" : r.status === "en cours" ? "#2563EB" : "#A16207",
                  }}>{r.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
