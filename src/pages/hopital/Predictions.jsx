import { colors } from "../../theme";
import { useState, useMemo } from "react";
import Layout from "../../components/Layout";
import { useMedicamentsCritiques, useMedicaments, useFournisseurs } from "../../hooks/useSupabaseData";
import { insertCommande } from "../../hooks/useMutations";

const inputStyle = {
  width: "100%", padding: "9px 13px", border: "1.5px solid var(--border)",
  borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box",
  color: colors.navy, backgroundColor: colors.bgCard,
};

function CommanderModal({ medicamentNom, quantiteDefaut, onClose, onSaved }) {
  const { data: fournisseurs, loading: loadingF } = useFournisseurs();
  const [fournisseurId, setFournisseurId] = useState("");
  const [quantite, setQuantite] = useState(String(quantiteDefaut));
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState(null);

  const handleSave = async () => {
    if (!fournisseurId) { setErreur("Veuillez sélectionner un fournisseur."); return; }
    const qty = parseInt(quantite, 10);
    if (!qty || qty <= 0) { setErreur("La quantité doit être supérieure à 0."); return; }
    setSaving(true);
    try {
      await insertCommande({
        fournisseur_id: fournisseurId,
        statut: "envoyee",
        date_commande: new Date().toISOString(),
        notes: `${medicamentNom} — Qté : ${qty} (recommandation IA Prédictions)`,
        montant_total: 0,
      });
      onSaved("Commande passée pour " + medicamentNom);
      onClose();
    } catch (e) {
      setErreur("Erreur : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ backgroundColor: colors.bgCard, borderRadius: 16, width: 420, padding: "24px 28px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.navy }}>Commander — {medicamentNom}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted }}>×</button>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Fournisseur *</label>
          <select
            value={fournisseurId}
            onChange={(e) => setFournisseurId(e.target.value)}
            style={{ ...inputStyle, cursor: loadingF ? "wait" : "pointer" }}
          >
            <option value="">{loadingF ? "Chargement…" : "— Sélectionner —"}</option>
            {fournisseurs.filter((f) => f.actif !== false).map((f) => (
              <option key={f.id} value={f.id}>{f.nom}</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Quantité à commander</label>
          <input
            style={inputStyle}
            type="number"
            min="1"
            value={quantite}
            onChange={(e) => setQuantite(e.target.value)}
          />
        </div>
        {erreur && (
          <div style={{ padding: "9px 13px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 12, color: "#DC2626", marginBottom: 12 }}>
            {erreur}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 18px", backgroundColor: colors.bgCard, border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 13, color: colors.textSecondary, cursor: "pointer" }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: "9px 18px", backgroundColor: saving ? "#E5E7EB" : "#10B981", color: saving ? "#9CA3AF" : "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "Envoi…" : "Passer la commande"}
          </button>
        </div>
      </div>
    </div>
  );
}

const riskColor = { critique: "#EF4444", alerte: "#F59E0B", normal: "#10B981" };


function getRisque(m) {
  if (!m.stock_minimum || m.stock_minimum === 0) return "normal";
  const ratio = m.stock_actuel / m.stock_minimum;
  if (ratio <= 0.3) return "critique";
  if (ratio <= 0.6) return "alerte";
  return "normal";
}

export default function Predictions() {
  const { data: critiques, loading } = useMedicamentsCritiques(20);
  const { data: allMeds } = useMedicaments();
  const [commanderModal, setCommanderModal] = useState(null); // { nom, quantite }
  const [toast, setToast] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  const generateInsights = useMemo(() => {
    if (!critiques || critiques.length === 0) return [];
    const insights = [];
    const enRupture = critiques.filter((m) => (m.stock_actuel ?? 0) === 0);
    if (enRupture.length > 0) {
      insights.push({
        titre: "Ruptures de stock détectées",
        desc: `${enRupture.length} médicament(s) en rupture totale : ${enRupture.slice(0, 3).map((m) => m.nom).join(", ")}${enRupture.length > 3 ? ` et ${enRupture.length - 3} autres` : ""}. Commander en urgence.`,
        impact: "critique",
      });
    }
    const sousSeuil = critiques.filter((m) => (m.stock_actuel ?? 0) > 0 && (m.stock_actuel ?? 0) <= (m.stock_minimum ?? 0));
    if (sousSeuil.length > 0) {
      insights.push({
        titre: `${sousSeuil.length} médicament(s) sous le seuil minimum`,
        desc: `Stocks insuffisants pour assurer la continuité des soins. Prévoir les commandes dans les 48h.`,
        impact: "élevé",
      });
    }
    const valeurStock = allMeds.reduce((s, m) => s + (m.stock_actuel ?? 0) * (m.prix_unitaire ?? 0), 0);
    if (valeurStock > 0) {
      insights.push({
        titre: "Valeur totale du stock",
        desc: `Le stock actuel représente ${valeurStock.toLocaleString("fr-FR")} FCFA. ${sousSeuil.length > 0 ? "Optimiser les niveaux critiques pour réduire le risque." : "Niveaux globalement satisfaisants."}`,
        impact: sousSeuil.length > 3 ? "modéré" : "faible",
      });
    }
    return insights;
  }, [critiques, allMeds]);

  // Build predictions from critiques meds
  const predictions = critiques.map((m) => ({
    medicament: m.nom,
    risque: getRisque(m),
    stock: m.stock_actuel ?? 0,
    demandePrevue: m.stock_minimum ?? 20,
    recommendation: `Commander ${Math.max(0, (m.stock_minimum ?? 0) * 3 - (m.stock_actuel ?? 0))} unités`,
  }));

  return (
    <Layout title="Prédictions IA" subtitle="Anticipation de la demande médicamenteuse par intelligence artificielle">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, backgroundColor: "#10B981", color: "white", padding: "12px 20px", borderRadius: 10, fontWeight: 600, fontSize: 13, zIndex: 2000, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
          {toast}
        </div>
      )}
      {commanderModal && (
        <CommanderModal
          medicamentNom={commanderModal.nom}
          quantiteDefaut={commanderModal.quantite}
          onClose={() => setCommanderModal(null)}
          onSaved={(msg) => { showToast(msg); setCommanderModal(null); }}
        />
      )}
      <div className="kpi-row">
        {[
          { label: "Produits à surveiller", value: loading ? "…" : predictions.length,                                            color: "#10B981" },
          { label: "Critiques",             value: loading ? "…" : predictions.filter(p => p.risque === "critique").length,       color: "#EF4444" },
          { label: "En alerte",             value: loading ? "…" : predictions.filter(p => p.risque === "alerte").length,         color: "#F59E0B" },
          { label: "Total médicaments",     value: loading ? "…" : allMeds.length,                                                color: "#8B5CF6" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "18px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div className="dash-grid-2">
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: colors.navy }}>Produits en tension — stock critique</h3>
          {loading && [1,2,3].map((i) => (
            <div key={i} style={{ height: 80, backgroundColor: colors.bgSurface, borderRadius: 10, marginBottom: 12, animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
          {!loading && predictions.length === 0 && (
            <div style={{ color: colors.textMuted, fontSize: 13, textAlign: "center", padding: 24 }}>Aucun produit en tension</div>
          )}
          {!loading && predictions.map((p) => {
            const col = riskColor[p.risque];
            const pct = Math.min(100, Math.round((p.stock / p.demandePrevue) * 100));
            return (
              <div key={p.medicament} style={{ padding: "14px", borderRadius: 10, backgroundColor: colors.bgSurface, border: `1px solid ${col}22`, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: colors.navy }}>{p.medicament}</span>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, backgroundColor: col + "20", color: col, fontWeight: 700 }}>{p.risque.toUpperCase()}</span>
                </div>
                <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>
                  Stock actuel : <strong style={{ color: p.stock < 10 ? "#EF4444" : "#374151" }}>{p.stock}</strong> · Seuil : <strong>{p.demandePrevue}</strong>
                </div>
                <div style={{ height: 6, backgroundColor: "#E5E7EB", borderRadius: 4, marginBottom: 6 }}>
                  <div style={{ height: "100%", width: `${pct}%`, backgroundColor: col, borderRadius: 4 }} />
                </div>
                <div style={{ fontSize: 12, color: "#3B82F6", fontWeight: 600 }}>Recommandation : {p.recommendation}</div>
              </div>
            );
          })}
        </div>

        <div>
          <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: colors.navy }}>Insights IA</h3>
            {generateInsights.length === 0 && !loading && (
              <div style={{ color: colors.textMuted, fontSize: 13, textAlign: "center", padding: 16 }}>Aucun insight disponible — stock en ordre.</div>
            )}
            {generateInsights.map((ins) => (
              <div key={ins.titre} style={{ padding: "14px", backgroundColor: colors.bgSurface, borderRadius: 10, marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: colors.navy }}>{ins.titre}</span>
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, fontWeight: 700,
                    backgroundColor: ins.impact === "critique" || ins.impact === "élevé" ? "#FEF2F2" : ins.impact === "modéré" ? "#FFFBEB" : "#DCFCE7",
                    color: ins.impact === "critique" || ins.impact === "élevé" ? "#EF4444" : ins.impact === "modéré" ? "#D97706" : "#16A34A",
                  }}>{ins.impact}</span>
                </div>
                <div style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 1.6 }}>{ins.desc}</div>
              </div>
            ))}
          </div>

          <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: colors.navy }}>Commandes suggérées</h3>
            {!loading && predictions.filter(p => p.risque !== "normal").map((p) => (
              <div key={p.medicament} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border-light)" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: colors.navy }}>{p.medicament}</div>
                  <div style={{ fontSize: 11, color: colors.textMuted }}>{p.recommendation}</div>
                </div>
                <button
                  onClick={() => setCommanderModal({ nom: p.medicament, quantite: Math.max(0, (critiques.find(m => m.nom === p.medicament)?.stock_minimum ?? 0) * 3 - p.stock) })}
                  style={{ padding: "6px 14px", backgroundColor: "#10B981", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  Commander
                </button>
              </div>
            ))}
            {!loading && predictions.filter(p => p.risque !== "normal").length === 0 && (
              <div style={{ color: colors.textMuted, fontSize: 13, textAlign: "center", padding: 16 }}>Aucune commande urgente</div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
