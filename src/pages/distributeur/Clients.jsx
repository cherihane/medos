import Layout from "../../components/Layout";
import { useEtablissements } from "../../hooks/useSupabaseData";

export default function Clients() {
  const { data: etabs, loading, error } = useEtablissements();

  return (
    <Layout title="Clients" subtitle="Gestion et suivi des comptes clients">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
        <button style={{ padding: "8px 18px", backgroundColor: "#F59E0B", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + Nouveau client
        </button>
      </div>

      {error && (
        <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "14px 18px", marginBottom: 16, fontSize: 13, color: "#DC2626" }}>
          Erreur : {error.message}
        </div>
      )}

      <div style={{ backgroundColor: "white", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: "#F8FAFC" }}>
              {["Client", "Ville", "Type", "Email", "Statut", "Actions"].map((h) => (
                <th key={h} style={{ padding: "12px 18px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6B7280", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && [1,2,3,4].map((i) => (
              <tr key={i} style={{ borderBottom: "1px solid #F3F4F6", animation: "pulse 1.5s ease-in-out infinite" }}>
                {[180,100,80,140,60,100].map((w, j) => (
                  <td key={j} style={{ padding: "14px 18px" }}><div style={{ height: 13, width: w, backgroundColor: "#F3F4F6", borderRadius: 6 }} /></td>
                ))}
              </tr>
            ))}
            {!loading && etabs.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Aucun établissement</td></tr>
            )}
            {!loading && etabs.map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                <td style={{ padding: "14px 18px", fontWeight: 600, color: "#0A1628" }}>{c.nom}</td>
                <td style={{ padding: "14px 18px", color: "#6B7280" }}>{c.ville}</td>
                <td style={{ padding: "14px 18px", color: "#6B7280", textTransform: "capitalize" }}>{c.type}</td>
                <td style={{ padding: "14px 18px", color: "#6B7280", fontSize: 12 }}>{c.email ?? "—"}</td>
                <td style={{ padding: "14px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: c.actif ? "#10B981" : "#9CA3AF" }} />
                    <span style={{ fontSize: 12, color: c.actif ? "#16A34A" : "#9CA3AF", fontWeight: 600 }}>{c.actif ? "actif" : "inactif"}</span>
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
