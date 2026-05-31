import Layout from "../../components/Layout";
import { useKpiAutorite, useAlertes, useEtablissements, useMedicaments } from "../../hooks/useSupabaseData";

export default function VueNationale() {
  const { data: kpi, loading: loadKpi } = useKpiAutorite();
  const { data: alertes, loading: loadAlt } = useAlertes(20);
  const { data: etabs, loading: loadEtabs } = useEtablissements();
  const { data: medicaments, loading: loadMed } = useMedicaments();

  const kpis = [
    { label: "Structures actives",      value: loadKpi ? "…" : kpi?.structuresActives ?? 0,    color: "#10B981" },
    { label: "Alertes pharmacovig.",    value: loadKpi ? "…" : kpi?.alertesPharmacovig ?? 0,   color: "#EF4444" },
    { label: "Médicaments tracés",      value: loadKpi ? "…" : kpi?.medicamentsTraces ?? 0,    color: "#3B82F6" },
    { label: "Lots enregistrés",        value: loadKpi ? "…" : kpi?.lots ?? 0,                 color: "#8B5CF6" },
  ];

  return (
    <Layout title="Vue Nationale" subtitle="Tableau de bord national — Autorité sanitaire RDC">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ backgroundColor: "white", borderRadius: 14, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Établissements enregistrés ({loadEtabs ? "…" : etabs.length})</h3>
          {loadEtabs && [1,2,3,4].map((i) => (
            <div key={i} style={{ height: 46, backgroundColor: "#F8FAFC", borderRadius: 10, marginBottom: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
          {!loadEtabs && etabs.map((e) => (
            <div key={e.id} style={{ padding: "10px 14px", backgroundColor: "#F8FAFC", borderRadius: 10, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#0A1628" }}>{e.nom}</span>
                  <span style={{ fontSize: 11, color: "#9CA3AF" }}>{e.ville}</span>
                </div>
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, fontWeight: 700, backgroundColor: "#DCFCE7", color: "#16A34A" }}>{e.type}</span>
              </div>
            </div>
          ))}
        </div>

        <div>
          <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Alertes actives ({loadAlt ? "…" : alertes.length})</h3>
            {loadAlt && [1,2,3].map((i) => (
              <div key={i} style={{ height: 52, backgroundColor: "#F8FAFC", borderRadius: 10, marginBottom: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
            {!loadAlt && alertes.length === 0 && (
              <div style={{ color: "#9CA3AF", fontSize: 13, textAlign: "center", padding: 16 }}>Aucune alerte</div>
            )}
            {!loadAlt && alertes.map((a) => (
              <div key={a.id} style={{ padding: "12px 14px", borderRadius: 10, marginBottom: 8, backgroundColor: a.severite === "critique" ? "#FEF2F2" : a.severite === "alerte" ? "#FFFBEB" : "#EFF6FF", borderLeft: `3px solid ${a.severite === "critique" ? "#EF4444" : a.severite === "alerte" ? "#F59E0B" : "#3B82F6"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#0A1628" }}>{a.titre}</span>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 8, fontWeight: 700, backgroundColor: a.severite === "critique" ? "#FEF2F2" : "#FFFBEB", color: a.severite === "critique" ? "#EF4444" : "#D97706" }}>{a.severite}</span>
                </div>
                {a.message && <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{a.message}</div>}
              </div>
            ))}
          </div>

          <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Indicateurs nationaux</h3>
            {(() => {
              const totalMeds = medicaments.length;
              const medsEnStock = medicaments.filter((m) => m.stock_actuel > 0).length;
              const pctDispo = totalMeds > 0 ? Math.round((medsEnStock / totalMeds) * 100) : 0;
              const structuresActives = kpi?.structuresActives ?? 0;
              const alertesCritiques = kpi?.alertesPharmacovig ?? 0;

              const indicateurs = [
                {
                  label: "Structures actives enregistrées",
                  value: loadKpi ? "…" : structuresActives,
                  trend: null,
                },
                {
                  label: "Alertes pharmacovigilance critiques",
                  value: loadKpi ? "…" : alertesCritiques,
                  trend: null,
                },
                {
                  label: "Médicaments tracés",
                  value: loadKpi ? "…" : kpi?.medicamentsTraces ?? 0,
                  trend: null,
                },
                {
                  label: "Médicaments avec stock disponible",
                  value: loadMed ? "…" : `${pctDispo}%`,
                  trend: null,
                },
              ];

              return indicateurs.map((ind) => (
                <div key={ind.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #F3F4F6" }}>
                  <span style={{ fontSize: 13, color: "#6B7280" }}>{ind.label}</span>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#0A1628" }}>{ind.value}</span>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>
    </Layout>
  );
}
