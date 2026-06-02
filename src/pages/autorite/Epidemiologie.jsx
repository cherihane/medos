import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import Layout from "../../components/Layout";
import { useAlertes } from "../../hooks/useSupabaseData";

const SEVERITE_STYLE = {
  critique: { bg: "#FEF2F2", color: "#EF4444" },
  haute:    { bg: "#FFFBEB", color: "#D97706" },
  moyenne:  { bg: "#EFF6FF", color: "#2563EB" },
  faible:   { bg: "#DCFCE7", color: "#16A34A" },
};

const MOIS_LABELS = ["Jan", "Fev", "Mar", "Avr", "Mai", "Jun", "Jul", "Aou", "Sep", "Oct", "Nov", "Dec"];

export default function Épidémiologie() {
  const { data: alertes, loading } = useAlertes(100);

  // Alertes de type épidémiologique
  const alertesEpi = useMemo(
    () => alertes.filter((a) =>
      ["epidemie", "epidemiologie", "maladie", "pharmacovigilance", "rupture_critique"].some((kw) =>
        (a.type ?? "").toLowerCase().includes(kw)
      )
    ),
    [alertes]
  );

  // Si pas de filtre specifique, afficher toutes les alertes
  const affichees = alertesEpi.length > 0 ? alertesEpi : alertes;

  // Statistiques par severite
  const parSeverite = useMemo(() => {
    const m = {};
    affichees.forEach((a) => { const s = a.severite ?? "faible"; m[s] = (m[s] ?? 0) + 1; });
    return m;
  }, [affichees]);

  // Groupement par mois (6 derniers mois)
  const chartData = useMemo(() => {
    const now = new Date();
    const mois = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      mois.push({ label: MOIS_LABELS[d.getMonth()], year: d.getFullYear(), month: d.getMonth(), alertes: 0 });
    }
    affichees.forEach((a) => {
      const d = new Date(a.created_at ?? a.date ?? "");
      if (isNaN(d)) return;
      const m = mois.find((x) => x.year === d.getFullYear() && x.month === d.getMonth());
      if (m) m.alertes += 1;
    });
    return mois;
  }, [affichees]);

  const kpis = [
    { label: "Alertes au total",      value: loading ? "…" : affichees.length,              color: "#8B5CF6" },
    { label: "Alertes critiques",     value: loading ? "…" : parSeverite.critique ?? 0,     color: "#EF4444" },
    { label: "Alertes hautes",        value: loading ? "…" : parSeverite.haute ?? 0,        color: "#F59E0B" },
    { label: "Non lues",              value: loading ? "…" : affichees.filter((a) => !a.lu).length, color: "#3B82F6" },
  ];

  return (
    <Layout title="Épidémiologie" subtitle="Surveillance épidémiologique et alertes sanitaires">
      <div className="kpi-row">
        {kpis.map((k) => (
          <div key={k.label} style={{ backgroundColor: "white", borderRadius: 14, padding: "18px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 20 }}>
        <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Alertes par mois — 6 derniers mois</h3>
        {loading ? (
          <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", fontSize: 14 }}>Chargement…</div>
        ) : affichees.length === 0 ? (
          <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", fontSize: 14 }}>Aucune alerte enregistrée.</div>
        ) : (
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="alertes" fill="#8B5CF6" radius={[6, 6, 0, 0]} name="Alertes" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="dash-grid-2">
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Alertes actives</h3>
          {loading ? (
            <div style={{ color: "#9CA3AF", fontSize: 13 }}>Chargement…</div>
          ) : affichees.length === 0 ? (
            <div style={{ padding: "32px 0", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
              Aucune alerte épidémiologique enregistrée.
            </div>
          ) : (
            affichees.slice(0, 8).map((a) => {
              const s = SEVERITE_STYLE[a.severite] ?? SEVERITE_STYLE.faible;
              return (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "11px 0", borderBottom: "1px solid #F3F4F6" }}>
                  <div style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#0A1628", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.titre ?? "Alerte"}</div>
                    <div style={{ fontSize: 11, color: "#9CA3AF" }}>{a.type ?? "—"}</div>
                  </div>
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, backgroundColor: s.bg, color: s.color, fontWeight: 700, flexShrink: 0 }}>
                    {a.severite ?? "faible"}
                  </span>
                </div>
              );
            })
          )}
        </div>

        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Repartition par severite</h3>
          {loading ? (
            <div style={{ color: "#9CA3AF", fontSize: 13 }}>Chargement…</div>
          ) : affichees.length === 0 ? (
            <div style={{ padding: "32px 0", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
              Aucune alerte a afficher.
            </div>
          ) : (
            Object.entries(SEVERITE_STYLE).map(([niv, style]) => {
              const count = parSeverite[niv] ?? 0;
              const pct = affichees.length > 0 ? Math.round((count / affichees.length) * 100) : 0;
              return (
                <div key={niv} style={{ padding: "12px 14px", backgroundColor: style.bg, borderRadius: 10, marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: style.color, textTransform: "capitalize" }}>{niv}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#0A1628" }}>{count} alerte{count !== 1 ? "s" : ""}</span>
                  </div>
                  <div style={{ height: 6, backgroundColor: "rgba(0,0,0,0.08)", borderRadius: 4 }}>
                    <div style={{ height: "100%", width: `${pct}%`, backgroundColor: style.color, borderRadius: 4 }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Layout>
  );
}
