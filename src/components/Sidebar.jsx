import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import NavIcon from "./NavIcon";

const roleColors = {
  pharmacie: "#3B82F6",
  hopital: "#10B981",
  distributeur: "#F59E0B",
  autorite: "#8B5CF6",
};

export default function Sidebar() {
  const { auth, logout } = useAuth();
  if (!auth) return null;

  const accentColor = roleColors[auth.role] || "#3B82F6";

  return (
    <aside style={{
      width: 220,
      minHeight: "100vh",
      backgroundColor: "#0A1628",
      position: "fixed",
      left: 0,
      top: 0,
      bottom: 0,
      zIndex: 50,
      display: "flex",
      flexDirection: "column",
    }}>
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
        {/* Role badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "4px 10px", borderRadius: 20,
          backgroundColor: accentColor + "22",
          border: `1px solid ${accentColor}44`,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: accentColor }} />
          <span style={{ fontSize: 11, color: accentColor, fontWeight: 700 }}>{auth.label}</span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "10px 0", overflowY: "auto" }}>
        {auth.nav.map((item) => (
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
            })}
          >
            <NavIcon name={item.icon} />
            {item.label}
          </NavLink>
        ))}
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
    </aside>
  );
}
