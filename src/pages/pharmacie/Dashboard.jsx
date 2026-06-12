import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import Layout from "../../components/Layout";
import PredictionsIA from "../../components/PredictionsIA";
import { useMedicamentsCritiques, useKpiPharmacie } from "../../hooks/useSupabaseData";
import { supabase } from "../../supabaseClient";
import { colors, radius, shadow, font } from "../../theme";

function useTendancePharmacie() {
  const [hier, setHier] = useState(null);
  useEffect(() => {
    const today = new Date();
    const hierDebut = new Date(today); hierDebut.setDate(hierDebut.getDate() - 1); hierDebut.setHours(0,0,0,0);
    const hierFin   = new Date(today); hierFin.setDate(hierFin.getDate() - 1); hierFin.setHours(23,59,59,999);
    Promise.all([
      supabase.from("ventes").select("montant_total").gte("created_at", hierDebut.toISOString()).lte("created_at", hierFin.toISOString()),
      supabase.from("ordonnances").select("id").eq("statut", "en_attente").gte("created_at", hierDebut.toISOString()).lte("created_at", hierFin.toISOString()),
    ]).then(([v, o]) => {
      setHier({
        ventesHier: (v.data ?? []).reduce((s, x) => s + (x.montant_total ?? 0), 0),
        ordonnancesHier: o.data?.length ?? 0,
      });
    });
  }, []);
  return hier;
}

function useVentes7Jours() {
  const { auth } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth?.etablissement_id) return;
    const labels = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      labels.push(d.toISOString().slice(0, 10));
    }
    Promise.all(
      labels.map((date) =>
        supabase
          .from("ventes")
          .select("montant_total")
          .eq("etablissement_id", auth.etablissement_id)
          .gte("created_at", date + "T00:00:00")
          .lte("created_at", date + "T23:59:59")
          .then(({ data: rows }) => ({
            jour: new Date(date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }),
            total: (rows ?? []).reduce((s, r) => s + (r.montant_total ?? 0), 0),
          }))
      )
    ).then((results) => { setData(results); setLoading(false); });
  }, [auth?.etablissement_id]);

  return { data, loading };
}

function VentesChart() {
  const { data, loading } = useVentes7Jours();

  if (loading) {
    return <div style={{ height: 240, backgroundColor: colors.bgSurface, borderRadius: 10 }} />;
  }

  const totalSemaine = data.reduce((s, d) => s + d.total, 0);

  if (totalSemaine === 0) {
    return (
      <div style={{ height: 240, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: colors.bgSurface, borderRadius: 10, gap: 8 }}>
        <div style={{ fontSize: 13, color: colors.textMuted }}>Aucune vente enregistree cette semaine.</div>
        <div style={{ fontSize: 11, color: colors.textMuted }}>Les donnees apparaitront apres les premieres transactions en caisse.</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 8 }}>
        Total semaine : <strong style={{ color: colors.navy }}>{totalSemaine.toLocaleString("fr-FR")} FCFA</strong>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <XAxis dataKey="jour" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : v} />
          <Tooltip formatter={(v) => [`${Number(v).toLocaleString("fr-FR")} FCFA`, "Ventes"]} />
          <Bar dataKey="total" fill="#10B981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function fmtChange(now, prev) {
  if (prev == null || prev === 0) return null;
  const pct = Math.round(((now - prev) / prev) * 100);
  return pct > 0 ? `+${pct}%` : `${pct}%`;
}

// ── Badge de sévérité ────────────────────────────────────────────────────────
function SeveriteBadge({ pct }) {
  const color = pct <= 10 ? "#DC2626" : pct <= 30 ? "#F59E0B" : "#10B981";
  const bg    = pct <= 10 ? "#FEF2F2" : pct <= 30 ? "#FFFBEB" : "#DCFCE7";
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 6, backgroundColor: bg, color }}>
      {pct <= 10 ? "CRITIQUE" : pct <= 30 ? "ALERTE" : "OK"}
    </span>
  );
}

// ── Ligne de stock critique ───────────────────────────────────────────────────
function StockRow({ med }) {
  const pct = med.stock_minimum > 0
    ? Math.min(100, Math.round((med.stock_actuel / med.stock_minimum) * 100))
    : 0;
  const barColor = pct <= 10 ? "#DC2626" : pct <= 30 ? "#F59E0B" : "#10B981";

  return (
    <div key={med.id}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <div>
          <span style={{ fontSize: 12, fontWeight: 600, color: colors.text }}>{med.nom}</span>
          <span style={{ fontSize: 10, color: colors.textMuted, marginLeft: 6 }}>{med.categorie}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <SeveriteBadge pct={pct} />
          <span style={{ fontSize: 12, color: "#EF4444", fontWeight: 700 }}>
            {med.stock_actuel}/{med.stock_minimum}
          </span>
        </div>
      </div>
      <div style={{ height: 6, backgroundColor: colors.borderLight, borderRadius: 4 }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          backgroundColor: barColor,
          borderRadius: 4,
          transition: "width 0.4s",
        }} />
      </div>
      <div style={{ fontSize: 10, color: colors.textMuted, marginTop: 3 }}>
        {med.prix_unitaire?.toLocaleString()} FCFA / {med.unite || "unité"}
      </div>
    </div>
  );
}

