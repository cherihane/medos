import { colors } from "../../theme";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import * as XLSX from "xlsx";
import Layout from "../../components/Layout";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useMedicaments, useAlertes, usePatients } from "../../hooks/useSupabaseData";
import { useAuth } from "../../context/AuthContext";
import { openDocument, tableHTML, alertBannerHTML, fetchEtabFromAuth } from "../../utils/MedOSDocument";
import { supabase } from "../../supabaseClient";

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

// ── Helpers CSV / Excel ────────────────────────────────────────────────────────

function downloadCSV(filename, rows) {
  const escape = (v) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function downloadXLSX(filename, sheets) {
  // sheets: [{ name, data: [[...], ...] }]
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, data }) => {
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, name);
  });
  XLSX.writeFile(wb, filename);
}

async function exportVentesCSV(auth) {
  const etablissement_id = auth?.etablissement_id;
  const { data } = await supabase
    .from("ventes")
    .select("created_at, medicament_nom, quantite, prix_unitaire, montant_total, mode_paiement")
    .eq("etablissement_id", etablissement_id)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (!data || data.length === 0) { throw new Error("Aucune vente trouvée."); }

  const header = ["Date", "Médicament", "Quantité", "Prix unitaire", "Total", "Mode de paiement"];
  const rows = data.map((v) => [
    v.created_at ? new Date(v.created_at).toLocaleDateString("fr-FR") : "—",
    v.medicament_nom ?? "—",
    v.quantite ?? 0,
    v.prix_unitaire ?? 0,
    v.montant_total ?? 0,
    v.mode_paiement ?? "—",
  ]);
  downloadCSV(`journal_ventes_${new Date().toISOString().slice(0,10)}.csv`, [header, ...rows]);
}

function exportInventaireXLSX(medicaments) {
  const header = ["Médicament", "Catégorie", "Stock actuel", "Stock minimum", "Prix vente (FCFA)", "Date péremption", "Statut"];
  const rows = medicaments.map((m) => {
    const rupture = (m.stock_actuel ?? 0) < (m.stock_minimum ?? 0);
    return [
      m.nom ?? "—",
      m.categorie ?? "—",
      m.stock_actuel ?? 0,
      m.stock_minimum ?? 0,
      m.prix_unitaire ?? 0,
      m.date_peremption ? new Date(m.date_peremption).toLocaleDateString("fr-FR") : "—",
      rupture ? "RUPTURE" : "OK",
    ];
  });
  downloadXLSX(`inventaire_${new Date().toISOString().slice(0,10)}.xlsx`, [
    { name: "Inventaire", data: [header, ...rows] },
  ]);
}

async function exportMensuelXLSX(auth) {
  const etablissement_id = auth?.etablissement_id;
  const debut = new Date();
  debut.setDate(1); debut.setHours(0,0,0,0);

  const { data } = await supabase
    .from("ventes")
    .select("created_at, medicament_nom, quantite, montant_total, mode_paiement")
    .eq("etablissement_id", etablissement_id)
    .gte("created_at", debut.toISOString())
    .order("created_at", { ascending: false });

  if (!data || data.length === 0) { throw new Error("Aucune vente ce mois-ci."); }

  // Feuille 1 : détail
  const detailHeader = ["Date", "Médicament", "Quantité", "Total", "Mode"];
  const detailRows = data.map((v) => [
    v.created_at ? new Date(v.created_at).toLocaleDateString("fr-FR") : "—",
    v.medicament_nom ?? "—",
    v.quantite ?? 0,
    v.montant_total ?? 0,
    v.mode_paiement ?? "—",
  ]);

  // Feuille 2 : résumé par mode de paiement
  const byMode = data.reduce((acc, v) => {
    const mode = v.mode_paiement ?? "inconnu";
    acc[mode] = (acc[mode] ?? 0) + (v.montant_total ?? 0);
    return acc;
  }, {});
  const resumeHeader = ["Mode de paiement", "Total (FCFA)"];
  const resumeRows = Object.entries(byMode).map(([k, v]) => [k, v]);
  const totalGlobal = data.reduce((s, v) => s + (v.montant_total ?? 0), 0);

  const mois = debut.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  downloadXLSX(`rapport_mensuel_${mois.replace(" ", "_")}.xlsx`, [
    { name: "Detail", data: [detailHeader, ...detailRows] },
    { name: "Resume", data: [resumeHeader, ...resumeRows, ["TOTAL", totalGlobal]] },
  ]);
}

function exportBilanPDF(medicaments, etab) {
  const dateFr = new Date().toLocaleDateString("fr-FR");
  const ruptures = medicaments.filter((m) => (m.stock_actuel ?? 0) < (m.stock_minimum ?? 0));
  const ok = medicaments.length - ruptures.length;
  const valeurStock = medicaments.reduce((s, m) => s + (m.stock_actuel ?? 0) * (m.prix_unitaire ?? 0), 0);

  const statsHTML = `
    <div style="display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap">
      ${[
        { label: "Total produits", val: medicaments.length, color: "#3B82F6" },
        { label: "En stock OK", val: ok, color: "#16A34A" },
        { label: "En rupture", val: ruptures.length, color: "#DC2626" },
        { label: "Valeur stock estimée", val: `${valeurStock.toLocaleString("fr-FR")} FCFA`, color: "#7C3AED" },
      ].map((s) => `
        <div style="flex:1;min-width:130px;padding:12px 16px;border-radius:8px;border-left:4px solid ${s.color};background:#F8FAFC">
          <div style="font-size:20px;font-weight:800;color:${s.color}">${s.val}</div>
          <div style="font-size:11px;color:#6B7280">${s.label}</div>
        </div>
      `).join("")}
    </div>`;

  const rows = medicaments.map((m) => {
    const rupture = (m.stock_actuel ?? 0) < (m.stock_minimum ?? 0);
    const badge = rupture
      ? `<span style="padding:2px 7px;background:#FEF2F2;color:#DC2626;border-radius:4px;font-weight:700;font-size:10px">RUPTURE</span>`
      : `<span style="padding:2px 7px;background:#DCFCE7;color:#16A34A;border-radius:4px;font-size:10px">OK</span>`;
    return [m.nom ?? "—", m.categorie ?? "—", String(m.stock_actuel ?? 0), String(m.stock_minimum ?? 0), String(m.prix_unitaire ?? 0), badge];
  });

  openDocument({
    titre: "Bilan de stock",
    sousTitre: `Exporté le ${dateFr} — ${medicaments.length} produit${medicaments.length !== 1 ? "s" : ""}`,
    etablissement: etab,
    sections: [
      { titre: "Synthèse", html: statsHTML },
      { titre: "Détail inventaire complet", html: tableHTML(["Médicament", "Catégorie", "Stock actuel", "Stock min.", "Prix vente", "Statut"], rows, { alignRight: [2, 3, 4] }) },
    ],
  });
}

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#EC4899"];

