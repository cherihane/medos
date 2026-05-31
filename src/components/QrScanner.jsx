/**
 * QrScanner — Composant caméra QR/Barcode via html5-qrcode
 * Usage : <QrScanner onScan={(text) => ...} onClose={() => ...} />
 */
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

export default function QrScanner({ onScan, onClose }) {
  const idRef = useRef("qr-reader-" + Math.random().toString(36).slice(2, 8));
  const scannerRef = useRef(null);
  const [camError, setCamError] = useState(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const elementId = idRef.current;
    const html5QrCode = new Html5Qrcode(elementId);
    scannerRef.current = html5QrCode;

    html5QrCode
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1.0 },
        (decodedText) => {
          onScan(decodedText);
          stop();
        },
        () => { /* scan errors ignorés */ }
      )
      .then(() => setStarted(true))
      .catch((err) => {
        setCamError(
          err?.message?.includes("Permission")
            ? "Accès caméra refusé. Autorisez la caméra dans les paramètres du navigateur."
            : "Impossible d'accéder à la caméra : " + (err?.message || String(err))
        );
      });

    return () => {
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = () => {
    if (scannerRef.current?.isScanning) {
      scannerRef.current.stop().catch(() => {});
    }
  };

  const handleClose = () => {
    stop();
    onClose();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.85)",
      zIndex: 1100, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    }}>
      {/* Header */}
      <div style={{ color: "white", marginBottom: 16, textAlign: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Scanner QR / code-barres</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Pointez la caméra vers le code du médicament</div>
      </div>

      {/* Zone caméra */}
      <div style={{ position: "relative", width: 320, borderRadius: 16, overflow: "hidden", boxShadow: "0 0 0 4px rgba(59,130,246,0.4)" }}>
        {camError ? (
          <div style={{ width: 320, height: 320, backgroundColor: "#1F2937", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📷</div>
            <div style={{ color: "#FCA5A5", fontSize: 13 }}>{camError}</div>
          </div>
        ) : (
          <>
            <div id={idRef.current} style={{ width: 320 }} />
            {/* Viseur */}
            {started && (
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                {/* Coins bleus */}
                {[
                  { top: 30, left: 30, borderTop: "3px solid #3B82F6", borderLeft: "3px solid #3B82F6" },
                  { top: 30, right: 30, borderTop: "3px solid #3B82F6", borderRight: "3px solid #3B82F6" },
                  { bottom: 30, left: 30, borderBottom: "3px solid #3B82F6", borderLeft: "3px solid #3B82F6" },
                  { bottom: 30, right: 30, borderBottom: "3px solid #3B82F6", borderRight: "3px solid #3B82F6" },
                ].map((s, i) => (
                  <div key={i} style={{ position: "absolute", width: 24, height: 24, ...s }} />
                ))}
                {/* Ligne scan */}
                <div style={{
                  position: "absolute", left: "15%", right: "15%",
                  top: "50%", height: 2,
                  background: "linear-gradient(90deg, transparent, #3B82F6, transparent)",
                  boxShadow: "0 0 8px #3B82F6",
                  animation: "scanLine 2s ease-in-out infinite",
                }} />
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes scanLine {
          0%, 100% { transform: translateY(-60px); opacity: 0.4; }
          50%       { transform: translateY(60px);  opacity: 1;   }
        }
      `}</style>

      <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
        <button
          onClick={handleClose}
          style={{ padding: "10px 28px", backgroundColor: "white", color: "#0A1628", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          Fermer
        </button>
      </div>
      <div style={{ marginTop: 12, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
        Appuyez sur Fermer pour revenir à la saisie manuelle
      </div>
    </div>
  );
}