// ── Squelette de chargement ───────────────────────────────────────────────────
function Skeleton({ height = 16, width = "100%", mb = 8 }) {
  return (
    <div style={{
      height,
      width,
      backgroundColor: colors.borderLight,
      borderRadius: 6,
      marginBottom: mb,
      animation: "pulse 1.5s ease-in-out infinite",
    }} />
  );
}

// ── KPI depuis Supabase ───────────────────────────────────────────────────────
function KpiSection() {
  const { data: live, loading } = useKpiPharmacie();
  const hier = useTendancePharmacie();
  const navigate = useNavigate();

  const kpis = [
    {
      label: "Médicaments référencés",
      value: live?.totalMedicaments ?? 0,
      color: "#3B82F6",
      to: "/pharmacie/inventaire",
      change: null,
    },
    {
      label: "Produits en rupture",
      value: live?.ruptures ?? 0,
      color: "#EF4444",
      to: "/pharmacie/inventaire",
      change: null,
    },
    {
      label: "Patients enregistrés",
      value: live?.totalPatients ?? 0,
      color: "#8B5CF6",
      to: "/pharmacie/patients",
      change: null,
    },
    {
      label: "Ordonnances en attente",
      value: live?.ordonnancesEnAttente ?? 0,
      color: "#F59E0B",
      to: "/pharmacie/ordonnances",
      change: hier ? fmtChange(live?.ordonnancesEnAttente ?? 0, hier.ordonnancesHier) : null,
    },
  ];

  if (loading) {
    return (
      <div className="kpi-row">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ flex: 1, backgroundColor: colors.bgCard, borderRadius: 14, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <Skeleton height={36} width={36} mb={12} />
            <Skeleton height={28} width="60%" mb={8} />
            <Skeleton height={14} width="80%" mb={0} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="kpi-row">
      {kpis.map((k) => (
        <div
          key={k.label}
          onClick={() => navigate(k.to)}
          style={{
            backgroundColor: colors.bgCard, borderRadius: 14, padding: "20px 24px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1,
            borderLeft: `4px solid ${k.color}`,
            cursor: "pointer",
            transition: "box-shadow 0.15s",
          }}
          onMouseEnter={(e) => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)"}
          onMouseLeave={(e) => e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)"}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: k.color }}>{k.value}</div>
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
  );
}

// ── Panneau stock critique ────────────────────────────────────────────────────
function StockCritiquePanel() {
  const { data, loading, error } = useMedicamentsCritiques(6);

  return (
    <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.navy }}>Stock Critique</h3>
        {!loading && !error && (
          <span style={{ fontSize: 11, fontWeight: 700, backgroundColor: "#FEF2F2", color: "#DC2626", padding: "3px 8px", borderRadius: 10 }}>
            {data.length} produit{data.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[1, 2, 3].map((i) => <Skeleton key={i} height={52} mb={0} />)}
        </div>
      )}

      {error && !loading && (
        <div style={{ fontSize: 12, color: colors.textMuted, textAlign: "center", padding: "20px 0" }}>
          Connexion Supabase requise
        </div>
      )}

      {!loading && !error && data.length === 0 && (
        <div style={{ fontSize: 13, color: "#10B981", textAlign: "center", padding: "24px 0" }}>
          Tous les stocks sont suffisants
        </div>
      )}

      {!loading && !error && data.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {data.map((med) => <StockRow key={med.id} med={med} />)}
        </div>
      )}
    </div>
  );
}

// ── Dashboard principal ───────────────────────────────────────────────────────
export default function DashboardPharmacie() {
  return (
    <Layout title="Dashboard Pharmacie" subtitle="Vue d'ensemble de votre activité du jour">
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      <KpiSection />

      <div className="dash-grid-2-1">
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", minWidth: 0 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: colors.navy }}>
            Ventes — 7 derniers jours
          </h3>
          <VentesChart />
        </div>

        <StockCritiquePanel />
      </div>

      <div className="dash-grid-2" style={{ marginTop: 20 }}>
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 700, color: colors.navy }}>Tendance ordonnances</h3>
          <p style={{ margin: 0, fontSize: 13, color: colors.textMuted }}>L'historique des ordonnances apparaîtra ici au fil des dispensations enregistrées.</p>
        </div>
        <PredictionsIA />
      </div>
    </Layout>
  );
}
