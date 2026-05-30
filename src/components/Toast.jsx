export default function Toast({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 2000,
      display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none",
    }}>
      {toasts.map((t) => (
        <div key={t.id} style={{
          padding: "13px 20px", borderRadius: 12, fontSize: 13, fontWeight: 600,
          boxShadow: "0 8px 30px rgba(0,0,0,0.18)", maxWidth: 380,
          backgroundColor: t.type === "success" ? "#10B981" : "#EF4444",
          color: "white", display: "flex", alignItems: "center", gap: 8,
          animation: "toastIn 0.22s ease",
        }}>
          <span style={{ fontSize: 16 }}>{t.type === "success" ? "✅" : "❌"}</span>
          {t.msg}
        </div>
      ))}
      <style>{`@keyframes toastIn{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}`}</style>
    </div>
  );
}
