import { useState } from "react";
import Layout from "../../components/Layout";
import { useMedicaments } from "../../hooks/useSupabaseData";

const statusStyle = {
  critique: { bg: "#FEF2F2", color: "#EF4444", label: "Critique" },
  alerte:   { bg: "#FFFBEB", color: "#F59E0B", label: "Alerte" },
  normal:   { bg: "#DCFCE7", color: "#16A34A", label: "Normal" },
};

function getStatut(m) {
  if (!m.stock_minimum || m.stock_minimum === 0) return "normal";
  const ratio = m.stock_actuel / m.stock_minimum;
  if (ratio <= 0.2) return "critique";
  if (ratio <= 0.5) return "alerte";
  return "normal";
}

export default function Stock() {
  const { data: medicaments, loading, error } = useMedicaments();
  const [filter, setFilter] = useState("tous");
  const withStatut = medicaments.map((m) => ({ ...m, statut: getStatut(m) }));
  const filtered = withStatut.filter((p) => filter === "tous" || p.statut === filter);
  const valeurStock = medicaments.reduce((s, m) => s + (m.stock_actuel ?? 0) * (m.prix_unitaire ?? 0), 0);

  return (
    <Layout title="Stock Hospitalier" subtitle="Gestion du stock médicamenteux de l'hôpital">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {["tous", "critique", "alerte", "normal"].map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", textTransform: "capitalize",
              border: filter === f ? "2px solid #10B981" : "1.5px solid #E5E7EB",
              backgroundColor: filter === f ? "#DCFCE7" : "white",
              color: filter === f ? "#16A34A" : "#6B7280",
            }}>{f}</button>
          ))}
        </div>
        <button style={{ padding: "8px 16px", backgroundColor: "#10B981", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + Réceptionner stock
        </button>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total références",  value: loading ? "…" : medicaments.length, color: "#10B981" },
          { label: "Stock critique",    value: loading ? "…" : withStatut.filter(p => p.statut === "critique").length, color: "#EF4444" },
          { label: "Valeur stock",      value: loading ? "…" : `${(valeurStock / 1000000).toFixed(1)}M FCFA`, color: "#3B82F6" },
          { label: "En alerte",         value: loading ? "…" : withStatut.filter(p => p.statut === "alerte").length, color: "#F59E0B" },
        ].map((s) => (
          <div key={s.label} style={{ backgroundColor: "white", padding: "14px 20px", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${s.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ backgroundColor: "white", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: "#F8FAFC" }}>
              {["Produit", "DCI / Forme", "Stock actuel", "Stock min.", "Prix unitaire", "Catégorie", "Statut", "Action"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6B7280", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && [1,2,3,4,5].map((i) => (
              <tr key={i} style={{ borderBottom: "1px solid #F3F4F6", animation: "pulse 1.5s ease-in-out infinite" }}>
                {[180,120,60,60,100,100,70,80].map((w, j) => (
                  <td key={j} style={{ padding: "13px 16px" }}><div style={{ height: 13, width: w, backgroundColor: "#F3F4F6", borderRadius: 6 }} /></td>
                ))}
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Aucun produit trouvé</td></tr>
            )}
            {!loading && filtered.map((p) => {
              const s = statusStyle[p.statut];
              return (
                <tr key={p.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "13px 16px", fontWeight: 600, color: "#0A1628" }}>{p.nom}</td>
                  <td style={{ padding: "13px 16px", color: "#6B7280" }}>{p.dci ?? "—"}{p.forme ? ` · ${p.forme}` : ""}</td>
                  <td style={{ padding: "13px 16px", fontWeight: 700, color: (p.stock_actuel ?? 0) < (p.stock_minimum ?? 0) ? "#EF4444" : "#374151" }}>{p.stock_actuel ?? 0}</td>
                  <td style={{ padding: "13px 16px", color: "#9CA3AF" }}>{p.stock_minimum ?? 0}</td>
                  <td style={{ padding: "13px 16px", color: "#6B7280" }}>{(p.prix_unitaire ?? 0).toLocaleString()} FCFA</td>
                  <td style={{ padding: "13px 16px", color: "#6B7280" }}>{p.categorie ?? "—"}</td>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ padding: "3px 10px", backgroundColor: s.bg, color: s.color, borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{s.label}</span>
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <button style={{ padding: "4px 12px", backgroundColor: "#DCFCE7", color: "#16A34A", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Réapprovisionner</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
