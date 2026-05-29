import Layout from "../../components/Layout";

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
  return (
    <Layout title="API" subtitle="Documentation et accès à l'API nationale MedOS">
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Endpoints actifs", value: "34", color: "#8B5CF6" },
          { label: "Clés API délivrées", value: "128", color: "#3B82F6" },
          { label: "Appels/heure", value: "4 821", color: "#10B981" },
          { label: "Disponibilité", value: "99.8%", color: "#F59E0B" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: "white", borderRadius: 14, padding: "18px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Endpoints disponibles</h3>
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>Version 1.0 · Base URL : api.medos.ci</span>
          </div>

          {endpoints.map((ep) => {
            const mc = methodColor[ep.method];
            return (
              <div key={ep.path} style={{ padding: "14px 16px", backgroundColor: "#F8FAFC", borderRadius: 10, marginBottom: 10, display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 6, backgroundColor: mc.bg, color: mc.color, flexShrink: 0, width: 44, textAlign: "center" }}>
                  {ep.method}
                </span>
                <code style={{ fontSize: 12, color: "#374151", fontFamily: "monospace", flex: 1 }}>{ep.path}</code>
                <span style={{ fontSize: 12, color: "#6B7280", flex: 2 }}>{ep.desc}</span>
                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, fontWeight: 700, backgroundColor: ep.status === "stable" ? "#DCFCE7" : "#FFFBEB", color: ep.status === "stable" ? "#16A34A" : "#D97706" }}>
                  {ep.status}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Authentification</h3>
            <div style={{ backgroundColor: "#0A1628", borderRadius: 10, padding: "16px", marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 6 }}>Exemple de requête</div>
              <code style={{ fontSize: 11, color: "#10B981", fontFamily: "monospace", display: "block", lineHeight: 1.8 }}>
                curl https://api.medos.ci/v1/<br />
                -H "Authorization: Bearer<br />
                &nbsp;&nbsp;&nbsp;YOUR_API_KEY"<br />
                -H "X-Structure-ID: SN-1248"
              </code>
            </div>
            <button style={{ width: "100%", padding: "10px", backgroundColor: "#8B5CF6", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Générer une clé API
            </button>
          </div>

          <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Organisations connectées</h3>
            {[
              { org: "OMS Côte d'Ivoire", usage: "Épidémiologie", calls: "842/j" },
              { org: "CEDEAO Santé", usage: "Stocks", calls: "1 204/j" },
              { org: "Institut Pasteur CI", usage: "Traçabilité", calls: "321/j" },
              { org: "Banque Mondiale", usage: "ODD", calls: "156/j" },
            ].map((o) => (
              <div key={o.org} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #F3F4F6" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0A1628" }}>{o.org}</div>
                  <div style={{ fontSize: 10, color: "#9CA3AF" }}>{o.usage}</div>
                </div>
                <span style={{ fontSize: 12, color: "#8B5CF6", fontWeight: 700 }}>{o.calls}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
