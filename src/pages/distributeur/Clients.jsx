import Layout from "../../components/Layout";
import { networkClients } from "../../data/staticData";

export default function Clients() {
  return (
    <Layout title="Clients" subtitle="Gestion et suivi des comptes clients">
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
        <button style={{ padding: "8px 18px", backgroundColor: "#F59E0B", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + Nouveau client
        </button>
      </div>

      <div style={{ backgroundColor: "white", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: "#F8FAFC" }}>
              {["Client", "Ville", "Commandes", "CA total", "Statut", "Actions"].map((h) => (
                <th key={h} style={{ padding: "12px 18px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6B7280", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ...networkClients,
              { name: "Hôpital Général Bouaké", ville: "Bouaké", commandes: 18, ca: "2.1", status: "actif" },
              { name: "Centre Médical Yopougon", ville: "Abidjan", commandes: 31, ca: "3.8", status: "actif" },
              { name: "Pharmacie de la Paix", ville: "Abidjan", commandes: 7, ca: "0.6", status: "inactif" },
            ].map((c) => (
              <tr key={c.name} style={{ borderBottom: "1px solid #F3F4F6" }}>
                <td style={{ padding: "14px 18px", fontWeight: 600, color: "#0A1628" }}>{c.name}</td>
                <td style={{ padding: "14px 18px", color: "#6B7280" }}>{c.ville}</td>
                <td style={{ padding: "14px 18px", fontWeight: 700, color: "#374151" }}>{c.commandes}</td>
                <td style={{ padding: "14px 18px", fontWeight: 700, color: "#0A1628" }}>{c.ca}M FCFA</td>
                <td style={{ padding: "14px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: c.status === "actif" ? "#10B981" : "#9CA3AF" }} />
                    <span style={{ fontSize: 12, color: c.status === "actif" ? "#16A34A" : "#9CA3AF", fontWeight: 600 }}>{c.status}</span>
                  </div>
                </td>
                <td style={{ padding: "14px 18px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button style={{ padding: "4px 12px", backgroundColor: "#FFFBEB", color: "#D97706", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Commande</button>
                    <button style={{ padding: "4px 12px", backgroundColor: "#F8FAFC", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>Fiche</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
