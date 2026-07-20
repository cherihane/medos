import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { colors } from "../theme";
import { useAuth } from "../context/AuthContext";

// Déconnexion automatique après inactivité — sécurité pour les postes
// partagés (pharmacie/hôpital). Monté une seule fois, tout en haut de
// l'arbre de routes (voir App.js), jamais dupliqué par page.
// Configurables via env (utile pour les tests automatisés en conditions
// réelles sans attendre 20 minutes) ; valeurs par défaut = celles voulues
// en production.
const INACTIVITY_LIMIT_MS = Number(process.env.REACT_APP_INACTIVITY_LIMIT_MS) || 20 * 60 * 1000;
const WARNING_BEFORE_MS = Number(process.env.REACT_APP_INACTIVITY_WARNING_MS) || 60 * 1000;
const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll"];

export default function InactivityGuard() {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();
  const [secondsLeft, setSecondsLeft] = useState(null); // null = pas d'avertissement affiché

  const warnTimerRef = useRef(null);
  const logoutTimerRef = useRef(null);
  const countdownRef = useRef(null);

  const clearAllTimers = useCallback(() => {
    clearTimeout(warnTimerRef.current);
    clearTimeout(logoutTimerRef.current);
    clearInterval(countdownRef.current);
  }, []);

  const handleLogout = useCallback(async () => {
    clearAllTimers();
    setSecondsLeft(null);
    await logout();
    navigate("/", { replace: true });
  }, [clearAllTimers, logout, navigate]);

  const showWarning = useCallback(() => {
    setSecondsLeft(Math.round(WARNING_BEFORE_MS / 1000));
    countdownRef.current = setInterval(() => {
      setSecondsLeft((s) => (s !== null && s > 0 ? s - 1 : s));
    }, 1000);
  }, []);

  const resetTimers = useCallback(() => {
    clearAllTimers();
    setSecondsLeft(null);
    warnTimerRef.current = setTimeout(showWarning, INACTIVITY_LIMIT_MS - WARNING_BEFORE_MS);
    logoutTimerRef.current = setTimeout(handleLogout, INACTIVITY_LIMIT_MS);
  }, [clearAllTimers, showWarning, handleLogout]);

  useEffect(() => {
    if (!auth) {
      clearAllTimers();
      setSecondsLeft(null);
      return;
    }

    resetTimers();
    const handleActivity = () => resetTimers();
    ACTIVITY_EVENTS.forEach((ev) =>
      window.addEventListener(ev, handleActivity, { capture: true, passive: true })
    );

    return () => {
      ACTIVITY_EVENTS.forEach((ev) =>
        window.removeEventListener(ev, handleActivity, { capture: true })
      );
      clearAllTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth]);

  if (!auth || secondsLeft === null) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, backgroundColor: "rgba(10,22,40,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 2000, padding: 20,
      }}
    >
      <div style={{
        backgroundColor: colors.bgCard ?? "white", borderRadius: 18, width: "100%", maxWidth: 420,
        boxShadow: "0 24px 80px rgba(0,0,0,0.3)", padding: "28px 28px 24px", textAlign: "center",
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: "50%", margin: "0 auto 16px",
          backgroundColor: "#FFFBEB", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
          </svg>
        </div>
        <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 800, color: colors.navy }}>
          Vous allez être déconnecté
        </h3>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: colors.textSecondary }}>
          Pour votre sécurité, vous allez être déconnecté dans <strong>{secondsLeft} seconde{secondsLeft !== 1 ? "s" : ""}</strong> par
          inactivité. Cliquez pour rester connecté.
        </p>
        <button
          onClick={resetTimers}
          style={{
            width: "100%", padding: "11px", backgroundColor: "#3B82F6", color: "white",
            border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer",
          }}
        >
          Rester connecté
        </button>
      </div>
    </div>
  );
}
