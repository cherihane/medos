import { useState } from "react";
import Layout from "../components/Layout";
import { useFournisseurs } from "../hooks/useSupabaseData";

export default function Fournisseurs() {
  const { data: fournisseurs, loading } = useFournisseurs();
  const [search, setSearch] = useState("");

  const filtered = fournisseurs.filter((f) => {
    const q = search.toLowerCase();
    return (
      f.nom.toLowerCase().includes(q) ||
      (f.pays ?? "").toLowerCase().includes(q) ||
      (f.contact_nom ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <Layout title="Fournisseurs">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input
            placeholder="Rechercher par nom, pays, contact..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "8px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 13, outline: "none", width: 280 }}
          />
          {!loading && (
            <span style={{ fontSize: 13, color: "#9CA3AF" }}>
              {filtered.length} fournisseur{filtered.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "48px", textAlign: "center", color: "#9CA3AF", fontSize: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          Chargement des fournisseurs…
        </div>
      ) : filtered.length === 0 && fournisseurs.length === 0 ? (
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "64px 24px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ marginBottom: 16, color: "#D1D5DB", display: "flex", justifyContent: "center" }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21"/><path d="M9 10h.01M12 10h.01M15 10h.01"/></svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
            Aucun fournisseur enregistré
          </div>
          <div style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 20 }}>
            Ajoutez vos fournisseurs pour passer des commandes et gerer vos approvisionnements.
          </div>
          <button style={{ padding: "10px 24px", backgroundColor: "#3B82F6", color: "white", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            + Ajouter un fournisseur
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "48px", textAlign: "center", color: "#9CA3AF", fontSize: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          Aucun fournisseur ne correspond a la recherche.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          {filtered.map((f) => (
            <div
              key={f.id}
              style={{ backgroundColor: "white", borderRadius: 16, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{
                    width: 50, height: 50, borderRadius: 14,
                    backgroundColor: f.actif ? "#EFF6FF" : "#F3F4F6",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 20, fontWeight: 800, color: f.actif ? "#1D4ED8" : "#9CA3AF",
                  }}>
                    {f.nom.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "#0A1628" }}>{f.nom}</div>
                    <div style={{ fontSize: 12, color: "#9CA3AF" }}>{f.pays ?? "—"}</div>
                  </div>
                </div>
                <span style={{
                  padding: "4px 12px", borderRadius: 12, fontSize: 11, fontWeight: 700,
                  backgroundColor: f.actif ? "#DCFCE7" : "#F3F4F6",
                  color: f.actif ? "#16A34A" : "#9CA3AF",
                }}>
                  {f.actif ? "actif" : "inactif"}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                {[
                  { label: "Delai de livraison", value: f.delai_livraison ?? "—" },
                  { label: "Conditions paiement", value: f.conditions_paiement ?? "—" },
                ].map((item) => (
                  <div key={item.label} style={{ padding: "10px 12px", backgroundColor: "#F8FAFC", borderRadius: 10 }}>
                    <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#0A1628" }}>{item.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ padding: "10px 12px", backgroundColor: "#F8FAFC", borderRadius: 10, marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 2 }}>Contact</div>
                {f.contact_nom && (
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0A1628", marginBottom: 2 }}>{f.contact_nom}</div>
                )}
                {f.email && (
                  <div style={{ fontSize: 13, color: "#3B82F6" }}>{f.email}</div>
                )}
                {f.telephone && (
                  <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{f.telephone}</div>
                )}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ flex: 1, padding: "9px", backgroundColor: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  Passer commande
                </button>
                <button style={{ flex: 1, padding: "9px", backgroundColor: "#F8FAFC", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  Voir details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
