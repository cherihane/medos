import { Link } from "react-router-dom";

/**
 * Footer discret affiché sur les pages publiques (Login, Inscription).
 */
export default function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <div style={{
      padding: "16px 24px",
      borderTop: "1px solid #E5E7EB",
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      backgroundColor: "#F8FAFC",
    }}>
      <span style={{ fontSize: 11, color: "#9CA3AF" }}>
        &copy; {year} Kela Group — Tous droits reserves
      </span>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {[
          { to: "/cgu",            label: "Conditions d'utilisation" },
          { to: "/confidentialite", label: "Confidentialite"          },
          { to: "/a-propos",       label: "A propos"                 },
        ].map(({ to, label }) => (
          <Link
            key={to}
            to={to}
            style={{ fontSize: 11, color: "#6B7280", textDecoration: "none" }}
          >
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
