import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import Layout from "../../components/Layout";
import KpiCard from "../../components/KpiCard";
import { kpiPharmacy, salesData } from "../../data/staticData";
import { useMedicamentsCritiques, useKpiPharmacie } from "../../hooks/useSupabaseData";

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
          <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{med.nom}</span>
          <span style={{ fontSize: 10, color: "#9CA3AF", marginLeft: 6 }}>{med.categorie}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <SeveriteBadge pct={pct} />
          <span style={{ fontSize: 12, color: "#EF4444", fontWeight: 700 }}>
            {med.stock_actuel}/{med.stock_minimum}
          </span>
        </div>
      </div>
      <div style={{ height: 6, backgroundColor: "#F3F4F6", borderRadius: 4 }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          backgroundColor: barColor,
          borderRadius: 4,
          transition: "width 0.4s",
        }} />
      </div>
      <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 3 }}>
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
      backgroundColor: "#F3F4F6",
      borderRadius: 6,
      marginBottom: mb,
      animation: "pulse 1.5s ease-in-out infinite",
    }} />
  );
}

// ── KPI fusionnés (Supabase + fallback statique) ─────────────────────────────
function KpiSection() {
  const { data: live, loading } = useKpiPharmacie();

  const kpis = kpiPharmacy.map((k) => {
    if (!live) return k;
    if (k.label === "Produits en rupture")
      return { ...k, value: String(live.ruptures), change: live.ruptures > 5 ? "-" + live.ruptures : "+" + (5 - live.ruptures) };
    if (k.label === "Clients du jour")
      return { ...k, value: String(live.totalPatients) };
    return k;
  });

  if (loading) {
    return (
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ flex: 1, backgroundColor: "white", borderRadius: 14, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <Skeleton height={36} width={36} mb={12} />
            <Skeleton height={28} width="60%" mb={8} />
            <Skeleton height={14} width="80%" mb={0} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
      {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
    </div>
  );
}

// ── Panneau stock critique ────────────────────────────────────────────────────
function StockCritiquePanel() {
  const { data, loading, error } = useMedicamentsCritiques(6);

  return (
    <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Stock Critique</h3>
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
        <div style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", padding: "20px 0" }}>
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

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", minWidth: 0 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>
            Ventes — 7 derniers jours
          </h3>
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesData}>
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => v >= 1000 ? `${v / 1000}k` : v} />
                <Tooltip formatter={(v) => `${v.toLocaleString()} FCFA`} />
                <Bar dataKey="ventes" fill="#3B82F6" radius={[6, 6, 0, 0]} name="Ventes" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <StockCritiquePanel />
      </div>

      <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginTop: 20, minWidth: 0 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Tendance ordonnances</h3>
        <div style={{ width: "100%", height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={salesData}>
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="ordonnances" stroke="#10B981" strokeWidth={2.5} dot={{ fill: "#10B981", r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Layout>
  );
}
