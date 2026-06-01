import { useState } from "react";
import Layout from "../../components/Layout";

const acteurs = [
  { nom: "Pharmacie Lumière", type: "Pharmacie", ville: "Abidjan", licence: "PH-CI-2019-0421", statut: "conforme", dernierControle: "2024-01-10", score: 94 },
  { nom: "Hôpital Central Abidjan", type: "Hôpital", ville: "Abidjan", licence: "HO-CI-2015-0089", statut: "conforme", dernierControle: "2024-01-08", score: 88 },
  { nom: "MedDistrib International", type: "Distributeur", ville: "Abidjan", licence: "DI-CI-2018-0234", statut: "alerte", dernierControle: "2023-12-15", score: 71 },
  { nom: "Clinique du Nord", type: "Clinique", ville: "Bouaké", licence: "CL-CI-2020-0156", statut: "conforme", dernierControle: "2024-01-05", score: 91 },
  { nom: "Pharmacie Espoir", type: "Pharmacie", ville: "San Pédro", licence: "PH-CI-2021-0512", statut: "suspendu", dernierControle: "2023-11-20", score: 42 },
  { nom: "Centre de Santé Daloa", type: "CS", ville: "Daloa", licence: "CS-CI-2017-0078", statut: "conforme", dernierControle: "2023-12-28", score: 83 },
];

const statutStyle = {
  conforme: { bg: "#DCFCE7", color: "#16A34A" },
  alerte: { bg: "#FFFBEB", color: "#D97706" },
  suspendu: { bg: "#FEF2F2", color: "#EF4444" },
};

// ─── Modal Inspection ────────────────────────────────────────────────────────
function InspectionModal({ acteur, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ backgroundColor: "white", borderRadius: 16, width: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ padding: "20px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Fiche d'inspection</h3>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 3 }}>{acteur.nom}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF" }}>×</button>
        </div>
        <div style={{ padding: "18px 24px" }}>
          {[
            ["Nom", acteur.nom],
            ["Type", acteur.type],
            ["Ville", acteur.ville],
            ["N° Licence", acteur.licence],
            ["Dernier contrôle", acteur.dernierControle],
            ["Statut", acteur.statut],
            ["Score de conformité", `${acteur.score} / 100`],
          ].map(([label, val]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #F3F4F6" }}>
              <span style={{ fontSize: 13, color: "#6B7280" }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#0A1628", textTransform: label === "Statut" ? "capitalize" : "none" }}>{val}</span>
            </div>
          ))}
          <div style={{ marginTop: 16, padding: "12px 14px", backgroundColor: acteur.statut === "conforme" ? "#DCFCE7" : acteur.statut === "alerte" ? "#FFFBEB" : "#FEF2F2", borderRadius: 8, fontSize: 12, color: "#374151" }}>
            <strong>Observation :</strong> {
              acteur.statut === "conforme" ? "Établissement conforme aux normes réglementaires en vigueur." :
              acteur.statut === "alerte" ? "Des irrégularités ont été relevées lors du dernier contrôle. Une inspection de suivi est recommandée." :
              "Licence suspendue suite aux manquements graves constatés lors du dernier contrôle."
            }
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <button onClick={onClose} style={{ padding: "9px 20px", backgroundColor: "#8B5CF6", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function exportRegistreTxt(acteurs) {
  const date = new Date().toLocaleDateString("fr-FR");
  const sep = "─".repeat(70);
  const lines = [
    "MEDOS — REGISTRE DES ACTEURS PHARMACEUTIQUES",
    `Exporté le ${date}`,
    sep,
    "",
    ...acteurs.map((a) =>
      `${a.nom.padEnd(32)} | ${a.type.padEnd(14)} | ${a.ville.padEnd(12)} | ${a.licence.padEnd(18)} | Score: ${String(a.score).padStart(3)}% | ${a.statut}`
    ),
    "",
    sep,
    `Total : ${acteurs.length} acteurs`,
  ];
  const content = "﻿" + lines.join("\n");
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `registre-acteurs-${date.replace(/\//g, "-")}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Acteurs() {
  const [inspected, setInspected] = useState(null);

  return (
    <Layout title="Acteurs" subtitle="Répertoire et conformité des acteurs pharmaceutiques">
      {inspected && <InspectionModal acteur={inspected} onClose={() => setInspected(null)} />}
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Acteurs enregistrés", value: "1 248", color: "#8B5CF6" },
          { label: "Conformes", value: "1 189", color: "#10B981" },
          { label: "En alerte", value: "42", color: "#F59E0B" },
          { label: "Suspendus", value: "17", color: "#EF4444" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: "white", borderRadius: 14, padding: "18px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ backgroundColor: "white", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between" }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0A1628" }}>Registre des acteurs</h3>
          <button onClick={() => exportRegistreTxt(acteurs)} style={{ padding: "7px 14px", backgroundColor: "#8B5CF6", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Exporter le registre
          </button>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: "#F8FAFC" }}>
              {["Nom", "Type", "Ville", "N° Licence", "Score", "Dernier contrôle", "Statut", "Actions"].map((h) => (
                <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6B7280", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {acteurs.map((a) => {
              const s = statutStyle[a.statut];
              return (
                <tr key={a.nom} style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "13px 16px", fontWeight: 600, color: "#0A1628" }}>{a.nom}</td>
                  <td style={{ padding: "13px 16px", color: "#6B7280" }}>
                    <span style={{ padding: "2px 8px", backgroundColor: "#EFF6FF", color: "#2563EB", borderRadius: 8, fontSize: 11, fontWeight: 600 }}>{a.type}</span>
                  </td>
                  <td style={{ padding: "13px 16px", color: "#6B7280" }}>{a.ville}</td>
                  <td style={{ padding: "13px 16px", color: "#9CA3AF", fontSize: 11, fontFamily: "monospace" }}>{a.licence}</td>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ height: 6, width: 60, backgroundColor: "#E5E7EB", borderRadius: 4 }}>
                        <div style={{ height: "100%", width: `${a.score}%`, backgroundColor: a.score >= 80 ? "#10B981" : a.score >= 60 ? "#F59E0B" : "#EF4444", borderRadius: 4 }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: a.score >= 80 ? "#16A34A" : a.score >= 60 ? "#D97706" : "#EF4444" }}>{a.score}%</span>
                    </div>
                  </td>
                  <td style={{ padding: "13px 16px", color: "#6B7280", fontSize: 12 }}>{a.dernierControle}</td>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ padding: "3px 10px", backgroundColor: s.bg, color: s.color, borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{a.statut}</span>
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <button onClick={() => setInspected(a)} style={{ padding: "4px 12px", backgroundColor: "#F8FAFC", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>
                      Inspecter
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
