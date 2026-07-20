import { colors } from "../../theme";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useMedicaments } from "../../hooks/useSupabaseData";
import { useThemeTokens } from "../../context/DarkModeContext";

// Même logique de statut que Inventaire.jsx / Dashboard (ratio stock_actuel /
// stock_minimum) — cet écran ne fait qu'agréger et filtrer ce que ces pages
// calculent déjà, pas de nouvelle source de vérité.
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
};

function medicamentLabel(med) {
  return `${med.nom}${med.dosage ? ` ${med.dosage}` : ""}${med.forme ? ` (${med.forme})` : ""}`;
}

// Quantité suggérée : de quoi remonter à deux fois le seuil minimum, jamais
// moins que le seuil lui-même — un point de départ éditable par l'utilisateur
// avant l'envoi de la commande, pas une valeur figée.
function quantiteSuggeree(med) {
  const min = med.stock_minimum || 10;
  return Math.max(min * 2 - (med.stock_actuel ?? 0), min);
}

function ligneCommande(med) {
  return {
    medicament_id: med.id,
    nom:           medicamentLabel(med),
    quantite:      quantiteSuggeree(med),
    prix_unitaire: med.prix_unitaire ?? 0,
  };
}

export default function Alertes() {
  const t = useThemeTokens();
  const navigate = useNavigate();
  const { data: medicaments, loading } = useMedicaments();
  const { toasts } = useToast();
  const [selected, setSelected] = useState(() => new Set());

  const alertes = useMemo(() => {
    return medicaments
      .map((m) => ({ ...m, statut: getStatut(m) }))
      .filter((m) => m.statut !== "normal")
      .sort((a, b) => (a.stock_actuel / (a.stock_minimum || 1)) - (b.stock_actuel / (b.stock_minimum || 1)));
  }, [medicaments]);

  const toggleSelect = (id) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const toggleAll = () => {
    setSelected((s) => s.size === alertes.length ? new Set() : new Set(alertes.map((m) => m.id)));
  };

  const commander = (meds) => {
    const lignes = meds.map(ligneCommande);
    navigate("/pharmacie/fournisseurs", { state: { prefillLignes: lignes } });
  };

  const selectedCount = selected.size;

  return (
    <Layout title="Alertes de stock" subtitle="Médicaments sous le seuil minimum">
      <Toast toasts={toasts} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ fontSize: 13, color: t.textLight }}>
          {loading ? "Chargement…" : `${alertes.length} médicament${alertes.length !== 1 ? "s" : ""} sous le seuil minimum`}
        </div>
        {selectedCount > 0 && (
          <button
            onClick={() => commander(alertes.filter((m) => selected.has(m.id)))}
            style={{ padding: "10px 20px", backgroundColor: "#10B981", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(16,185,129,0.3)" }}
          >
            Commander la sélection ({selectedCount})
          </button>
        )}
      </div>

      <div style={{ backgroundColor: t.bgCard, borderRadius: 14, boxShadow: t.shadow, overflow: "hidden" }}>
        <div className="table-scroll">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: t.bgSurface }}>
                <th style={{ padding: "12px 16px", width: 36 }}>
                  <input
                    type="checkbox"
                    checked={alertes.length > 0 && selectedCount === alertes.length}
                    onChange={toggleAll}
                    disabled={alertes.length === 0}
                    style={{ cursor: alertes.length === 0 ? "default" : "pointer" }}
                  />
                </th>
                {["Médicament", "Catégorie", "Stock actuel", "Seuil minimum", "Statut", ""].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: t.textLight, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} style={{ padding: "40px 16px", textAlign: "center", color: t.textMuted, fontSize: 13 }}>Chargement…</td></tr>
              )}
              {!loading && alertes.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: "40px 16px", textAlign: "center", color: t.textMuted, fontSize: 13 }}>
                    Aucune alerte de stock — tous les médicaments sont au-dessus de leur seuil minimum.
                  </td>
                </tr>
              )}
              {!loading && alertes.map((m) => {
                const s = statusStyle[m.statut];
                return (
                  <tr key={m.id} style={{ borderBottom: `1px solid ${t.borderLight}` }}>
                    <td style={{ padding: "13px 16px" }}>
                      <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleSelect(m.id)} style={{ cursor: "pointer" }} />
                    </td>
                    <td style={{ padding: "13px 16px", fontSize: 13, fontWeight: 700, color: t.textHeavy }}>{medicamentLabel(m)}</td>
                    <td style={{ padding: "13px 16px", fontSize: 12, color: t.textLight }}>{m.categorie || "—"}</td>
                    <td style={{ padding: "13px 16px", fontSize: 13, fontWeight: 700, color: s.color }}>{m.stock_actuel ?? 0}</td>
                    <td style={{ padding: "13px 16px", fontSize: 12, color: t.textLight }}>{m.stock_minimum ?? "—"}</td>
                    <td style={{ padding: "13px 16px" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, backgroundColor: s.bg, color: s.color }}>{s.label}</span>
                    </td>
                    <td style={{ padding: "13px 16px", textAlign: "right" }}>
                      <button
                        onClick={() => commander([m])}
                        style={{ padding: "7px 14px", backgroundColor: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
                      >
                        Commander
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
