import { useState } from "react";
import Layout from "../components/Layout";
import { products } from "../data/staticData";

const statusStyle = {
  critique: { bg: "#FEF2F2", color: "#EF4444", label: "Critique" },
  alerte: { bg: "#FFFBEB", color: "#F59E0B", label: "Alerte" },
  normal: { bg: "#DCFCE7", color: "#16A34A", label: "Normal" },
};

export default function Inventaire() {
  const [filter, setFilter] = useState("tous");
  const [search, setSearch] = useState("");

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.categorie.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "tous" || p.status === filter;
    return matchSearch && matchFilter;
  });

  return (
    <Layout title="Inventaire Produits">
      {/* Filters */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {["tous", "normal", "alerte", "critique"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                border: filter === f ? "2px solid #3B82F6" : "1.5px solid #E5E7EB",
                backgroundColor: filter === f ? "#EFF6FF" : "white",
                color: filter === f ? "#2563EB" : "#6B7280",
                textTransform: "capitalize"
              }}
            >
              {f}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            placeholder="🔍 Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "8px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 13, outline: "none", width: 220 }}
          />
          <button style={{ padding: "8px 16px", backgroundColor: "#3B82F6", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            + Nouveau produit
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total produits", value: products.length, color: "#3B82F6" },
          { label: "En rupture critique", value: products.filter(p => p.status === "critique").length, color: "#EF4444" },
          { label: "En alerte", value: products.filter(p => p.status === "alerte").length, color: "#F59E0B" },
          { label: "Stock normal", value: products.filter(p => p.status === "normal").length, color: "#10B981" },
        ].map((s) => (
          <div key={s.label} style={{ backgroundColor: "white", padding: "14px 20px", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${s.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ backgroundColor: "white", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: "#F8FAFC" }}>
              {["ID", "Produit", "Catégorie", "Stock", "Prix unitaire", "Fournisseur", "Expiration", "Statut", "Actions"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6B7280", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const s = statusStyle[p.status];
              return (
                <tr key={p.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "13px 16px", color: "#9CA3AF", fontSize: 12 }}>{p.id}</td>
                  <td style={{ padding: "13px 16px", fontWeight: 600, color: "#0A1628" }}>{p.name}</td>
                  <td style={{ padding: "13px 16px", color: "#6B7280" }}>
                    <span style={{ padding: "3px 10px", backgroundColor: "#EFF6FF", color: "#2563EB", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{p.categorie}</span>
                  </td>
                  <td style={{ padding: "13px 16px", fontWeight: 700, color: p.stock < 10 ? "#EF4444" : "#374151" }}>{p.stock}</td>
                  <td style={{ padding: "13px 16px", color: "#374151" }}>{p.prix.toLocaleString()} FCFA</td>
                  <td style={{ padding: "13px 16px", color: "#6B7280" }}>{p.fournisseur}</td>
                  <td style={{ padding: "13px 16px", color: "#6B7280", fontSize: 12 }}>{p.expiry}</td>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ padding: "3px 10px", backgroundColor: s.bg, color: s.color, borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{s.label}</span>
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button style={{ padding: "4px 10px", backgroundColor: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Éditer</button>
                      <button style={{ padding: "4px 10px", backgroundColor: "#DCFCE7", color: "#16A34A", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Commander</button>
                    </div>
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
