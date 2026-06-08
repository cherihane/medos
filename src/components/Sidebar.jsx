import { NavLink } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationsContext";
import { useIsMobile } from "../hooks/useWindowSize";
import { supabase } from "../supabaseClient";
import NavIcon from "./NavIcon";
import { colors, sidebar, radius, font } from "../theme";
import { useDarkMode } from "../context/DarkModeContext";

const roleColors = {
  pharmacie:    colors.pharmacie,
  hopital:      colors.hopital,
  distributeur: colors.distributeur,
  autorite:     colors.autorite,
};

const BADGE_MAP = {
  fournisseurs: "commande",
  dashboard:    "commande",
  alertes:      "alerte",
};

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
          x
        </button>
      </div>
    </div>
  );
}

function useEtablissementInfo(auth) {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    if (!auth?.user?.email) return;

    supabase
      .from("etablissements")
      .select("nom, ville, email")
      .eq("email", auth.user.email)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setInfo({ nom: data.nom, sub: data.ville || "" });
        } else {
          setInfo({ nom: auth.user.email, sub: auth.label || "" });
        }
      });
  }, [auth?.user?.email, auth?.label]); // eslint-disable-line react-hooks/exhaustive-deps

  return info || { nom: auth?.structure || "", sub: auth?.location || "" };
}

const SIDEBAR_WIDTH = 220;

export default function Sidebar({ mobileOpen, onMobileClose }) {
  const { auth, logout } = useAuth();
  const { unreadCount, unreadByType, lastNotif, markAllRead, dismissLast } = useNotifications();
  const { dark, toggleDark } = useDarkMode();
  const etablissement = useEtablissementInfo(auth);
  const isMobile = useIsMobile();

  if (!auth) return null;

  const accentColor = roleColors[auth.role] || "#3B82F6";

  // Sur mobile, la sidebar est un panneau qui se superpose.
  // Sur desktop, elle est fixe dans la mise en page.
  const sidebarStyle = isMobile
    ? {
        width: SIDEBAR_WIDTH,
        minHeight: "100vh",
        backgroundColor: "#0A1628",
        position: "fixed",
        left: 0, top: 0, bottom: 0,
        zIndex: 300,
        display: "flex",
        flexDirection: "column",
        transform: mobileOpen ? "translateX(0)" : `translateX(-${SIDEBAR_WIDTH}px)`,
        transition: "transform 0.22s cubic-bezier(0.4,0,0.2,1)",
        boxShadow: mobileOpen ? "4px 0 32px rgba(0,0,0,0.35)" : "none",
      }
    : {
        width: SIDEBAR_WIDTH,
        minHeight: "100vh",
        backgroundColor: "#0A1628",
        position: "fixed",
        left: 0, top: 0, bottom: 0,
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
      };

  return (
    <>
      {/* Overlay de fermeture sur mobile */}
      {isMobile && mobileOpen && (
        <div
          onClick={onMobileClose}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.45)",
            zIndex: 299,
          }}
        />
      )}

      <aside style={sidebarStyle}>
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

        {/* Logo + bouton fermeture mobile */}
        <div style={{ padding: "22px 20px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
            {isMobile && (
              <button
                onClick={onMobileClose}
                style={{
                  background: "rgba(255,255,255,0.08)", border: "none",
                  borderRadius: 8, width: 30, height: 30,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: "rgba(255,255,255,0.6)", fontSize: 18,
                }}
              >
                x
              </button>
            )}
          </div>

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
          {auth.nav.map((item, index) => {
            if (item.type === "separator") {
              return (
                <div key={`sep-${index}`} style={{
                  padding: "16px 20px 6px",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.25)",
                  textTransform: "uppercase",
                  letterSpacing: "0.8px",
                  userSelect: "none",
                }}>
                  {item.label}
                </div>
              );
            }

            const badgeType = BADGE_MAP[item.icon];
            const badgeCount = badgeType ? unreadByType[badgeType] : 0;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={isMobile ? onMobileClose : undefined}
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
                {etablissement.nom}
              </div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {etablissement.sub}
              </div>
            </div>
          </div>
          {/* Toggle mode sombre */}
          <button
            onClick={toggleDark}
            style={{ width: "100%", padding: "7px", backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11, cursor: "pointer", fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}
          >
            <span>{dark ? "Mode clair" : "Mode sombre"}</span>
            <div style={{ width: 32, height: 18, borderRadius: 9, backgroundColor: dark ? "#3B82F6" : "rgba(255,255,255,0.15)", position: "relative", flexShrink: 0 }}>
              <div style={{ position: "absolute", top: 2, left: dark ? 16 : 2, width: 14, height: 14, borderRadius: "50%", backgroundColor: "white", transition: "left 0.2s" }} />
            </div>
          </button>

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

        {lastNotif && (
          <NotifToast notif={lastNotif} onDismiss={dismissLast} accentColor={accentColor} />
        )}
      </aside>
    </>
  );
}
