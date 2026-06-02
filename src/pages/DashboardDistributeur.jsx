import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import Layout from "../components/Layout";
import KpiCard from "../components/KpiCard";
import { useKpiDistributeur, useCommandes, useEtablissements } from "../hooks/useSupabaseData";

const STATUT_STYLE = {
  livree:       { bg: "#DCFCE7", color: "#16A34A", label: "livree" },
  en_transit:   { bg: "#DBEAFE", color: "#2563EB", label: "en transit" },
  confirmee:    { bg: "#EDE9FE", color: "#7C3AED", label: "confirmee" },
  envoyee:      { bg: "#FEF9C3", color: "#A16207", label: "envoyee" },
  brouillon:    { bg: "#F3F4F6", color: "#6B7280", label: "brouillon" },
  annulee:      { bg: "#FEE2E2", color: "#DC2626", label: "annulee" },
};

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function fmtMontant(v) {
  if (!v) return "—";
  return `${Number(v).toLocaleString("fr-FR")} FCFA`;
}

export default function DashboardDistributeur() {
  const { data: kpi, loading: loadKpi }     = useKpiDistributeur();
  const { data: commandes, loading: loadCmd } = useCommandes();
  const { data: etabs, loading: loadEtabs } = useEtablissements();

  const kpiCards = [
    {
      label: "Commandes actives",
      value: loadKpi ? "…" : kpi?.commandesActives ?? 0,
      color: "#10B981",
    },
    {
      label: "Clients actifs",
      value: loadKpi ? "…" : kpi?.clients ?? 0,
      color: "#3B82F6",
    },
    {
      label: "Chiffre d'affaires total",
      value: loadKpi ? "…" : `${((kpi?.ca ?? 0) / 1_000_000).toFixed(1)}M FCFA`,
      color: "#F59E0B",
    },
    {
      label: "Livraisons en cours",
      value: loadKpi ? "…" : kpi?.livraisonsEnCours ?? 0,
      color: "#8B5CF6",
    },
  ];

  // Reseau clients : etablissements non-distributeur avec leurs stats commandes
  const reseauClients = useMemo(() => {
    if (!etabs.length) return [];
    const clients = etabs.filter((e) => e.type !== "distributeur" && e.type !== "autorite");
    const statsMap = {};
    commandes.forEach((c) => {
      const nom = c.etablissements?.nom;
      if (!nom) return;
      if (!statsMap[nom]) statsMap[nom] = { ca: 0, count: 0, ville: c.etablissements?.ville ?? "—" };
      statsMap[nom].ca += Number(c.montant_total ?? 0);
      statsMap[nom].count += 1;
    });
    return clients.slice(0, 6).map((e) => ({
      nom: e.nom,
      ville: e.ville ?? "—",
      type: e.type,
      ca: ((statsMap[e.nom]?.ca ?? 0) / 1_000_000).toFixed(1),
      commandes: statsMap[e.nom]?.count ?? 0,
      actif: e.actif,
    }));
  }, [etabs, commandes]);

  // Graphique : montant commandes par mois (6 derniers mois)
  const chartData = useMemo(() => {
    const MOIS = ["Jan", "Fev", "Mar", "Avr", "Mai", "Jun", "Jul", "Aou", "Sep", "Oct", "Nov", "Dec"];
    const map = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map[key] = { mois: MOIS[d.getMonth()], reel: 0 };
    }
    commandes.forEach((c) => {
      if (!c.date_commande) return;
      const key = c.date_commande.slice(0, 7);
      if (map[key]) map[key].reel += Number(c.montant_total ?? 0);
    });
    return Object.values(map);
  }, [commandes]);

  // 10 dernieres commandes
  const dernieresCommandes = commandes.slice(0, 10);

  return (
    <Layout title="Dashboard Distributeur">
      <div className="kpi-row">
        {kpiCards.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      <div className="dash-grid-2">
        {/* Reseau clients */}
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Reseau clients</h3>
          {loadEtabs ? (
            <div style={{ color: "#9CA3AF", fontSize: 13 }}>Chargement…</div>
          ) : reseauClients.length === 0 ? (
            <div style={{ color: "#9CA3AF", fontSize: 13 }}>Aucun client enregistré.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {reseauClients.map((c) => (
                <div
                  key={c.nom}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 16px", backgroundColor: "#F8FAFC", borderRadius: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: "50%",
                      backgroundColor: c.actif ? "#10B981" : "#9CA3AF",
                    }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#0A1628" }}>{c.nom}</div>
                      <div style={{ fontSize: 11, color: "#9CA3AF" }}>{c.ville} — {c.type}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#0A1628" }}>{c.ca}M FCFA</div>
                    <div style={{ fontSize: 11, color: "#9CA3AF" }}>{c.commandes} cmd</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Graphique chiffre d'affaires */}
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", minWidth: 0 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>
            Chiffre d'affaires — 6 derniers mois (FCFA)
          </h3>
          {loadCmd ? (
            <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", fontSize: 13 }}>
              Chargement…
            </div>
          ) : (
            <div style={{ width: "100%", height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                  />
                  <Tooltip formatter={(v) => `${Number(v).toLocaleString("fr-FR")} FCFA`} />
                  <Line
                    type="monotone"
                    dataKey="reel"
                    stroke="#3B82F6"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                    name="Chiffre d'affaires"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Dernieres commandes */}
      <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginTop: 20 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Dernieres commandes</h3>
        {loadCmd ? (
          <div style={{ color: "#9CA3AF", fontSize: 13 }}>Chargement…</div>
        ) : dernieresCommandes.length === 0 ? (
          <div style={{ color: "#9CA3AF", fontSize: 13, padding: "24px 0", textAlign: "center" }}>
            Aucune commande enregistrée.
          </div>
        ) : (
          <div className="table-scroll"><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: "#F8FAFC" }}>
                {["N° Commande", "Client", "Ville", "Montant", "Date", "Statut"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6B7280", borderBottom: "1px solid #E5E7EB" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dernieresCommandes.map((c) => {
                const s = STATUT_STYLE[c.statut] ?? STATUT_STYLE.brouillon;
                return (
                  <tr key={c.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                    <td style={{ padding: "12px 14px", fontWeight: 600, color: "#3B82F6", fontFamily: "monospace" }}>
                      {c.reference ?? "—"}
                    </td>
                    <td style={{ padding: "12px 14px", color: "#374151" }}>
                      {c.etablissements?.nom ?? "—"}
                    </td>
                    <td style={{ padding: "12px 14px", color: "#6B7280" }}>
                      {c.etablissements?.ville ?? "—"}
                    </td>
                    <td style={{ padding: "12px 14px", fontWeight: 700, color: "#0A1628" }}>
                      {fmtMontant(c.montant_total)}
                    </td>
                    <td style={{ padding: "12px 14px", color: "#6B7280" }}>
                      {fmtDate(c.date_commande)}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{
                        padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700,
                        backgroundColor: s.bg, color: s.color,
                      }}>
                        {s.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </div>
    </Layout>
  );
}
