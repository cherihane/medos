import { useState } from "react";
import Layout from "../../components/Layout";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useAlertesPaginated, useAlertesStats } from "../../hooks/useSupabaseData";
import { updateAlerte } from "../../hooks/useMutations";
import Pagination from "../../components/Pagination";

const severityStyle = {
  critique: { bg: "#FEF2F2", border: "#FCA5A5", color: "#EF4444", dot: "#EF4444" },
  alerte:   { bg: "#FFFBEB", border: "#FCD34D", color: "#D97706", dot: "#F59E0B" },
  info:     { bg: "#EFF6FF", border: "#BFDBFE", color: "#2563EB", dot: "#3B82F6" },
};

function fmt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function Alertes() {
  const [filter, setFilter] = useState("tous");
  const { data: alertes, loading, error, total, page, setPage, totalPages, refetch } = useAlertesPaginated(filter);
  const stats = useAlertesStats();
  const { toasts, success, error: toastError } = useToast();
  const [readIds, setReadIds] = useState(new Set());
  const [actioning, setActioning] = useState(null);

  const markRead = async (id) => {
    setActioning(id);
    try {
      await updateAlerte(id, { lu: true });
      setReadIds((prev) => new Set([...prev, id]));
      success("Alerte marquée comme lue");
    } catch (e) {
      toastError("Erreur : " + e.message);
    } finally {
      setActioning(null);
    }
  };

  const markAllRead = async () => {
    const unread = alertes.filter((a) => !readIds.has(a.id));
    try {
      await Promise.all(unread.map((a) => updateAlerte(a.id, { lu: true })));
      setReadIds(new Set(alertes.map((a) => a.id)));
      success(`${unread.length} alertes marquées comme lues`);
    } catch (e) {
      toastError("Erreur : " + e.message);
    }
  };

  const filtered = alertes;
  const unreadCount = alertes.filter((a) => !readIds.has(a.id)).length;

  return (
    <Layout title="Alertes" subtitle="Surveillance et gestion des alertes pharmaceutiques">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <Toast toasts={toasts} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {["tous", "critique", "alerte", "info"].map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", textTransform: "capitalize",
              border: filter === f ? "2px solid #10B981" : "1.5px solid #E5E7EB",
              backgroundColor: filter === f ? "#DCFCE7" : "white",
              color: filter === f ? "#16A34A" : "#6B7280",
            }}>{f}</button>
          ))}
          {unreadCount > 0 && (
            <span style={{ padding: "3px 10px", backgroundColor: "#EF4444", color: "white", borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
              {unreadCount} non lues
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} style={{ padding: "8px 16px", backgroundColor: "white", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 13, color: "#374151", cursor: "pointer", fontWeight: 600 }}>
            Tout marquer comme lu
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Critiques",    value: stats.loading ? "…" : stats.critique, color: "#EF4444", bg: "#FEF2F2" },
          { label: "Alertes",      value: stats.loading ? "…" : stats.alerte,   color: "#F59E0B", bg: "#FFFBEB" },
          { label: "Informations", value: stats.loading ? "…" : stats.info,     color: "#3B82F6", bg: "#EFF6FF" },
          { label: "Non lues",     value: loading ? "…" : unreadCount,          color: "#8B5CF6", bg: "#F5F3FF" },
        ].map((s) => (
          <div key={s.label} style={{ backgroundColor: s.bg, borderRadius: 12, padding: "14px 20px", flex: 1, borderLeft: `4px solid ${s.color}` }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "14px 18px", marginBottom: 16, fontSize: 13, color: "#DC2626" }}>
          Erreur : {error.message}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {loading && [1, 2, 3, 4].map((i) => (
          <div key={i} style={{ height: 72, backgroundColor: "#F8FAFC", borderRadius: 14, animation: "pulse 1.5s ease-in-out infinite" }} />
        ))}
        {!loading && filtered.length === 0 && (
          <div style={{ backgroundColor: "white", borderRadius: 14, padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
            Aucune alerte active
          </div>
        )}
        {!loading && filtered.map((alert) => {
          const s = severityStyle[alert.severite] ?? severityStyle.info;
          const isRead = readIds.has(alert.id);
          const isActioning = actioning === alert.id;
          return (
            <div key={alert.id} style={{
              backgroundColor: isRead ? "white" : s.bg,
              border: `1px solid ${isRead ? "#E5E7EB" : s.border}`,
              borderRadius: 14, padding: "16px 20px",
              display: "flex", alignItems: "center", gap: 14,
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              opacity: isRead ? 0.7 : 1,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: isRead ? 500 : 700, color: "#0A1628", marginBottom: 4 }}>{alert.titre}</div>
                {alert.message && alert.message !== alert.titre && (
                  <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>{alert.message}</div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, fontWeight: 700, backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{alert.severite}</span>
                  <span style={{ fontSize: 11, color: "#9CA3AF" }}>{alert.type}</span>
                  <span style={{ fontSize: 12, color: "#9CA3AF" }}>{fmt(alert.created_at)}</span>
                </div>
              </div>
              {!isRead && (
                <button
                  onClick={() => markRead(alert.id)}
                  disabled={isActioning}
                  style={{ padding: "6px 14px", backgroundColor: "white", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12, color: "#374151", cursor: isActioning ? "wait" : "pointer" }}>
                  {isActioning ? "…" : "Marquer lu"}
                </button>
              )}
              <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: isRead ? "#D1D5DB" : s.dot, flexShrink: 0 }} />
            </div>
          );
        })}
      </div>
      <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
    </Layout>
  );
}
