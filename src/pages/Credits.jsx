import { colors } from "../theme";
import { useMemo } from "react";
import Layout from "../components/Layout";
import { useCommandes } from "../hooks/useSupabaseData";

const STATUT_STYLE = {
  livree:     { bg: "#DCFCE7", color: "#16A34A", label: "Livree" },
  en_transit: { bg: "#DBEAFE", color: "#2563EB", label: "En transit" },
  confirmee:  { bg: "#EDE9FE", color: "#7C3AED", label: "Confirmee" },
  envoyee:    { bg: "#FEF9C3", color: "#A16207", label: "Envoyee" },
  brouillon:  { bg: "#F3F4F6", color: colors.textSecondary, label: "Brouillon" },
  annulee:    { bg: "#FEE2E2", color: "#DC2626", label: "Annulee" },
};

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function fmtMontant(v) {
  if (v == null) return "—";
  return `${Number(v).toLocaleString("fr-FR")} FCFA`;
}

export default function Credits() {
  const { data: commandes, loading } = useCommandes();

  // Commandes non soldees (exclure livree et annulee) = encours credit
  const enCours = useMemo(
    () => commandes.filter((c) => !["livree", "annulee"].includes(c.statut)),
    [commandes]
  );

  const totalEncours = useMemo(
    () => enCours.reduce((s, c) => s + Number(c.montant_total ?? 0), 0),
    [enCours]
  );

  const enAlerte = useMemo(
    () => enCours.filter((c) =>
      c.date_livraison_prevue && new Date(c.date_livraison_prevue) < new Date()
    ).length,
    [enCours]
  );

  const stats = [
    { label: "Encours total",      value: fmtMontant(totalEncours),  color: "#3B82F6" },
    { label: "Commandes actives",  value: enCours.length,            color: "#8B5CF6" },
    { label: "En retard",          value: enAlerte,                  color: "#F59E0B" },
    { label: "Total commandes",    value: commandes.length,          color: "#10B981" },
  ];

  return (
    <Layout title="Commandes et Credits">
      <div className="kpi-row">
        {stats.map((s) => (
          <div key={s.label} style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${s.color}` }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{loading ? "…" : s.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "48px", textAlign: "center", color: colors.textMuted, fontSize: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          Chargement des commandes…
        </div>
      ) : commandes.length === 0 ? (
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "64px 24px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 48, marginBottom: 16, color: "#D1D5DB" }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: colors.text, marginBottom: 8 }}>
            Aucune commande enregistrée
          </div>
          <div style={{ fontSize: 13, color: colors.textMuted, marginBottom: 20 }}>
            Les commandes passées auprès des fournisseurs apparaîtront ici.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {commandes.map((c) => {
            const s = STATUT_STYLE[c.statut] ?? STATUT_STYLE.brouillon;
            const enRetard = c.date_livraison_prevue && new Date(c.date_livraison_prevue) < new Date() && c.statut !== "livree";
            return (
              <div
                key={c.id}
                style={{
                  backgroundColor: colors.bgCard,
                  borderRadius: 14,
                  padding: "20px 24px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  borderLeft: enRetard ? "4px solid #F59E0B" : "4px solid transparent",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: colors.navy, marginBottom: 2 }}>
                      {c.etablissements?.nom ?? "Client inconnu"}
                    </div>
                    <div style={{ fontSize: 12, color: colors.textMuted }}>
                      {c.reference ?? "—"}
                      {c.fournisseurs?.nom ? ` · via ${c.fournisseurs.nom}` : ""}
                      {c.etablissements?.ville ? ` · ${c.etablissements.ville}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {enRetard && (
                      <span style={{ padding: "3px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700, backgroundColor: "#FFFBEB", color: "#D97706" }}>
                        En retard
                      </span>
                    )}
                    <span style={{ padding: "4px 12px", borderRadius: 12, fontSize: 12, fontWeight: 700, backgroundColor: s.bg, color: s.color }}>
                      {s.label}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 24, fontSize: 13 }}>
                  <div>
                    <div style={{ color: colors.textMuted, fontSize: 11, marginBottom: 2 }}>Montant</div>
                    <div style={{ fontWeight: 800, color: colors.navy, fontSize: 15 }}>
                      {fmtMontant(c.montant_total)}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: colors.textMuted, fontSize: 11, marginBottom: 2 }}>Date commande</div>
                    <div style={{ fontWeight: 600, color: colors.text }}>{fmtDate(c.date_commande)}</div>
                  </div>
                  {c.date_livraison_prevue && (
                    <div>
                      <div style={{ color: colors.textMuted, fontSize: 11, marginBottom: 2 }}>Livraison prevue</div>
                      <div style={{ fontWeight: 600, color: enRetard ? "#F59E0B" : "#374151" }}>
                        {fmtDate(c.date_livraison_prevue)}
                      </div>
                    </div>
                  )}
                </div>

                {c.notes && (
                  <div style={{ marginTop: 10, fontSize: 12, color: colors.textSecondary, fontStyle: "italic" }}>
                    {c.notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
