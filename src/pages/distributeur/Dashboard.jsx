import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import Layout from "../../components/Layout";
import KpiCard from "../../components/KpiCard";
import { kpiDistributor, networkClients } from "../../data/staticData";

const forecastData = [
  { mois: "Fév", prevision: 28000000 },
  { mois: "Mar", prevision: 31000000 },
  { mois: "Avr", prevision: 27000000 },
  { mois: "Mai", reel: 25000000, prevision: 26000000 },
  { mois: "Jun", reel: 27500000, prevision: 28500000 },
  { mois: "Jul", reel: 24800000, prevision: 25000000 },
];

export default function DashboardDistributeur() {
  return (
    <Layout title="Dashboard Distributeur" subtitle="Vue d'ensemble — MedDistrib International">
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {kpiDistributor.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Réseau clients</h3>
          {networkClients.map((c) => (
            <div key={c.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", backgroundColor: "#F8FAFC", borderRadius: 10, marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: c.status === "actif" ? "#F59E0B" : "#9CA3AF" }} />
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

        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", minWidth: 0 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Prévisions de ventes</h3>
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={forecastData}>
                <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
                <Tooltip formatter={(v) => `${(v / 1000000).toFixed(1)}M FCFA`} />
                <Line type="monotone" dataKey="reel" stroke="#F59E0B" strokeWidth={2.5} dot={{ r: 4 }} name="Réel" />
                <Line type="monotone" dataKey="prevision" stroke="#D97706" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3 }} name="Prévision" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ marginTop: 20 }}>
            {[
              { cmd: "CMD-2024-156", client: "Pharmacie Lumière", montant: "342 000 FCFA", status: "livré" },
              { cmd: "CMD-2024-155", client: "Hôpital Central", montant: "1 820 000 FCFA", status: "en cours" },
              { cmd: "CMD-2024-154", client: "Clinique du Nord", montant: "245 500 FCFA", status: "préparation" },
            ].map((r) => (
              <div key={r.cmd} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #F3F4F6" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0A1628" }}>{r.client}</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF" }}>{r.cmd}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{r.montant}</div>
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, fontWeight: 700, backgroundColor: r.status === "livré" ? "#DCFCE7" : r.status === "en cours" ? "#DBEAFE" : "#FEF9C3", color: r.status === "livré" ? "#16A34A" : r.status === "en cours" ? "#2563EB" : "#A16207" }}>{r.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
