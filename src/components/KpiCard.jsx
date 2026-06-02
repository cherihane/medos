import { colors, radius, shadow, font } from "../theme";

export default function KpiCard({ label, value, change, color }) {
  return (
    <div style={{
      backgroundColor: colors.bgCard,
      borderRadius: radius.lg,
      padding: "20px 24px",
      boxShadow: shadow.sm,
      display: "flex",
      flexDirection: "column",
      gap: 8,
      flex: 1,
      minWidth: 0,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ width: 36, height: 36, borderRadius: radius.md, backgroundColor: color + "18", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 10, height: 10, borderRadius: radius.full, backgroundColor: color }} />
        </div>
        {change != null && (
          <span style={{
            fontSize: font.sm, fontWeight: font.bold, padding: "3px 8px", borderRadius: radius.full,
            backgroundColor: change.startsWith("-") ? colors.errorLight : colors.successLight,
            color: change.startsWith("-") ? colors.errorDark : colors.success,
          }}>
            {change}
          </span>
        )}
      </div>
      <div style={{ fontSize: 24, fontWeight: font.extrabold, color: colors.navy }}>{value}</div>
      <div style={{ fontSize: font.base, color: colors.textSecondary }}>{label}</div>
      <div style={{ height: 3, backgroundColor: color, borderRadius: radius.sm, width: "35%" }} />
    </div>
  );
}
