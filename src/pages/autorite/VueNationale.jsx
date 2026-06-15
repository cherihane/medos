import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import { useKpiAutorite, useAlertes, useEtablissements, useMedicaments } from "../../hooks/useSupabaseData";
import { colors, radius, shadow, font } from "../../theme";
import { useAuth } from "../../context/AuthContext";

export default function VueNationale() {
  const { auth } = useAuth();
  const { data: kpi, loading: loadKpi } = useKpiAutorite();
  const { data: alertes, loading: loadAlt } = useAlertes(20);
  const { data: etabs, loading: loadEtabs } = useEtablissements();
  const { data: medicaments, loading: loadMed } = useMedicaments();
  const navigate = useNavigate();

  const ruptures             = medicaments.filter((m) => (m.stock_actuel ?? 0) === 0).length;
  const sousSeuil            = medicaments.filter((m) => (m.stock_actuel ?? 0) > 0 && (m.stock_actuel ?? 0) <= (m.stock_minimum ?? 0)).length;
  const alertesCritiquesCount = alertes.filter((a) => a.severite === "critique" && !a.resolu).length;
  const pctDispo             = medicaments.length > 0
    ? Math.round((medicaments.filter((m) => (m.stock_actuel ?? 0) > 0).length / medicaments.length) * 100)
    : 0;

  const kpis = [
    { label: "Structures actives",   value: loadKpi ? "…" : kpi?.structuresActives ?? 0,   color: "#10B981", to: "/autorite/acteurs" },
    { label: "Alertes pharmacovig.", value: loadKpi ? "…" : kpi?.alertesPharmacovig ?? 0,  color: "#EF4444", to: "/autorite/epidemiologie" },
    { label: "Médicaments tracés",   value: loadKpi ? "…" : kpi?.medicamentsTraces ?? 0,   color: "#3B82F6", to: "/autorite/contrefacons" },
    { label: "Lots enregistrés",     value: loadKpi ? "…" : kpi?.lots ?? 0,                color: "#8B5CF6", to: "/autorite/rapports-odd" },
  ];

  return (
    <Layout title="Vue Nationale" subtitle={`Tableau de bord national — ${auth?.label ?? "Autorité sanitaire"}`}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <div className="kpi-row">
        {kpis.map((k) => (
          <div
            key={k.label}
            onClick={() => navigate(k.to)}
            style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}`, cursor: "pointer", transition: "box-shadow 0.15s" }}
            onMouseEnter={(e) => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)"}
            onMouseLeave={(e) => e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)"}
          >
            <div style={{ fontSize: 26, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div className="dash-grid-2">
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: colors.navy }}>Établissements enregistrés ({loadEtabs ? "…" : etabs.length})</h3>
          {loadEtabs && [1,2,3,4].map((i) => (
            <div key={i} style={{ height: 46, backgroundColor: colors.bgSurface, borderRadius: 10, marginBottom: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
          {!loadEtabs && etabs.map((e) => (
            <div key={e.id} style={{ padding: "10px 14px", backgroundColor: colors.bgSurface, borderRadius: 10, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: colors.navy }}>{e.nom}</span>
                  <span style={{ fontSize: 11, color: colors.textMuted }}>{e.ville}</span>
                </div>
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, fontWeight: 700, backgroundColor: "#DCFCE7", color: "#16A34A" }}>{e.type}</span>
              </div>
            </div>
          ))}
        </div>

        <div>
          <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: colors.navy }}>Alertes actives ({loadAlt ? "…" : alertes.length})</h3>
            {loadAlt && [1,2,3].map((i) => (
              <div key={i} style={{ height: 52, backgroundColor: colors.bgSurface, borderRadius: 10, marginBottom: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
            {!loadAlt && alertes.length === 0 && (
              <div style={{ color: colors.textMuted, fontSize: 13, textAlign: "center", padding: 16 }}>Aucune alerte</div>
            )}
            {!loadAlt && alertes.map((a) => (
              <div key={a.id} style={{ padding: "12px 14px", borderRadius: 10, marginBottom: 8, backgroundColor: a.severite === "critique" ? "#FEF2F2" : a.severite === "alerte" ? "#FFFBEB" : "#EFF6FF", borderLeft: `3px solid ${a.severite === "critique" ? "#EF4444" : a.severite === "alerte" ? "#F59E0B" : "#3B82F6"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: colors.navy }}>{a.titre}</span>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 8, fontWeight: 700, backgroundColor: a.severite === "critique" ? "#FEF2F2" : "#FFFBEB", color: a.severite === "critique" ? "#EF4444" : "#D97706" }}>{a.severite}</span>
                </div>
                {a.message && <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{a.message}</div>}
              </div>
            ))}
          </div>

          <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: colors.navy }}>Indicateurs nationaux</h3>
            {[
              { label: "Structures actives enregistrees",        value: loadKpi ? "…" : kpi?.structuresActives ?? 0,   color: "#10B981" },
              { label: "Alertes pharmacovigilance non resolues", value: loadAlt ? "…" : alertesCritiquesCount,          color: alertesCritiquesCount > 0 ? "#EF4444" : "#10B981" },
              { label: "Medicaments traces dans le systeme",     value: loadKpi ? "…" : kpi?.medicamentsTraces ?? 0,   color: "#3B82F6" },
              { label: "Medicaments avec stock disponible",      value: loadMed ? "…" : `${pctDispo}%`,                color: pctDispo < 70 ? "#EF4444" : pctDispo < 85 ? "#F59E0B" : "#10B981" },
              { label: "Medicaments en rupture de stock",        value: loadMed ? "…" : ruptures,                      color: ruptures > 0 ? "#EF4444" : "#10B981" },
              { label: "Medicaments sous le seuil minimum",      value: loadMed ? "…" : sousSeuil,                     color: sousSeuil > 0 ? "#F59E0B" : "#10B981" },
            ].map((ind) => (
              <div key={ind.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border-light)" }}>
                <span style={{ fontSize: 13, color: colors.textSecondary }}>{ind.label}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: ind.color }}>{ind.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
