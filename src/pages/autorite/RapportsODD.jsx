import { useState } from "react";
import Layout from "../../components/Layout";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useKpiAutorite, useMedicaments, useEtablissements, useAlertes } from "../../hooks/useSupabaseData";
import { useAuth } from "../../context/AuthContext";
import { openDocument, tableHTML, kpiHTML, etabFromAuth } from "../../utils/MedOSDocument";

const oddData = [
  { goal: "ODD 3.3", label: "Maladies infectieuses", progress: 67, target: 80 },
  { goal: "ODD 3.4", label: "Maladies non transmissibles", progress: 54, target: 70 },
  { goal: "ODD 3.8", label: "Couverture santé universelle", progress: 72, target: 90 },
  { goal: "ODD 3.b", label: "Accès médicaments essentiels", progress: 78, target: 85 },
];

export default function RapportsODD() {
  const { auth } = useAuth();
  const etab = etabFromAuth(auth);
  const { data: kpi } = useKpiAutorite();
  const { data: medicaments } = useMedicaments();
  const { data: etablissements } = useEtablissements();
  const { data: alertes } = useAlertes(100);
  const { toasts, success } = useToast();
  const [generating, setGenerating] = useState(null);

  const genererPDF = (rapportNom) => {
    setGenerating(rapportNom);

    const oddRows = oddData.map((o) => {
      const ok = o.progress >= o.target;
      const bar = `<div style="width:100%;height:8px;background:#E5E7EB;border-radius:4px;position:relative">
        <div style="height:100%;width:${o.progress}%;background:${ok ? "#10B981" : "#8B5CF6"};border-radius:4px"></div>
      </div>`;
      return [
        `<strong>${o.goal}</strong>`,
        o.label,
        `<span style="color:${ok ? "#10B981" : "#D97706"};font-weight:700">${o.progress}%</span>`,
        `${o.target}%`,
        bar,
      ];
    });

    const medRows = medicaments.slice(0, 20).map((m) => [
      m.nom ?? "—",
      String(m.stock_actuel ?? 0),
      String(m.stock_minimum ?? 0),
      (m.stock_actuel ?? 0) < (m.stock_minimum ?? 0)
        ? `<span style="color:#DC2626;font-weight:700">RUPTURE</span>`
        : `<span style="color:#16A34A">OK</span>`,
    ]);

    const etabRows = etablissements.slice(0, 15).map((e) => [e.nom ?? "—", e.type ?? "—", e.ville ?? "—"]);

    openDocument({
      titre: rapportNom,
      sousTitre: `Rapport ODD — Système National de Gestion Pharmaceutique`,
      etablissement: etab,
      sections: [
        {
          titre: "Données nationales en temps réel",
          html: kpiHTML([
            { label: "Structures actives",    value: kpi?.structuresActives ?? "—",   color: "#10B981" },
            { label: "Médicaments tracés",    value: kpi?.medicamentsTraces ?? "—",   color: "#3B82F6" },
            { label: "Lots enregistrés",      value: kpi?.lots ?? "—",                color: "#8B5CF6" },
            { label: "Alertes pharmacovig.", value: kpi?.alertesPharmacovig ?? "—",  color: "#F59E0B" },
          ]),
        },
        {
          titre: "Indicateurs ODD Santé",
          html: tableHTML(["Objectif", "Description", "Progression", "Cible 2030", "Avancement"], oddRows),
        },
        ...(medRows.length > 0 ? [{
          titre: `Médicaments (${medicaments.length} au total, 20 premiers affichés)`,
          html: tableHTML(["Médicament", "Stock actuel", "Stock minimum", "Statut"], medRows, { alignRight: [1, 2] }),
        }] : []),
        ...(etabRows.length > 0 ? [{
          titre: `Établissements (${etablissements.length} au total)`,
          html: tableHTML(["Nom", "Type", "Ville"], etabRows),
        }] : []),
      ],
    });

    setTimeout(() => {
      setGenerating(null);
      success(`Rapport "${rapportNom}" ouvert`);
    }, 300);
  };

  return (
    <Layout title="Rapports ODD" subtitle="Suivi des Objectifs de Développement Durable — Santé">
      <Toast toasts={toasts} />
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Score ODD moyen", value: "68%", color: "#8B5CF6" },
          { label: "Objectifs atteints", value: "1/4", color: "#10B981" },
          { label: "Progression annuelle", value: "+4.2%", color: "#3B82F6" },
          { label: "Classement régional", value: "7/54", color: "#F59E0B" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: "white", borderRadius: 14, padding: "18px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Progression par objectif</h3>
          {oddData.map((o) => (
            <div key={o.goal} style={{ padding: "16px", backgroundColor: "#F8FAFC", borderRadius: 10, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#8B5CF6", padding: "2px 8px", backgroundColor: "#F5F3FF", borderRadius: 8 }}>{o.goal}</span>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginTop: 4 }}>{o.label}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: o.progress >= o.target ? "#10B981" : "#F59E0B" }}>{o.progress}%</div>
                  <div style={{ fontSize: 10, color: "#9CA3AF" }}>cible : {o.target}%</div>
                </div>
              </div>
              <div style={{ height: 8, backgroundColor: "#E5E7EB", borderRadius: 4, position: "relative" }}>
                <div style={{ height: "100%", width: `${o.progress}%`, backgroundColor: o.progress >= o.target ? "#10B981" : "#8B5CF6", borderRadius: 4 }} />
                <div style={{ position: "absolute", top: 0, left: `${o.target}%`, width: 2, height: "100%", backgroundColor: "#F59E0B" }} />
              </div>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>Ligne jaune = cible ONU 2030</div>
            </div>
          ))}
        </div>

        <div>
          <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Résumé exécutif 2024</h3>
            <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.8 }}>
              La Côte d'Ivoire progresse vers les ODD Santé avec une amélioration de +4.2% de la couverture vaccinale et une réduction de 12% de la mortalité infantile par rapport à 2023. La couverture santé universelle reste l'objectif le plus déficitaire avec 18 points d'écart à la cible.
            </div>
            <div style={{ marginTop: 16, padding: "12px", backgroundColor: "#F5F3FF", borderRadius: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#7C3AED", marginBottom: 4 }}>Priorité 2024-2025</div>
              <div style={{ fontSize: 12, color: "#6B7280" }}>Renforcer l'accès aux médicaments essentiels dans les zones rurales et améliorer la couverture vaccinale dans les régions nord.</div>
            </div>
          </div>

          <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Rapports disponibles</h3>
            {[
              { name: "Rapport ODD Santé 2023", date: "Jan 2024", pages: "84 pages" },
              { name: "Bilan mi-parcours 2020-2030", date: "Juil 2023", pages: "120 pages" },
              { name: "Rapport régional CEDEAO", date: "Oct 2023", pages: "56 pages" },
            ].map((r) => (
              <div key={r.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: "1px solid #F3F4F6" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0A1628" }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF" }}>{r.date} · {r.pages}</div>
                </div>
                <button
                  onClick={() => genererPDF(r.name)}
                  disabled={generating === r.name}
                  style={{ padding: "6px 14px", backgroundColor: generating === r.name ? "#E5E7EB" : "#F8FAFC", color: generating === r.name ? "#9CA3AF" : "#374151", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12, cursor: generating === r.name ? "wait" : "pointer" }}>
                  {generating === r.name ? "Génération…" : "Télécharger"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
