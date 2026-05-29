import Sidebar from "./Sidebar";

export default function Layout({ children, title, subtitle }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#F0F4FB" }}>
      <Sidebar />
      <main style={{ marginLeft: 220, flex: 1, padding: "28px 32px", minHeight: "100vh" }}>
        {title && (
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 21, fontWeight: 700, color: "#0A1628", margin: 0 }}>{title}</h1>
            {subtitle && <p style={{ fontSize: 13, color: "#6B7280", margin: "4px 0 0" }}>{subtitle}</p>}
            <div style={{ height: 3, width: 36, backgroundColor: "#3B82F6", borderRadius: 2, marginTop: 8 }} />
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
