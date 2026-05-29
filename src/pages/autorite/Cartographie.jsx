import Layout from "../../components/Layout";

const points = [
  { name: "CHU Abidjan", type: "CHU", lat: 48, lon: 52, status: "actif" },
  { name: "Hôpital Bouaké", type: "Hôpital", lat: 35, lon: 38, status: "actif" },
  { name: "Clinique Yamoussoukro", type: "Clinique", lat: 42, lon: 55, status: "alerte" },
  { name: "CS Korhogo", type: "Centre de Santé", lat: 22, lon: 42, status: "critique" },
  { name: "Pharmacie San Pédro", type: "Pharmacie", lat: 62, lon: 28, status: "actif" },
  { name: "Hôpital Daloa", type: "Hôpital", lat: 40, lon: 35, status: "actif" },
  { name: "CS Man", type: "Centre de Santé", lat: 35, lon: 22, status: "alerte" },
];

const typeColors = { CHU: "#8B5CF6", Hôpital: "#3B82F6", Clinique: "#10B981", "Centre de Santé": "#F59E0B", Pharmacie: "#EC4899" };
const statusColors = { actif: "#10B981", alerte: "#F59E0B", critique: "#EF4444" };

export default function Cartographie() {
  return (
    <Layout title="Cartographie" subtitle="Géolocalisation des structures de santé sur le territoire national">
      <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
        {[
          { label: "Structures cartographiées", value: "1 248", color: "#8B5CF6" },
          { label: "Régions couvertes", value: "14/14", color: "#10B981" },
          { label: "En alerte", value: "34", color: "#F59E0B" },
          { label: "Hors ligne", value: "7", color: "#EF4444" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: "white", borderRadius: 14, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        {/* Fake map */}
        <div style={{ backgroundColor: "white", borderRadius: 16, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Carte interactive — Côte d'Ivoire</h3>
            <div style={{ display: "flex", gap: 6 }}>
              {["Tous", "CHU", "Hôpitaux", "Pharmacies"].map((f) => (
                <button key={f} style={{ padding: "4px 12px", backgroundColor: f === "Tous" ? "#8B5CF6" : "#F8FAFC", color: f === "Tous" ? "white" : "#6B7280", border: "1px solid #E5E7EB", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>{f}</button>
              ))}
            </div>
          </div>

          <div style={{ width: "100%", height: 400, backgroundColor: "#E8F4F0", borderRadius: 12, position: "relative", overflow: "hidden" }}>
            {/* Grid lines */}
            {[20, 40, 60, 80].map((v) => (
              <div key={v} style={{ position: "absolute", top: `${v}%`, left: 0, right: 0, height: 1, backgroundColor: "rgba(0,0,0,0.06)" }} />
            ))}
            {[20, 40, 60, 80].map((v) => (
              <div key={v} style={{ position: "absolute", left: `${v}%`, top: 0, bottom: 0, width: 1, backgroundColor: "rgba(0,0,0,0.06)" }} />
            ))}

            {/* CI shape hint */}
            <div style={{ position: "absolute", top: "10%", left: "15%", right: "10%", bottom: "15%", border: "2px dashed rgba(139,92,246,0.2)", borderRadius: "60% 40% 50% 50%", backgroundColor: "rgba(139,92,246,0.04)" }} />

            {/* Points */}
            {points.map((p) => (
              <div key={p.name} style={{ position: "absolute", left: `${p.lon}%`, top: `${p.lat}%`, transform: "translate(-50%, -50%)", cursor: "pointer" }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: statusColors[p.status], border: "2px solid white", boxShadow: "0 2px 6px rgba(0,0,0,0.2)" }} />
                <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap", backgroundColor: "white", padding: "2px 6px", borderRadius: 4, fontSize: 10, color: "#374151", fontWeight: 600, boxShadow: "0 1px 4px rgba(0,0,0,0.12)" }}>
                  {p.name}
                </div>
              </div>
            ))}

            <div style={{ position: "absolute", bottom: 12, right: 12, fontSize: 11, color: "#9CA3AF", backgroundColor: "rgba(255,255,255,0.8)", padding: "4px 8px", borderRadius: 6 }}>
              Carte schématique — Données illustratives
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ backgroundColor: "white", borderRadius: 14, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h4 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: "#0A1628" }}>Légende</h4>
            {Object.entries(typeColors).map(([type, color]) => (
              <div key={type} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: color }} />
                <span style={{ fontSize: 12, color: "#374151" }}>{type}</span>
              </div>
            ))}
            <div style={{ borderTop: "1px solid #E5E7EB", marginTop: 12, paddingTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 8 }}>Statut</div>
              {Object.entries(statusColors).map(([s, c]) => (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: c }} />
                  <span style={{ fontSize: 11, color: "#6B7280", textTransform: "capitalize" }}>{s}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ backgroundColor: "white", borderRadius: 14, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h4 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: "#0A1628" }}>Structures affichées</h4>
            {points.map((p) => (
              <div key={p.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #F3F4F6" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0A1628" }}>{p.name}</div>
                  <div style={{ fontSize: 10, color: "#9CA3AF" }}>{p.type}</div>
                </div>
                <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: statusColors[p.status] }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
