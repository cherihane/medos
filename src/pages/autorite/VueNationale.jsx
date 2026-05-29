import Layout from "../../components/Layout";
import KpiCard from "../../components/KpiCard";
import { kpiAuthority } from "../../data/staticData";

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

export default function VueNationale() {
  return (
    <Layout title="Vue Nationale" subtitle="Tableau de bord national — Ministère de la Santé">
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {kpiAuthority.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Couverture par région</h3>
          {regions.map((r) => (
            <div key={r.name} style={{ padding: "10px 14px", backgroundColor: "#F8FAFC", borderRadius: 10, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#0A1628" }}>{r.name}</span>
                  <span style={{ fontSize: 11, color: "#9CA3AF" }}>{r.structures} structures</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {r.alertes > 0 && <span style={{ fontSize: 11, padding: "1px 7px", backgroundColor: "#FEF2F2", color: "#EF4444", borderRadius: 10, fontWeight: 700 }}>{r.alertes}</span>}
                  <span style={{ fontWeight: 700, fontSize: 13, color: r.couverture >= 70 ? "#10B981" : r.couverture >= 55 ? "#F59E0B" : "#EF4444" }}>{r.couverture}%</span>
                </div>
              </div>
              <div style={{ height: 6, backgroundColor: "#E5E7EB", borderRadius: 4 }}>
                <div style={{ height: "100%", width: `${r.couverture}%`, borderRadius: 4, backgroundColor: r.couverture >= 70 ? "#10B981" : r.couverture >= 55 ? "#F59E0B" : "#EF4444" }} />
              </div>
            </div>
          ))}
          <div style={{ marginTop: 14, display: "flex", gap: 16, fontSize: 11, color: "#6B7280" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, backgroundColor: "#10B981", borderRadius: 2, display: "inline-block" }} /> Bonne couverture</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, backgroundColor: "#F59E0B", borderRadius: 2, display: "inline-block" }} /> Moyenne</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, backgroundColor: "#EF4444", borderRadius: 2, display: "inline-block" }} /> Faible</span>
          </div>
        </div>

        <div>
          <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Alertes Pharmacovigilance</h3>
            {[
              { produit: "Chloroquine 250mg", probleme: "Effets cardiaques signalés", nb: 8, niveau: "critique" },
              { produit: "Artemether 20mg", probleme: "Réaction allergique sévère", nb: 3, niveau: "alerte" },
              { produit: "Metronidazole 500mg", probleme: "Résistance suspectée", nb: 12, niveau: "surveillance" },
            ].map((r) => (
              <div key={r.produit} style={{ padding: "12px 14px", borderRadius: 10, marginBottom: 8, backgroundColor: r.niveau === "critique" ? "#FEF2F2" : r.niveau === "alerte" ? "#FFFBEB" : "#EFF6FF", borderLeft: `3px solid ${r.niveau === "critique" ? "#EF4444" : r.niveau === "alerte" ? "#F59E0B" : "#3B82F6"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#0A1628" }}>{r.produit}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#EF4444" }}>{r.nb} signalements</span>
                </div>
                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{r.probleme}</div>
              </div>
            ))}
          </div>

          <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Indicateurs nationaux</h3>
            {[
              { label: "Taux de couverture vaccinale", value: "73%", trend: "+4.2%" },
              { label: "Mortalité infantile (pour 1000)", value: "42", trend: "-12%" },
              { label: "Structures fonctionnelles", value: "1 248", trend: "+34" },
              { label: "Médicaments essentiels disponibles", value: "87%", trend: "+2%" },
            ].map((ind) => (
              <div key={ind.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #F3F4F6" }}>
                <span style={{ fontSize: 13, color: "#6B7280" }}>{ind.label}</span>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#0A1628" }}>{ind.value}</span>
                  <div style={{ fontSize: 11, color: ind.trend.startsWith("+") ? "#10B981" : "#EF4444", fontWeight: 600 }}>{ind.trend}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
