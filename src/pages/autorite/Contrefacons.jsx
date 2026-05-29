import Layout from "../../components/Layout";

const incidents = [
  { id: "CTF-2024-012", produit: "Amoxicilline 500mg", marque: "PharmaCongo", region: "Abidjan", date: "2024-01-14", signalements: 8, gravite: "critique", action: "Rappel initié" },
  { id: "CTF-2024-011", produit: "Artémisinine", marque: "GlobalPharma", region: "Bouaké", date: "2024-01-10", signalements: 3, gravite: "alerte", action: "Enquête en cours" },
  { id: "CTF-2024-010", produit: "Insuline 100UI", marque: "Inconnue", region: "Abidjan", date: "2024-01-08", signalements: 12, gravite: "critique", action: "Saisie effectuée" },
  { id: "CTF-2024-009", produit: "Vitamine C 500mg", marque: "MedDistrib", region: "Daloa", date: "2024-01-05", signalements: 2, gravite: "surveillance", action: "Analyse en cours" },
];

const graviteStyle = {
  critique: { bg: "#FEF2F2", color: "#EF4444" },
  alerte: { bg: "#FFFBEB", color: "#D97706" },
  surveillance: { bg: "#EFF6FF", color: "#2563EB" },
};

export default function Contrefacons() {
  return (
    <Layout title="Contrefaçons" subtitle="Détection et lutte contre les médicaments falsifiés">
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Incidents actifs", value: "12", color: "#EF4444" },
          { label: "Saisies (mois)", value: "4", color: "#F59E0B" },
          { label: "Produits analysés", value: "284", color: "#8B5CF6" },
          { label: "Taux d'authenticité", value: "98.6%", color: "#10B981" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: "white", borderRadius: 14, padding: "18px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Incidents signalés</h3>
          <button style={{ padding: "7px 16px", backgroundColor: "#EF4444", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            + Nouveau signalement
          </button>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: "#F8FAFC" }}>
              {["Référence", "Produit", "Fabricant", "Région", "Signalements", "Gravité", "Action", ""].map((h) => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6B7280", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {incidents.map((inc) => {
              const g = graviteStyle[inc.gravite];
              return (
                <tr key={inc.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "12px 14px", fontWeight: 600, color: "#8B5CF6", fontSize: 12 }}>{inc.id}</td>
                  <td style={{ padding: "12px 14px", fontWeight: 600, color: "#0A1628" }}>{inc.produit}</td>
                  <td style={{ padding: "12px 14px", color: "#6B7280" }}>{inc.marque}</td>
                  <td style={{ padding: "12px 14px", color: "#6B7280" }}>{inc.region}</td>
                  <td style={{ padding: "12px 14px", fontWeight: 700, color: "#EF4444" }}>{inc.signalements}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ padding: "3px 10px", backgroundColor: g.bg, color: g.color, borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{inc.gravite}</span>
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: "#374151" }}>{inc.action}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <button style={{ padding: "4px 12px", backgroundColor: "#F8FAFC", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>Détails</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ backgroundColor: "#FEF2F2", borderRadius: 14, padding: "20px 24px", border: "1px solid #FCA5A5" }}>
        <div style={{ fontWeight: 700, color: "#EF4444", fontSize: 14, marginBottom: 6 }}>Alerte nationale active</div>
        <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7 }}>
          3 lots d'insuline de marque inconnue ont été saisis à Abidjan. 12 signalements d'effets indésirables graves ont été reçus. Une enquête nationale est en cours avec l'INTERPOL. Toutes les structures sont invitées à vérifier leurs stocks.
        </div>
        <button style={{ marginTop: 12, padding: "8px 18px", backgroundColor: "#EF4444", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Voir le rapport complet
        </button>
      </div>
    </Layout>
  );
}