function ExportBtn({ label, desc, color, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", flexDirection: "column", alignItems: "flex-start",
        padding: "14px 18px", borderRadius: 10, border: `1.5px solid ${color}30`,
        backgroundColor: `${color}08`, cursor: "pointer", minWidth: 220, flex: "1 1 220px",
        textAlign: "left", transition: "background 0.15s",
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 700, color }}>{label}</span>
      <span style={{ fontSize: 11, color: colors.textSecondary, marginTop: 3 }}>{desc}</span>
    </button>
  );
}

export default function Rapports() {
  const { auth } = useAuth();
  const { toasts, error: showError } = useToast();
  const { data: medicaments, loading: loadMed } = useMedicaments();
  const { data: alertes, loading: loadAlt } = useAlertes(50);
  const { data: patients, loading: loadPat } = usePatients(auth?.etablissement_id);

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
      <div className="kpi-row">
        {kpis.map((k) => (
          <div key={k.label} style={{ backgroundColor: colors.bgCard, padding: "18px 22px", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{k.label}</div>
            <div style={{ fontSize: 11, color: k.color, marginTop: 4, fontWeight: 600 }}>{k.pct}</div>
          </div>
        ))}
      </div>

      <div className="dash-grid-2-1" style={{ marginBottom: 20 }}>
        {/* Stock par catégorie */}
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", minWidth: 0 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: colors.navy }}>Stock par catégorie</h3>
          {loading ? (
            <div style={{ height: 220, backgroundColor: colors.bgSurface, borderRadius: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
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
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: colors.navy }}>Catégories</h3>
          {loading ? (
            <div style={{ height: 160, backgroundColor: colors.bgSurface, borderRadius: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
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
                    <span style={{ fontSize: 11, color: colors.textSecondary }}>{d.name} ({d.value})</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Alertes par type + rapports */}
      <div className="dash-grid-2">
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: colors.navy }}>Alertes par type</h3>
          {loading ? (
            [1,2,3].map((i) => <div key={i} style={{ height: 36, backgroundColor: colors.bgSurface, borderRadius: 8, marginBottom: 8, animation: "pulse 1.5s ease-in-out infinite" }} />)
          ) : Object.entries(byType).length === 0 ? (
            <div style={{ color: colors.textMuted, fontSize: 13 }}>Aucune alerte active</div>
          ) : (
            Object.entries(byType).map(([type, count]) => (
              <div key={type} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", backgroundColor: colors.bgSurface, borderRadius: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: colors.text, textTransform: "capitalize" }}>{type}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#EF4444" }}>{count}</span>
              </div>
            ))
          )}
        </div>

        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: colors.navy }}>Rapports disponibles</h3>
          {rapportsDispo.map((r) => (
            <div key={r.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: "1px solid var(--border-light)" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: colors.navy }}>{r.name}</div>
                <div style={{ fontSize: 11, color: colors.textMuted }}>{r.date} · {r.pages}</div>
              </div>
              <button onClick={async () => { const etab = await fetchEtabFromAuth(auth); exportRapport(r.name, { medicaments, alertes, patients }, etab); }} style={{ padding: "6px 14px", backgroundColor: colors.bgSurface, color: colors.text, border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>
                Exporter
              </button>
            </div>
          ))}
        </div>
      </div>
      {/* ── Exports avances ── */}
      <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginTop: 20 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: colors.navy }}>Exports avances</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <ExportBtn
            label="CSV — Journal des ventes"
            desc="Toutes les ventes (jusqu'a 5 000 lignes)"
            color="#10B981"
            onClick={async () => { try { await exportVentesCSV(auth); } catch (e) { showError(e.message); } }}
          />
          <ExportBtn
            label="Excel — Inventaire complet"
            desc={`${medicaments.length} produits avec prix et peremptions`}
            color="#3B82F6"
            onClick={() => exportInventaireXLSX(medicaments)}
          />
          <ExportBtn
            label="Excel — Rapport mensuel"
            desc="Ventes du mois en cours, par mode de paiement"
            color="#7C3AED"
            onClick={async () => { try { await exportMensuelXLSX(auth); } catch (e) { showError(e.message); } }}
          />
          <ExportBtn
            label="PDF — Bilan de stock"
            desc="Synthese + inventaire complet imprimable"
            color="#F59E0B"
            onClick={async () => { const etab = await fetchEtabFromAuth(auth); exportBilanPDF(medicaments, etab); }}
          />
        </div>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <Toast toasts={toasts} />
    </Layout>
  );
}
