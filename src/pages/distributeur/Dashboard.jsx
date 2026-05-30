import Layout from "../../components/Layout";
import { useKpiDistributeur, useEtablissements, useCommandes } from "../../hooks/useSupabaseData";

function fmt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

export default function DashboardDistributeur() {
  const { data: kpi, loading: loadKpi } = useKpiDistributeur();
  const { data: etabs, loading: loadEtabs } = useEtablissements();
  const { data: commandes, loading: loadCmd } = useCommandes();

  const loading = loadKpi || loadEtabs || loadCmd;
  const recentCommandes = commandes.slice(0, 5);

  const kpis = [
    { label: "Commandes actives",   value: loadKpi ? "…" : kpi?.commandesActives ?? 0, color: "#F59E0B" },
    { label: "Clients",             value: loadKpi ? "…" : kpi?.clients ?? 0,           color: "#3B82F6" },
    { label: "CA total",            value: loadKpi ? "…" : `${((kpi?.ca ?? 0) / 1000000).toFixed(1)}M FCFA`, color: "#10B981" },
    { label: "Livraisons en cours", value: loadKpi ? "…" : kpi?.livraisonsEnCours ?? 0, color: "#8B5CF6" },
  ];

  return (
    <Layout title="Dashboard Distributeur" subtitle="Vue d'ensemble — MedDistrib Congo">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ backgroundColor: "white", borderRadius: 14, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Réseau établissements ({loadEtabs ? "…" : etabs.length})</h3>
          {loadEtabs && [1,2,3].map((i) => (
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
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 8, backgroundColor: "#DCFCE7", color: "#16A34A", fontWeight: 600 }}>actif</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", minWidth: 0 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Commandes récentes</h3>
          {loadCmd && [1,2,3].map((i) => (
            <div key={i} style={{ height: 44, backgroundColor: "#F8FAFC", borderRadius: 8, marginBottom: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
          {!loadCmd && recentCommandes.length === 0 && (
            <div style={{ color: "#9CA3AF", fontSize: 13, textAlign: "center", padding: 24 }}>Aucune commande</div>
          )}
          {!loadCmd && recentCommandes.map((c) => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #F3F4F6" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#0A1628" }}>{c.etablissements?.nom ?? "—"}</div>
                <div style={{ fontSize: 11, color: "#9CA3AF" }}>{c.reference ?? c.id.slice(0,8).toUpperCase()} · {fmt(c.date_commande)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{(c.montant_total ?? 0).toLocaleString()} FCFA</div>
                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, fontWeight: 700, backgroundColor: c.statut === "livree" ? "#DCFCE7" : c.statut === "en_cours" ? "#DBEAFE" : "#FEF9C3", color: c.statut === "livree" ? "#16A34A" : c.statut === "en_cours" ? "#2563EB" : "#A16207" }}>{c.statut}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
