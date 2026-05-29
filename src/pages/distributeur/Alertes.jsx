import { useState } from "react";
import Layout from "../../components/Layout";
import { alerts } from "../../data/staticData";

const severityStyle = {
  critique: { bg: "#FEF2F2", border: "#FCA5A5", color: "#EF4444", dot: "#EF4444" },
  alerte: { bg: "#FFFBEB", border: "#FCD34D", color: "#D97706", dot: "#F59E0B" },
  info: { bg: "#EFF6FF", border: "#BFDBFE", color: "#2563EB", dot: "#3B82F6" },
};

export default function AlertesDistributeur() {
  const [alertList, setAlertList] = useState(alerts);
  const [filter, setFilter] = useState("tous");

  const markRead = (id) => setAlertList((prev) => prev.map((a) => a.id === id ? { ...a, read: true } : a));
  const filtered = alertList.filter((a) => filter === "tous" || a.severity === filter);
  const unreadCount = alertList.filter((a) => !a.read).length;

  return (
    <Layout title="Alertes" subtitle="Surveillance des alertes de distribution et livraison">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {["tous", "critique", "alerte", "info"].map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", textTransform: "capitalize",
              border: filter === f ? "2px solid #F59E0B" : "1.5px solid #E5E7EB",
              backgroundColor: filter === f ? "#FFFBEB" : "white",
              color: filter === f ? "#D97706" : "#6B7280",
            }}>{f}</button>
          ))}
          {unreadCount > 0 && <span style={{ padding: "3px 10px", backgroundColor: "#EF4444", color: "white", borderRadius: 12, fontSize: 12, fontWeight: 700 }}>{unreadCount} non lues</span>}
        </div>
        <button onClick={() => setAlertList(prev => prev.map(a => ({ ...a, read: true })))} style={{ padding: "8px 16px", backgroundColor: "white", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 13, color: "#374151", cursor: "pointer", fontWeight: 600 }}>
          Tout marquer lu
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((alert) => {
          const s = severityStyle[alert.severity];
          return (
            <div key={alert.id} style={{ backgroundColor: alert.read ? "white" : s.bg, border: `1px solid ${alert.read ? "#E5E7EB" : s.border}`, borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, opacity: alert.read ? 0.7 : 1 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: alert.read ? 500 : 700, color: "#0A1628", marginBottom: 4 }}>{alert.message}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, fontWeight: 700, backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{alert.severity}</span>
                  <span style={{ fontSize: 12, color: "#9CA3AF" }}>{alert.time}</span>
                </div>
              </div>
              {!alert.read && <button onClick={() => markRead(alert.id)} style={{ padding: "6px 14px", backgroundColor: "white", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12, color: "#374151", cursor: "pointer" }}>Marquer lu</button>}
              <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: alert.read ? "#D1D5DB" : s.dot }} />
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
