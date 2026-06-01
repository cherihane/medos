import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import Layout from "../../components/Layout";
import { useAuth } from "../../context/AuthContext";
import { openDocument, tableHTML, kpiHTML, etabFromAuth } from "../../utils/MedOSDocument";

const rapportsStatiques = [
  { name: "Rapport de dispensation — Janvier 2024", type: "Dispensations", date: "01/02/2024",
    kpis: [["Dispensations totales","1 240"],["Coût total","18 400 000 FCFA"],["Taux de disponibilité","91.3%"],["Patients servis","892"]],
    lignes: [["Période","Janvier 2024"],["Médicaments dispensés","1 240"],["Coût total","18 400 000 FCFA"],["Taux de disponibilité","91.3%"],["Patients servis","892"]] },
  { name: "Rapport de coûts médicamenteux — Q4 2023", type: "Finances", date: "15/01/2024",
    kpis: [["Coût total","54 200 000 FCFA"],["Budget alloué","60 000 000 FCFA"],["Taux d'utilisation","90.3%"],["Écart favorable","5 800 000 FCFA"]],
    lignes: [["Période","Q4 2023 (Oct-Déc)"],["Coût total médicaments","54 200 000 FCFA"],["Budget alloué","60 000 000 FCFA"],["Taux d'utilisation","90.3%"],["Écart favorable","5 800 000 FCFA"]] },
  { name: "Rapport de disponibilité — 2023", type: "Stock", date: "10/01/2024",
    kpis: [["Taux moyen","89.7%"],["Ruptures","14"],["Durée moy. rupture","3.2 jours"],["Médicaments essentiels","97.1%"]],
    lignes: [["Année","2023"],["Taux de disponibilité moyen","89.7%"],["Ruptures enregistrées","14"],["Durée moyenne de rupture","3.2 jours"],["Médicaments essentiels disponibles","97.1%"]] },
];

const monthlyData = [
  { mois: "Août", dispensations: 1120 },
  { mois: "Sep",  dispensations: 1340 },
  { mois: "Oct",  dispensations: 1180 },
  { mois: "Nov",  dispensations: 1560 },
  { mois: "Déc",  dispensations: 1820 },
  { mois: "Jan",  dispensations: 1240 },
];

function exportRapportHopital(rapport, etab) {
  openDocument({
    titre: rapport.name,
    sousTitre: `${rapport.type} — Période : ${rapport.date}`,
    etablissement: etab,
    sections: [
      {
        titre: "Indicateurs clés",
        html: kpiHTML(rapport.kpis.map(([label, value]) => ({ label, value }))),
      },
      {
        titre: "Détail des indicateurs",
        html: tableHTML(["Indicateur", "Valeur"], rapport.lignes),
      },
    ],
  });
}

function exportRapportGlobal(etab) {
  openDocument({
    titre: "Rapport global hospitalier",
    sousTitre: `Données consolidées — ${new Date().toLocaleDateString("fr-FR")}`,
    etablissement: etab,
    sections: [
      {
        titre: "Indicateurs du mois",
        html: kpiHTML([
          { label: "Dispensations", value: "1 240", color: "#10B981" },
          { label: "Coût médicaments", value: "18,4M FCFA", color: "#3B82F6" },
          { label: "Taux disponibilité", value: "91.3%", color: "#8B5CF6" },
          { label: "Patients servis", value: "892", color: "#F59E0B" },
        ]),
      },
      {
        titre: "Dispensations mensuelles — 6 derniers mois",
        html: tableHTML(
          ["Mois", "Dispensations"],
          monthlyData.map((m) => [m.mois, m.dispensations.toLocaleString("fr-FR")]),
          { alignRight: [1] }
        ),
      },
    ],
  });
}

export default function Rapports() {
  const { auth } = useAuth();
  const etab = etabFromAuth(auth);

  return (
    <Layout title="Rapports Hospitaliers" subtitle="Tableaux de bord et rapports de performance">
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Dispensations (mois)", value: "1 240", color: "#10B981" },
          { label: "Coût médicaments", value: "18.4M FCFA", color: "#3B82F6" },
          { label: "Taux disponibilité", value: "91.3%", color: "#8B5CF6" },
          { label: "Patients servis", value: "892", color: "#F59E0B" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: "white", borderRadius: 14, padding: "18px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 20, minWidth: 0 }}>
        <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Dispensations mensuelles</h3>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData}>
              <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="dispensations" fill="#10B981" radius={[6, 6, 0, 0]} name="Dispensations" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Rapports disponibles</h3>
          <button
            onClick={() => exportRapportGlobal(etab)}
            style={{ padding: "7px 16px", backgroundColor: "#10B981", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Générer rapport
          </button>
        </div>
        {rapportsStatiques.map((r) => (
          <div key={r.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #F3F4F6" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#0A1628" }}>{r.name}</div>
              <div style={{ fontSize: 11, color: "#9CA3AF" }}>Généré le {r.date}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ padding: "3px 10px", backgroundColor: "#DCFCE7", color: "#16A34A", borderRadius: 8, fontSize: 11, fontWeight: 600 }}>{r.type}</span>
              <button
                onClick={() => exportRapportHopital(r, etab)}
                style={{ padding: "6px 14px", backgroundColor: "#F8FAFC", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12, cursor: "pointer" }}
              >
                Imprimer
              </button>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
