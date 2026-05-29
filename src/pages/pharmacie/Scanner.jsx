import { useState } from "react";
import Layout from "../../components/Layout";

const fakeResults = {
  "3400936543988": { name: "Doliprane 1000mg", dci: "Paracétamol", labo: "Sanofi", lot: "LOT2024-A12", expiry: "2026-03", status: "authentique", stock: 145 },
  "3400939518607": { name: "Amoxicilline Mylan 500mg", dci: "Amoxicilline", labo: "Mylan", lot: "LOT2024-B08", expiry: "2025-09", status: "alerte_expiration", stock: 12 },
};

const statusInfo = {
  authentique: { label: "Médicament authentique", bg: "#DCFCE7", color: "#16A34A", border: "#86EFAC" },
  alerte_expiration: { label: "Alerte : expiration proche", bg: "#FFFBEB", color: "#D97706", border: "#FCD34D" },
  inconnu: { label: "Médicament non reconnu", bg: "#FEF2F2", color: "#EF4444", border: "#FCA5A5" },
};

export default function Scanner() {
  const [barcode, setBarcode] = useState("");
  const [result, setResult] = useState(null);
  const [scanning, setScanning] = useState(false);

  const handleScan = () => {
    if (!barcode) return;
    setScanning(true);
    setTimeout(() => { setResult(fakeResults[barcode] || { status: "inconnu" }); setScanning(false); }, 900);
  };

  const simulateScan = (code) => {
    setBarcode(code);
    setScanning(true);
    setTimeout(() => { setResult(fakeResults[code]); setScanning(false); }, 900);
  };

  return (
    <Layout title="Scanner" subtitle="Vérification d'authenticité et traçabilité des médicaments">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ backgroundColor: "white", borderRadius: 16, padding: "28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Zone de scan</h3>

            <div style={{ width: "100%", height: 200, backgroundColor: "#0A1628", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", marginBottom: 20 }}>
              <div style={{ position: "relative", width: 180, height: 140, border: "2px solid rgba(59,130,246,0.4)", borderRadius: 8 }}>
                {[
                  { top: -2, left: -2, borderTopWidth: 3, borderLeftWidth: 3 },
                  { top: -2, right: -2, borderTopWidth: 3, borderRightWidth: 3 },
                  { bottom: -2, left: -2, borderBottomWidth: 3, borderLeftWidth: 3 },
                  { bottom: -2, right: -2, borderBottomWidth: 3, borderRightWidth: 3 },
                ].map((pos, i) => (
                  <div key={i} style={{ position: "absolute", width: 20, height: 20, borderColor: "#3B82F6", borderStyle: "solid", borderWidth: 0, ...pos }} />
                ))}
                {scanning && <div style={{ position: "absolute", top: "50%", left: "10%", right: "10%", height: 2, backgroundColor: "#3B82F6", boxShadow: "0 0 8px #3B82F6" }} />}
                <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, textAlign: "center", paddingTop: 50 }}>
                  {scanning ? "Analyse en cours..." : "Placez le code-barre ici"}
                </div>
              </div>
              <div style={{ position: "absolute", bottom: 10, color: "rgba(255,255,255,0.35)", fontSize: 11 }}>Caméra active</div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <input
                placeholder="Code-barre ou QR code..."
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleScan()}
                style={{ flex: 1, padding: "10px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 13, outline: "none" }}
              />
              <button onClick={handleScan} disabled={!barcode || scanning}
                style={{ padding: "10px 20px", backgroundColor: "#3B82F6", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {scanning ? "..." : "Scanner"}
              </button>
            </div>
          </div>

          <div style={{ backgroundColor: "white", borderRadius: 14, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h4 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: "#0A1628" }}>Codes de démonstration</h4>
            {Object.entries(fakeResults).map(([code, data]) => (
              <button key={code} onClick={() => simulateScan(code)}
                style={{ width: "100%", padding: "12px 16px", backgroundColor: "#F8FAFC", border: "1px solid #E5E7EB", borderRadius: 10, cursor: "pointer", textAlign: "left", marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0A1628" }}>{data.name}</div>
                <div style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "monospace" }}>{code}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ backgroundColor: "white", borderRadius: 16, padding: "28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Résultat</h3>
          {!result && !scanning && (
            <div style={{ textAlign: "center", color: "#9CA3AF", paddingTop: 60 }}>
              <div style={{ width: 52, height: 52, backgroundColor: "#F0F4FB", borderRadius: 14, margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>
                  <path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
                  <line x1="7" y1="12" x2="17" y2="12"/>
                </svg>
              </div>
              En attente de scan...
            </div>
          )}
          {scanning && <div style={{ textAlign: "center", color: "#3B82F6", paddingTop: 60, fontSize: 14, fontWeight: 600 }}>Vérification en cours...</div>}
          {result && !scanning && (() => {
            const si = statusInfo[result.status];
            return (
              <>
                <div style={{ padding: "16px", backgroundColor: si.bg, borderRadius: 12, border: `1px solid ${si.border}`, marginBottom: 20, textAlign: "center" }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: si.color }}>{si.label}</div>
                </div>
                {result.status !== "inconnu" && (
                  <>
                    {[
                      { label: "Nom commercial", value: result.name },
                      { label: "DCI", value: result.dci },
                      { label: "Laboratoire", value: result.labo },
                      { label: "Numéro de lot", value: result.lot },
                      { label: "Date d'expiration", value: result.expiry },
                      { label: "Stock actuel", value: `${result.stock} unités` },
                    ].map((f) => (
                      <div key={f.label} style={{ display: "flex", justifyContent: "space-between", padding: "11px 0", borderBottom: "1px solid #F3F4F6" }}>
                        <span style={{ fontSize: 13, color: "#6B7280" }}>{f.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#0A1628" }}>{f.value}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                      <button style={{ flex: 1, padding: "10px", backgroundColor: "#3B82F6", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Ajouter à la vente</button>
                      <button style={{ flex: 1, padding: "10px", backgroundColor: "#F8FAFC", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, cursor: "pointer" }}>Signaler</button>
                    </div>
                  </>
                )}
              </>
            );
          })()}
        </div>
      </div>
    </Layout>
  );
}
