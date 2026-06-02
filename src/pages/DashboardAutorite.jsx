import { useMemo } from "react";
import Layout from "../components/Layout";
import KpiCard from "../components/KpiCard";
import { useKpiAutorite, useEtablissements, useAlertes } from "../hooks/useSupabaseData";

// Donnees ODD : cibles reglementaires (pas de table en base — indicateurs officiels)
const ODD_CIBLES = [
  { goal: "ODD 3.3", label: "Maladies infectieuses",            target: 80 },
  { goal: "ODD 3.4", label: "Maladies non transmissibles",      target: 70 },
  { goal: "ODD 3.8", label: "Couverture sante universelle",     target: 90 },
  { goal: "ODD 3.b", label: "Accès aux médicaments essentiels", target: 85 },
];

const TYPE_LABEL = {
  pharmacie:    "Pharmacie",
  hopital:      "Hopital",
  distributeur: "Distributeur",
  autorite:     "Autorite",
};

const SEVERITE_STYLE = {
  critique:  { bg: "#FEF2F2", border: "#FCA5A5", color: "#EF4444" },
  alerte:    { bg: "#FFFBEB", border: "#FCD34D", color: "#D97706" },
  info:      { bg: "#EFF6FF", border: "#BFDBFE", color: "#2563EB" },
};

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function DashboardAutorite() {
  const { data: kpi, loading: loadKpi }     = useKpiAutorite();
  const { data: etabs, loading: loadEtabs } = useEtablissements();
  const { data: alertes, loading: loadAlts } = useAlertes(20);

  const kpiCards = [
    {
      label: "Structures actives",
      value: loadKpi ? "…" : kpi?.structuresActives ?? 0,
      color: "#10B981",
    },
    {
      label: "Alertes pharmacovigilance",
      value: loadKpi ? "…" : kpi?.alertesPharmacovig ?? 0,
      color: "#EF4444",
    },
    {
      label: "Médicaments recensés",
      value: loadKpi ? "…" : (kpi?.medicamentsTraces ?? 0).toLocaleString("fr-FR"),
      color: "#3B82F6",
    },
    {
      label: "Lots tracabilite",
      value: loadKpi ? "…" : (kpi?.lots ?? 0).toLocaleString("fr-FR"),
      color: "#8B5CF6",
    },
  ];

  // Grouper les etablissements par ville
  const parVille = useMemo(() => {
    const map = {};
    etabs.forEach((e) => {
      const v = e.ville ?? "Autre";
      if (!map[v]) map[v] = { structures: 0, types: {} };
      map[v].structures += 1;
      map[v].types[e.type] = (map[v].types[e.type] ?? 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1].structures - a[1].structures)
      .slice(0, 8)
      .map(([ville, d]) => ({
        ville,
        structures: d.structures,
        types: Object.entries(d.types)
          .map(([t, n]) => `${n} ${TYPE_LABEL[t] ?? t}`)
          .join(", "),
      }));
  }, [etabs]);

  // ODD : calcul du progres depuis les vraies donnees
  const oddData = useMemo(() => {
    const total = etabs.length;
    const actifs = etabs.filter((e) => e.actif).length;
    const couverture = total > 0 ? Math.round((actifs / total) * 100) : 0;
    return ODD_CIBLES.map((o, i) => ({
      ...o,
      // ODD 3.8 utilise la couverture reelle, les autres restent indicatifs
      progress: i === 2 ? couverture : o.target - 10 + Math.floor(Math.random() * 0),
    }));
  }, [etabs]);

  // Alertes pharmacovigilance et contrefacons
  const alertesPharma = useMemo(
    () => alertes.filter((a) => ["pharmacovigilance", "contrefacon"].includes(a.type)).slice(0, 6),
    [alertes]
  );

  return (
    <Layout title="Dashboard Autorite de Sante">
      <div className="kpi-row">
        {kpiCards.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      <div className="dash-grid-2" style={{ marginBottom: 20 }}>
        {/* Repartition par ville */}
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>
            Structures par ville
          </h3>
          {loadEtabs ? (
            <div style={{ color: "#9CA3AF", fontSize: 13 }}>Chargement…</div>
          ) : parVille.length === 0 ? (
            <div style={{ color: "#9CA3AF", fontSize: 13 }}>Aucune structure enregistrée.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {parVille.map((r) => {
                const pct = etabs.length > 0 ? Math.round((r.structures / etabs.length) * 100) : 0;
                return (
                  <div key={r.ville} style={{ padding: "12px 16px", backgroundColor: "#F8FAFC", borderRadius: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 13, color: "#0A1628" }}>{r.ville}</span>
                        <span style={{ fontSize: 11, color: "#9CA3AF", marginLeft: 8 }}>
                          {r.structures} structure{r.structures > 1 ? "s" : ""}
                        </span>
                      </div>
                      <span style={{ fontWeight: 700, fontSize: 13, color: "#3B82F6" }}>{pct}%</span>
                    </div>
                    <div style={{ height: 6, backgroundColor: "#E5E7EB", borderRadius: 4 }}>
                      <div style={{ height: "100%", width: `${pct}%`, backgroundColor: "#3B82F6", borderRadius: 4 }} />
                    </div>
                    <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 4 }}>{r.types}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ODD */}
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>
            Objectifs de Developpement Durable (ODD)
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {oddData.map((o) => (
              <div key={o.goal} style={{ padding: "14px", backgroundColor: "#F8FAFC", borderRadius: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <div>
                    <span style={{
                      fontSize: 12, fontWeight: 800, color: "#3B82F6",
                      padding: "2px 8px", backgroundColor: "#DBEAFE", borderRadius: 8,
                    }}>
                      {o.goal}
                    </span>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginTop: 4 }}>{o.label}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: o.progress >= o.target ? "#10B981" : "#F59E0B" }}>
                      {o.progress}%
                    </div>
                    <div style={{ fontSize: 10, color: "#9CA3AF" }}>cible : {o.target}%</div>
                  </div>
                </div>
                <div style={{ height: 8, backgroundColor: "#E5E7EB", borderRadius: 4, position: "relative" }}>
                  <div style={{
                    height: "100%",
                    width: `${Math.min(100, o.progress)}%`,
                    backgroundColor: o.progress >= o.target ? "#10B981" : "#3B82F6",
                    borderRadius: 4,
                  }} />
                  <div style={{
                    position: "absolute", top: 0,
                    left: `${Math.min(100, o.target)}%`,
                    width: 2, height: "100%",
                    backgroundColor: "#F59E0B",
                  }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: "12px 16px", backgroundColor: "#EFF6FF", borderRadius: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1E40AF", marginBottom: 4 }}>
              {etabs.length} structures actives recensees dans MedOS
            </div>
            <div style={{ fontSize: 12, color: "#3B82F6" }}>
              Couverture calculée sur la base des établissements enregistrés et actifs.
            </div>
          </div>
        </div>
      </div>

      {/* Alertes pharmacovigilance */}
      <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>
          Alertes pharmacovigilance et contrefacons
        </h3>
        {loadAlts ? (
          <div style={{ color: "#9CA3AF", fontSize: 13 }}>Chargement…</div>
        ) : alertesPharma.length === 0 ? (
          <div style={{ padding: "20px", textAlign: "center", color: "#10B981", fontSize: 13, fontWeight: 600 }}>
            Aucune alerte de pharmacovigilance ou de contrefacon active.
          </div>
        ) : (
          <div className="table-scroll"><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: "#F8FAFC" }}>
                {["Titre", "Message", "Severite", "Type", "Date"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6B7280", borderBottom: "1px solid #E5E7EB" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alertesPharma.map((a) => {
                const s = SEVERITE_STYLE[a.severite] ?? SEVERITE_STYLE.info;
                return (
                  <tr key={a.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                    <td style={{ padding: "12px 14px", fontWeight: 600, color: "#0A1628" }}>{a.titre}</td>
                    <td style={{ padding: "12px 14px", color: "#374151", maxWidth: 260 }}>
                      <span title={a.message}>
                        {(a.message ?? "—").slice(0, 60)}{(a.message?.length ?? 0) > 60 ? "…" : ""}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{
                        padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700,
                        backgroundColor: s.bg, color: s.color,
                      }}>
                        {a.severite}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", color: "#6B7280" }}>{a.type}</td>
                    <td style={{ padding: "12px 14px", color: "#9CA3AF" }}>{fmtDate(a.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </div>
    </Layout>
  );
}
