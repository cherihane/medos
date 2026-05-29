export default function KpiCard({ label, value, change, color }) {
  const positive = change && (change.startsWith("+") || (!change.startsWith("-") && !isNaN(parseFloat(change))));
  return (
    <div style={{
      backgroundColor: "white",
      borderRadius: 14,
      padding: "20px 24px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      display: "flex",
      flexDirection: "column",
      gap: 8,
      flex: 1,
      minWidth: 0,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: color + "18", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: color }} />
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
          backgroundColor: change && change.startsWith("-") ? "#FEE2E2" : "#DCFCE7",
          color: change && change.startsWith("-") ? "#DC2626" : "#16A34A",
        }}>
          {change}
        </span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: "#0A1628" }}>{value}</div>
      <div style={{ fontSize: 13, color: "#6B7280" }}>{label}</div>
      <div style={{ height: 3, backgroundColor: color, borderRadius: 2, width: "35%" }} />
    </div>
  );
}
