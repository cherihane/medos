import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationsContext";
import NavIcon from "./NavIcon";

const roleColors = {
  pharmacie:    "#3B82F6",
  hopital:      "#10B981",
  distributeur: "#F59E0B",
  autorite:     "#8B5CF6",
};

// Quels icônes de nav reçoivent quel type de badge
const BADGE_MAP = {
  // pharmacie / hopital : badge commande sur "fournisseurs"
  fournisseurs: "commande",
  // distributeur : badge commande sur "dashboard"
  dashboard: "commande",
  // tous : badge alerte sur "alertes"
  alertes: "alerte",
};

// Toast flottant en bas de la sidebar
function NotifToast({ notif, onDismiss, accentColor }) {
  const colors = {
    critique: { bg: "#FEF2F2", border: "#EF4444", text: "#DC2626" },
    alerte:   { bg: "#FFFBEB", border: "#F59E0B", text: "#D97706" },
    info:     { bg: "#EFF6FF", border: accentColor, text: accentColor },
  };
  const c = colors[notif.severite] || colors.info;

  return (
    <div style={{
      position: "absolute",
      bottom: 80,
      left: 10,
      right: 10,
      backgroundColor: c.bg,
      border: `1px solid ${c.border}`,
      borderRadius: 10,
      padding: "10px 12px",
      boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
      zIndex: 200,
      animation: "slideUp 0.2s ease",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: c.text, marginBottom: 2 }}>{notif.title}</div>
          {notif.message && (
            <div style={{ fontSize: 11, color: "#6B7280" }}>{notif.message}</div>
          )}
        </div>
        <button
          onClick={onDismiss}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: 14, lineHeight: 1, marginLeft: 6, padding: 0 }}
        >
          ×
        </button>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const { auth, logout } = useAuth();
  const { unreadCount, unreadByType, lastNotif, markAllRead, dismissLast } = useNotifications();
  if (!auth) return null;

  const accentColor = roleColors[auth.role] || "#3B82F6";

  return (
    <aside style={{
      width: 220,
      minHeight: "100vh",
      backgroundColor: "#0A1628",
      position: "fixed",
      left: 0, top: 0, bottom: 0,
      zIndex: 50,
      display: "flex",
      flexDirection: "column",
    }}>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes badgePop {
          0%   { transform: scale(0.5); opacity: 0; }
          70%  { transform: scale(1.2); }
          100% { transform: scale(1);   opacity: 1; }
        }
      `}</style>

      {/* Logo */}
      <div style={{ padding: "22px 20px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 34, height: 34,
            backgroundColor: accentColor,
            borderRadius: 9,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <div>
            <div style={{ color: "white", fontWeight: 800, fontSize: 19, letterSpacing: 0.5 }}>MedOS</div>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: 500 }}>by Kela Group</div>
          </div>
        </div>

        {/* Role badge + compteur notifications */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 10px", borderRadius: 20,
            backgroundColor: accentColor + "22",
            border: `1px solid ${accentColor}44`,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: accentColor }} />
            <span style={{ fontSize: 11, color: accentColor, fontWeight: 700 }}>{auth.label}</span>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              title="Marquer tout comme lu"
              style={{
                display: "flex", alignItems: "center", gap: 5,
                background: "none", border: "none", cursor: "pointer",
                padding: "2px 6px",
              }}
            >
              <div style={{
                backgroundColor: "#EF4444",
                color: "white",
                borderRadius: 10,
                fontSize: 10,
                fontWeight: 800,
                minWidth: 18,
                height: 18,
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "0 4px",
                animation: "badgePop 0.3s ease",
              }}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "10px 0", overflowY: "auto" }}>
        {auth.nav.map((item) => {
          const badgeType = BADGE_MAP[item.icon];
          const badgeCount = badgeType ? unreadByType[badgeType] : 0;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              style={({ isActive }) => ({
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 20px",
                color: isActive ? "#FFFFFF" : "rgba(255,255,255,0.5)",
                backgroundColor: isActive ? `${accentColor}1A` : "transparent",
                borderLeft: isActive ? `3px solid ${accentColor}` : "3px solid transparent",
                textDecoration: "none",
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                transition: "all 0.12s",
                position: "relative",
              })}
            >
              <NavIcon name={item.icon} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {badgeCount > 0 && (
                <span style={{
                  backgroundColor: "#EF4444",
                  color: "white",
                  borderRadius: 10,
                  fontSize: 10,
                  fontWeight: 800,
                  minWidth: 17,
                  height: 17,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "0 4px",
                  animation: "badgePop 0.3s ease",
                }}>
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User footer */}
      <div style={{ padding: "14px 20px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: "50%",
            backgroundColor: accentColor,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontWeight: 700, fontSize: 13, flexShrink: 0,
          }}>
            {auth.initial}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: "white", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {auth.structure}
            </div>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10 }}>{auth.location}</div>
          </div>
        </div>
        <button
          onClick={logout}
          style={{
            width: "100%",
            padding: "7px",
            backgroundColor: "rgba(239,68,68,0.12)",
            color: "#FCA5A5",
            border: "1px solid rgba(239,68,68,0.25)",
            borderRadius: 8,
            fontSize: 12,
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          Déconnexion
        </button>
      </div>

      {/* Toast notification flottant */}
      {lastNotif && (
        <NotifToast notif={lastNotif} onDismiss={dismissLast} accentColor={accentColor} />
      )}
    </aside>
  );
}
