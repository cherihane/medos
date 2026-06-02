import { useState, useEffect, useRef } from "react";
import Layout from "../../components/Layout";
import { useKpiDistributeur, useEtablissements, useCommandesRealtime } from "../../hooks/useSupabaseData";
import { updateCommande } from "../../hooks/useMutations";

function fmt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

// Valeurs exactes du check constraint SQL :
// brouillon | envoyee | confirmee | en_transit | livree | annulee
const STATUT_STYLE = {
  brouillon:  { bg: "#F3F4F6", color: "#6B7280",  label: "Brouillon" },
  envoyee:    { bg: "#FEF9C3", color: "#A16207",  label: "Envoyée" },
  confirmee:  { bg: "#DBEAFE", color: "#2563EB",  label: "Confirmée" },
  en_transit: { bg: "#E0E7FF", color: "#4F46E5",  label: "En transit" },
  livree:     { bg: "#DCFCE7", color: "#16A34A",  label: "Livrée" },
  annulee:    { bg: "#FEF2F2", color: "#DC2626",  label: "Annulée" },
};

function StatutBadge({ statut }) {
  const s = STATUT_STYLE[statut] || { bg: "#F3F4F6", color: "#6B7280", label: statut };
  return (
    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, fontWeight: 700, backgroundColor: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

// ── Panneau commandes temps réel ──────────────────────────────────────────────
function CommandesPanel() {
  const { data: commandes, loading } = useCommandesRealtime();
  const [updating, setUpdating] = useState(null);
  const [newIds, setNewIds] = useState(new Set());
  const [actionError, setActionError] = useState(null);

  // Détecte les nouvelles lignes arrivées via Realtime (hors chargement initial).
  // On utilise un ref pour mémoriser les IDs déjà vus sans provoquer de re-render.
  // null = chargement initial pas encore terminé.
  const seenIdsRef = useRef(null);

  useEffect(() => {
    if (loading) return;

    if (seenIdsRef.current === null) {
      // Premier chargement : marquer tous les IDs comme vus sans animation
      seenIdsRef.current = new Set(commandes.map((c) => c.id));
      return;
    }

    // Nouvelles lignes = IDs pas encore dans seenIds
    const freshIds = commandes
      .filter((c) => !seenIdsRef.current.has(c.id))
      .map((c) => c.id);

    // Mettre à jour le registre
    commandes.forEach((c) => seenIdsRef.current.add(c.id));

    if (freshIds.length === 0) return;

    setNewIds(new Set(freshIds));
    const timer = setTimeout(() => setNewIds(new Set()), 3000);
    return () => clearTimeout(timer);
  }, [commandes, loading]);

  const handleAction = async (id, statut) => {
    setUpdating(id);
    setActionError(null);
    try {
      await updateCommande(id, { statut });
    } catch (e) {
      setActionError("Erreur : " + e.message);
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Commandes reçues</h3>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, backgroundColor: "#DCFCE7", color: "#16A34A", padding: "3px 8px", borderRadius: 10 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#16A34A", display: "inline-block", animation: "livePulse 1.5s ease-in-out infinite" }} />
          TEMPS RÉEL
        </span>
      </div>

      {actionError && (
        <div style={{ padding: "10px 14px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 13, color: "#DC2626", marginBottom: 8 }}>
          {actionError}
        </div>
      )}
      {loading && [1, 2, 3].map((i) => (
        <div key={i} style={{ height: 56, backgroundColor: "#F8FAFC", borderRadius: 8, marginBottom: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
      ))}

      {!loading && commandes.length === 0 && (
        <div style={{ color: "#9CA3AF", fontSize: 13, textAlign: "center", padding: 24 }}>
          Aucune commande — en attente de nouvelles commandes…
        </div>
      )}

      <div style={{ maxHeight: 420, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
        {!loading && commandes.map((c) => {
          const isNew = newIds.has(c.id);
          return (
            <div key={c.id} style={{
              padding: "12px 14px",
              backgroundColor: isNew ? "#FFFBEB" : "#F8FAFC",
              borderRadius: 10,
              border: isNew ? "1px solid #FCD34D" : "1px solid #F3F4F6",
              transition: "background-color 1s ease",
              animation: isNew ? "newRow 0.4s ease" : undefined,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0A1628" }}>
                    {c.etablissements?.nom ?? "—"}
                    {isNew && (
                      <span style={{ marginLeft: 8, fontSize: 10, backgroundColor: "#FCD34D", color: "#92400E", padding: "1px 6px", borderRadius: 6, fontWeight: 700 }}>
                        NOUVEAU
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                    {c.reference ?? c.id.slice(0, 8).toUpperCase()} · {fmt(c.date_commande)}
                    {c.notes && <span> · {c.notes.slice(0, 60)}{c.notes.length > 60 ? "…" : ""}</span>}
                  </div>
                </div>
                <StatutBadge statut={c.statut} />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#0A1628" }}>
                  {(c.montant_total ?? 0).toLocaleString()} FCFA
                </div>

                {(c.statut === "envoyee" || c.statut === "brouillon") && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => handleAction(c.id, "confirmee")}
                      disabled={updating === c.id}
                      style={{ padding: "5px 12px", backgroundColor: "#DCFCE7", color: "#16A34A", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: updating === c.id ? "wait" : "pointer" }}
                    >
                      {updating === c.id ? "…" : "Valider"}
                    </button>
                    <button
                      onClick={() => handleAction(c.id, "annulee")}
                      disabled={updating === c.id}
                      style={{ padding: "5px 12px", backgroundColor: "#FEF2F2", color: "#DC2626", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: updating === c.id ? "wait" : "pointer" }}
                    >
                      Refuser
                    </button>
                  </div>
                )}
                {c.statut === "confirmee" && (
                  <button
                    onClick={() => handleAction(c.id, "en_transit")}
                    disabled={updating === c.id}
                    style={{ padding: "5px 12px", backgroundColor: "#DBEAFE", color: "#2563EB", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: updating === c.id ? "wait" : "pointer" }}
                  >
                    {updating === c.id ? "…" : "Expédier"}
                  </button>
                )}
                {c.statut === "en_transit" && (
                  <button
                    onClick={() => handleAction(c.id, "livree")}
                    disabled={updating === c.id}
                    style={{ padding: "5px 12px", backgroundColor: "#DCFCE7", color: "#16A34A", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: updating === c.id ? "wait" : "pointer" }}
                  >
                    {updating === c.id ? "…" : "Confirmer livraison"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Dashboard principal ───────────────────────────────────────────────────────
export default function DashboardDistributeur() {
  const { data: kpi, loading: loadKpi } = useKpiDistributeur();
  const { data: etabs, loading: loadEtabs } = useEtablissements();

  const kpis = [
    { label: "Commandes actives",   value: loadKpi ? "…" : kpi?.commandesActives ?? 0,                              color: "#F59E0B" },
    { label: "Clients",             value: loadKpi ? "…" : kpi?.clients ?? 0,                                       color: "#3B82F6" },
    { label: "CA total",            value: loadKpi ? "…" : `${((kpi?.ca ?? 0) / 1000000).toFixed(1)}M FCFA`,        color: "#10B981" },
    { label: "Livraisons en cours", value: loadKpi ? "…" : kpi?.livraisonsEnCours ?? 0,                             color: "#8B5CF6" },
  ];

  return (
    <Layout title="Dashboard Distributeur" subtitle="Vue d'ensemble — MedDistrib Congo">
      <style>{`
        @keyframes pulse     { 0%,100%{opacity:1}   50%{opacity:.4} }
        @keyframes livePulse { 0%,100%{opacity:1}   50%{opacity:.3} }
        @keyframes newRow    { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* KPIs */}
      <div className="kpi-row">
        {kpis.map((k) => (
          <div key={k.label} style={{ backgroundColor: "white", borderRadius: 14, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div className="dash-grid-2">
        {/* Réseau établissements */}
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>
            Réseau établissements ({loadEtabs ? "…" : etabs.length})
          </h3>
          {loadEtabs && [1, 2, 3].map((i) => (
            <div key={i} style={{ height: 52, backgroundColor: "#F8FAFC", borderRadius: 10, marginBottom: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
          {!loadEtabs && etabs.map((e) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", backgroundColor: "#F8FAFC", borderRadius: 10, marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#10B981" }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#0A1628" }}>{e.nom}</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF" }}>{e.type} · {e.ville}</div>
                </div>
              </div>
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 8, backgroundColor: "#DCFCE7", color: "#16A34A", fontWeight: 600 }}>actif</span>
            </div>
          ))}
        </div>

        {/* Commandes temps réel */}
        <CommandesPanel />
      </div>
    </Layout>
  );
}
