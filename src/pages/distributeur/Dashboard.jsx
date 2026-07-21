import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import { useKpiDistributeur, useDistributeurClients, useCommandesRealtime } from "../../hooks/useSupabaseData";
import { updateCommande } from "../../hooks/useMutations";
import { supabase } from "../../supabaseClient";
import { colors, radius, shadow, font } from "../../theme";

function useTendanceDistributeur() {
  const [hier, setHier] = useState(null);
  useEffect(() => {
    const today = new Date();
    const hierDebut = new Date(today); hierDebut.setDate(hierDebut.getDate() - 1); hierDebut.setHours(0,0,0,0);
    const hierFin   = new Date(today); hierFin.setDate(hierFin.getDate() - 1); hierFin.setHours(23,59,59,999);
    Promise.all([
      supabase.from("commandes").select("id").gte("created_at", hierDebut.toISOString()).lte("created_at", hierFin.toISOString()),
      supabase.from("livraisons").select("id").eq("statut", "en_transit").gte("created_at", hierDebut.toISOString()).lte("created_at", hierFin.toISOString()),
    ]).then(([c, l]) => {
      setHier({
        commandesHier:   c.data?.length ?? 0,
        livraisonsHier:  l.data?.length ?? 0,
      });
    });
  }, []);
  return hier;
}

function fmtChange(now, prev) {
  if (prev == null || prev === 0) return null;
  const pct = Math.round(((now - prev) / prev) * 100);
  return pct > 0 ? `+${pct}%` : `${pct}%`;
}

function fmt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

function fmtFCFA(ca) {
  if (ca >= 1000000) return `${(ca / 1000000).toFixed(1)}M FCFA`;
  return `${ca.toLocaleString("fr-FR")} FCFA`;
}

// Valeurs exactes du check constraint SQL :
// brouillon | envoyee | confirmee | en_transit | livree | annulee
const STATUT_STYLE = {
  brouillon:  { bg: "#F3F4F6", color: colors.textSecondary,  label: "Brouillon" },
  envoyee:    { bg: "#FEF9C3", color: "#A16207",  label: "Envoyée" },
  confirmee:  { bg: "#DBEAFE", color: "#2563EB",  label: "Confirmée" },
  en_transit: { bg: "#E0E7FF", color: "#4F46E5",  label: "En transit" },
  livree:     { bg: "#DCFCE7", color: "#16A34A",  label: "Livrée" },
  annulee:    { bg: "#FEF2F2", color: "#DC2626",  label: "Annulée" },
};

