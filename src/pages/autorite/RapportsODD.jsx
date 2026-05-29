import Layout from "../../components/Layout";

const oddData = [
  { goal: "ODD 3.3", label: "Maladies infectieuses", progress: 67, target: 80 },
  { goal: "ODD 3.4", label: "Maladies non transmissibles", progress: 54, target: 70 },
  { goal: "ODD 3.8", label: "Couverture santé universelle", progress: 72, target: 90 },
  { goal: "ODD 3.b", label: "Accès médicaments essentiels", progress: 78, target: 85 },
];

export default function RapportsODD() {
  return (
    <Layout title="Rapports ODD" subtitle="Suivi des Objectifs de Développement Durable — Santé">
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Score ODD moyen", value: "68%", color: "#8B5CF6" },
          { label: "Objectifs atteints", value: "1/4", color: "#10B981" },
          { label: "Progression annuelle", value: "+4.2%", color: "#3B82F6" },
          { label: "Classement régional", value: "7/54", color: "#F59E0B" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: "white", borderRadius: 14, padding: "18px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Progression par objectif</h3>
          {oddData.map((o) => (
            <div key={o.goal} style={{ padding: "16px", backgroundColor: "#F8FAFC", borderRadius: 10, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#8B5CF6", padding: "2px 8px", backgroundColor: "#F5F3FF", borderRadius: 8 }}>{o.goal}</span>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginTop: 4 }}>{o.label}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: o.progress >= o.target ? "#10B981" : "#F59E0B" }}>{o.progress}%</div>
                  <div style={{ fontSize: 10, color: "#9CA3AF" }}>cible : {o.target}%</div>
                </div>
              </div>
              <div style={{ height: 8, backgroundColor: "#E5E7EB", borderRadius: 4, position: "relative" }}>
                <div style={{ height: "100%", width: `${o.progress}%`, backgroundColor: o.progress >= o.target ? "#10B981" : "#8B5CF6", borderRadius: 4 }} />
                <div style={{ position: "absolute", top: 0, left: `${o.target}%`, width: 2, height: "100%", backgroundColor: "#F59E0B" }} />
              </div>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>Ligne jaune = cible ONU 2030</div>
            </div>
          ))}
        </div>

        <div>
          <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Résumé exécutif 2024</h3>
            <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.8 }}>
              La Côte d'Ivoire progresse vers les ODD Santé avec une amélioration de +4.2% de la couverture vaccinale et une réduction de 12% de la mortalité infantile par rapport à 2023. La couverture santé universelle reste l'objectif le plus déficitaire avec 18 points d'écart à la cible.
            </div>
            <div style={{ marginTop: 16, padding: "12px", backgroundColor: "#F5F3FF", borderRadius: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#7C3AED", marginBottom: 4 }}>Priorité 2024-2025</div>
              <div style={{ fontSize: 12, color: "#6B7280" }}>Renforcer l'accès aux médicaments essentiels dans les zones rurales et améliorer la couverture vaccinale dans les régions nord.</div>
            </div>
          </div>

          <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Rapports disponibles</h3>
            {[
              { name: "Rapport ODD Santé 2023", date: "Jan 2024", pages: "84 pages" },
              { name: "Bilan mi-parcours 2020-2030", date: "Juil 2023", pages: "120 pages" },
              { name: "Rapport régional CEDEAO", date: "Oct 2023", pages: "56 pages" },
            ].map((r) => (
              <div key={r.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: "1px solid #F3F4F6" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0A1628" }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF" }}>{r.date} · {r.pages}</div>
                </div>
                <button style={{ padding: "6px 14px", backgroundColor: "#F8FAFC", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>
                  Télécharger
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
