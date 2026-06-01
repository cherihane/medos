import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import Layout from "../../components/Layout";
import { useMedicaments, useAlertes, usePatients } from "../../hooks/useSupabaseData";
import { useAuth } from "../../context/AuthContext";
import { openDocument, tableHTML, alertBannerHTML, etabFromAuth } from "../../utils/MedOSDocument";

function exportRapport(type, { medicaments, alertes, patients }, etab) {
  const dateFr = new Date().toLocaleDateString("fr-FR");

  if (type === "Inventaire complet médicaments") {
    const rows = medicaments.map((m) => {
      const rupture = (m.stock_actuel ?? 0) < (m.stock_minimum ?? 0);
      const badge = rupture
        ? `<span style="padding:2px 7px;background:#FEF2F2;color:#DC2626;border-radius:4px;font-weight:700;font-size:10px">RUPTURE</span>`
        : `<span style="padding:2px 7px;background:#DCFCE7;color:#16A34A;border-radius:4px;font-size:10px">OK</span>`;
      return [m.nom ?? "—", m.categorie ?? "—", String(m.stock_actuel ?? 0), String(m.stock_minimum ?? 0), badge];
    });
    openDocument({
      titre: "Inventaire complet médicaments",
      sousTitre: `Exporté le ${dateFr} — ${medicaments.length} produit${medicaments.length !== 1 ? "s" : ""} référencés`,
      etablissement: etab,
      sections: [{ titre: "Tableau de l'inventaire", html: tableHTML(["Médicament", "Catégorie", "Stock actuel", "Stock minimum", "Statut"], rows, { alignRight: [2, 3] }) }],
    });

  } else if (type === "État des stocks critiques") {
    const rupt = medicaments.filter((m) => (m.stock_actuel ?? 0) < (m.stock_minimum ?? 0));
    const rows = rupt.map((m) => [
      m.nom ?? "—", m.categorie ?? "—",
      `<strong style="color:#DC2626">${m.stock_actuel ?? 0}</strong>`,
      String(m.stock_minimum ?? 0),
      String((m.stock_minimum ?? 0) - (m.stock_actuel ?? 0)),
    ]);
    openDocument({
      titre: "État des stocks critiques",
      sousTitre: `Exporté le ${dateFr} — ${rupt.length} produit${rupt.length !== 1 ? "s" : ""} en rupture`,
      etablissement: etab,
      sections: [{
        titre: "Produits en rupture de stock",
        html: rupt.length === 0
          ? alertBannerHTML("Aucune rupture de stock détectée.", "success")
          : tableHTML(["Médicament", "Catégorie", "Stock actuel", "Stock minimum", "Manquant"], rows, { alignRight: [2, 3, 4] }),
      }],
    });

  } else if (type === "Registre patients") {
    const rows = patients.map((p) => [
      (p.nom ?? "—").toUpperCase(), p.prenom ?? "—",
      p.telephone ?? "—", p.groupe_sanguin ?? "—",
      p.derniere_visite ? new Date(p.derniere_visite).toLocaleDateString("fr-FR") : "—",
    ]);
    openDocument({
      titre: "Registre patients",
      sousTitre: `Exporté le ${dateFr} — ${patients.length} patient${patients.length !== 1 ? "s" : ""} enregistrés`,
      etablissement: etab,
      sections: [{ titre: "Liste des patients", html: tableHTML(["Nom", "Prénom", "Téléphone", "Gr. sanguin", "Dernière visite"], rows) }],
    });

  } else if (type === "Tableau de bord alertes") {
    const SEV_COLOR = { critique: "#DC2626", haute: "#D97706", moyenne: "#2563EB", faible: "#6B7280" };
    const rows = alertes.map((a) => {
      const c = SEV_COLOR[a.severite] ?? "#6B7280";
      const badge = `<span style="padding:2px 7px;background:${c}20;color:${c};border-radius:4px;font-weight:700;font-size:10px">${(a.severite ?? "").toUpperCase()}</span>`;
      return [badge, a.type ?? "—", a.titre ?? a.message ?? "—"];
    });
    openDocument({
      titre: "Tableau de bord alertes",
      sousTitre: `Exporté le ${dateFr} — ${alertes.length} alerte${alertes.length !== 1 ? "s" : ""} active${alertes.length !== 1 ? "s" : ""}`,
      etablissement: etab,
      sections: [{
        titre: "Alertes actives",
        html: rows.length === 0
          ? alertBannerHTML("Aucune alerte active.", "success")
          : tableHTML(["Sévérité", "Type", "Message"], rows),
      }],
    });
  }
}

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#EC4899"];

