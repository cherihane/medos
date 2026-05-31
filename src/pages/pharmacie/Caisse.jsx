import { useState, useEffect, useCallback } from "react";
import Layout from "../../components/Layout";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useMedicaments } from "../../hooks/useSupabaseData";
import { insertVentes, decrementStock, insertJournalCaisse, fetchJournalJour } from "../../hooks/useMutations";
import { useAuth } from "../../context/AuthContext";

// ─── helpers ─────────────────────────────────────────────────────────────────
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Onglet Caisse ────────────────────────────────────────────────────────────
function OngletCaisse({ onSaleComplete }) {
  const { auth } = useAuth();
  const { data: medicaments, loading } = useMedicaments();
  const { toasts, success, error: toastError } = useToast();
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [paiement, setPaiement] = useState("especes");
  const [montantRecu, setMontantRecu] = useState("");
  const [saving, setSaving] = useState(false);

  const total = cart.reduce((s, i) => s + (i.prix_unitaire ?? 0) * i.qty, 0);
  const monnaie = paiement === "especes" ? Math.max(0, Number(montantRecu) - total) : 0;
  const recuInsuffisant = paiement === "especes" && montantRecu !== "" && Number(montantRecu) < total;

  const addToCart = (med) => {
    if ((med.stock_actuel ?? 0) === 0) return toastError(`${med.nom} est en rupture de stock`);
    setCart((prev) => {
      const ex = prev.find((i) => i.id === med.id);
      if (ex) {
        if (ex.qty >= (med.stock_actuel ?? 0)) return prev;
        return prev.map((i) => i.id === med.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...med, qty: 1 }];
    });
  };

  const updateQty = (id, qty) => {
    if (qty <= 0) setCart((prev) => prev.filter((i) => i.id !== id));
    else setCart((prev) => prev.map((i) => i.id === id ? { ...i, qty } : i));
  };

  const favoris = medicaments.slice(0, 8);
  const resultats = search
    ? medicaments.filter((m) => m.nom.toLowerCase().includes(search.toLowerCase()))
    : [];

  const handleEncaisser = async () => {
    if (cart.length === 0) return;
    if (recuInsuffisant) return toastError("Montant reçu insuffisant");
    setSaving(true);
    try {
      const etablissement_id = auth?.etablissement_id ?? null;
      const caissier_id = auth?.user?.id ?? null;
      const caissier_email = auth?.user?.email ?? null;

      // 1. Insert ventes
      const rows = cart.map((item) => ({
        medicament_id: item.id,
        quantite: item.qty,
        prix_unitaire: item.prix_unitaire ?? 0,
        montant_total: (item.prix_unitaire ?? 0) * item.qty,
        mode_paiement: paiement,
        date_vente: new Date().toISOString(),
        ...(etablissement_id ? { etablissement_id } : {}),
        ...(caissier_id ? { vendu_par: caissier_id } : {}),
      }));
      await insertVentes(rows);

      // 2. Décrémenter le stock
      await Promise.all(cart.map((item) => decrementStock(item.id, item.qty)));

      // 3. Journal de caisse
      const montantRecuNum = paiement === "especes" && montantRecu !== "" ? Number(montantRecu) : null;
      const monnaieRendue = montantRecuNum != null ? Math.max(0, montantRecuNum - total) : null;
      await insertJournalCaisse({
        etablissement_id,
        caissier_id,
        caissier_email,
        montant_total: total,
        montant_recu: montantRecuNum,
        monnaie_rendue: monnaieRendue,
        mode_paiement: paiement,
        nb_articles: cart.reduce((s, i) => s + i.qty, 0),
        detail: cart.map((i) => ({
          nom: i.nom,
          qty: i.qty,
          prix_unitaire: i.prix_unitaire ?? 0,
          sous_total: (i.prix_unitaire ?? 0) * i.qty,
        })),
      });

      success(`Vente enregistrée — ${total.toLocaleString()} FCFA`);
      setCart([]);
      setMontantRecu("");
      onSaleComplete?.();
    } catch (e) {
      toastError("Erreur : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Toast toasts={toasts} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20, height: "calc(100vh - 220px)" }}>
        {/* Gauche */}
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
                    padding: "12px 8px",
                    backgroundColor: (m.stock_actuel ?? 0) === 0 ? "#F3F4F6" : "#F0F4FB",
                    border: "1.5px solid #E5E7EB", borderRadius: 10,
                    cursor: (m.stock_actuel ?? 0) === 0 ? "not-allowed" : "pointer",
                    textAlign: "center",
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

        {/* Droite : panier */}
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

            {/* Mode de paiement */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Mode de paiement</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[{ key: "especes", label: "Espèces" }, { key: "mobile_money", label: "Mobile" }, { key: "credit", label: "Crédit" }].map((mode) => (
                  <button key={mode.key} onClick={() => { setPaiement(mode.key); setMontantRecu(""); }} style={{
                    flex: 1, padding: "8px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer",
                    border: paiement === mode.key ? "2px solid #3B82F6" : "1.5px solid #E5E7EB",
                    backgroundColor: paiement === mode.key ? "#EFF6FF" : "white",
                    color: paiement === mode.key ? "#2563EB" : "#6B7280",
                  }}>{mode.label}</button>
                ))}
              </div>
            </div>

            {/* Suivi espèces */}
            {paiement === "especes" && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Montant reçu du client (FCFA)</label>
                <input
                  type="number"
                  min="0"
                  value={montantRecu}
                  onChange={(e) => setMontantRecu(e.target.value)}
                  placeholder={`Min. ${total.toLocaleString()}`}
                  style={{
                    width: "100%", padding: "8px 12px", border: `1.5px solid ${recuInsuffisant ? "#EF4444" : "#E5E7EB"}`,
                    borderRadius: 8, fontSize: 13, boxSizing: "border-box", outline: "none",
                    color: recuInsuffisant ? "#EF4444" : "#0A1628",
                  }}
                />
                {recuInsuffisant && (
                  <div style={{ fontSize: 11, color: "#EF4444", marginTop: 3 }}>
                    Montant insuffisant (manque {(total - Number(montantRecu)).toLocaleString()} FCFA)
                  </div>
                )}
                {!recuInsuffisant && montantRecu !== "" && Number(montantRecu) >= total && (
                  <div style={{ fontSize: 12, color: "#10B981", fontWeight: 700, marginTop: 4 }}>
                    Monnaie à rendre : {monnaie.toLocaleString()} FCFA
                  </div>
                )}
              </div>
            )}

            <button
              disabled={cart.length === 0 || saving || recuInsuffisant}
              onClick={handleEncaisser}
              style={{
                width: "100%", padding: "14px",
                backgroundColor: cart.length === 0 || saving || recuInsuffisant ? "#E5E7EB" : "#10B981",
                color: cart.length === 0 || saving || recuInsuffisant ? "#9CA3AF" : "white",
                border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700,
                cursor: cart.length === 0 || saving || recuInsuffisant ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Enregistrement…" : "Valider la vente"}
            </button>

            {cart.length > 0 && !saving && (
              <button
                onClick={() => { setCart([]); setMontantRecu(""); }}
                style={{ width: "100%", marginTop: 8, padding: "10px", backgroundColor: "white", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 13, color: "#6B7280", cursor: "pointer" }}>
                Vider le panier
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Onglet Journal du gérant ─────────────────────────────────────────────────
function OngletJournal({ refreshKey }) {
  const { auth } = useAuth();
  const [date, setDate] = useState(todayISO());
  const [journal, setJournal] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJournalJour(auth?.etablissement_id ?? null, date);
      setJournal(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [auth?.etablissement_id, date]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const totalEncaisse = journal.reduce((s, r) => s + (r.montant_total ?? 0), 0);
  const totalMonnaie = journal.reduce((s, r) => s + (r.monnaie_rendue ?? 0), 0);
  const soldeNet = totalEncaisse - totalMonnaie;
  const byMode = journal.reduce((acc, r) => {
    const k = r.mode_paiement ?? "autre";
    acc[k] = (acc[k] ?? 0) + (r.montant_total ?? 0);
    return acc;
  }, {});

  const modeLabels = { especes: "Espèces", mobile_money: "Mobile Money", credit: "Crédit", carte: "Carte", assurance: "Assurance" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ padding: "8px 12px", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 13 }}
        />
        <button onClick={load} style={{ padding: "8px 16px", backgroundColor: "#3B82F6", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          Actualiser
        </button>
      </div>

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {[
          { label: "Total encaissé", value: `${totalEncaisse.toLocaleString()} FCFA`, color: "#10B981" },
          { label: "Monnaie rendue", value: `${totalMonnaie.toLocaleString()} FCFA`, color: "#F59E0B" },
          { label: "Solde net espèces", value: `${soldeNet.toLocaleString()} FCFA`, color: "#3B82F6" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: "white", borderRadius: 12, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Répartition par mode */}
      {Object.keys(byMode).length > 0 && (
        <div style={{ backgroundColor: "white", borderRadius: 12, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h4 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#0A1628" }}>Répartition par mode de paiement</h4>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {Object.entries(byMode).map(([mode, montant]) => (
              <div key={mode} style={{ padding: "8px 14px", backgroundColor: "#F0F4FB", borderRadius: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{modeLabels[mode] ?? mode}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#2563EB", marginLeft: 8 }}>{montant.toLocaleString()} FCFA</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Liste des transactions */}
      <div style={{ backgroundColor: "white", borderRadius: 12, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <h4 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "#0A1628" }}>
          Transactions du jour ({journal.length})
        </h4>
        {loading && <div style={{ color: "#9CA3AF", fontSize: 13 }}>Chargement…</div>}
        {error && <div style={{ color: "#EF4444", fontSize: 13 }}>{error}</div>}
        {!loading && !error && journal.length === 0 && (
          <div style={{ color: "#9CA3AF", fontSize: 13, textAlign: "center", padding: 20 }}>Aucune transaction pour cette date.</div>
        )}
        {!loading && journal.map((row, idx) => (
          <div key={row.id} style={{ borderBottom: idx < journal.length - 1 ? "1px solid #F3F4F6" : "none", padding: "10px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <span style={{ fontSize: 12, color: "#9CA3AF" }}>{new Date(row.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                <span style={{ marginLeft: 8, fontSize: 12, padding: "2px 8px", borderRadius: 10, backgroundColor: "#EFF6FF", color: "#2563EB", fontWeight: 600 }}>
                  {modeLabels[row.mode_paiement] ?? row.mode_paiement}
                </span>
                <span style={{ marginLeft: 6, fontSize: 11, color: "#9CA3AF" }}>{row.nb_articles} art.</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0A1628" }}>{(row.montant_total ?? 0).toLocaleString()} FCFA</div>
                {row.monnaie_rendue != null && row.monnaie_rendue > 0 && (
                  <div style={{ fontSize: 11, color: "#F59E0B" }}>Monnaie : {row.monnaie_rendue.toLocaleString()} FCFA</div>
                )}
              </div>
            </div>
            {Array.isArray(row.detail) && row.detail.length > 0 && (
              <div style={{ marginTop: 4, paddingLeft: 8, borderLeft: "2px solid #E5E7EB" }}>
                {row.detail.map((d, di) => (
                  <div key={di} style={{ fontSize: 11, color: "#6B7280" }}>
                    {d.nom} × {d.qty} = {(d.sous_total ?? 0).toLocaleString()} FCFA
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function Caisse() {
  const [onglet, setOnglet] = useState("caisse");
  const [journalKey, setJournalKey] = useState(0);

  const handleSaleComplete = () => setJournalKey((k) => k + 1);

  return (
    <Layout title="Caisse — Point de Vente" subtitle="Enregistrement des ventes et dispensation">
      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, backgroundColor: "white", borderRadius: 12, padding: 4, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", width: "fit-content" }}>
        {[
          { key: "caisse", label: "🛒 Caisse" },
          { key: "journal", label: "📒 Journal du gérant" },
        ].map((t) => (
          <button key={t.key} onClick={() => setOnglet(t.key)} style={{
            padding: "8px 20px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer",
            backgroundColor: onglet === t.key ? "#3B82F6" : "transparent",
            color: onglet === t.key ? "white" : "#6B7280",
          }}>{t.label}</button>
        ))}
      </div>

      {onglet === "caisse" && <OngletCaisse onSaleComplete={handleSaleComplete} />}
      {onglet === "journal" && <OngletJournal refreshKey={journalKey} />}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </Layout>
  );
}
