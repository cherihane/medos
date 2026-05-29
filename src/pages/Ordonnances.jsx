import { useState } from "react";
import Layout from "../components/Layout";
import { prescriptions } from "../data/staticData";

const statusStyle = {
  "traitée": { bg: "#DCFCE7", color: "#16A34A" },
  "en attente": { bg: "#DBEAFE", color: "#2563EB" },
  "refusée": { bg: "#FEF2F2", color: "#EF4444" },
};

export default function Ordonnances() {
  const [selected, setSelected] = useState(null);

  return (
    <Layout title="Ordonnances">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20 }}>
        {/* List */}
        <div style={{ backgroundColor: "white", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0A1628" }}>Liste des ordonnances</h3>
            <button style={{ padding: "7px 14px", backgroundColor: "#3B82F6", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              + Nouvelle
            </button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: "#F8FAFC" }}>
                {["N° Ordonnance", "Patient", "Médecin", "Date", "Statut"].map((h) => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6B7280", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {prescriptions.map((p) => {
                const s = statusStyle[p.status];
                return (
                  <tr
                    key={p.id}
                    onClick={() => setSelected(p)}
                    style={{ borderBottom: "1px solid #F3F4F6", cursor: "pointer", backgroundColor: selected?.id === p.id ? "#EFF6FF" : "white" }}
                  >
                    <td style={{ padding: "13px 16px", fontWeight: 600, color: "#3B82F6" }}>{p.id}</td>
                    <td style={{ padding: "13px 16px", fontWeight: 600, color: "#0A1628" }}>{p.patient}</td>
                    <td style={{ padding: "13px 16px", color: "#6B7280" }}>{p.medecin}</td>
                    <td style={{ padding: "13px 16px", color: "#6B7280", fontSize: 12 }}>{p.date}</td>
                    <td style={{ padding: "13px 16px" }}>
                      <span style={{ padding: "3px 10px", backgroundColor: s.bg, color: s.color, borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{p.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Detail */}
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          {!selected ? (
            <div style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, paddingTop: 60 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              Sélectionnez une ordonnance pour voir les détails
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0A1628" }}>{selected.id}</h3>
                  <span style={{
                    fontSize: 11, padding: "2px 10px", borderRadius: 10, fontWeight: 700,
                    backgroundColor: statusStyle[selected.status].bg, color: statusStyle[selected.status].color
                  }}>{selected.status}</span>
                </div>
                <span style={{ fontSize: 12, color: "#9CA3AF" }}>{selected.date}</span>
              </div>

              <div style={{ padding: "14px", backgroundColor: "#F8FAFC", borderRadius: 10, marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>Patient</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0A1628" }}>{selected.patient}</div>
              </div>

              <div style={{ padding: "14px", backgroundColor: "#F8FAFC", borderRadius: 10, marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>Prescripteur</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0A1628" }}>{selected.medecin}</div>
              </div>

              <div style={{ padding: "14px", backgroundColor: "#F8FAFC", borderRadius: 10, marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>Médicaments prescrits</div>
                {selected.items.map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#3B82F6", flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: "#374151" }}>{item}</span>
                  </div>
                ))}
              </div>

              <div style={{ padding: "14px", backgroundColor: "#F8FAFC", borderRadius: 10, marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "#6B7280" }}>Total estimé</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: "#0A1628" }}>{selected.total}</span>
                </div>
              </div>

              {selected.status === "en attente" && (
                <div style={{ display: "flex", gap: 10 }}>
                  <button style={{ flex: 1, padding: "10px", backgroundColor: "#10B981", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    ✓ Valider
                  </button>
                  <button style={{ flex: 1, padding: "10px", backgroundColor: "#FEF2F2", color: "#EF4444", border: "1px solid #FCA5A5", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    ✗ Refuser
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
