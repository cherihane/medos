import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import KpiCard from "../../components/KpiCard";
import PredictionsIA from "../../components/PredictionsIA";
import { useAlertes, useKpiHopital, usePatients } from "../../hooks/useSupabaseData";
import { supabase } from "../../supabaseClient";
import { colors, radius, shadow, font } from "../../theme";

function useTendanceHopital() {
  const [hier, setHier] = useState(null);
  useEffect(() => {
    const today = new Date();
    const hierDebut = new Date(today); hierDebut.setDate(hierDebut.getDate() - 1); hierDebut.setHours(0,0,0,0);
    const hierFin   = new Date(today); hierFin.setDate(hierFin.getDate() - 1); hierFin.setHours(23,59,59,999);
    Promise.all([
      supabase.from("alertes").select("id, severite").eq("resolu", false).gte("created_at", hierDebut.toISOString()).lte("created_at", hierFin.toISOString()),
      supabase.from("ordonnances").select("id").gte("created_at", hierDebut.toISOString()).lte("created_at", hierFin.toISOString()),
    ]).then(([alts, ords]) => {
      setHier({
        alertesHier: (alts.data ?? []).filter((a) => a.severite === "critique").length,
        ordonnancesHier: ords.data?.length ?? 0,
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


function severiteStyle(severite) {
  switch (severite) {
    case "critique": return { bg: "#FEF2F2", border: "#EF4444" };
    case "alerte":   return { bg: "#FFFBEB", border: "#F59E0B" };
    default:         return { bg: "#EFF6FF", border: "#3B82F6" };
  }
}

function Skeleton({ height = 16, width = "100%", mb = 8 }) {
  return (
    <div style={{
      height, width, backgroundColor: colors.borderLight, borderRadius: 6, marginBottom: mb,
      animation: "pulse 1.5s ease-in-out infinite",
    }} />
  );
}

// ── KPI depuis Supabase ───────────────────────────────────────────────────────
function KpiSection() {
  const { data: live, loading } = useKpiHopital();
  const hier = useTendanceHopital();
  const navigate = useNavigate();

  const kpis = [
    { label: "Patients hospitalisés",  value: live?.patientsHospitalises ?? 0, color: "#3B82F6", to: "/hopital/patients",   change: null },
    { label: "Alertes critiques",      value: live?.alertesCritiques ?? 0,     color: "#EF4444", to: "/hopital/alertes",    change: hier ? fmtChange(live?.alertesCritiques ?? 0, hier.alertesHier) : null },
    { label: "Médicaments dispensés",  value: live?.medicamentsDispenses ?? 0, color: "#10B981", to: "/hopital/stock",      change: null },
    { label: "Ordonnances",            value: live?.consultations ?? 0,        color: "#8B5CF6", to: "/hopital/patients",   change: hier ? fmtChange(live?.consultations ?? 0, hier.ordonnancesHier) : null },
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

// ── Panneau alertes (données Supabase) ────────────────────────────────────────
function AlertesPanel() {
  const { data, loading, error } = useAlertes(8);

  const alertes = data;
  const isLive  = !loading && !error && data.length > 0;

  return (
    <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.navy }}>Alertes actives</h3>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
          backgroundColor: isLive ? "#DCFCE7" : "#F3F4F6",
          color: isLive ? "#16A34A" : "#9CA3AF",
        }}>
          {isLive ? "TEMPS RÉEL" : "STATIQUE"}
        </span>
      </div>

      {loading && [1,2,3].map((i) => <Skeleton key={i} height={44} mb={8} />)}

      {!loading && alertes.length === 0 && (
        <div style={{ fontSize: 13, color: colors.textMuted, textAlign: "center", padding: "20px 0" }}>
          Aucune alerte active
        </div>
      )}

      {!loading && alertes.map((a, i) => {
        const { bg, border } = severiteStyle(a.severite);
        return (
          <div key={a.id || i} style={{
            display: "flex", flexDirection: "column", padding: "11px 14px",
            borderRadius: 10, marginBottom: 8, backgroundColor: bg,
            borderLeft: `4px solid ${border}`,
          }}>
            <span style={{ fontSize: 13, color: colors.text, fontWeight: 500 }}>{a.titre}</span>
            {a.message && a.message !== a.titre && (
              <span style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{a.message}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Panneau patients récents ──────────────────────────────────────────────────
function PatientsPanel() {
  const { data, loading } = usePatients();

  const recent = data.slice(0, 5);

  return (
    <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.navy }}>Patients enregistrés</h3>
        {!loading && (
          <span style={{ fontSize: 12, color: colors.textSecondary }}>{data.length} total</span>
        )}
      </div>

      {loading && [1,2,3].map((i) => <Skeleton key={i} height={40} mb={8} />)}

      {!loading && recent.length === 0 && (
        <div style={{ fontSize: 12, color: colors.textMuted, textAlign: "center", padding: "20px 0" }}>
          Aucun patient enregistré
        </div>
      )}

      {!loading && recent.length > 0 && (
        <div>
          {recent.map((p) => (
            <div key={p.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 0", borderBottom: "1px solid var(--border-light)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  backgroundColor: "#EFF6FF",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700, color: "#3B82F6",
                }}>
                  {p.prenom?.[0]}{p.nom?.[0]}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: colors.navy }}>
                    {p.prenom} {p.nom}
                  </div>
                  <div style={{ fontSize: 11, color: colors.textMuted }}>
                    {p.antecedents?.length > 0 ? p.antecedents.join(", ") : "Aucun antécédent"}
                  </div>
                </div>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 8,
                backgroundColor: colors.borderLight, color: colors.textSecondary,
              }}>
                {p.groupe_sanguin || "—"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Occupation des services */}
      <h3 style={{ margin: "20px 0 14px", fontSize: 14, fontWeight: 700, color: colors.navy }}>Occupation des services</h3>
      <div style={{ fontSize: 13, color: colors.textMuted, textAlign: "center", padding: "16px 0" }}>
        Aucune donnée d'occupation disponible.<br />
        <span style={{ fontSize: 12 }}>Connectez un module de gestion des lits pour afficher les taux en temps réel.</span>
      </div>
    </div>
  );
}

// ── Dashboard principal ───────────────────────────────────────────────────────
export default function DashboardHopital() {
  return (
    <Layout title="Dashboard Hôpital" subtitle="Vue d'ensemble — Hôpital Central Abidjan">
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      <KpiSection />

      <div className="dash-grid-2">
        <AlertesPanel />
        <PatientsPanel />
      </div>

      <div className="dash-grid-2" style={{ marginTop: 20 }}>
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 700, color: colors.navy }}>Dispensation médicaments</h3>
          <p style={{ margin: 0, fontSize: 13, color: colors.textMuted }}>Données de dispensation disponibles après enregistrement des ventes en caisse.</p>
        </div>
        <PredictionsIA />
      </div>
    </Layout>
  );
}
