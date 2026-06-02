import { useState, useMemo } from "react";
import Layout from "../components/Layout";
import { useMedicaments } from "../hooks/useSupabaseData";
import { useIsMobile } from "../hooks/useWindowSize";

export default function Caisse() {
  const isMobile = useIsMobile();

  const { data: medicaments, loading } = useMedicaments();
  const [cart, setCart]       = useState([]);
  const [search, setSearch]   = useState("");
  const [paiement, setPaiement] = useState("especes");

  // Acces rapide : 8 premiers medicaments en stock tries par nom
  const accesRapide = useMemo(
    () => medicaments.filter((m) => m.stock_actuel > 0).slice(0, 8),
    [medicaments]
  );

  // Resultats de recherche
  const resultats = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return medicaments.filter(
      (m) =>
        m.stock_actuel > 0 &&
        (m.nom.toLowerCase().includes(q) ||
          (m.dci ?? "").toLowerCase().includes(q) ||
          (m.categorie ?? "").toLowerCase().includes(q))
    );
  }, [medicaments, search]);

  const addToCart = (med) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === med.id);
      if (existing) {
        if (existing.qty >= med.stock_actuel) return prev;
        return prev.map((i) => i.id === med.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...med, qty: 1 }];
    });
  };

  const updateQty = (id, qty) => {
    if (qty <= 0) setCart((prev) => prev.filter((i) => i.id !== id));
    else setCart((prev) => prev.map((i) => i.id === id ? { ...i, qty } : i));
  };

  const total = cart.reduce((sum, i) => sum + Number(i.prix_unitaire ?? 0) * i.qty, 0);

  const validerVente = () => {
    if (cart.length === 0) return;
    alert(`Vente validee !\nTotal : ${total.toLocaleString("fr-FR")} FCFA\nPaiement : ${paiement}\n\nNote : integrer ici la mutation insertVentes() pour persister en base.`);
    setCart([]);
    setSearch("");
  };

  return (
    <Layout title="Caisse — Point de Vente">
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 360px", gap: 20, height: "calc(100vh - 140px)" }}>
        {/* Gauche : catalogue */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Recherche */}
          <div style={{ backgroundColor: "white", borderRadius: 14, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <input
              placeholder="Rechercher un médicament par nom, DCI, catégorie..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }}
            />
          </div>

          {/* Acces rapide */}
          {!search && (
            <div style={{ backgroundColor: "white", borderRadius: 14, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#0A1628" }}>Acces rapide</h3>
              {loading ? (
                <div style={{ color: "#9CA3AF", fontSize: 13 }}>Chargement…</div>
              ) : accesRapide.length === 0 ? (
                <div style={{ color: "#9CA3AF", fontSize: 13 }}>Aucun médicament en stock.</div>
              ) : (
                <div className="kpi-grid kpi-grid-4" style={{ gap: 10 }}>
                  {accesRapide.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => addToCart(m)}
                      style={{
                        padding: "12px 8px", backgroundColor: "#F0F4FB",
                        border: "1.5px solid #E5E7EB", borderRadius: 10,
                        cursor: "pointer", textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#0A1628", marginBottom: 4, lineHeight: 1.3 }}>
                        {m.nom}
                      </div>
                      {m.dosage && (
                        <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 4 }}>{m.dosage}</div>
                      )}
                      <div style={{ fontSize: 12, color: "#3B82F6", fontWeight: 600 }}>
                        {m.prix_unitaire != null ? `${Number(m.prix_unitaire).toLocaleString("fr-FR")} FCFA` : "—"}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Resultats de recherche */}
          {search && (
            <div style={{ backgroundColor: "white", borderRadius: 14, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, overflowY: "auto" }}>
              <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#0A1628" }}>
                Resultats ({resultats.length})
              </h3>
              {resultats.length === 0 ? (
                <div style={{ color: "#9CA3AF", fontSize: 13, padding: "16px 0" }}>
                  Aucun médicament en stock ne correspond à "{search}".
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {resultats.map((m) => (
                    <div
                      key={m.id}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", backgroundColor: "#F8FAFC", borderRadius: 10 }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "#0A1628" }}>{m.nom}</div>
                        <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                          {m.categorie ?? "—"}{m.dosage ? ` · ${m.dosage}` : ""} · Stock : {m.stock_actuel}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontWeight: 700, color: "#374151" }}>
                          {m.prix_unitaire != null ? `${Number(m.prix_unitaire).toLocaleString("fr-FR")} FCFA` : "—"}
                        </span>
                        <button
                          onClick={() => addToCart(m)}
                          style={{ padding: "6px 14px", backgroundColor: "#3B82F6", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                        >
                          Ajouter
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Droite : panier */}
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Panier</h3>

          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            {cart.length === 0 ? (
              <div style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, padding: 40 }}>
                Aucun article dans le panier.
                <br />
                Cliquez sur un produit pour l'ajouter.
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.id} style={{ padding: "10px 14px", backgroundColor: "#F8FAFC", borderRadius: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#0A1628", marginBottom: 6 }}>{item.nom}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        onClick={() => updateQty(item.id, item.qty - 1)}
                        style={{ width: 26, height: 26, borderRadius: "50%", border: "1px solid #E5E7EB", background: "white", cursor: "pointer", fontSize: 14, fontWeight: 700, lineHeight: 1 }}
                      >
                        -
                      </button>
                      <span style={{ fontSize: 14, fontWeight: 700, width: 24, textAlign: "center" }}>{item.qty}</span>
                      <button
                        onClick={() => updateQty(item.id, item.qty + 1)}
                        disabled={item.qty >= item.stock_actuel}
                        style={{ width: 26, height: 26, borderRadius: "50%", border: "1px solid #E5E7EB", background: "white", cursor: item.qty >= item.stock_actuel ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 700, lineHeight: 1, opacity: item.qty >= item.stock_actuel ? 0.4 : 1 }}
                      >
                        +
                      </button>
                    </div>
                    <span style={{ fontWeight: 700, color: "#0A1628" }}>
                      {(Number(item.prix_unitaire ?? 0) * item.qty).toLocaleString("fr-FR")} FCFA
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Resume */}
          <div style={{ borderTop: "1px solid #E5E7EB", paddingTop: 16, marginTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13, color: "#6B7280" }}>
              <span>Sous-total ({cart.reduce((s, i) => s + i.qty, 0)} articles)</span>
              <span>{total.toLocaleString("fr-FR")} FCFA</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800, color: "#0A1628", marginBottom: 16 }}>
              <span>TOTAL</span>
              <span>{total.toLocaleString("fr-FR")} FCFA</span>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                Mode de paiement
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                {[
                  { key: "especes", label: "Especes" },
                  { key: "mobile",  label: "Mobile" },
                  { key: "credit",  label: "Credit" },
                ].map((mode) => (
                  <button
                    key={mode.key}
                    onClick={() => setPaiement(mode.key)}
                    style={{
                      flex: 1, padding: "8px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer",
                      border: paiement === mode.key ? "2px solid #3B82F6" : "1.5px solid #E5E7EB",
                      backgroundColor: paiement === mode.key ? "#EFF6FF" : "white",
                      color: paiement === mode.key ? "#2563EB" : "#6B7280",
                    }}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              disabled={cart.length === 0}
              onClick={validerVente}
              style={{
                width: "100%", padding: "14px",
                backgroundColor: cart.length === 0 ? "#E5E7EB" : "#10B981",
                color: cart.length === 0 ? "#9CA3AF" : "white",
                border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700,
                cursor: cart.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              Valider la vente
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
