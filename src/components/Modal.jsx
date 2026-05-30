import { useEffect } from "react";

export default function Modal({ title, onClose, children, width = 540 }) {
  // Fermer avec Escape
  useEffect(() => {
    const handler = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0, backgroundColor: "rgba(10,22,40,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: 20,
      }}
    >
      <div style={{
        backgroundColor: "white", borderRadius: 18, width: "100%", maxWidth: width,
        maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 24px 80px rgba(0,0,0,0.25)",
        animation: "modalIn 0.18s ease",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px", borderBottom: "1px solid #E5E7EB",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          position: "sticky", top: 0, backgroundColor: "white", zIndex: 1,
          borderRadius: "18px 18px 0 0",
        }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0A1628" }}>{title}</h2>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: "50%", border: "none",
            backgroundColor: "#F3F4F6", cursor: "pointer", fontSize: 20, lineHeight: 1,
            display: "flex", alignItems: "center", justifyContent: "center", color: "#6B7280",
          }}>×</button>
        </div>
        {/* Body */}
        <div style={{ padding: "24px" }}>{children}</div>
      </div>
      <style>{`@keyframes modalIn{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}`}</style>
    </div>
  );
}

// ── Helpers de formulaire réutilisables ───────────────────────────────────────
export function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

export const inputStyle = {
  width: "100%", padding: "10px 12px",
  border: "1.5px solid #E5E7EB", borderRadius: 8,
  fontSize: 13, outline: "none", boxSizing: "border-box",
  color: "#0A1628", backgroundColor: "white",
};

export const selectStyle = { ...inputStyle, cursor: "pointer" };

export function Row({ children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      {children}
    </div>
  );
}

export function ModalFooter({ onCancel, onSubmit, submitLabel = "Enregistrer", saving, danger }) {
  return (
    <div style={{
      display: "flex", justifyContent: "flex-end", gap: 10,
      marginTop: 24, paddingTop: 20, borderTop: "1px solid #F3F4F6",
    }}>
      <button onClick={onCancel} style={{
        padding: "10px 20px", backgroundColor: "white", color: "#374151",
        border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 13, cursor: "pointer", fontWeight: 600,
      }}>Annuler</button>
      <button onClick={onSubmit} disabled={saving} style={{
        padding: "10px 24px",
        backgroundColor: saving ? "#E5E7EB" : danger ? "#EF4444" : "#3B82F6",
        color: saving ? "#9CA3AF" : "white",
        border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700,
        cursor: saving ? "not-allowed" : "pointer",
        minWidth: 120,
      }}>
        {saving ? "Enregistrement…" : submitLabel}
      </button>
    </div>
  );
}
