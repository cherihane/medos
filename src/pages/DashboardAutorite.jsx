import Layout from "../components/Layout";
import KpiCard from "../components/KpiCard";
import { kpiAuthority } from "../data/staticData";

const regions = [
  { name: "Abidjan", structures: 428, couverture: 89, alertes: 2 },
  { name: "Yamoussoukro", structures: 87, couverture: 72, alertes: 1 },
  { name: "Bouaké", structures: 143, couverture: 68, alertes: 3 },
  { name: "San Pédro", structures: 98, couverture: 61, alertes: 1 },
  { name: "Daloa", structures: 76, couverture: 55, alertes: 2 },
  { name: "Korhogo", structures: 54, couverture: 48, alertes: 4 },
  { name: "Man", structures: 42, couverture: 43, alertes: 2 },
  { name: "Gagnoa", structures: 38, couverture: 52, alertes: 1 },
];

const oddData = [
  { goal: "ODD 3.3", label: "Maladies infectieuses", progress: 67, target: 80 },
  { goal: "ODD 3.4", label: "Maladies non transmissibles", progress: 54, target: 70 },
  { goal: "ODD 3.8", label: "Couverture santé universelle", progress: 72, target: 90 },
  { goal: "ODD 3.b", label: "Accès aux médicaments essentiels", progress: 78, target: 85 },
];

export default function DashboardAutorite() {
  return (
    <Layout title="Dashboard Autorité de Santé">
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {kpiAuthority.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* National Map */}
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>🗺️ Carte nationale — Couverture par région</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {regions.map((r) => (
              <div key={r.name} style={{ padding: "12px 16px", backgroundColor: "#F8FAFC", borderRadius: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "#0A1628" }}>{r.name}</span>
                    <span style={{ fontSize: 11, color: "#9CA3AF", marginLeft: 8 }}>{r.structures} structures</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {r.alertes > 0 && (
                      <span style={{ fontSize: 11, padding: "1px 7px", backgroundColor: "#FEF2F2", color: "#EF4444", borderRadius: 10, fontWeight: 700 }}>
                        {r.alertes} alertes
                      </span>
                    )}
                    <span style={{ fontWeight: 700, fontSize: 13, color: r.couverture >= 70 ? "#10B981" : r.couverture >= 55 ? "#F59E0B" : "#EF4444" }}>
                      {r.couverture}%
                    </span>
                  </div>
                </div>
                <div style={{ height: 6, backgroundColor: "#E5E7EB", borderRadius: 4 }}>
                  <div style={{
                    height: "100%", width: `${r.couverture}%`, borderRadius: 4,
                    backgroundColor: r.couverture >= 70 ? "#10B981" : r.couverture >= 55 ? "#F59E0B" : "#EF4444"
                  }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 16, fontSize: 11 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, backgroundColor: "#10B981", borderRadius: 2, display: "inline-block" }} /> ≥70% Bonne</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, backgroundColor: "#F59E0B", borderRadius: 2, display: "inline-block" }} /> 55–69% Moyenne</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, backgroundColor: "#EF4444", borderRadius: 2, display: "inline-block" }} /> &lt;55% Faible</span>
          </div>
        </div>

        {/* ODD */}
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>🌍 Objectifs de Développement Durable (ODD)</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {oddData.map((o) => (
              <div key={o.goal} style={{ padding: "16px", backgroundColor: "#F8FAFC", borderRadius: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#3B82F6", padding: "2px 8px", backgroundColor: "#DBEAFE", borderRadius: 8 }}>{o.goal}</span>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginTop: 4 }}>{o.label}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: o.progress >= o.target ? "#10B981" : "#F59E0B" }}>{o.progress}%</div>
                    <div style={{ fontSize: 10, color: "#9CA3AF" }}>cible : {o.target}%</div>
                  </div>
                </div>
                <div style={{ height: 8, backgroundColor: "#E5E7EB", borderRadius: 4, position: "relative" }}>
                  <div style={{ height: "100%", width: `${o.progress}%`, backgroundColor: o.progress >= o.target ? "#10B981" : "#3B82F6", borderRadius: 4 }} />
                  <div style={{ position: "absolute", top: 0, left: `${o.target}%`, width: 2, height: "100%", backgroundColor: "#F59E0B" }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20, padding: "16px", backgroundColor: "#EFF6FF", borderRadius: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1E40AF", marginBottom: 8 }}>Rapport ODD 2024</div>
            <div style={{ fontSize: 12, color: "#3B82F6" }}>
              La Côte d'Ivoire progresse vers les ODD santé avec une amélioration de +4.2% de la couverture vaccinale et -12% de la mortalité infantile par rapport à 2023.
            </div>
            <button style={{ marginTop: 12, padding: "8px 16px", backgroundColor: "#3B82F6", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Télécharger le rapport →
            </button>
          </div>
        </div>
      </div>

      {/* Pharmacovigilance */}
      <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>⚠️ Alertes Pharmacovigilance</h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: "#F8FAFC" }}>
              {["Produit", "Problème signalé", "Nb signalements", "Région", "Niveau", "Action"].map((h) => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6B7280", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { produit: "Chloroquine 250mg", probleme: "Effets indésirables cardiaques", nb: 8, region: "Abidjan", niveau: "critique" },
              { produit: "Artemether 20mg", probleme: "Réaction allergique sévère", nb: 3, region: "Bouaké", niveau: "alerte" },
              { produit: "Metronidazole 500mg", probleme: "Résistance suspectée", nb: 12, region: "National", niveau: "surveillance" },
            ].map((r) => (
              <tr key={r.produit} style={{ borderBottom: "1px solid #F3F4F6" }}>
                <td style={{ padding: "12px 14px", fontWeight: 600, color: "#0A1628" }}>{r.produit}</td>
                <td style={{ padding: "12px 14px", color: "#374151" }}>{r.probleme}</td>
                <td style={{ padding: "12px 14px", fontWeight: 700, color: "#EF4444" }}>{r.nb}</td>
                <td style={{ padding: "12px 14px", color: "#6B7280" }}>{r.region}</td>
                <td style={{ padding: "12px 14px" }}>
                  <span style={{
                    padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700,
                    backgroundColor: r.niveau === "critique" ? "#FEF2F2" : r.niveau === "alerte" ? "#FFFBEB" : "#EFF6FF",
                    color: r.niveau === "critique" ? "#EF4444" : r.niveau === "alerte" ? "#F59E0B" : "#3B82F6",
                  }}>{r.niveau}</span>
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <button style={{ fontSize: 11, padding: "4px 10px", backgroundColor: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
                    Enquêter
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
