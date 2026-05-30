import { useState } from "react";
import Layout from "../../components/Layout";
import { useMedicaments } from "../../hooks/useSupabaseData";

// Calcul du statut à partir du stock réel
function getStatut(med) {
  if (!med.stock_minimum || med.stock_minimum === 0) return "normal";
  const ratio = med.stock_actuel / med.stock_minimum;
  if (ratio <= 0.2) return "critique";
  if (ratio <= 0.5) return "alerte";
  return "normal";
}

const statusStyle = {
  critique: { bg: "#FEF2F2", color: "#EF4444", label: "Critique" },
  alerte:   { bg: "#FFFBEB", color: "#F59E0B", label: "Alerte"   },
  normal:   { bg: "#DCFCE7", color: "#16A34A", label: "Normal"   },
};

function SkeletonRow() {
  return (
    <tr style={{ borderBottom: "1px solid #F3F4F6", animation: "pulse 1.5s ease-in-out infinite" }}>
      {[80, 160, 90, 60, 100, 120, 80, 70, 100].map((w, i) => (
        <td key={i} style={{ padding: "13px 16px" }}>
          <div style={{ height: 13, width: w, backgroundColor: "#F3F4F6", borderRadius: 6 }} />
        </td>
      ))}
    </tr>
  );
}

export default function Inventaire() {
  const { data: medicaments, loading, error } = useMedicaments();
  const [filter, setFilter] = useState("tous");
  const [search, setSearch] = useState("");

  // Enrichir les médicaments avec le statut calculé
  const enriched = medicaments.map((m) => ({ ...m, statut: getStatut(m) }));

  const filtered = enriched.filter((m) => {
    const matchSearch = m.nom.toLowerCase().includes(search.toLowerCase())
      || (m.categorie || "").toLowerCase().includes(search.toLowerCase())
      || (m.code || "").toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "tous" || m.statut === filter;
    return matchSearch && matchFilter;
  });

  const counts = {
    total:    enriched.length,
    critique: enriched.filter((m) => m.statut === "critique").length,
    alerte:   enriched.filter((m) => m.statut === "alerte").length,
    normal:   enriched.filter((m) => m.statut === "normal").length,
  };

  return (
    <Layout title="Inventaire Produits" subtitle="Gestion du stock et des niveaux de réapprovisionnement">
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>

      {/* ── Barre de filtres ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {["tous", "normal", "alerte", "critique"].map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
              border: filter === f ? "2px solid #3B82F6" : "1.5px solid #E5E7EB",
              backgroundColor: filter === f ? "#EFF6FF" : "white",
              color: filter === f ? "#2563EB" : "#6B7280",
              textTransform: "capitalize",
            }}>
              {f}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "8px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 13, outline: "none", width: 220 }}
          />
          <button style={{ padding: "8px 16px", backgroundColor: "#3B82F6", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            + Nouveau produit
          </button>
        </div>
      </div>

      {/* ── KPI mini ── */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total produits",  value: loading ? "…" : counts.total,    color: "#3B82F6" },
          { label: "Stock critique",  value: loading ? "…" : counts.critique,  color: "#EF4444" },
          { label: "En alerte",       value: loading ? "…" : counts.alerte,    color: "#F59E0B" },
          { label: "Stock normal",    value: loading ? "…" : counts.normal,    color: "#10B981" },
        ].map((s) => (
          <div key={s.label} style={{ backgroundColor: "white", padding: "14px 20px", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${s.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Erreur ── */}
      {error && (
        <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "14px 18px", marginBottom: 20, fontSize: 13, color: "#DC2626" }}>
          Erreur de connexion Supabase : {error.message}
        </div>
      )}

      {/* ── Tableau ── */}
      <div style={{ backgroundColor: "white", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: "#F8FAFC" }}>
              {["Code", "Produit", "Catégorie", "Stock", "Seuil min", "Prix unitaire", "Forme", "Statut", "Actions"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6B7280", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && [1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}

            {!loading && !error && filtered.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: "40px", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
                  {search || filter !== "tous" ? "Aucun médicament correspond aux filtres" : "Aucun médicament dans la base de données"}
                </td>
              </tr>
            )}

            {!loading && filtered.map((m) => {
              const s = statusStyle[m.statut];
              const stockColor = m.statut === "critique" ? "#EF4444" : m.statut === "alerte" ? "#F59E0B" : "#374151";
              return (
                <tr key={m.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "13px 16px", color: "#9CA3AF", fontSize: 12, fontFamily: "monospace" }}>{m.code || "—"}</td>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ fontWeight: 600, color: "#0A1628" }}>{m.nom}</div>
                    {m.dci && <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>{m.dci}</div>}
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ padding: "3px 10px", backgroundColor: "#EFF6FF", color: "#2563EB", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>
                      {m.categorie || "—"}
                    </span>
                  </td>
                  <td style={{ padding: "13px 16px", fontWeight: 800, color: stockColor, fontSize: 15 }}>
                    {m.stock_actuel ?? "—"}
                  </td>
                  <td style={{ padding: "13px 16px", color: "#6B7280", fontSize: 12 }}>
                    {m.stock_minimum ?? "—"}
                  </td>
                  <td style={{ padding: "13px 16px", color: "#374151" }}>
                    {m.prix_unitaire != null ? `${m.prix_unitaire.toLocaleString()} FCFA` : "—"}
                  </td>
                  <td style={{ padding: "13px 16px", color: "#6B7280" }}>
                    {m.forme || "—"}
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ padding: "3px 10px", backgroundColor: s.bg, color: s.color, borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
                      {s.label}
                    </span>
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button style={{ padding: "4px 10px", backgroundColor: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                        Éditer
                      </button>
                      <button style={{ padding: "4px 10px", backgroundColor: "#DCFCE7", color: "#16A34A", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                        Commander
                      </button>
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
