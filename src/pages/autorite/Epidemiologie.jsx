import { colors } from "../../theme";
import { useMemo, useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import Layout from "../../components/Layout";
import { useAlertes } from "../../hooks/useSupabaseData";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../supabaseClient";

const SEVERITE_STYLE = {
  critique: { bg: "#FEF2F2", color: "#EF4444" },
  haute:    { bg: "#FFFBEB", color: "#D97706" },
  moyenne:  { bg: "#EFF6FF", color: "#2563EB" },
  faible:   { bg: "#DCFCE7", color: "#16A34A" },
};

const MOIS_LABELS = ["Jan", "Fev", "Mar", "Avr", "Mai", "Jun", "Jul", "Aou", "Sep", "Oct", "Nov", "Dec"];

function useEpiStats() {
  const { auth } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth?.etablissement_id) { setLoading(false); return; }
    const sixMoisAgo = new Date();
    sixMoisAgo.setMonth(sixMoisAgo.getMonth() - 6);

    Promise.all([
      supabase.from("consultations")
        .select("motif, service, triage, heure_arrivee")
        .gte("heure_arrivee", sixMoisAgo.toISOString())
        .not("motif", "is", null),
      supabase.from("examens")
        .select("type_examen, interpretation, created_at")
        .eq("interpretation", "critique")
        .gte("created_at", sixMoisAgo.toISOString()),
      supabase.from("hospitalisations")
        .select("service, statut, date_entree")
        .gte("date_entree", sixMoisAgo.toISOString()),
    ]).then(([consult, examens, hospit]) => {
      const compteurMotifs = {};
      (consult.data ?? []).forEach((c) => {
        const m = (c.motif ?? "").trim().toLowerCase();
        if (m) compteurMotifs[m] = (compteurMotifs[m] ?? 0) + 1;
      });
      const topMotifs = Object.entries(compteurMotifs)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([motif, count]) => ({ motif, count }));

      const parService = {};
      (hospit.data ?? []).forEach((h) => {
        const s = h.service ?? "Inconnu";
        if (!parService[s]) parService[s] = { total: 0, actifs: 0 };
        parService[s].total += 1;
        if (h.statut === "hospitalise") parService[s].actifs += 1;
      });

      setStats({ topMotifs, parService, totalConsult: consult.data?.length ?? 0 });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [auth?.etablissement_id]);

  return { stats, loading };
}

export default function Épidémiologie() {
  const { data: alertes, loading } = useAlertes(100);
  const { stats, loading: statsLoading } = useEpiStats();

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
          <div key={k.label} style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "18px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 20 }}>
        <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: colors.navy }}>Alertes par mois — 6 derniers mois</h3>
        {loading ? (
          <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: colors.textMuted, fontSize: 14 }}>Chargement…</div>
        ) : affichees.length === 0 ? (
          <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: colors.textMuted, fontSize: 14 }}>Aucune alerte enregistrée.</div>
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

      {!statsLoading && stats?.topMotifs?.length > 0 && (
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: colors.navy }}>
            Top motifs de consultation — 6 derniers mois
          </h3>
          {stats.topMotifs.map((m, i) => (
            <div key={m.motif} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: i < stats.topMotifs.length - 1 ? "1px solid var(--border-light)" : "none" }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: i === 0 ? "#8B5CF6" : colors.bgSurface, color: i === 0 ? "white" : colors.textMuted, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {i + 1}
              </span>
              <span style={{ flex: 1, fontSize: 13, color: colors.navy, textTransform: "capitalize" }}>{m.motif}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: colors.textSecondary }}>{m.count} cas</span>
              <div style={{ width: 80, height: 6, backgroundColor: colors.borderLight ?? "#E5E7EB", borderRadius: 3 }}>
                <div style={{ height: "100%", width: `${Math.round((m.count / stats.topMotifs[0].count) * 100)}%`, backgroundColor: "#8B5CF6", borderRadius: 3 }} />
              </div>
            </div>
          ))}
          <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 12 }}>
            Base sur {stats.totalConsult} consultations enregistrees dans MedOS
          </div>
        </div>
      )}

      {!statsLoading && stats?.parService && Object.keys(stats.parService).length > 0 && (
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: colors.navy }}>
            Hospitalisations par service — 6 derniers mois
          </h3>
          {Object.entries(stats.parService)
            .sort(([, a], [, b]) => b.total - a.total)
            .slice(0, 6)
            .map(([service, data]) => {
              const tauxActifs = data.total > 0 ? Math.round((data.actifs / data.total) * 100) : 0;
              const maxTotal = Math.max(...Object.values(stats.parService).map((d) => d.total));
              return (
                <div key={service} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: colors.navy, fontWeight: 600 }}>{service}</span>
                    <span style={{ color: colors.textMuted }}>{data.actifs} hospitalises actuellement / {data.total} total</span>
                  </div>
                  <div style={{ height: 8, backgroundColor: colors.borderLight ?? "#E5E7EB", borderRadius: 4 }}>
                    <div style={{
                      height: "100%",
                      width: `${Math.min(100, Math.round((data.total / maxTotal) * 100))}%`,
                      backgroundColor: tauxActifs > 70 ? "#EF4444" : tauxActifs > 40 ? "#F59E0B" : "#10B981",
                      borderRadius: 4,
                    }} />
                  </div>
                </div>
              );
            })
          }
        </div>
      )}

      <div className="dash-grid-2">
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: colors.navy }}>Alertes actives</h3>
          {loading ? (
            <div style={{ color: colors.textMuted, fontSize: 13 }}>Chargement…</div>
          ) : affichees.length === 0 ? (
            <div style={{ padding: "32px 0", textAlign: "center", color: colors.textMuted, fontSize: 13 }}>
              Aucune alerte épidémiologique enregistrée.
            </div>
          ) : (
            affichees.slice(0, 8).map((a) => {
              const s = SEVERITE_STYLE[a.severite] ?? SEVERITE_STYLE.faible;
              return (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "11px 0", borderBottom: "1px solid var(--border-light)" }}>
                  <div style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: colors.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.titre ?? "Alerte"}</div>
                    <div style={{ fontSize: 11, color: colors.textMuted }}>{a.type ?? "—"}</div>
                  </div>
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, backgroundColor: s.bg, color: s.color, fontWeight: 700, flexShrink: 0 }}>
                    {a.severite ?? "faible"}
                  </span>
                </div>
              );
            })
          )}
        </div>

        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: colors.navy }}>Repartition par severite</h3>
          {loading ? (
            <div style={{ color: colors.textMuted, fontSize: 13 }}>Chargement…</div>
          ) : affichees.length === 0 ? (
            <div style={{ padding: "32px 0", textAlign: "center", color: colors.textMuted, fontSize: 13 }}>
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
                    <span style={{ fontSize: 13, fontWeight: 800, color: colors.navy }}>{count} alerte{count !== 1 ? "s" : ""}</span>
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
