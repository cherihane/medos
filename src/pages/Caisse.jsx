import { useState } from "react";
import Layout from "../components/Layout";
import { cashierFavorites, products } from "../data/staticData";

export default function Caisse() {
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [paiement, setPaiement] = useState("especes");

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) return prev.map((i) => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const updateQty = (id, qty) => {
    if (qty <= 0) setCart((prev) => prev.filter((i) => i.id !== id));
    else setCart((prev) => prev.map((i) => i.id === id ? { ...i, qty } : i));
  };

  const total = cart.reduce((sum, i) => sum + i.prix * i.qty, 0);

  return (
    <Layout title="Caisse — Point de Vente">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20, height: "calc(100vh - 140px)" }}>
        {/* Left: Products */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Search */}
          <div style={{ backgroundColor: "white", borderRadius: 14, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <input
              placeholder="🔍 Rechercher un médicament..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }}
            />
          </div>

          {/* Favorites */}
          <div style={{ backgroundColor: "white", borderRadius: 14, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#0A1628" }}>⭐ Favoris</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {cashierFavorites.map((fav) => (
                <button
                  key={fav.id}
                  onClick={() => addToCart(fav)}
                  style={{
                    padding: "12px 8px", backgroundColor: "#F0F4FB", border: "1.5px solid #E5E7EB",
                    borderRadius: 10, cursor: "pointer", textAlign: "center", transition: "all 0.15s"
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#0A1628", marginBottom: 4 }}>{fav.name}</div>
                  <div style={{ fontSize: 12, color: "#3B82F6", fontWeight: 600 }}>{fav.prix.toLocaleString()} FCFA</div>
                </button>
              ))}
            </div>
          </div>

          {/* All products search results */}
          {search && (
            <div style={{ backgroundColor: "white", borderRadius: 14, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, overflow: "auto" }}>
              <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#0A1628" }}>Résultats de recherche</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())).map((p) => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", backgroundColor: "#F8FAFC", borderRadius: 10 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#0A1628" }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: "#9CA3AF" }}>{p.categorie} · Stock: {p.stock}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontWeight: 700, color: "#374151" }}>{p.prix.toLocaleString()} FCFA</span>
                      <button onClick={() => addToCart(p)} style={{ padding: "6px 14px", backgroundColor: "#3B82F6", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                        Ajouter
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Cart */}
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>🧾 Panier</h3>

          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            {cart.length === 0 && (
              <div style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, padding: 40 }}>
                Aucun article dans le panier.<br/>Cliquez sur un produit pour l'ajouter.
              </div>
            )}
            {cart.map((item) => (
              <div key={item.id} style={{ padding: "10px 14px", backgroundColor: "#F8FAFC", borderRadius: 10 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#0A1628", marginBottom: 6 }}>{item.name}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button onClick={() => updateQty(item.id, item.qty - 1)} style={{ width: 26, height: 26, borderRadius: "50%", border: "1px solid #E5E7EB", background: "white", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>−</button>
                    <span style={{ fontSize: 14, fontWeight: 700, width: 24, textAlign: "center" }}>{item.qty}</span>
                    <button onClick={() => updateQty(item.id, item.qty + 1)} style={{ width: 26, height: 26, borderRadius: "50%", border: "1px solid #E5E7EB", background: "white", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>+</button>
                  </div>
                  <span style={{ fontWeight: 700, color: "#0A1628" }}>{(item.prix * item.qty).toLocaleString()} FCFA</span>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div style={{ borderTop: "1px solid #E5E7EB", paddingTop: 16, marginTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13, color: "#6B7280" }}>
              <span>Sous-total ({cart.length} articles)</span>
              <span>{total.toLocaleString()} FCFA</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13, color: "#6B7280" }}>
              <span>TVA (0%)</span><span>0 FCFA</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800, color: "#0A1628", marginBottom: 16 }}>
              <span>TOTAL</span>
              <span>{total.toLocaleString()} FCFA</span>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Mode de paiement</label>
              <div style={{ display: "flex", gap: 8 }}>
                {["especes", "mobile", "credit"].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setPaiement(mode)}
                    style={{
                      flex: 1, padding: "8px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer",
                      border: paiement === mode ? "2px solid #3B82F6" : "1.5px solid #E5E7EB",
                      backgroundColor: paiement === mode ? "#EFF6FF" : "white",
                      color: paiement === mode ? "#2563EB" : "#6B7280"
                    }}
                  >
                    {mode === "especes" ? "💵 Espèces" : mode === "mobile" ? "📱 Mobile" : "💳 Crédit"}
                  </button>
                ))}
              </div>
            </div>

            <button
              disabled={cart.length === 0}
              onClick={() => { alert(`Vente validée !\nTotal : ${total.toLocaleString()} FCFA\nPaiement : ${paiement}`); setCart([]); }}
              style={{
                width: "100%", padding: "14px", backgroundColor: cart.length === 0 ? "#E5E7EB" : "#10B981",
                color: cart.length === 0 ? "#9CA3AF" : "white", border: "none", borderRadius: 10,
                fontSize: 15, fontWeight: 700, cursor: cart.length === 0 ? "not-allowed" : "pointer"
              }}
            >
              ✓ Valider la vente
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
