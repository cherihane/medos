import { colors } from "../../theme";
import Layout from "../../components/Layout";
import { useEtablissements } from "../../hooks/useSupabaseData";

const endpoints = [
  { method: "GET", path: "/api/v1/structures", desc: "Lister toutes les structures de santé", status: "stable" },
  { method: "GET", path: "/api/v1/medicaments", desc: "Catalogue national des médicaments", status: "stable" },
  { method: "GET", path: "/api/v1/stocks/{id}", desc: "Stocks en temps réel par structure", status: "stable" },
  { method: "POST", path: "/api/v1/alertes", desc: "Créer une alerte pharmacovigilance", status: "stable" },
  { method: "GET", path: "/api/v1/epidemiologie", desc: "Données épidémiologiques nationales", status: "beta" },
  { method: "GET", path: "/api/v1/tracabilite/{lot}", desc: "Traçabilité d'un lot par code", status: "stable" },
  { method: "POST", path: "/api/v1/contrefacons", desc: "Signaler un médicament falsifié", status: "stable" },
  { method: "GET", path: "/api/v1/odd/rapports", desc: "Indicateurs ODD santé", status: "beta" },
];

const methodColor = {
  GET: { bg: "#DCFCE7", color: "#16A34A" },
  POST: { bg: "#DBEAFE", color: "#2563EB" },
  PUT: { bg: "#FFFBEB", color: "#D97706" },
  DELETE: { bg: "#FEF2F2", color: "#EF4444" },
};

export default function API() {
  const { data: etablissements, loading: loadEtab } = useEtablissements();

  const kpis = [
    { label: "Endpoints documentes", value: endpoints.length,                              color: "#8B5CF6" },
    { label: "Organisations",        value: loadEtab ? "…" : etablissements.length,        color: "#3B82F6" },
    { label: "Structures actives",   value: loadEtab ? "…" : etablissements.filter((e) => e.actif).length, color: "#10B981" },
    { label: "Version API",          value: "v1.0",                                        color: "#F59E0B" },
  ];

  return (
    <Layout title="API" subtitle="Documentation et acces a l'API nationale MedOS">
      <div className="kpi-row">
        {kpis.map((k) => (
          <div key={k.label} style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "18px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div className="dash-grid-2-1">
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.navy }}>Endpoints disponibles</h3>
            <span style={{ fontSize: 12, color: colors.textMuted }}>Version 1.0 · Base URL : api.medos.ci</span>
          </div>

          {endpoints.map((ep) => {
            const mc = methodColor[ep.method];
            return (
              <div key={ep.path} style={{ padding: "14px 16px", backgroundColor: colors.bgSurface, borderRadius: 10, marginBottom: 10, display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 6, backgroundColor: mc.bg, color: mc.color, flexShrink: 0, width: 44, textAlign: "center" }}>
                  {ep.method}
                </span>
                <code style={{ fontSize: 12, color: colors.text, fontFamily: "monospace", flex: 1 }}>{ep.path}</code>
                <span style={{ fontSize: 12, color: colors.textSecondary, flex: 2 }}>{ep.desc}</span>
                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, fontWeight: 700, backgroundColor: ep.status === "stable" ? "#DCFCE7" : "#FFFBEB", color: ep.status === "stable" ? "#16A34A" : "#D97706" }}>
                  {ep.status}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: colors.navy }}>Authentification</h3>
            <div style={{ backgroundColor: "#0A1628", borderRadius: 10, padding: "16px", marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 6 }}>Exemple de requête</div>
              <code style={{ fontSize: 11, color: "#10B981", fontFamily: "monospace", display: "block", lineHeight: 1.8 }}>
                curl https://api.medos.ci/v1/<br />
                -H "Authorization: Bearer<br />
                &nbsp;&nbsp;&nbsp;YOUR_API_KEY"<br />
                -H "X-Structure-ID: SN-1248"
              </code>
            </div>
            <div style={{ textAlign: "center", padding: "14px", backgroundColor: colors.bgSurface, borderRadius: 10, fontSize: 12, color: colors.textMuted }}>
              La generation de cles API sera disponible dans la prochaine version de MedOS.
              Contactez l'equipe technique pour un acces anticipe.
            </div>
          </div>

          <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", maxHeight: 280, overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: colors.navy }}>
              Organisations connectees {!loadEtab && `(${etablissements.length})`}
            </h3>
            {loadEtab ? (
              <div style={{ color: colors.textMuted, fontSize: 13 }}>Chargement…</div>
            ) : etablissements.length === 0 ? (
              <div style={{ padding: "20px 0", textAlign: "center", color: colors.textMuted, fontSize: 13 }}>
                Aucune organisation enregistrée.
              </div>
            ) : (
              etablissements.map((e) => (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--border-light)" }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: colors.navy }}>{e.nom ?? "—"}</div>
                    <div style={{ fontSize: 10, color: colors.textMuted }}>{e.type ?? "—"}{e.ville ? ` · ${e.ville}` : ""}</div>
                  </div>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 8, fontWeight: 700, backgroundColor: e.actif ? "#DCFCE7" : "#F3F4F6", color: e.actif ? "#16A34A" : "#9CA3AF" }}>
                    {e.actif ? "actif" : "inactif"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
