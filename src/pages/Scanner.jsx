import { useState } from "react";
import Layout from "../components/Layout";

const fakeResults = {
  "3400936543988": {
    name: "Doliprane 1000mg",
    dci: "Paracétamol",
    labo: "Sanofi",
    lot: "LOT2024-A12",
    expiry: "2026-03",
    status: "authentique",
    stock: 145,
  },
  "3400939518607": {
    name: "Amoxicilline Mylan 500mg",
    dci: "Amoxicilline",
    labo: "Mylan",
    lot: "LOT2024-B08",
    expiry: "2025-09",
    status: "alerte_expiration",
    stock: 12,
  },
};

export default function Scanner() {
  const [barcode, setBarcode] = useState("");
  const [result, setResult] = useState(null);
  const [scanning, setScanning] = useState(false);

  const handleScan = () => {
    setScanning(true);
    setTimeout(() => {
      const res = fakeResults[barcode] || { status: "inconnu" };
      setResult(res);
      setScanning(false);
    }, 1000);
  };

  const simulateScan = (code) => {
    setBarcode(code);
    setScanning(true);
    setTimeout(() => {
      setResult(fakeResults[code]);
      setScanning(false);
    }, 1000);
  };

  const statusInfo = {
    authentique: { icon: "✅", label: "Médicament authentique", bg: "#DCFCE7", color: "#16A34A", border: "#86EFAC" },
    alerte_expiration: { icon: "⚠️", label: "Alerte : expiration proche", bg: "#FFFBEB", color: "#D97706", border: "#FCD34D" },
    inconnu: { icon: "❌", label: "Médicament non reconnu", bg: "#FEF2F2", color: "#EF4444", border: "#FCA5A5" },
  };

  return (
    <Layout title="Scanner — Traçabilité">
      <div className="dash-grid-2">
        {/* Scanner zone */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ backgroundColor: "white", borderRadius: 16, padding: "28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", textAlign: "center" }}>
            <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Zone de scan</h3>

            {/* Fake scanner view */}
            <div style={{
              width: "100%", height: 200, backgroundColor: "#0A1628", borderRadius: 12,
              display: "flex", alignItems: "center", justifyContent: "center", position: "relative", marginBottom: 20
            }}>
              <div style={{ position: "relative", width: 180, height: 140, border: "2px solid rgba(59,130,246,0.4)", borderRadius: 8 }}>
                {["top-left", "top-right", "bottom-left", "bottom-right"].map((pos) => {
                  const style = {
                    position: "absolute", width: 20, height: 20,
                    borderColor: "#3B82F6", borderStyle: "solid", borderWidth: 0,
                  };
                  if (pos === "top-left") { style.top = -2; style.left = -2; style.borderTopWidth = 3; style.borderLeftWidth = 3; }
                  if (pos === "top-right") { style.top = -2; style.right = -2; style.borderTopWidth = 3; style.borderRightWidth = 3; }
                  if (pos === "bottom-left") { style.bottom = -2; style.left = -2; style.borderBottomWidth = 3; style.borderLeftWidth = 3; }
                  if (pos === "bottom-right") { style.bottom = -2; style.right = -2; style.borderBottomWidth = 3; style.borderRightWidth = 3; }
                  return <div key={pos} style={style} />;
                })}
                {scanning ? (
                  <div style={{ position: "absolute", top: "50%", left: "10%", right: "10%", height: 2, backgroundColor: "#3B82F6", boxShadow: "0 0 8px #3B82F6", animation: "none" }} />
                ) : (
                  <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, textAlign: "center", paddingTop: 50 }}>
                    {scanning ? "Scan en cours..." : "Placez le code-barre ici"}
                  </div>
                )}
              </div>
              <div style={{ position: "absolute", bottom: 10, color: "rgba(255,255,255,0.4)", fontSize: 11 }}>
                📡 Caméra active
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <input
                placeholder="Code-barre ou QR code..."
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleScan()}
                style={{ flex: 1, padding: "10px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 13, outline: "none" }}
              />
              <button
                onClick={handleScan}
                disabled={!barcode || scanning}
                style={{ padding: "10px 20px", backgroundColor: "#3B82F6", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                {scanning ? "..." : "Scanner"}
              </button>
            </div>
          </div>

          {/* Quick scan buttons */}
          <div style={{ backgroundColor: "white", borderRadius: 14, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h4 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: "#0A1628" }}>Codes de démonstration</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {Object.entries(fakeResults).map(([code, data]) => (
                <button
                  key={code}
                  onClick={() => simulateScan(code)}
                  style={{ padding: "12px 16px", backgroundColor: "#F8FAFC", border: "1px solid #E5E7EB", borderRadius: 10, cursor: "pointer", textAlign: "left" }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#0A1628" }}>{data.name}</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "monospace" }}>{code}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Result */}
        <div style={{ backgroundColor: "white", borderRadius: 16, padding: "28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Résultat du scan</h3>

          {!result && !scanning && (
            <div style={{ textAlign: "center", color: "#9CA3AF", paddingTop: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📡</div>
              <div style={{ fontSize: 13 }}>En attente de scan...</div>
            </div>
          )}

          {scanning && (
            <div style={{ textAlign: "center", color: "#3B82F6", paddingTop: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔄</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Vérification en cours...</div>
            </div>
          )}

          {result && !scanning && (
            <>
              {(() => {
                const si = statusInfo[result.status];
                return (
                  <div style={{ padding: "16px", backgroundColor: si.bg, borderRadius: 12, border: `1px solid ${si.border}`, marginBottom: 20, textAlign: "center" }}>
                    <div style={{ fontSize: 32, marginBottom: 6 }}>{si.icon}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: si.color }}>{si.label}</div>
                  </div>
                );
              })()}

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
                    <button style={{ flex: 1, padding: "10px", backgroundColor: "#3B82F6", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                      Ajouter à la vente
                    </button>
                    <button style={{ flex: 1, padding: "10px", backgroundColor: "#F8FAFC", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, cursor: "pointer" }}>
                      Signaler
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
