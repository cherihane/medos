import { useState } from "react";
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

function generateKey() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const segment = (n) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `mk_live_${segment(8)}-${segment(4)}-${segment(4)}-${segment(12)}`;
}

function CleModal({ onClose }) {
  const [cle] = useState(() => generateKey());
  const [copie, setCopie] = useState(false);

  const handleCopier = () => {
    navigator.clipboard.writeText(cle).then(() => {
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    });
  };

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ backgroundColor: "white", borderRadius: 16, width: 500, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ padding: "20px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Nouvelle clé API générée</h3>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 3 }}>Copiez cette clé maintenant — elle ne sera plus affichée.</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF" }}>×</button>
        </div>
        <div style={{ padding: "18px 24px" }}>
          <div style={{ backgroundColor: "#0A1628", borderRadius: 10, padding: "14px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
            <code style={{ fontSize: 12, color: "#10B981", fontFamily: "monospace", flex: 1, wordBreak: "break-all" }}>{cle}</code>
            <button
              onClick={handleCopier}
              style={{ padding: "6px 12px", backgroundColor: copie ? "#10B981" : "#8B5CF6", color: "white", border: "none", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
            >
              {copie ? "Copié" : "Copier"}
            </button>
          </div>
          <div style={{ padding: "10px 14px", backgroundColor: "#FFFBEB", borderRadius: 8, fontSize: 12, color: "#92400E", marginBottom: 16 }}>
            Cette clé donne accès à tous les endpoints API MedOS. Conservez-la en lieu sûr et ne la partagez pas.
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "9px 20px", backgroundColor: "#8B5CF6", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function API() {
  const [showCle, setShowCle] = useState(false);
  const { data: etablissements, loading: loadEtab } = useEtablissements();

  const kpis = [
    { label: "Endpoints documentes", value: endpoints.length,                              color: "#8B5CF6" },
    { label: "Organisations",        value: loadEtab ? "…" : etablissements.length,        color: "#3B82F6" },
    { label: "Structures actives",   value: loadEtab ? "…" : etablissements.filter((e) => e.actif).length, color: "#10B981" },
    { label: "Version API",          value: "v1.0",                                        color: "#F59E0B" },
  ];

  return (
    <Layout title="API" subtitle="Documentation et acces a l'API nationale MedOS">
      {showCle && <CleModal onClose={() => setShowCle(false)} />}
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {kpis.map((k) => (
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
            <button onClick={() => setShowCle(true)} style={{ width: "100%", padding: "10px", backgroundColor: "#8B5CF6", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Générer une clé API
            </button>
          </div>

          <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", maxHeight: 280, overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>
              Organisations connectees {!loadEtab && `(${etablissements.length})`}
            </h3>
            {loadEtab ? (
              <div style={{ color: "#9CA3AF", fontSize: 13 }}>Chargement…</div>
            ) : etablissements.length === 0 ? (
              <div style={{ padding: "20px 0", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
                Aucune organisation enregistrée.
              </div>
            ) : (
              etablissements.map((e) => (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #F3F4F6" }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#0A1628" }}>{e.nom ?? "—"}</div>
                    <div style={{ fontSize: 10, color: "#9CA3AF" }}>{e.type ?? "—"}{e.ville ? ` · ${e.ville}` : ""}</div>
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
