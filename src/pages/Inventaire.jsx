import { useState } from "react";
import Layout from "../components/Layout";
import { useMedicaments } from "../hooks/useSupabaseData";

function statutMed(m) {
  if (m.stock_actuel <= 0) return "rupture";
  if (m.stock_actuel < m.stock_minimum) return "critique";
  if (m.stock_actuel < m.stock_minimum * 1.5) return "alerte";
  return "normal";
}

const STATUT_STYLE = {
  rupture:  { bg: "#FEE2E2", color: "#DC2626", label: "Rupture" },
  critique: { bg: "#FEF2F2", color: "#EF4444", label: "Critique" },
  alerte:   { bg: "#FFFBEB", color: "#F59E0B", label: "Alerte" },
  normal:   { bg: "#DCFCE7", color: "#16A34A", label: "Normal" },
};

function fmtExpiry(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Inventaire() {
  const { data: medicaments, loading } = useMedicaments();
  const [filter, setFilter]   = useState("tous");
  const [search, setSearch]   = useState("");

  const enriched = medicaments.map((m) => ({ ...m, statut: statutMed(m) }));

  const filtered = enriched.filter((m) => {
    const q = search.toLowerCase();
    const matchSearch =
      m.nom.toLowerCase().includes(q) ||
      (m.categorie ?? "").toLowerCase().includes(q) ||
      (m.dci ?? "").toLowerCase().includes(q) ||
      (m.code ?? "").toLowerCase().includes(q);
    const matchFilter =
      filter === "tous" ||
      (filter === "critique" && (m.statut === "critique" || m.statut === "rupture")) ||
      m.statut === filter;
    return matchSearch && matchFilter;
  });

  const stats = [
    { label: "Total produits",      value: enriched.length,                                                color: "#3B82F6" },
    { label: "Rupture / Critique",  value: enriched.filter((m) => m.statut === "rupture" || m.statut === "critique").length, color: "#EF4444" },
    { label: "En alerte",           value: enriched.filter((m) => m.statut === "alerte").length,           color: "#F59E0B" },
    { label: "Stock normal",        value: enriched.filter((m) => m.statut === "normal").length,           color: "#10B981" },
  ];

  return (
    <Layout title="Inventaire Produits">
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
                textTransform: "capitalize",
              }}
            >
              {f}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            placeholder="Rechercher par nom, catégorie, DCI..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "8px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 13, outline: "none", width: 280 }}
          />
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ backgroundColor: "white", padding: "14px 20px", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${s.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{loading ? "…" : s.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ backgroundColor: "white", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "48px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>
            Chargement de l'inventaire…
          </div>
        ) : filtered.length === 0 && enriched.length === 0 ? (
          <div style={{ padding: "64px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16, color: "#D1D5DB" }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 12h8M12 8v8"/></svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
              Aucun médicament enregistre
            </div>
            <div style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 20 }}>
              L'inventaire est vide. Ajoutez votre premier produit pour commencer.
            </div>
            <button style={{ padding: "10px 24px", backgroundColor: "#3B82F6", color: "white", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              + Ajouter un produit
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>
            Aucun produit ne correspond aux filtres selectionnes.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: "#F8FAFC" }}>
                {["Code", "Produit", "Categorie", "Forme", "Stock actuel", "Stock min.", "Prix unitaire", "Statut"].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6B7280", borderBottom: "1px solid #E5E7EB" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const s = STATUT_STYLE[m.statut];
                return (
                  <tr key={m.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                    <td style={{ padding: "13px 16px", color: "#9CA3AF", fontSize: 12, fontFamily: "monospace" }}>
                      {m.code ?? "—"}
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <div style={{ fontWeight: 600, color: "#0A1628" }}>{m.nom}</div>
                      {m.dci && <div style={{ fontSize: 11, color: "#9CA3AF" }}>{m.dci}</div>}
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <span style={{ padding: "3px 10px", backgroundColor: "#EFF6FF", color: "#2563EB", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>
                        {m.categorie ?? "—"}
                      </span>
                    </td>
                    <td style={{ padding: "13px 16px", color: "#6B7280", fontSize: 12 }}>
                      {m.forme ?? "—"}{m.dosage ? ` ${m.dosage}` : ""}
                    </td>
                    <td style={{ padding: "13px 16px", fontWeight: 700, color: m.stock_actuel < m.stock_minimum ? "#EF4444" : "#374151" }}>
                      {m.stock_actuel ?? 0}
                    </td>
                    <td style={{ padding: "13px 16px", color: "#9CA3AF" }}>
                      {m.stock_minimum ?? 0}
                    </td>
                    <td style={{ padding: "13px 16px", color: "#374151" }}>
                      {m.prix_unitaire != null ? `${Number(m.prix_unitaire).toLocaleString("fr-FR")} FCFA` : "—"}
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <span style={{ padding: "3px 10px", backgroundColor: s.bg, color: s.color, borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
                        {s.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}
