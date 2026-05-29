import Layout from "../components/Layout";
import { suppliers } from "../data/staticData";

export default function Fournisseurs() {
  return (
    <Layout title="Fournisseurs">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 14, color: "#6B7280" }}>{suppliers.length} fournisseurs enregistrés</div>
        <button style={{ padding: "8px 18px", backgroundColor: "#3B82F6", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + Nouveau fournisseur
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {suppliers.map((s) => (
          <div key={s.id} style={{ backgroundColor: "white", borderRadius: 16, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 50, height: 50, borderRadius: 14, backgroundColor: s.status === "actif" ? "#EFF6FF" : "#F3F4F6",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22
                }}>🏭</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: "#0A1628" }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: "#9CA3AF" }}>{s.pays}</div>
                </div>
              </div>
              <span style={{
                padding: "4px 12px", borderRadius: 12, fontSize: 11, fontWeight: 700,
                backgroundColor: s.status === "actif" ? "#DCFCE7" : "#F3F4F6",
                color: s.status === "actif" ? "#16A34A" : "#9CA3AF"
              }}>{s.status}</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              {[
                { label: "Produits référencés", value: s.produits, icon: "📦" },
                { label: "Délai de livraison", value: s.delai, icon: "🚚" },
                { label: "CA mensuel", value: s.ca, icon: "💰" },
                { label: "ID Fournisseur", value: s.id, icon: "🆔" },
              ].map((item) => (
                <div key={item.label} style={{ padding: "10px 12px", backgroundColor: "#F8FAFC", borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 2 }}>{item.icon} {item.label}</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#0A1628" }}>{item.value}</div>
                </div>
              ))}
            </div>

            <div style={{ padding: "10px 12px", backgroundColor: "#F8FAFC", borderRadius: 10, marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 2 }}>📧 Contact</div>
              <div style={{ fontSize: 13, color: "#3B82F6" }}>{s.contact}</div>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{s.tel}</div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ flex: 1, padding: "9px", backgroundColor: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Passer commande
              </button>
              <button style={{ flex: 1, padding: "9px", backgroundColor: "#F8FAFC", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Voir détails
              </button>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
