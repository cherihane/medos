/**
 * Rapports — Distributeur
 * CA par période, répartition par client réel, médicaments les plus livrés,
 * taux de rupture/retard, export CSV — sur le modèle des Rapports pharmacie
 * (pages/pharmacie/Rapports.jsx), adapté aux données réelles distributeur
 * (commandes reçues des clients + livraisons expédiées, jamais les commandes
 * placées auprès des fabricants, qui sont une autre relation).
 */
import { colors } from "../../theme";
import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import Layout from "../../components/Layout";
import { useAuth } from "../../context/AuthContext";
import { useDistributeurClients } from "../../hooks/useSupabaseData";
import { supabase } from "../../supabaseClient";

const MOIS_LABELS = ["Jan", "Fev", "Mar", "Avr", "Mai", "Jun", "Jul", "Aou", "Sep", "Oct", "Nov", "Dec"];

function fmtFCFA(v) {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M FCFA`;
  return `${Math.round(v).toLocaleString("fr-FR")} FCFA`;
}

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

// Toutes les données de ce rapport en une seule passe — pas de hook générique
// réutilisable ici (mêmes principes que AnalyseCommandesDistributeur dans
// Previsions.jsx) : la page a besoin de tout l'historique brut pour recalculer
// ses propres agrégations (CA/mois, top clients, top médicaments, taux).
function useDonneesRapport(distributeurId) {
  const [state, setState] = useState({ loading: true, commandes: [], livraisons: [] });

  useEffect(() => {
    if (!distributeurId) return;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));

    const depuis12Mois = new Date();
    depuis12Mois.setMonth(depuis12Mois.getMonth() - 11);
    depuis12Mois.setDate(1);
    depuis12Mois.setHours(0, 0, 0, 0);

    Promise.all([
      supabase
        .from("commandes")
        .select("id, montant_total, statut, date_commande, created_at, etablissement_id")
        .eq("distributeur_id", distributeurId)
        .gte("created_at", depuis12Mois.toISOString()),
      supabase
        .from("livraisons")
        .select(`
          id, statut, date_depart, date_arrivee_prevue, date_arrivee_reelle,
          etablissement_id, distributeur_clients_id, created_at,
          livraison_lignes ( medicament_nom, quantite, disponible )
        `)
        .eq("distributeur_id", distributeurId)
        .gte("created_at", depuis12Mois.toISOString()),
    ]).then(([cmdRes, livRes]) => {
      if (cancelled) return;
      setState({ loading: false, commandes: cmdRes.data ?? [], livraisons: livRes.data ?? [] });
    });

    return () => { cancelled = true; };
  }, [distributeurId]);

  return state;
}

export default function Rapports() {
  const { auth } = useAuth();
  const { data: relations } = useDistributeurClients();
  const relationsById = Object.fromEntries(relations.map((r) => [r.id, r]));
  const { loading, commandes, livraisons } = useDonneesRapport(auth?.etablissement_id);

  const nomClient = (l) =>
    relationsById[l.distributeur_clients_id]?.client?.nom
    ?? relations.find((r) => r.client?.id === l.etablissement_id)?.client?.nom
    ?? "Client inconnu";

  // ── CA par mois (12 derniers mois, commandes reçues des clients) ────────────
  const caParMois = (() => {
    const now = new Date();
    const mois = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      mois.push({ mois: MOIS_LABELS[d.getMonth()], year: d.getFullYear(), month: d.getMonth(), ca: 0 });
    }
    commandes.forEach((c) => {
      const d = new Date(c.date_commande ?? c.created_at);
      if (isNaN(d)) return;
      const m = mois.find((x) => x.year === d.getFullYear() && x.month === d.getMonth());
      if (m) m.ca += Number(c.montant_total ?? 0);
    });
    return mois;
  })();
  const caTotal = commandes.reduce((s, c) => s + Number(c.montant_total ?? 0), 0);

  // ── Répartition par client réel (nombre de livraisons) ───────────────────────
  const parClient = (() => {
    const map = {};
    livraisons.forEach((l) => {
      const nom = nomClient(l);
      map[nom] = (map[nom] ?? 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([nom, count]) => ({ nom, count }));
  })();

  // ── Médicaments les plus livrés ───────────────────────────────────────────────
  const parMedicament = (() => {
    const map = {};
    livraisons.forEach((l) => {
      (l.livraison_lignes ?? []).forEach((ligne) => {
        map[ligne.medicament_nom] = (map[ligne.medicament_nom] ?? 0) + (ligne.quantite ?? 0);
      });
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([nom, qte]) => ({ nom: nom.length > 16 ? nom.slice(0, 16) + "…" : nom, qte }));
  })();

  // ── Taux de rupture (lignes marquées "en rupture, à reporter") ──────────────
  const toutesLesLignes = livraisons.flatMap((l) => l.livraison_lignes ?? []);
  const tauxRupture = toutesLesLignes.length > 0
    ? Math.round((toutesLesLignes.filter((x) => x.disponible === false).length / toutesLesLignes.length) * 100)
    : 0;

  // ── Taux de retard (livrées avec date réelle > date prévue) ─────────────────
  const livreesAvecDates = livraisons.filter((l) => l.statut === "livree" && l.date_arrivee_prevue && l.date_arrivee_reelle);
  const enRetard = livreesAvecDates.filter((l) => new Date(l.date_arrivee_reelle) > new Date(l.date_arrivee_prevue));
  const tauxRetard = livreesAvecDates.length > 0 ? Math.round((enRetard.length / livreesAvecDates.length) * 100) : 0;

  const kpis = [
    { label: "Chiffre d'affaires (12 mois)", value: loading ? "…" : fmtFCFA(caTotal), color: "#F59E0B" },
    { label: "Livraisons (12 mois)",          value: loading ? "…" : livraisons.length, color: "#3B82F6" },
    { label: "Taux de rupture signalée",      value: loading ? "…" : `${tauxRupture}%`, color: tauxRupture > 10 ? "#DC2626" : "#10B981" },
    { label: "Taux de retard",                value: loading ? "…" : `${tauxRetard}%`,  color: tauxRetard > 10 ? "#DC2626" : "#10B981" },
  ];

  const exportCSV = () => {
    const header = ["Date", "Client", "Statut", "Produits", "Quantité totale", "En rupture", "Date prévue", "Date réelle"];
    const rows = livraisons.map((l) => {
      const lignes = l.livraison_lignes ?? [];
      return [
        l.created_at ? new Date(l.created_at).toLocaleDateString("fr-FR") : "—",
        nomClient(l),
        l.statut,
        lignes.length,
        lignes.reduce((s, x) => s + (x.quantite ?? 0), 0),
        lignes.some((x) => x.disponible === false) ? "Oui" : "Non",
        l.date_arrivee_prevue ? new Date(l.date_arrivee_prevue).toLocaleDateString("fr-FR") : "—",
        l.date_arrivee_reelle ? new Date(l.date_arrivee_reelle).toLocaleDateString("fr-FR") : "—",
      ];
    });
    downloadCSV(`rapport_livraisons_${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows]);
  };

  return (
    <Layout title="Rapports" subtitle="Analyses et indicateurs de performance — distributeur">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      <div className="kpi-row">
        {kpis.map((k) => (
          <div key={k.label} style={{ backgroundColor: colors.bgCard, padding: "18px 22px", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginTop: 20, marginBottom: 20, minWidth: 0 }}>
        <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: colors.navy }}>Chiffre d'affaires par mois (12 derniers mois)</h3>
        {loading ? (
          <div style={{ height: 220, backgroundColor: colors.bgSurface, borderRadius: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
        ) : caTotal === 0 ? (
          <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: colors.textMuted, fontSize: 14 }}>Aucune commande reçue sur les 12 derniers mois.</div>
        ) : (
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={caParMois}>
                <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
                <Tooltip formatter={(v) => fmtFCFA(v)} />
                <Bar dataKey="ca" fill="#F59E0B" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="dash-grid-2" style={{ marginBottom: 20 }}>
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", minWidth: 0 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: colors.navy }}>Répartition par client réel</h3>
          {loading ? (
            <div style={{ height: 200, backgroundColor: colors.bgSurface, borderRadius: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
          ) : parClient.length === 0 ? (
            <div style={{ color: colors.textMuted, fontSize: 13 }}>Aucune livraison enregistrée.</div>
          ) : (
            parClient.map((c) => (
              <div key={c.nom} style={{ display: "flex", justifyContent: "space-between", padding: "9px 12px", backgroundColor: colors.bgSurface, borderRadius: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: colors.navy }}>{c.nom}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: colors.textSecondary }}>{c.count} livraison{c.count > 1 ? "s" : ""}</span>
              </div>
            ))
          )}
        </div>

        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", minWidth: 0 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: colors.navy }}>Médicaments les plus livrés</h3>
          {loading ? (
            <div style={{ height: 200, backgroundColor: colors.bgSurface, borderRadius: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
          ) : parMedicament.length === 0 ? (
            <div style={{ color: colors.textMuted, fontSize: 13 }}>Aucun médicament livré.</div>
          ) : (
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={parMedicament} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="nom" type="category" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="qte" fill="#10B981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: colors.navy }}>Export</h3>
        <button
          onClick={exportCSV}
          disabled={loading || livraisons.length === 0}
          style={{
            display: "flex", flexDirection: "column", alignItems: "flex-start",
            padding: "14px 18px", borderRadius: 10, border: "1.5px solid #10B98130",
            backgroundColor: "#10B98108", cursor: loading || livraisons.length === 0 ? "not-allowed" : "pointer",
            minWidth: 260, textAlign: "left",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: "#10B981" }}>CSV — Livraisons (12 derniers mois)</span>
          <span style={{ fontSize: 11, color: colors.textSecondary, marginTop: 3 }}>
            Détail par livraison : client, statut, produits, ruptures, dates
          </span>
        </button>
      </div>
    </Layout>
  );
}
