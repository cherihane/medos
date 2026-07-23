/**
 * Facturation — Distributeur
 * Suivi simple de paiement par commande reçue (payé / en attente / en
 * retard) — même logique que Credits.jsx en pharmacie (suivi manuel, pas de
 * moteur de facturation), adapté au contexte distributeur-client : le
 * distributeur reçoit le paiement de ses clients pour les commandes qu'ils
 * lui passent. Solde dû par client calculé et exposé pour la fiche client
 * (voir ReseauClients.jsx).
 */
import { colors } from "../../theme";
import { useState } from "react";
import Layout from "../../components/Layout";
import { useAuth } from "../../context/AuthContext";
import { useCommandesRecuesPaginated } from "../../hooks/useSupabaseData";
import { updateCommande } from "../../hooks/useMutations";
import Pagination from "../../components/Pagination";

const PAIEMENT_STYLE = {
  paye:        { bg: "#DCFCE7", color: "#16A34A", label: "Payé" },
  en_attente:  { bg: "#FFFBEB", color: "#D97706", label: "En attente" },
  en_retard:   { bg: "#FEF2F2", color: "#DC2626", label: "En retard" },
};

function fmt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}
function fmtFCFA(v) {
  return `${Math.round(v ?? 0).toLocaleString("fr-FR")} FCFA`;
}

export default function Facturation() {
  const { auth } = useAuth();
  const [filtre, setFiltre] = useState("");
  const { data: commandes, loading, error, total, page, setPage, totalPages, refetch } =
    useCommandesRecuesPaginated(auth?.etablissement_id, 20, { statut_paiement: filtre });
  const [busyId, setBusyId] = useState(null);

  const changerStatut = async (commande, statut_paiement) => {
    setBusyId(commande.id);
    try {
      await updateCommande(commande.id, { statut_paiement });
      refetch();
    } finally {
      setBusyId(null);
    }
  };

  // KPI globaux sur la page courante (suivi simple, pas d'agrégat serveur
  // séparé — cohérent avec Credits.jsx pharmacie qui fait de même).
  const totalDu = commandes.filter((c) => c.statut_paiement !== "paye").reduce((s, c) => s + (c.montant_total ?? 0), 0);
  const totalPaye = commandes.filter((c) => c.statut_paiement === "paye").reduce((s, c) => s + (c.montant_total ?? 0), 0);
  const nbEnRetard = commandes.filter((c) => c.statut_paiement === "en_retard").length;

  return (
    <Layout title="Facturation" subtitle="Suivi de paiement des commandes reçues de vos clients">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      <div className="kpi-row">
        {[
          { label: "Solde dû (page courante)",  value: loading ? "…" : fmtFCFA(totalDu),   color: "#DC2626" },
          { label: "Payé (page courante)",       value: loading ? "…" : fmtFCFA(totalPaye), color: "#16A34A" },
          { label: "Commandes en retard",        value: loading ? "…" : nbEnRetard,          color: "#F59E0B" },
          { label: "Total commandes",            value: loading ? "…" : total,               color: "#3B82F6" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: colors.bgCard, padding: "18px 22px", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        {[
          { key: "", label: "Toutes" },
          { key: "en_attente", label: "En attente" },
          { key: "en_retard", label: "En retard" },
          { key: "paye", label: "Payées" },
        ].map((f) => (
          <button key={f.key} onClick={() => setFiltre(f.key)} style={{
            padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
            border: filtre === f.key ? "2px solid #F59E0B" : "1.5px solid var(--border)",
            backgroundColor: filtre === f.key ? "#FFFBEB" : "white",
            color: filtre === f.key ? "#D97706" : "#6B7280",
          }}>
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ backgroundColor: "#FEF2F2", padding: "14px 18px", borderRadius: 12, marginBottom: 16, fontSize: 13, color: "#DC2626" }}>
          Une erreur s'est produite. Veuillez réessayer.
        </div>
      )}

      <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div className="table-scroll"><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: colors.bgSurface }}>
              {["Référence", "Client", "Date", "Montant", "Paiement", "Actions"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: colors.textSecondary, borderBottom: "1px solid var(--border)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && [1,2,3].map((i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border-light)", animation: "pulse 1.5s ease-in-out infinite" }}>
                {[100,160,90,110,100,140].map((w, j) => (
                  <td key={j} style={{ padding: "14px 16px" }}><div style={{ height: 13, width: w, backgroundColor: colors.borderLight, borderRadius: 6 }} /></td>
                ))}
              </tr>
            ))}
            {!loading && commandes.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: colors.textMuted, fontSize: 13 }}>Aucune commande trouvée</td></tr>
            )}
            {!loading && commandes.map((c) => {
              const s = PAIEMENT_STYLE[c.statut_paiement] ?? PAIEMENT_STYLE.en_attente;
              return (
                <tr key={c.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "14px 16px", fontFamily: "monospace", color: colors.textSecondary, fontSize: 12 }}>{c.reference ?? "—"}</td>
                  <td style={{ padding: "14px 16px", fontWeight: 600, color: colors.navy }}>
                    {c.etablissements?.nom ?? "—"}
                    {c.etablissements?.ville && <div style={{ fontSize: 11, color: colors.textMuted }}>{c.etablissements.ville}</div>}
                  </td>
                  <td style={{ padding: "14px 16px", color: colors.textSecondary, fontSize: 12 }}>{fmt(c.date_commande)}</td>
                  <td style={{ padding: "14px 16px", fontWeight: 700, color: colors.navy }}>{fmtFCFA(c.montant_total)}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ padding: "3px 10px", backgroundColor: s.bg, color: s.color, borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{s.label}</span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {c.statut_paiement !== "paye" && (
                        <button onClick={() => changerStatut(c, "paye")} disabled={busyId === c.id} style={{ padding: "4px 10px", backgroundColor: "#DCFCE7", color: "#16A34A", border: "none", borderRadius: 6, fontSize: 11, cursor: busyId === c.id ? "wait" : "pointer", fontWeight: 600 }}>
                          Marquer payé
                        </button>
                      )}
                      {c.statut_paiement !== "en_retard" && c.statut_paiement !== "paye" && (
                        <button onClick={() => changerStatut(c, "en_retard")} disabled={busyId === c.id} style={{ padding: "4px 10px", backgroundColor: "#FEF2F2", color: "#DC2626", border: "none", borderRadius: 6, fontSize: 11, cursor: busyId === c.id ? "wait" : "pointer", fontWeight: 600 }}>
                          Marquer en retard
                        </button>
                      )}
                      {c.statut_paiement === "paye" && (
                        <button onClick={() => changerStatut(c, "en_attente")} disabled={busyId === c.id} style={{ padding: "4px 10px", backgroundColor: colors.bgSurface, color: colors.text, border: "1px solid var(--border)", borderRadius: 6, fontSize: 11, cursor: busyId === c.id ? "wait" : "pointer", fontWeight: 600 }}>
                          Annuler
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
        <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
      </div>
    </Layout>
  );
}
