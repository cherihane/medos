import { useState, useCallback, useEffect, useRef } from "react";
import Layout from "../../components/Layout";
import QrScanner from "../../components/QrScanner";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useVerificationLot } from "../../hooks/useVerificationLot";

// ── Styles statuts ────────────────────────────────────────────────────────────
const STATUTS = {
  certifie: {
    label: "Certifié MedOS",
    sublabel: "Lot enregistré par un distributeur certifié",
    bg: "#DCFCE7", color: "#16A34A", border: "#86EFAC",
  },
  bdpm: {
    label: "Authentique — Base officielle française",
    sublabel: "Médicament référencé dans la BDPM (Ministère de la Santé, France)",
    bg: "#DBEAFE", color: "#1D4ED8", border: "#93C5FD",
  },
  suspect: {
    label: "Lot suspect — Non identifié",
    sublabel: "Introuvable dans MedOS et dans la BDPM. Alerte créée, email envoyé aux autorités.",
    bg: "#FEF2F2", color: "#DC2626", border: "#FCA5A5",
  },
};

// ── Historique (session seulement) ────────────────────────────────────────────
function HistoriqueItem({ item, onRescan }) {
  const s = STATUTS[item.result.statut];
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
      backgroundColor: "#F8FAFC", borderRadius: 10, cursor: "pointer",
      border: `1px solid ${s.border}`,
    }}
      onClick={() => onRescan(item)}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#0A1628", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.nom || item.lot || "Scan sans libellé"}
        </div>
        <div style={{ fontSize: 11, color: "#9CA3AF" }}>
          {item.lot && <span style={{ fontFamily: "monospace", marginRight: 8 }}>{item.lot}</span>}
          {new Date(item.ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 8, backgroundColor: s.bg, color: s.color, fontWeight: 700, flexShrink: 0 }}>
        {item.result.statut === "certifie" ? "MedOS" : item.result.statut === "bdpm" ? "BDPM" : "Suspect"}
      </span>
    </div>
  );
}

