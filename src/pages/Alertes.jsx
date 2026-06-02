import { useState, useEffect } from "react";
import Layout from "../components/Layout";
import { useAlertesRealtime } from "../hooks/useSupabaseData";
import { updateAlerte } from "../hooks/useMutations";

const TYPE_ICONE = {
  rupture:          "Rupture",
  expiration:       "Expiration",
  credit:           "Credit",
  commande:         "Commande",
  ordonnance:       "Ordonnance",
  temperature:      "Temperature",
  livraison:        "Livraison",
  pharmacovigilance: "Pharmacovig.",
  contrefacon:      "Contrefacon",
};

const SEVERITE_STYLE = {
  critique: { bg: "#FEF2F2", border: "#FCA5A5", color: "#EF4444", dot: "#EF4444" },
  alerte:   { bg: "#FFFBEB", border: "#FCD34D", color: "#D97706", dot: "#F59E0B" },
  info:     { bg: "#EFF6FF", border: "#BFDBFE", color: "#2563EB", dot: "#3B82F6" },
};

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now - d) / 60000);
  if (diff < 1) return "il y a quelques secondes";
  if (diff < 60) return `il y a ${diff} min`;
  if (diff < 1440) return `il y a ${Math.floor(diff / 60)} h`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function Alertes() {
  const { data: remote, loading } = useAlertesRealtime(50);
  const [alertList, setAlertList] = useState([]);
  const [filter, setFilter] = useState("tous");
  const [saving, setSaving] = useState(false);

  // Sync state local avec donnees distantes
  useEffect(() => {
    if (!loading) setAlertList(remote);
  }, [remote, loading]);

  const markRead = async (id) => {
    setAlertList((prev) => prev.map((a) => a.id === id ? { ...a, lu: true } : a));
    await updateAlerte(id, { lu: true });
  };

  const markAllRead = async () => {
    const unread = alertList.filter((a) => !a.lu);
    if (unread.length === 0) return;
    setSaving(true);
    setAlertList((prev) => prev.map((a) => ({ ...a, lu: true })));
    await Promise.all(unread.map((a) => updateAlerte(a.id, { lu: true })));
    setSaving(false);
  };

  const filtered = alertList.filter((a) =>
    filter === "tous" || a.severite === filter
  );
  const unreadCount = alertList.filter((a) => !a.lu).length;

  const stats = [
    { label: "Critiques",    value: alertList.filter((a) => a.severite === "critique").length, color: "#EF4444", bg: "#FEF2F2" },
    { label: "Alertes",      value: alertList.filter((a) => a.severite === "alerte").length,   color: "#F59E0B", bg: "#FFFBEB" },
    { label: "Informations", value: alertList.filter((a) => a.severite === "info").length,      color: "#3B82F6", bg: "#EFF6FF" },
    { label: "Non lues",     value: unreadCount,                                                color: "#8B5CF6", bg: "#F5F3FF" },
  ];

  return (
    <Layout title="Alertes">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {["tous", "critique", "alerte", "info"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                border: filter === f ? "2px solid #3B82F6" : "1.5px solid #E5E7EB",
                backgroundColor: filter === f ? "#EFF6FF" : "white",
                color: filter === f ? "#2563EB" : "#6B7280",
                textTransform: "capitalize",
              }}
            >
              {f}
            </button>
          ))}
          {unreadCount > 0 && (
            <span style={{
              padding: "3px 10px", backgroundColor: "#EF4444", color: "white",
              borderRadius: 12, fontSize: 12, fontWeight: 700,
            }}>
              {unreadCount} non lues
            </span>
          )}
        </div>
        <button
          onClick={markAllRead}
          disabled={saving || unreadCount === 0}
          style={{
            padding: "8px 16px", backgroundColor: "white",
            border: "1.5px solid #E5E7EB", borderRadius: 10,
            fontSize: 13, color: "#374151", cursor: unreadCount === 0 ? "default" : "pointer",
            fontWeight: 600, opacity: unreadCount === 0 ? 0.5 : 1,
          }}
        >
          {saving ? "Enregistrement…" : "Tout marquer comme lu"}
        </button>
      </div>

      {/* Stats */}
      <div className="kpi-row">
        {stats.map((s) => (
          <div
            key={s.label}
            style={{
              backgroundColor: s.bg, borderRadius: 12, padding: "14px 20px",
              flex: 1, borderLeft: `4px solid ${s.color}`,
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Liste des alertes */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "48px", color: "#9CA3AF", fontSize: 14 }}>
          Chargement des alertes…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "48px", backgroundColor: "white",
          borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", color: "#9CA3AF", fontSize: 14,
        }}>
          {filter === "tous"
            ? "Aucune alerte active."
            : `Aucune alerte de niveau "${filter}".`}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((alert) => {
            const s = SEVERITE_STYLE[alert.severite] ?? SEVERITE_STYLE.info;
            return (
              <div
                key={alert.id}
                style={{
                  backgroundColor: alert.lu ? "white" : s.bg,
                  border: `1px solid ${alert.lu ? "#E5E7EB" : s.border}`,
                  borderRadius: 14, padding: "18px 22px",
                  display: "flex", alignItems: "center", gap: 16,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                  opacity: alert.lu ? 0.75 : 1,
                }}
              >
                <div style={{
                  padding: "6px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700,
                  backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}`,
                  flexShrink: 0, textTransform: "uppercase",
                }}>
                  {TYPE_ICONE[alert.type] ?? alert.type}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 14, fontWeight: alert.lu ? 500 : 700,
                    color: "#0A1628", marginBottom: 4,
                  }}>
                    {alert.titre}
                  </div>
                  {alert.message && (
                    <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>
                      {alert.message}
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      fontSize: 11, padding: "2px 8px", borderRadius: 10, fontWeight: 700,
                      backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}`,
                    }}>
                      {alert.severite}
                    </span>
                    <span style={{ fontSize: 12, color: "#9CA3AF" }}>
                      {fmtDate(alert.created_at)}
                    </span>
                  </div>
                </div>

                {!alert.lu && (
                  <button
                    onClick={() => markRead(alert.id)}
                    style={{
                      padding: "6px 14px", backgroundColor: "white",
                      border: "1px solid #E5E7EB", borderRadius: 8,
                      fontSize: 12, color: "#374151", cursor: "pointer", flexShrink: 0,
                    }}
                  >
                    Marquer lu
                  </button>
                )}

                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  backgroundColor: alert.lu ? "#D1D5DB" : s.dot,
                  flexShrink: 0,
                }} />
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