export default function Rapports() {
  const { auth } = useAuth();
  const etab = etabFromAuth(auth);
  const { data: medicaments, loading: loadMed } = useMedicaments();
  const { data: alertes, loading: loadAlt } = useAlertes(50);
  const { data: patients, loading: loadPat } = usePatients();

  const loading = loadMed || loadAlt || loadPat;

  // Répartition par catégorie
  const byCategorie = medicaments.reduce((acc, m) => {
    const cat = m.categorie ?? "Autres";
    acc[cat] = (acc[cat] ?? 0) + 1;
    return acc;
  }, {});
  const pieData = Object.entries(byCategorie)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value]) => ({ name, value }));

  // Stock par catégorie (barres)
  const stockData = Object.entries(
    medicaments.reduce((acc, m) => {
      const cat = m.categorie ?? "Autres";
      acc[cat] = (acc[cat] ?? 0) + (m.stock_actuel ?? 0);
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([cat, stock]) => ({ cat: cat.slice(0, 10), stock }));

  // Alertes par type
  const byType = alertes.reduce((acc, a) => {
    acc[a.type] = (acc[a.type] ?? 0) + 1;
    return acc;
  }, {});

  const ruptures    = medicaments.filter((m) => m.stock_actuel < m.stock_minimum).length;
  const critiques   = alertes.filter((a) => a.severite === "critique").length;
  const totalPatients = patients.length;

  const kpis = [
    { label: "Médicaments référencés", value: loading ? "…" : medicaments.length,  pct: "+0%",  color: "#3B82F6" },
    { label: "Produits en rupture",    value: loading ? "…" : ruptures,             pct: ruptures > 0 ? `${ruptures} ⚠` : "OK", color: "#EF4444" },
    { label: "Patients enregistrés",   value: loading ? "…" : totalPatients,        pct: "+0",   color: "#8B5CF6" },
    { label: "Alertes actives",        value: loading ? "…" : alertes.length,       pct: critiques > 0 ? `${critiques} critiques` : "OK", color: "#F59E0B" },
  ];

  const rapportsDispo = [
    { name: "Inventaire complet médicaments",    date: new Date().toLocaleDateString("fr-FR"), pages: `${medicaments.length} produits` },
    { name: "État des stocks critiques",          date: new Date().toLocaleDateString("fr-FR"), pages: `${ruptures} ruptures` },
    { name: "Registre patients",                  date: new Date().toLocaleDateString("fr-FR"), pages: `${totalPatients} patients` },
    { name: "Tableau de bord alertes",            date: new Date().toLocaleDateString("fr-FR"), pages: `${alertes.length} alertes` },
  ];

  return (
    <Layout title="Rapports" subtitle="Analyses et indicateurs de performance">
      {/* ── KPI ── */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ backgroundColor: "white", padding: "18px 22px", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{k.label}</div>
            <div style={{ fontSize: 11, color: k.color, marginTop: 4, fontWeight: 600 }}>{k.pct}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* Stock par catégorie */}
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", minWidth: 0 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Stock par catégorie</h3>
          {loading ? (
            <div style={{ height: 220, backgroundColor: "#F8FAFC", borderRadius: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
          ) : (
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stockData}>
                  <XAxis dataKey="cat" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v} unités`, "Stock"]} />
                  <Bar dataKey="stock" fill="#3B82F6" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Répartition catégories */}
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Catégories</h3>
          {loading ? (
            <div style={{ height: 160, backgroundColor: "#F8FAFC", borderRadius: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
          ) : (
            <>
              <div style={{ width: "100%", height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value">
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                {pieData.map((d, i) => (
                  <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: COLORS[i % COLORS.length] }} />
                    <span style={{ fontSize: 11, color: "#6B7280" }}>{d.name} ({d.value})</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Alertes par type + rapports */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Alertes par type</h3>
          {loading ? (
            [1,2,3].map((i) => <div key={i} style={{ height: 36, backgroundColor: "#F8FAFC", borderRadius: 8, marginBottom: 8, animation: "pulse 1.5s ease-in-out infinite" }} />)
          ) : Object.entries(byType).length === 0 ? (
            <div style={{ color: "#9CA3AF", fontSize: 13 }}>Aucune alerte active</div>
          ) : (
            Object.entries(byType).map(([type, count]) => (
              <div key={type} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", backgroundColor: "#F8FAFC", borderRadius: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#374151", textTransform: "capitalize" }}>{type}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#EF4444" }}>{count}</span>
              </div>
            ))
          )}
        </div>

        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Rapports disponibles</h3>
          {rapportsDispo.map((r) => (
            <div key={r.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: "1px solid #F3F4F6" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0A1628" }}>{r.name}</div>
                <div style={{ fontSize: 11, color: "#9CA3AF" }}>{r.date} · {r.pages}</div>
              </div>
              <button onClick={() => exportRapport(r.name, { medicaments, alertes, patients }, etab)} style={{ padding: "6px 14px", backgroundColor: "#F8FAFC", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>
                Exporter
              </button>
            </div>
          ))}
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </Layout>
  );
}
