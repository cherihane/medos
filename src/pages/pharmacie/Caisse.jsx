import { useState } from "react";
import Layout from "../../components/Layout";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useMedicaments } from "../../hooks/useSupabaseData";
import { insertVentes, decrementStock } from "../../hooks/useMutations";

export default function Caisse() {
  const { data: medicaments, loading } = useMedicaments();
  const { toasts, success, error: toastError } = useToast();
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [paiement, setPaiement] = useState("especes");
  const [saving, setSaving] = useState(false);

  const addToCart = (med) => {
    if ((med.stock_actuel ?? 0) === 0) return toastError(`${med.nom} est en rupture de stock`);
    setCart((prev) => {
      const ex = prev.find((i) => i.id === med.id);
      if (ex) {
        if (ex.qty >= (med.stock_actuel ?? 0)) return prev; // don't exceed stock
        return prev.map((i) => i.id === med.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...med, qty: 1 }];
    });
  };

  const updateQty = (id, qty) => {
    if (qty <= 0) setCart((prev) => prev.filter((i) => i.id !== id));
    else setCart((prev) => prev.map((i) => i.id === id ? { ...i, qty } : i));
  };

  const total = cart.reduce((s, i) => s + (i.prix_unitaire ?? 0) * i.qty, 0);
  const favoris = medicaments.slice(0, 8);
  const resultats = search ? medicaments.filter((m) => m.nom.toLowerCase().includes(search.toLowerCase())) : [];

  const handleEncaisser = async () => {
    if (cart.length === 0) return;
    setSaving(true);
    try {
      // Insert one vente row per item
      const rows = cart.map((item) => ({
        medicament_id: item.id,
        quantite: item.qty,
        prix_unitaire: item.prix_unitaire ?? 0,
        montant_total: (item.prix_unitaire ?? 0) * item.qty,
        mode_paiement: paiement,
        date_vente: new Date().toISOString(),
      }));
      await insertVentes(rows);
      // Decrement stock for each item
      await Promise.all(cart.map((item) => decrementStock(item.id, item.qty)));
      success(`Vente enregistrée — ${total.toLocaleString()} FCFA`);
      setCart([]);
    } catch (e) {
      toastError("Erreur lors de l'enregistrement : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout title="Caisse — Point de Vente" subtitle="Enregistrement des ventes et dispensation">
      <Toast toasts={toasts} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20, height: "calc(100vh - 160px)" }}>

        {/* ── Gauche ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ backgroundColor: "white", borderRadius: 14, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <input
              placeholder="Rechercher un médicament…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ backgroundColor: "white", borderRadius: 14, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#0A1628" }}>
              Produits disponibles {!loading && `(${medicaments.length})`}
            </h3>
            {loading ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
                {[1,2,3,4,5,6,7,8].map((i) => (
                  <div key={i} style={{ height: 64, backgroundColor: "#F3F4F6", borderRadius: 10, animation: "pulse 1.5s ease-in-out infinite" }} />
                ))}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                {favoris.map((m) => (
                  <button key={m.id} onClick={() => addToCart(m)} style={{
                    padding: "12px 8px", backgroundColor: (m.stock_actuel ?? 0) === 0 ? "#F3F4F6" : "#F0F4FB",
                    border: "1.5px solid #E5E7EB", borderRadius: 10, cursor: (m.stock_actuel ?? 0) === 0 ? "not-allowed" : "pointer", textAlign: "center",
                    opacity: (m.stock_actuel ?? 0) === 0 ? 0.5 : 1,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#0A1628", marginBottom: 4 }}>{m.nom}</div>
                    <div style={{ fontSize: 12, color: "#3B82F6", fontWeight: 600 }}>{(m.prix_unitaire ?? 0).toLocaleString()} FCFA</div>
                    <div style={{ fontSize: 10, color: "#9CA3AF" }}>Stock: {m.stock_actuel ?? 0}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {search && resultats.length > 0 && (
            <div style={{ backgroundColor: "white", borderRadius: 14, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, overflow: "auto" }}>
              <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#0A1628" }}>Résultats ({resultats.length})</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {resultats.map((m) => (
                  <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", backgroundColor: "#F8FAFC", borderRadius: 10 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#0A1628" }}>{m.nom}</div>
                      <div style={{ fontSize: 11, color: "#9CA3AF" }}>{m.categorie} · Stock : {m.stock_actuel ?? 0}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontWeight: 700, color: "#374151" }}>{(m.prix_unitaire ?? 0).toLocaleString()} FCFA</span>
                      <button onClick={() => addToCart(m)} style={{ padding: "6px 14px", backgroundColor: "#3B82F6", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                        Ajouter
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Droite : panier ── */}
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Panier</h3>

          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            {cart.length === 0 && (
              <div style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, padding: 40 }}>
                Aucun article.<br />Cliquez sur un produit pour l'ajouter.
              </div>
            )}
            {cart.map((item) => (
              <div key={item.id} style={{ padding: "10px 14px", backgroundColor: "#F8FAFC", borderRadius: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#0A1628" }}>{item.nom}</div>
                  <button onClick={() => updateQty(item.id, 0)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: 14, padding: 0 }}>×</button>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button onClick={() => updateQty(item.id, item.qty - 1)} style={{ width: 26, height: 26, borderRadius: "50%", border: "1px solid #E5E7EB", background: "white", cursor: "pointer", fontWeight: 700 }}>-</button>
                    <span style={{ fontSize: 14, fontWeight: 700, width: 24, textAlign: "center" }}>{item.qty}</span>
                    <button onClick={() => updateQty(item.id, item.qty + 1)} style={{ width: 26, height: 26, borderRadius: "50%", border: "1px solid #E5E7EB", background: "white", cursor: "pointer", fontWeight: 700 }}>+</button>
                  </div>
                  <span style={{ fontWeight: 700, color: "#0A1628" }}>{((item.prix_unitaire ?? 0) * item.qty).toLocaleString()} FCFA</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: "1px solid #E5E7EB", paddingTop: 16, marginTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13, color: "#6B7280" }}>
              <span>Sous-total ({cart.reduce((s, i) => s + i.qty, 0)} articles)</span>
              <span>{total.toLocaleString()} FCFA</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800, color: "#0A1628", marginBottom: 16 }}>
              <span>TOTAL</span>
              <span>{total.toLocaleString()} FCFA</span>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Mode de paiement</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[{ key: "especes", label: "Espèces" }, { key: "mobile_money", label: "Mobile" }, { key: "credit", label: "Crédit" }].map((mode) => (
                  <button key={mode.key} onClick={() => setPaiement(mode.key)} style={{
                    flex: 1, padding: "8px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer",
                    border: paiement === mode.key ? "2px solid #3B82F6" : "1.5px solid #E5E7EB",
                    backgroundColor: paiement === mode.key ? "#EFF6FF" : "white",
                    color: paiement === mode.key ? "#2563EB" : "#6B7280",
                  }}>{mode.label}</button>
                ))}
              </div>
            </div>

            <button
              disabled={cart.length === 0 || saving}
              onClick={handleEncaisser}
              style={{
                width: "100%", padding: "14px",
                backgroundColor: cart.length === 0 || saving ? "#E5E7EB" : "#10B981",
                color: cart.length === 0 || saving ? "#9CA3AF" : "white",
                border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700,
                cursor: cart.length === 0 || saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Enregistrement…" : "Valider la vente"}
            </button>

            {cart.length > 0 && !saving && (
              <button
                onClick={() => setCart([])}
                style={{ width: "100%", marginTop: 8, padding: "10px", backgroundColor: "white", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 13, color: "#6B7280", cursor: "pointer" }}>
                Vider le panier
              </button>
            )}
          </div>
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </Layout>
  );
}
