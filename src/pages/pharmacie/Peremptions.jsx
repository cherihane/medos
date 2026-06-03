import { colors } from "../../theme";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useMedicaments } from "../../hooks/useSupabaseData";
import { useThemeTokens } from "../../context/DarkModeContext";

function todayISO() { return new Date().toISOString().slice(0, 10); }

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).setHours(12) - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

function CriticiteBadge({ days }) {
  if (days === null) return <span style={{ fontSize: 11, color: colors.textMuted }}>Pas de date</span>;
  if (days < 0) return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, backgroundColor: "#1F2937", color: "#F9FAFB" }}>Expiré</span>;
  if (days <= 30) return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, backgroundColor: "#FEF2F2", color: "#DC2626" }}>Critique — {days}j</span>;
  if (days <= 60) return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, backgroundColor: "#FFFBEB", color: "#D97706" }}>Alerte — {days}j</span>;
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, backgroundColor: "#FEF9C3", color: "#A16207" }}>Vigilance — {days}j</span>;
}

export default function Peremptions() {
  const t = useThemeTokens();
  const navigate = useNavigate();
  const { data: medicaments, loading } = useMedicaments();
  const { toasts } = useToast();
  const [filtre, setFiltre] = useState(90); // jours

  const produits = useMemo(() => {
    return medicaments
      .filter((m) => {
        if (!m.date_peremption) return false;
        const d = daysUntil(m.date_peremption);
        return d !== null && d <= filtre;
      })
      .map((m) => ({ ...m, jours: daysUntil(m.date_peremption) }))
      .sort((a, b) => (a.jours ?? 999) - (b.jours ?? 999));
  }, [medicaments, filtre]);

  const expires  = produits.filter((m) => (m.jours ?? 0) < 0).length;
  const critique = produits.filter((m) => (m.jours ?? 999) >= 0 && (m.jours ?? 999) <= 30).length;
  const alerte   = produits.filter((m) => (m.jours ?? 999) > 30 && (m.jours ?? 999) <= 60).length;

  function exportCSV() {
    const header = ["Médicament", "Catégorie", "Stock actuel", "Date péremption", "Jours restants", "Criticité"].join(";");
    const rows = produits.map((m) => {
      const crit = (m.jours ?? 0) < 0 ? "Expiré" : (m.jours ?? 999) <= 30 ? "Critique" : (m.jours ?? 999) <= 60 ? "Alerte" : "Vigilance";
      return [m.nom, m.categorie ?? "", m.stock_actuel ?? 0, fmtDate(m.date_peremption), m.jours ?? "", crit].join(";");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `peremptions_${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Layout title="Péremptions" subtitle="Médicaments arrivant à expiration">
      <Toast toasts={toasts} />
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      {/* KPI */}
      <div className="kpi-row" style={{ marginBottom: 20 }}>
        {[
          { label: "Produits expirés", value: expires,  color: "#1F2937" },
          { label: "Critique (< 30j)", value: critique, color: "#EF4444" },
          { label: "Alerte (30–60j)",  value: alerte,   color: "#F59E0B" },
          { label: "Total sur la période", value: produits.length, color: "#3B82F6" },
        ].map((k) => (
          <div key={k.label} style={{ flex: 1, backgroundColor: t.bgCard, borderRadius: 14, padding: "18px 22px", boxShadow: t.shadow, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: t.textLight, marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ backgroundColor: t.bgCard, borderRadius: 14, padding: "16px 20px", boxShadow: t.shadow, marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: t.textHeavy }}>Horizon :</span>
        {[30, 60, 90].map((d) => (
          <button key={d} onClick={() => setFiltre(d)} style={{ padding: "7px 18px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", backgroundColor: filtre === d ? "#3B82F6" : t.bgSurface, color: filtre === d ? "white" : t.textLight }}>
            {d} jours
          </button>
        ))}
        <button onClick={() => setFiltre(999)} style={{ padding: "7px 18px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", backgroundColor: filtre === 999 ? "#3B82F6" : t.bgSurface, color: filtre === 999 ? "white" : t.textLight }}>
          Tous
        </button>
        <div style={{ marginLeft: "auto" }}>
          <button onClick={exportCSV} disabled={produits.length === 0} style={{ padding: "8px 18px", backgroundColor: produits.length === 0 ? "#E5E7EB" : "#0A1628", color: produits.length === 0 ? "#9CA3AF" : "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: produits.length === 0 ? "not-allowed" : "pointer" }}>
            Exporter CSV
          </button>
        </div>
      </div>

      {/* Tableau */}
      <div style={{ backgroundColor: t.bgCard, borderRadius: 14, boxShadow: t.shadow, overflow: "hidden" }}>
        <div className="table-scroll">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: t.bgSurface }}>
                {["Médicament", "Catégorie", "Stock actuel", "Date péremption", "Criticité", "Action"].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: t.textLight, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && [1, 2, 3, 4].map((i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${t.borderLight}`, animation: "pulse 1.5s ease-in-out infinite" }}>
                  {[160, 100, 80, 100, 100, 80].map((w, j) => (
                    <td key={j} style={{ padding: "13px 16px" }}>
                      <div style={{ height: 13, width: w, backgroundColor: colors.borderLight, borderRadius: 6 }} />
                    </td>
                  ))}
                </tr>
              ))}
              {!loading && produits.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: "40px 16px", textAlign: "center", color: t.textMuted, fontSize: 13 }}>
                    Aucun médicament n'expire dans les {filtre === 999 ? "—" : filtre + " prochains"} jours.
                  </td>
                </tr>
              )}
              {!loading && produits.map((m) => (
                <tr key={m.id} style={{ borderBottom: `1px solid ${t.borderLight}` }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = t.bgSurface} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ""}>
                  <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: t.textHeavy }}>{m.nom}</td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: t.textLight }}>{m.categorie ?? "—"}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: (m.stock_actuel ?? 0) === 0 ? "#9CA3AF" : t.textHeavy }}>
                    {m.stock_actuel ?? 0}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: t.text }}>{fmtDate(m.date_peremption)}</td>
                  <td style={{ padding: "12px 16px" }}><CriticiteBadge days={m.jours} /></td>
                  <td style={{ padding: "12px 16px" }}>
                    {(m.stock_actuel ?? 0) > 0 && (
                      <button
                        onClick={() => navigate("/pharmacie/caisse")}
                        style={{ padding: "5px 14px", backgroundColor: "#3B82F6", color: "white", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                      >
                        Vendre
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
