/**
 * MedOS — Design tokens centraux
 *
 * Source unique de vérité pour toutes les valeurs visuelles.
 * Importer ce module dans les composants au lieu de hardcoder des couleurs.
 *
 * Usage :
 *   import { colors, spacing, radius, shadow, font } from "../theme";
 *   style={{ backgroundColor: colors.primary, borderRadius: radius.md }}
 */

// ── Couleurs ──────────────────────────────────────────────────────────────────

export const colors = {
  // Marque
  primary:       "#3B82F6",   // bleu principal — actions, accents
  primaryDark:   "#2563EB",   // bleu foncé — hover, liens
  primaryLight:  "#EFF6FF",   // bleu très clair — backgrounds sélectionnés
  primaryMuted:  "#BFDBFE",   // bleu désaturé — bordures légères

  // Sémantique
  success:       "#10B981",
  successLight:  "#DCFCE7",
  successBorder: "#A7F3D0",

  warning:       "#F59E0B",
  warningLight:  "#FFFBEB",
  warningBorder: "#FCD34D",

  error:         "#EF4444",
  errorDark:     "#DC2626",
  errorLight:    "#FEF2F2",
  errorBorder:   "#FECACA",

  info:          "#6366F1",

  // Rôles
  pharmacie:    "#3B82F6",
  hopital:      "#10B981",
  distributeur: "#F59E0B",
  autorite:     "#8B5CF6",

  // Neutres
  navy:          "#0A1628",   // dark primary
  navyMid:       "#1E3A5F",
  text:          "#374151",
  textSecondary: "#6B7280",
  textMuted:     "#9CA3AF",
  textDisabled:  "#D1D5DB",

  // Backgrounds
  bg:            "#F0F4FB",
  bgCard:        "white",
  bgSurface:     "#F8FAFC",
  bgHover:       "#F9FAFB",

  // Bordures
  border:        "#E5E7EB",
  borderLight:   "#F3F4F6",
};

// ── Espacement ────────────────────────────────────────────────────────────────

export const spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};

// ── Border radius ─────────────────────────────────────────────────────────────

export const radius = {
  sm:   6,
  md:   10,
  lg:   14,
  xl:   18,
  full: 9999,
};

// ── Ombres ────────────────────────────────────────────────────────────────────

export const shadow = {
  sm:  "0 1px 4px rgba(0,0,0,0.06)",
  md:  "0 4px 16px rgba(0,0,0,0.08)",
  lg:  "0 8px 32px rgba(0,0,0,0.12)",
  xl:  "0 24px 80px rgba(0,0,0,0.18)",
};

// ── Typographie ───────────────────────────────────────────────────────────────

export const font = {
  // Tailles
  xs:   10,
  sm:   11,
  base: 13,
  md:   14,
  lg:   16,
  xl:   19,
  xxl:  22,
  h1:   26,

  // Graisses
  normal:    400,
  medium:    500,
  semibold:  600,
  bold:      700,
  extrabold: 800,
  black:     900,
};

// ── Sidebar ───────────────────────────────────────────────────────────────────

export const sidebar = {
  width:       220,
  bg:          colors.navy,
  borderAlpha: "rgba(255,255,255,0.08)",
};

// ── Breakpoints (en px) ───────────────────────────────────────────────────────

export const breakpoints = {
  mobile:  640,
  tablet:  768,
  desktop: 1024,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Retourne le style d'un bouton primaire MedOS.
 * @param {{ disabled?: boolean, danger?: boolean, size?: "sm"|"md"|"lg" }} opts
 */
export function btnStyle({ disabled = false, danger = false, size = "md" } = {}) {
  const pad = { sm: "7px 14px", md: "10px 22px", lg: "13px 28px" }[size];
  const fs  = { sm: 12, md: 13, lg: 14 }[size];
  return {
    padding:         pad,
    fontSize:        fs,
    fontWeight:      font.bold,
    border:          "none",
    borderRadius:    radius.md,
    cursor:          disabled ? "not-allowed" : "pointer",
    backgroundColor: disabled ? colors.borderLight : danger ? colors.error : colors.primary,
    color:           disabled ? colors.textDisabled : "white",
    fontFamily:      "inherit",
    transition:      "background-color 0.15s",
  };
}

/**
 * Style d'un champ input MedOS standard.
 */
export const inputStyle = {
  width:           "100%",
  padding:         "10px 12px",
  border:          `1.5px solid ${colors.border}`,
  borderRadius:    radius.md,
  fontSize:        font.base,
  outline:         "none",
  boxSizing:       "border-box",
  color:           colors.navy,
  backgroundColor: colors.bgCard,
  fontFamily:      "inherit",
};

/**
 * Style d'une card MedOS standard.
 */
export const cardStyle = {
  backgroundColor: colors.bgCard,
  borderRadius:    radius.lg,
  border:          `1px solid ${colors.border}`,
  padding:         `${spacing.lg}px`,
  boxShadow:       shadow.sm,
};
