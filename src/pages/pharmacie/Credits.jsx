import Layout from "../../components/Layout";
import { credits } from "../../data/staticData";

const statusStyle = {
  normal: { bg: "#DCFCE7", color: "#16A34A" },
  alerte: { bg: "#FFFBEB", color: "#F59E0B" },
  critique: { bg: "#FEF2F2", color: "#EF4444" },
};

export default function Credits() {
  return (
    <Layout title="Crédits" subtitle="Suivi des comptes crédit et des encours clients">
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Encours total", value: "9 670 000 FCFA", color: "#3B82F6" },
          { label: "Limite globale", value: "13 000 000 FCFA", color: "#8B5CF6" },
          { label: "Comptes en alerte", value: "2", color: "#F59E0B" },
          { label: "Taux utilisation", value: "74%", color: "#10B981" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: "white", borderRadius: 14, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#0A1628", marginTop: 4 }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {credits.map((c) => {
          const s = statusStyle[c.status];
          const pct = Math.round((c.encours / c.limite) * 100);
          return (
            <div key={c.id} style={{ backgroundColor: "white", borderRadius: 16, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: "#0A1628", marginBottom: 2 }}>{c.client}</div>
                  <div style={{ fontSize: 12, color: "#9CA3AF" }}>{c.id} · {c.transactions} transactions</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, color: "#6B7280" }}>Échéance : <strong>{c.echeance}</strong></span>
                  <span style={{ padding: "4px 12px", borderRadius: 12, fontSize: 12, fontWeight: 700, backgroundColor: s.bg, color: s.color }}>{c.status}</span>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14 }}>
                <span style={{ color: "#6B7280" }}>Encours</span>
                <div>
                  <span style={{ fontWeight: 800, color: "#0A1628" }}>{c.encours.toLocaleString()} FCFA</span>
                  <span style={{ color: "#9CA3AF", fontSize: 12 }}> / {c.limite.toLocaleString()} FCFA</span>
                </div>
              </div>
              <div style={{ height: 10, backgroundColor: "#E5E7EB", borderRadius: 6, marginBottom: 6 }}>
                <div style={{ height: "100%", width: `${pct}%`, borderRadius: 6, backgroundColor: pct >= 99 ? "#EF4444" : pct >= 80 ? "#F59E0B" : "#10B981" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#9CA3AF", marginBottom: 16 }}>
                <span>{pct}% utilisé</span>
                <span>Disponible : {(c.limite - c.encours).toLocaleString()} FCFA</span>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button style={{ padding: "8px 16px", backgroundColor: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Transactions</button>
                <button style={{ padding: "8px 16px", backgroundColor: "#DCFCE7", color: "#16A34A", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Enregistrer paiement</button>
                {c.status !== "normal" && (
                  <button style={{ padding: "8px 16px", backgroundColor: "#FFFBEB", color: "#D97706", border: "1px solid #FCD34D", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Envoyer relance</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