function StatutBadge({ statut }) {
  const s = STATUT_STYLE[statut] || { bg: "#F3F4F6", color: colors.textSecondary, label: statut };
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

  function parseLignes(c) {
    try {
      if (Array.isArray(c.lignes)) return c.lignes;
      const parsed = JSON.parse(c.notes ?? "{}");
      if (Array.isArray(parsed.lignes)) return parsed.lignes;
      return [];
    } catch { return []; }
  }

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

  const handleAction = async (cmd, statut) => {
    setUpdating(cmd.id);
    setActionError(null);
    try {
      await updateCommande(cmd.id, { statut });
      if (["confirmee", "en_transit", "livree", "annulee"].includes(statut)) {
        const { data: row } = await supabase
          .from("commandes")
          .select("etablissement_id")
          .eq("id", cmd.id)
          .single();
        if (row?.etablissement_id) {
          const titres = {
            confirmee:  "Commande confirmee",
            en_transit: "Commande en transit",
            livree:     "Commande livree",
            annulee:    "Commande annulee",
          };
          try {
            await supabase.rpc("notifier_client_distributeur", {
              p_etablissement_id: row.etablissement_id,
              p_type: "commande",
              p_titre: titres[statut] ?? "Commande mise a jour",
              p_message: `Ref. ${cmd.reference ?? cmd.id?.slice(0, 8).toUpperCase()}`,
              p_severite: statut === "annulee" ? "critique" : "info",
            });
          } catch (_) {}
        }
      }
    } catch (e) {
      setActionError("Erreur : " + e.message);
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.navy }}>Commandes reçues</h3>
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
        <div key={i} style={{ height: 56, backgroundColor: colors.bgSurface, borderRadius: 8, marginBottom: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
      ))}

      {!loading && commandes.length === 0 && (
        <div style={{ color: colors.textMuted, fontSize: 13, textAlign: "center", padding: 24 }}>
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
              border: isNew ? "1px solid #FCD34D" : "1px solid var(--border-light)",
              transition: "background-color 1s ease",
              animation: isNew ? "newRow 0.4s ease" : undefined,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>
                    {c.etablissements?.nom ?? "—"}
                    {isNew && (
                      <span style={{ marginLeft: 8, fontSize: 10, backgroundColor: "#FCD34D", color: "#92400E", padding: "1px 6px", borderRadius: 6, fontWeight: 700 }}>
                        NOUVEAU
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                    {c.reference ?? c.id.slice(0, 8).toUpperCase()} · {fmt(c.date_commande)}
                  </div>
                </div>
                <StatutBadge statut={c.statut} />
              </div>

              {(() => {
                const lignes = parseLignes(c);
                if (!lignes.length) return null;
                return (
                  <div style={{ backgroundColor: colors.bgCard, borderRadius: 8, padding: "6px 10px", marginBottom: 6, border: "1px solid var(--border-light)" }}>
                    {lignes.slice(0, 3).map((l, i) => (
                      <div key={i} style={{ fontSize: 11, color: colors.text, padding: "2px 0", borderBottom: i < Math.min(lignes.length, 3) - 1 ? "1px solid var(--border-light)" : "none" }}>
                        <span style={{ fontWeight: 600 }}>{l.medicament_nom ?? l.medicamentNom ?? l.nom ?? "—"}</span>
                        <span style={{ color: colors.textMuted, marginLeft: 6 }}>× {l.quantite ?? "?"}</span>
                      </div>
                    ))}
                    {lignes.length > 3 && (
                      <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 3 }}>+{lignes.length - 3} autre(s)</div>
                    )}
                  </div>
                );
              })()}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: colors.navy }}>
                  {(c.montant_total ?? 0).toLocaleString()} FCFA
                </div>

                {(c.statut === "envoyee" || c.statut === "brouillon") && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => handleAction(c, "confirmee")}
                      disabled={updating === c.id}
                      style={{ padding: "5px 12px", backgroundColor: "#DCFCE7", color: "#16A34A", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: updating === c.id ? "wait" : "pointer" }}
                    >
                      {updating === c.id ? "…" : "Valider"}
                    </button>
                    <button
                      onClick={() => handleAction(c, "annulee")}
                      disabled={updating === c.id}
                      style={{ padding: "5px 12px", backgroundColor: "#FEF2F2", color: "#DC2626", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: updating === c.id ? "wait" : "pointer" }}
                    >
                      Refuser
                    </button>
                  </div>
                )}
                {c.statut === "confirmee" && (
                  <button
                    onClick={() => handleAction(c, "en_transit")}
                    disabled={updating === c.id}
                    style={{ padding: "5px 12px", backgroundColor: "#DBEAFE", color: "#2563EB", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: updating === c.id ? "wait" : "pointer" }}
                  >
                    {updating === c.id ? "…" : "Expédier"}
                  </button>
                )}
                {c.statut === "en_transit" && (
                  <button
                    onClick={() => handleAction(c, "livree")}
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
  const { data: relations, loading: loadEtabs } = useDistributeurClients();
  const etabs = relations.map((r) => r.client).filter(Boolean);
  const hier = useTendanceDistributeur();
  const navigate = useNavigate();

  const commandesActives   = loadKpi ? 0 : (kpi?.commandesActives ?? 0);
  const livraisonsEnCours  = loadKpi ? 0 : (kpi?.livraisonsEnCours ?? 0);

  const kpis = [
    { label: "Commandes actives",   value: loadKpi ? "…" : commandesActives,                                        color: "#F59E0B", to: "/distributeur/livraisons", change: hier ? fmtChange(commandesActives, hier.commandesHier) : null },
    { label: "Clients",             value: loadKpi ? "…" : kpi?.clients ?? 0,                                       color: "#3B82F6", to: "/distributeur/clients",    change: null },
    { label: "CA total",            value: loadKpi ? "…" : fmtFCFA(kpi?.ca ?? 0),                                    color: "#10B981", to: "/distributeur/livraisons", change: null },
    { label: "Livraisons en cours", value: loadKpi ? "…" : livraisonsEnCours,                                       color: "#8B5CF6", to: "/distributeur/livraisons", change: hier ? fmtChange(livraisonsEnCours, hier.livraisonsHier) : null },
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
          <div
            key={k.label}
            onClick={() => navigate(k.to)}
            style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}`, cursor: "pointer", transition: "box-shadow 0.15s" }}
            onMouseEnter={(e) => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)"}
            onMouseLeave={(e) => e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)"}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: k.color }}>{k.value}</div>
              {k.change && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
                  backgroundColor: k.change.startsWith("-") ? "#FEE2E2" : "#DCFCE7",
                  color: k.change.startsWith("-") ? "#DC2626" : "#16A34A",
                }}>{k.change}</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div className="dash-grid-2">
        {/* Vos clients */}
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: colors.navy }}>
            Vos clients ({loadEtabs ? "…" : etabs.length})
          </h3>
          {loadEtabs && [1, 2, 3].map((i) => (
            <div key={i} style={{ height: 52, backgroundColor: colors.bgSurface, borderRadius: 10, marginBottom: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
          {!loadEtabs && etabs.length === 0 && (
            <div style={{ color: colors.textMuted, fontSize: 13, textAlign: "center", padding: 24 }}>
              Aucun client pour l'instant.
            </div>
          )}
          {!loadEtabs && etabs.map((e) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", backgroundColor: colors.bgSurface, borderRadius: 10, marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#10B981" }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: colors.navy }}>{e.nom}</div>
                  <div style={{ fontSize: 11, color: colors.textMuted }}>{e.type} · {e.ville}</div>
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
