import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import Layout from "../../components/Layout";
import { useAuth } from "../../context/AuthContext";
import { useOrdonnances, useMedicaments } from "../../hooks/useSupabaseData";
import { openDocument, tableHTML, kpiHTML, etabFromAuth } from "../../utils/MedOSDocument";

const MOIS_LABELS = ["Jan", "Fev", "Mar", "Avr", "Mai", "Jun", "Jul", "Aou", "Sep", "Oct", "Nov", "Dec"];

function exportRapportGlobal(etab, monthlyData, kpis) {
  openDocument({
    titre: "Rapport global hospitalier",
    sousTitre: `Donnees consolidees — ${new Date().toLocaleDateString("fr-FR")}`,
    etablissement: etab,
    sections: [
      {
        titre: "Indicateurs du mois",
        html: kpiHTML(kpis.map((k) => ({ label: k.label, value: String(k.value), color: k.color }))),
      },
      ...(monthlyData.length > 0 ? [{
        titre: "Ordonnances mensuelles — 6 derniers mois",
        html: tableHTML(
          ["Mois", "Ordonnances"],
          monthlyData.map((m) => [m.mois, m.dispensations.toLocaleString("fr-FR")]),
          { alignRight: [1] }
        ),
      }] : []),
    ],
  });
}

export default function Rapports() {
  const { auth } = useAuth();
  const etab = etabFromAuth(auth);
  const { data: ordonnances, loading: loadOrd } = useOrdonnances();
  const { data: medicaments, loading: loadMed } = useMedicaments();

  const loading = loadOrd || loadMed;

  // Ordonnances par mois (6 derniers mois)
  const monthlyData = useMemo(() => {
    const now = new Date();
    const mois = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      mois.push({ mois: MOIS_LABELS[d.getMonth()], year: d.getFullYear(), month: d.getMonth(), dispensations: 0 });
    }
    ordonnances.forEach((o) => {
      const d = new Date(o.date_emission ?? o.created_at ?? "");
      if (isNaN(d)) return;
      const m = mois.find((x) => x.year === d.getFullYear() && x.month === d.getMonth());
      if (m) m.dispensations += 1;
    });
    return mois;
  }, [ordonnances]);

  // KPIs calcules
  const moisActuel = new Date().getMonth();
  const anneeActuelle = new Date().getFullYear();
  const ordMoisActuel = ordonnances.filter((o) => {
    const d = new Date(o.date_emission ?? o.created_at ?? "");
    return !isNaN(d) && d.getMonth() === moisActuel && d.getFullYear() === anneeActuelle;
  });

  const ruptures = medicaments.filter((m) => (m.stock_actuel ?? 0) < (m.stock_minimum ?? 0)).length;
  const tauxDispo = medicaments.length > 0
    ? Math.round(((medicaments.length - ruptures) / medicaments.length) * 100)
    : 0;
  const enAttente = ordonnances.filter((o) => o.statut === "en_attente").length;

  const kpis = [
    { label: "Ordonnances (mois)", value: loading ? "…" : ordMoisActuel.length, color: "#10B981" },
    { label: "Total ordonnances",  value: loading ? "…" : ordonnances.length,   color: "#3B82F6" },
    { label: "Taux disponibilite", value: loading ? "…" : `${tauxDispo}%`,       color: "#8B5CF6" },
    { label: "En attente",         value: loading ? "…" : enAttente,             color: "#F59E0B" },
  ];

  return (
    <Layout title="Rapports Hospitaliers" subtitle="Tableaux de bord et rapports de performance">
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ backgroundColor: "white", borderRadius: 14, padding: "18px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 20, minWidth: 0 }}>
        <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Ordonnances mensuelles</h3>
        {loading ? (
          <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", fontSize: 14 }}>Chargement…</div>
        ) : ordonnances.length === 0 ? (
          <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", fontSize: 14 }}>Aucune ordonnance enregistree.</div>
        ) : (
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="dispensations" fill="#10B981" radius={[6, 6, 0, 0]} name="Ordonnances" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Synthese</h3>
          <button
            onClick={() => exportRapportGlobal(etab, monthlyData, kpis)}
            style={{ padding: "7px 16px", backgroundColor: "#10B981", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Generer rapport
          </button>
        </div>

        {loading ? (
          <div style={{ padding: "32px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>Chargement…</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ padding: "16px", backgroundColor: "#F0FDF4", borderRadius: 10 }}>
              <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>Ordonnances ce mois</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#10B981" }}>{ordMoisActuel.length}</div>
            </div>
            <div style={{ padding: "16px", backgroundColor: "#EFF6FF", borderRadius: 10 }}>
              <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>Medicaments en base</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#3B82F6" }}>{medicaments.length}</div>
            </div>
            <div style={{ padding: "16px", backgroundColor: "#F5F3FF", borderRadius: 10 }}>
              <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>Taux de disponibilite</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#8B5CF6" }}>{tauxDispo}%</div>
            </div>
            <div style={{ padding: "16px", backgroundColor: ruptures > 0 ? "#FEF2F2" : "#F0FDF4", borderRadius: 10 }}>
              <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>Ruptures de stock</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: ruptures > 0 ? "#EF4444" : "#10B981" }}>{ruptures}</div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
