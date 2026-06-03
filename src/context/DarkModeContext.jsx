import { createContext, useContext, useState, useEffect } from "react";

const DarkModeContext = createContext({ dark: false, toggleDark: () => {} });

export function DarkModeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    try {
      const saved = localStorage.getItem("medos_dark") === "1";
      // Applique immediatement la classe pour eviter le flash blanc au chargement
      if (saved) document.documentElement.classList.add("dark");
      return saved;
    }
    catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem("medos_dark", dark ? "1" : "0"); }
    catch {}
    // Applique la classe "dark" sur <html> — les CSS vars :root.dark s'activent
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    // Garde aussi data-theme pour compatibilite avec les regles CSS existantes
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }, [dark]);

  const toggleDark = () => setDark((d) => !d);

  return (
    <DarkModeContext.Provider value={{ dark, toggleDark }}>
      {children}
    </DarkModeContext.Provider>
  );
}

export function useDarkMode() {
  return useContext(DarkModeContext);
}

// Tokens adaptatifs — usage : const t = useThemeTokens();
export function useThemeTokens() {
  const { dark } = useDarkMode();
  return dark ? darkTokens : lightTokens;
}

const lightTokens = {
  bg:          "#F0F4FB",
  bgCard:      "white",
  bgSurface:   "#F8FAFC",
  bgHover:     "#F9FAFB",
  text:        "#374151",
  textHeavy:   "#0A1628",
  textLight:   "#6B7280",
  textMuted:   "#9CA3AF",
  border:      "#E5E7EB",
  borderLight: "#F3F4F6",
  shadow:      "0 1px 4px rgba(0,0,0,0.06)",
  shadowHover: "0 4px 16px rgba(0,0,0,0.1)",
  inputBg:     "white",
  inputBorder: "#E5E7EB",
};

const darkTokens = {
  bg:          "#0F172A",
  bgCard:      "#1E293B",
  bgSurface:   "#273344",
  bgHover:     "#2D3E50",
  text:        "#CBD5E1",
  textHeavy:   "#F1F5F9",
  textLight:   "#94A3B8",
  textMuted:   "#64748B",
  border:      "#334155",
  borderLight: "#1E293B",
  shadow:      "0 1px 4px rgba(0,0,0,0.3)",
  shadowHover: "0 4px 16px rgba(0,0,0,0.4)",
  inputBg:     "#1E293B",
  inputBorder: "#334155",
};
