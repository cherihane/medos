import { useState } from "react";
import Sidebar from "./Sidebar";
import { useIsMobile } from "../hooks/useWindowSize";

const SIDEBAR_WIDTH = 220;

export default function Layout({ children, title, subtitle }) {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#F0F4FB" }}>
      <Sidebar
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />

      <main style={{
        marginLeft: isMobile ? 0 : SIDEBAR_WIDTH,
        flex: 1,
        padding: isMobile ? "16px" : "28px 32px",
        minHeight: "100vh",
        minWidth: 0,
      }}>
        {/* Barre supérieure mobile : hamburger + titre */}
        {isMobile && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
            padding: "10px 0",
            borderBottom: "1px solid #E5E7EB",
          }}>
            <button
              onClick={() => setSidebarOpen(true)}
              style={{
                background: "none",
                border: "1.5px solid #E5E7EB",
                borderRadius: 8,
                width: 38,
                height: 38,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <span style={{ display: "block", width: 16, height: 2, backgroundColor: "#0A1628", borderRadius: 1 }} />
              <span style={{ display: "block", width: 16, height: 2, backgroundColor: "#0A1628", borderRadius: 1 }} />
              <span style={{ display: "block", width: 16, height: 2, backgroundColor: "#0A1628", borderRadius: 1 }} />
            </button>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#0A1628", fontFamily: "inherit" }}>
                <span style={{ color: "#3B82F6" }}>Med</span>OS
              </div>
            </div>
          </div>
        )}

        {/* Titre de page sur desktop */}
        {title && !isMobile && (
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 21, fontWeight: 700, color: "#0A1628", margin: 0 }}>{title}</h1>
            {subtitle && <p style={{ fontSize: 13, color: "#6B7280", margin: "4px 0 0" }}>{subtitle}</p>}
            <div style={{ height: 3, width: 36, backgroundColor: "#3B82F6", borderRadius: 2, marginTop: 8 }} />
          </div>
        )}

        {/* Titre de page sur mobile (sous le hamburger) */}
        {title && isMobile && (
          <div style={{ marginBottom: 16 }}>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "#0A1628", margin: 0 }}>{title}</h1>
            {subtitle && <p style={{ fontSize: 12, color: "#6B7280", margin: "3px 0 0" }}>{subtitle}</p>}
            <div style={{ height: 3, width: 28, backgroundColor: "#3B82F6", borderRadius: 2, marginTop: 6 }} />
          </div>
        )}

        {children}
      </main>
    </div>
  );
}