// ── Panneau résultat ──────────────────────────────────────────────────────────
function ResultPanel({ result }) {
  const s = STATUTS[result.statut];
  return (
    <div style={{ animation: "fadeIn 0.25s ease" }}>
      {/* Badge statut */}
      <div style={{ padding: "18px 20px", backgroundColor: s.bg, borderRadius: 14, border: `1px solid ${s.border}`, marginBottom: 20, textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: s.color }}>{s.label}</div>
        <div style={{ fontSize: 12, color: s.color, marginTop: 4, opacity: 0.8 }}>{s.sublabel}</div>
      </div>

      {/* Détails */}
      <div style={{ backgroundColor: "#F8FAFC", borderRadius: 12, overflow: "hidden" }}>
        {Object.entries(result.details).map(([k, v], i, arr) => (
          <div key={k} style={{
            display: "flex", justifyContent: "space-between", alignItems: "flex-start",
            padding: "11px 16px",
            borderBottom: i < arr.length - 1 ? "1px solid #E5E7EB" : "none",
          }}>
            <span style={{ fontSize: 12, color: "#6B7280", flexShrink: 0, marginRight: 12 }}>{k}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#0A1628", textAlign: "right", wordBreak: "break-word" }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Source badge */}
      <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
        <span style={{ fontSize: 10, color: "#9CA3AF", padding: "3px 10px", backgroundColor: "#F3F4F6", borderRadius: 8 }}>
          Source : {result.source === "supabase" ? "Base MedOS (Supabase)" : result.source === "bdpm" ? "BDPM — Médicaments France" : "Aucune base"}
        </span>
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function Scanner({ profile = "pharmacie" }) {
  const { loading, result, error, verifier, reset } = useVerificationLot();
  const { toasts, success, error: toastError } = useToast();

  const [nomMedicament, setNomMedicament] = useState("");
  const [numerolot, setNumerolot] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [historique, setHistorique] = useState([]);

  // Refs pour éviter la boucle infinie et capturer le contexte au moment du scan
  const lastHandledResult = useRef(null);
  const scanContextRef = useRef({ nom: "", lot: "" });

  const profileLabels = {
    pharmacie:    { color: "#3B82F6", bg: "#EFF6FF" },
    hopital:      { color: "#10B981", bg: "#DCFCE7" },
    distributeur: { color: "#F59E0B", bg: "#FFFBEB" },
  };
  const pStyle = profileLabels[profile] || profileLabels.pharmacie;

  const handleVerifier = useCallback(async () => {
    if (!nomMedicament.trim() && !numerolot.trim()) {
      toastError("Saisissez un nom de médicament ou un numéro de lot");
      return;
    }
    // Capturer le contexte avant l'appel (les champs peuvent changer entre-temps)
    scanContextRef.current = { nom: nomMedicament.trim(), lot: numerolot.trim() };
    await verifier({
      nomMedicament: nomMedicament.trim(),
      numerolot: numerolot.trim(),
      scannePar: `Scanner MedOS — ${profile}`,
    });
  }, [nomMedicament, numerolot, verifier, profile, toastError]);

  // Ajouter à l'historique une seule fois quand result change
  useEffect(() => {
    if (!result) return;
    if (result === lastHandledResult.current) return;
    lastHandledResult.current = result;

    const { nom, lot } = scanContextRef.current;
    setHistorique((prev) => [
      { id: Date.now(), nom, lot, result, ts: Date.now() },
      ...prev.slice(0, 19),
    ]);
    if (result.statut === "suspect") {
      toastError("Lot suspect — alerte envoyée aux autorités");
    } else {
      success(result.statut === "certifie" ? "Certifié MedOS" : "Référencé BDPM France");
    }
  }, [result, toastError, success]);

  const handleQrScan = (text) => {
    setShowCamera(false);
    try {
      const obj = JSON.parse(text);
      if (obj.lot) setNumerolot(obj.lot);
      if (obj.nom) setNomMedicament(obj.nom);
    } catch {
      if (/^[A-Z0-9\-]+$/i.test(text.trim()) && text.length < 30) {
        setNumerolot(text.trim());
      } else {
        setNomMedicament(text.trim());
      }
    }
    success("Code scanné — cliquez sur Vérifier pour analyser");
  };

  const handleReset = () => { reset(); setNomMedicament(""); setNumerolot(""); };

  const handleRescan = (item) => {
    reset();
    setNomMedicament(item.nom || "");
    setNumerolot(item.lot || "");
  };

  return (
    <Layout
      title="Scanner Contrefaçons"
      subtitle="Vérification d'authenticité — Base MedOS + BDPM officielle France"
    >
      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { to { transform: rotate(360deg) } }
      `}</style>
      <Toast toasts={toasts} />
      {showCamera && <QrScanner onScan={handleQrScan} onClose={() => setShowCamera(false)} />}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: 20 }}>

        {/* ── Colonne gauche : saisie + historique ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Saisie */}
          <div style={{ backgroundColor: "white", borderRadius: 16, padding: "28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Vérifier un médicament</h3>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6B7280" }}>
                  Saisissez le nom et/ou le numéro de lot pour vérification
                </p>
              </div>
              <button
                onClick={() => setShowCamera(true)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "9px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                  cursor: "pointer", border: "none",
                  backgroundColor: pStyle.bg, color: pStyle.color,
                }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                Scanner
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                  Nom du médicament
                </label>
                <input
                  value={nomMedicament}
                  onChange={(e) => { setNomMedicament(e.target.value); reset(); }}
                  onKeyDown={(e) => e.key === "Enter" && handleVerifier()}
                  placeholder="Ex: Amoxicilline 500mg, Doliprane, Artemisinine…"
                  style={{ width: "100%", padding: "11px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box", color: "#0A1628" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                  Numéro de lot (optionnel)
                </label>
                <input
                  value={numerolot}
                  onChange={(e) => { setNumerolot(e.target.value); reset(); }}
                  onKeyDown={(e) => e.key === "Enter" && handleVerifier()}
                  placeholder="Ex: LOT2024-A12, MED-003…"
                  style={{ width: "100%", padding: "11px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box", color: "#0A1628", fontFamily: "monospace" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                onClick={handleVerifier}
                disabled={loading || (!nomMedicament.trim() && !numerolot.trim())}
                style={{
                  flex: 1, padding: "12px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: loading ? "wait" : "pointer", border: "none",
                  backgroundColor: loading || (!nomMedicament.trim() && !numerolot.trim()) ? "#E5E7EB" : pStyle.color,
                  color: loading || (!nomMedicament.trim() && !numerolot.trim()) ? "#9CA3AF" : "white",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                {loading ? (
                  <>
                    <div style={{ width: 16, height: 16, border: "2px solid #9CA3AF", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    Vérification en cours…
                  </>
                ) : "Vérifier l'authenticité"}
              </button>
              {(nomMedicament || numerolot || result) && (
                <button onClick={handleReset} style={{ padding: "12px 16px", backgroundColor: "#F8FAFC", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, cursor: "pointer" }}>
                  Réinitialiser
                </button>
              )}
            </div>

            {error && (
              <div style={{ marginTop: 12, padding: "10px 14px", backgroundColor: "#FEF2F2", borderRadius: 8, fontSize: 12, color: "#DC2626" }}>
                Erreur : {error}
              </div>
            )}
          </div>

          {/* Historique */}
          {historique.length > 0 && (
            <div style={{ backgroundColor: "white", borderRadius: 14, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#0A1628" }}>
                  Historique de la session ({historique.length})
                </h4>
                <button onClick={() => setHistorique([])} style={{ fontSize: 11, color: "#9CA3AF", background: "none", border: "none", cursor: "pointer" }}>
                  Effacer
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {historique.map((item) => (
                  <HistoriqueItem key={item.id} item={item} onRescan={handleRescan} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Colonne droite : résultat ── */}
        <div style={{ backgroundColor: "white", borderRadius: 16, padding: "28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", alignSelf: "flex-start", position: "sticky", top: 20 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Résultat</h3>

          {!result && !loading && (
            <div style={{ textAlign: "center", color: "#9CA3AF", paddingTop: 40, paddingBottom: 40 }}>
              <div style={{ width: 56, height: 56, backgroundColor: "#F0F4FB", borderRadius: 14, margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>
                  <path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
                  <rect x="7" y="7" width="10" height="10" rx="1"/>
                </svg>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 6 }}>En attente de vérification</div>
              <div style={{ fontSize: 12 }}>Saisissez un médicament ou scannez un QR code</div>
            </div>
          )}

          {loading && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ width: 40, height: 40, border: "3px solid #E5E7EB", borderTopColor: pStyle.color, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Vérification en cours…</div>
              <div style={{ fontSize: 12, color: "#9CA3AF" }}>Consultation MedOS puis BDPM France</div>

              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "Recherche dans MedOS (Supabase)", color: "#10B981" },
                  { label: "Consultation BDPM — France",      color: "#2563EB" },
                  { label: "Analyse du résultat",             color: "#8B5CF6" },
                ].map((step, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", backgroundColor: "#F8FAFC", borderRadius: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: step.color, animation: `spin ${0.8 + i * 0.3}s linear infinite` }} />
                    <span style={{ fontSize: 12, color: "#6B7280" }}>{step.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result && !loading && <ResultPanel result={result} />}
        </div>
      </div>
    </Layout>
  );
}
