import { useState } from "react";
import Layout from "../../components/Layout";

const fakeResults = {
  "3400936543988": { name: "Doliprane 1000mg", labo: "Sanofi", lot: "LOT2024-A12", expiry: "2026-03", origine: "France", statut: "authentique", etapes: [
    { lieu: "Usine Sanofi — Lyon", date: "2024-01-05", action: "Fabrication" },
    { lieu: "Entrepôt MedDistrib — Abidjan", date: "2024-01-12", action: "Réception" },
    { lieu: "Pharmacie Lumière — Abidjan", date: "2024-01-15", action: "Dispensation" },
  ]},
};

export default function Tracabilite() {
  const [barcode, setBarcode] = useState("");
  const [result, setResult] = useState(null);
  const [scanning, setScanning] = useState(false);

  const handleScan = () => {
    if (!barcode) return;
    setScanning(true);
    setTimeout(() => { setResult(fakeResults[barcode] || { statut: "inconnu" }); setScanning(false); }, 900);
  };

  return (
    <Layout title="Traçabilité" subtitle="Suivi de bout en bout de la chaîne pharmaceutique">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ backgroundColor: "white", borderRadius: 16, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Scanner un produit</h3>

          <div style={{ width: "100%", height: 180, backgroundColor: "#0A1628", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <div style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
              Zone de scan — Caméra active
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <input value={barcode} onChange={(e) => setBarcode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleScan()}
              placeholder="Code-barre / QR code / Lot..."
              style={{ flex: 1, padding: "10px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 13, outline: "none" }} />
            <button onClick={handleScan} style={{ padding: "10px 20px", backgroundColor: "#F59E0B", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              {scanning ? "..." : "Tracer"}
            </button>
          </div>

          <div>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: "#0A1628", margin: "0 0 10px" }}>Codes de test</h4>
            <button onClick={() => { setBarcode("3400936543988"); handleScan(); }}
              style={{ width: "100%", padding: "10px 14px", backgroundColor: "#F8FAFC", border: "1px solid #E5E7EB", borderRadius: 10, cursor: "pointer", textAlign: "left", fontSize: 12 }}>
              <strong>Doliprane 1000mg</strong>
              <span style={{ color: "#9CA3AF", marginLeft: 8, fontFamily: "monospace" }}>3400936543988</span>
            </button>
          </div>

          <div style={{ marginTop: 20 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: "#0A1628", margin: "0 0 12px" }}>Statistiques traçabilité</h4>
            {[
              { label: "Produits tracés (mois)", value: "4 521", color: "#F59E0B" },
              { label: "Lots authentifiés", value: "98.7%", color: "#10B981" },
              { label: "Alertes détectées", value: "3", color: "#EF4444" },
            ].map((s) => (
              <div key={s.label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #F3F4F6" }}>
                <span style={{ fontSize: 13, color: "#6B7280" }}>{s.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ backgroundColor: "white", borderRadius: 16, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Historique du produit</h3>
          {!result && !scanning && (
            <div style={{ textAlign: "center", color: "#9CA3AF", paddingTop: 60, fontSize: 13 }}>Scannez un produit pour voir sa traçabilité complète</div>
          )}
          {scanning && <div style={{ textAlign: "center", color: "#F59E0B", paddingTop: 60, fontSize: 14, fontWeight: 600 }}>Traçage en cours...</div>}
          {result && !scanning && result.statut !== "inconnu" && (
            <>
              <div style={{ padding: "14px", backgroundColor: "#DCFCE7", borderRadius: 10, marginBottom: 20, border: "1px solid #86EFAC" }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: "#16A34A", marginBottom: 2 }}>Produit authentifié</div>
                <div style={{ fontSize: 13, color: "#374151" }}>{result.name} · {result.labo}</div>
                <div style={{ fontSize: 12, color: "#6B7280" }}>Lot : {result.lot} · Expire : {result.expiry} · Origine : {result.origine}</div>
              </div>

              <h4 style={{ fontSize: 13, fontWeight: 700, color: "#0A1628", margin: "0 0 16px" }}>Chaine de traçabilité</h4>
              <div style={{ position: "relative" }}>
                {result.etapes.map((e, i) => (
                  <div key={i} style={{ display: "flex", gap: 16, marginBottom: 20 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#F59E0B", flexShrink: 0 }} />
                      {i < result.etapes.length - 1 && <div style={{ width: 2, flex: 1, backgroundColor: "#E5E7EB", marginTop: 4 }} />}
                    </div>
                    <div style={{ flex: 1, paddingBottom: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#0A1628" }}>{e.action}</div>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>{e.lieu}</div>
                      <div style={{ fontSize: 11, color: "#9CA3AF" }}>{e.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {result && !scanning && result.statut === "inconnu" && (
            <div style={{ padding: "16px", backgroundColor: "#FEF2F2", borderRadius: 10, border: "1px solid #FCA5A5", textAlign: "center" }}>
              <div style={{ fontWeight: 700, color: "#EF4444", fontSize: 15 }}>Produit non reconnu</div>
              <div style={{ color: "#6B7280", fontSize: 13, marginTop: 4 }}>Ce produit n'est pas dans la base de traçabilité</div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
