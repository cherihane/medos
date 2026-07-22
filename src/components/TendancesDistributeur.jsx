/**
 * TendancesDistributeur — Prévisions v1 (distributeur)
 * Tendance saisonnière basée sur l'historique réel des commandes MedOS —
 * pas une prévision épidémiologique. Deux sources :
 *   1) l'historique du distributeur lui-même vers ses fabricants
 *   2) l'historique + le stock bas actuel de ses clients connectés à MedOS
 */
import { colors } from "../theme";
import { usePrevisionsDistributeur, MOIS_LABELS_COURT } from "../hooks/usePrevisionsDistributeur";

function MiniHistogramme({ parMois, pics }) {
  const max = Math.max(...parMois, 1);
  const picsMois = new Set(pics.map((p) => p.mois));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 40, marginTop: 8 }}>
      {parMois.map((qte, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div
            title={`${MOIS_LABELS_COURT[i]} : ${qte}`}
            style={{
              width: "100%",
              height: Math.max(2, Math.round((qte / max) * 32)),
              borderRadius: 2,
              backgroundColor: picsMois.has(i) ? "#F59E0B" : qte > 0 ? "#FDE68A" : "#F3F4F6",
            }}
          />
          <span style={{ fontSize: 8, color: colors.textMuted }}>{MOIS_LABELS_COURT[i][0]}</span>
        </div>
      ))}
    </div>
  );
}

function CarteTendance({ t, libelleSource }) {
  return (
    <div style={{ padding: "14px 16px", backgroundColor: colors.bgSurface, borderRadius: 10, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>{t.nom}</span>
        <span style={{ fontSize: 11, color: colors.textSecondary }}>{t.total.toLocaleString("fr-FR")} unités / 12 mois</span>
      </div>
      <MiniHistogramme parMois={t.parMois} pics={t.pics} />
      {t.tendanceFiable ? (
        <div style={{ fontSize: 11.5, color: "#92400E", marginTop: 8, backgroundColor: "#FFFBEB", borderRadius: 6, padding: "6px 9px" }}>
          Habituellement commandé davantage en <b>{t.pics.map((p) => MOIS_LABELS_COURT[p.mois]).join(", ")}</b> — {libelleSource}
          , anticipez votre stock avant cette période.
        </div>
      ) : (
        <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 6 }}>
          Historique insuffisant ({t.moisDistincts} mois distincts) pour affirmer une tendance saisonnière fiable.
        </div>
      )}
    </div>
  );
}

export default function TendancesDistributeur({ etablissementId }) {
  const { data, loading, error } = usePrevisionsDistributeur(etablissementId);

  return (
    <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 20 }}>
      <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: colors.navy }}>Tendances et recommandations</h3>
      <p style={{ margin: "0 0 20px", fontSize: 12, color: colors.textSecondary, lineHeight: 1.5 }}>
        Basé uniquement sur l'historique réel de vos commandes MedOS et de vos clients connectés —
        une tendance interne, pas une prévision épidémiologique.
      </p>

      {loading && <div style={{ color: colors.textMuted, fontSize: 13 }}>Analyse de l'historique en cours…</div>}
      {error && <div style={{ color: "#DC2626", fontSize: 13 }}>Erreur : {error}</div>}

      {data && (
        <>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: colors.textSecondary, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Vos commandes vers vos fabricants ({data.nbCommandesFabricants} commande{data.nbCommandesFabricants > 1 ? "s" : ""} sur 12 mois)
            </div>
            {data.nbCommandesFabricants === 0 ? (
              <div style={{ padding: "16px 0", textAlign: "center", color: colors.textMuted, fontSize: 13 }}>
                Aucune commande fabricant enregistrée sur les 12 derniers mois — revenez ici une fois vos premières
                commandes passées pour voir apparaître une tendance.
              </div>
            ) : (
              data.tendancesFabricants.slice(0, 8).map((t) => (
                <CarteTendance key={t.nom} t={t} libelleSource="d'après votre propre historique de commandes" />
              ))
            )}
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: colors.textSecondary, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Chez vos clients connectés à MedOS
              {data.ruptureClients.nbClients > 0 ? ` (${data.ruptureClients.nbClients} client${data.ruptureClients.nbClients > 1 ? "s" : ""})` : ""}
            </div>
            {data.ruptureClients.nbClients === 0 ? (
              <div style={{ padding: "16px 0", textAlign: "center", color: colors.textMuted, fontSize: 13 }}>
                Aucun client MedOS rattaché pour l'instant — cette section s'activera automatiquement dès qu'un
                établissement commandera chez vous via la plateforme.
              </div>
            ) : (
              <>
                {data.ruptureClients.parMedicament.slice(0, 6).map((r) => (
                  <div key={r.nom} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", backgroundColor: "#FEF2F2", borderRadius: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: colors.navy }}>{r.nom}</span>
                    <span style={{ fontSize: 11.5, color: "#DC2626", fontWeight: 700 }}>
                      {r.nbClientsEnRupture} client{r.nbClientsEnRupture > 1 ? "s" : ""} en rupture actuellement
                    </span>
                  </div>
                ))}
                {data.ruptureClients.parMedicament.length === 0 && (
                  <div style={{ padding: "8px 0", fontSize: 12, color: "#10B981" }}>
                    Aucun de vos clients n'est actuellement en rupture — stocks satisfaisants.
                  </div>
                )}
                {data.nbCommandesClients > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 8 }}>
                      Fréquence de leurs commandes vers vous ({data.nbCommandesClients} commande{data.nbCommandesClients > 1 ? "s" : ""}
                      {" "}sur 12 mois, {data.nbClientsAvecCommande} client{data.nbClientsAvecCommande > 1 ? "s" : ""} distinct{data.nbClientsAvecCommande > 1 ? "s" : ""})
                    </div>
                    {data.tendancesClients.slice(0, 6).map((t) => (
                      <CarteTendance key={t.nom} t={t} libelleSource="d'après l'historique de commandes de vos clients" />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
