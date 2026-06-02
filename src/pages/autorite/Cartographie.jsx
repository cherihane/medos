import { useMemo } from "react";
import Layout from "../../components/Layout";
import { useEtablissements } from "../../hooks/useSupabaseData";

const TYPE_COLORS = {
  pharmacie:    "#EC4899",
  hopital:      "#3B82F6",
  clinique:     "#10B981",
  distributeur: "#F59E0B",
  chu:          "#8B5CF6",
  autorite:     "#6B7280",
};

function typeColor(type) {
  if (!type) return "#9CA3AF";
  return TYPE_COLORS[type.toLowerCase()] ?? "#9CA3AF";
}

export default function Cartographie() {
  const { data: etablissements, loading } = useEtablissements();

  const parVille = useMemo(() => {
    const map = {};
    etablissements.forEach((e) => {
      const v = e.ville ?? "Inconnue";
      if (!map[v]) map[v] = [];
      map[v].push(e);
    });
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [etablissements]);

  const actifs = etablissements.filter((e) => e.actif).length;
  const villes = parVille.length;
  const typesUniques = [...new Set(etablissements.map((e) => e.type).filter(Boolean))].length;

  const kpis = [
    { label: "Structures enregistrées", value: loading ? "…" : établissements.length, color: "#8B5CF6" },
    { label: "Villes couvertes",        value: loading ? "…" : villes,                color: "#10B981" },
    { label: "Structures actives",      value: loading ? "…" : actifs,                color: "#3B82F6" },
    { label: "Types d'acteurs",         value: loading ? "…" : typesUniques,          color: "#F59E0B" },
  ];

  return (
    <Layout title="Cartographie" subtitle="Geolocalisation des structures de sante sur le territoire national">
      <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ backgroundColor: "white", borderRadius: 14, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        {/* Zone carte */}
        <div style={{ backgroundColor: "white", borderRadius: 16, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Carte des etablissements</h3>

          {loading ? (
            <div style={{ height: 400, display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", fontSize: 14 }}>
              Chargement…
            </div>
          ) : etablissements.length === 0 ? (
            <div style={{ height: 400, backgroundColor: "#F8FAFC", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#374151" }}>Aucun etablissement connecte dans votre region</div>
              <div style={{ fontSize: 13, color: "#9CA3AF" }}>Les structures apparaîtront ici une fois enregistrées dans le systeme.</div>
            </div>
          ) : (
            <div style={{ width: "100%", height: 400, backgroundColor: "#E8F4F0", borderRadius: 12, position: "relative", overflow: "hidden" }}>
              {[20, 40, 60, 80].map((v) => (
                <div key={`h${v}`} style={{ position: "absolute", top: `${v}%`, left: 0, right: 0, height: 1, backgroundColor: "rgba(0,0,0,0.06)" }} />
              ))}
              {[20, 40, 60, 80].map((v) => (
                <div key={`v${v}`} style={{ position: "absolute", left: `${v}%`, top: 0, bottom: 0, width: 1, backgroundColor: "rgba(0,0,0,0.06)" }} />
              ))}
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#8B5CF6" }}>{etablissements.length}</div>
                <div style={{ fontSize: 13, color: "#6B7280" }}>établissement{établissements.length > 1 ? "s" : ""} enregistre{établissements.length > 1 ? "s" : ""}</div>
                <div style={{ fontSize: 12, color: "#9CA3AF" }}>{villes} ville{villes > 1 ? "s" : ""}</div>
              </div>
              <div style={{ position: "absolute", bottom: 12, right: 12, fontSize: 11, color: "#9CA3AF", backgroundColor: "rgba(255,255,255,0.8)", padding: "4px 8px", borderRadius: 6 }}>
                Integration cartographique interactive — a venir
              </div>
            </div>
          )}
        </div>

        {/* Panneau lateral */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ backgroundColor: "white", borderRadius: 14, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h4 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: "#0A1628" }}>Types d'etablissements</h4>
            {Object.entries(TYPE_COLORS).map(([type, color]) => (
              <div key={type} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: color }} />
                <span style={{ fontSize: 12, color: "#374151", textTransform: "capitalize" }}>{type}</span>
              </div>
            ))}
            <div style={{ borderTop: "1px solid #E5E7EB", marginTop: 12, paddingTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 8 }}>Statut</div>
              {[["Actif", "#10B981"], ["Inactif", "#EF4444"]].map(([s, c]) => (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: c }} />
                  <span style={{ fontSize: 11, color: "#6B7280" }}>{s}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ backgroundColor: "white", borderRadius: 14, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, overflowY: "auto", maxHeight: 320 }}>
            <h4 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: "#0A1628" }}>
              Structures {!loading && `(${etablissements.length})`}
            </h4>
            {loading ? (
              <div style={{ color: "#9CA3AF", fontSize: 13 }}>Chargement…</div>
            ) : etablissements.length === 0 ? (
              <div style={{ color: "#9CA3AF", fontSize: 13 }}>Aucun établissement enregistre.</div>
            ) : (
              parVille.map(([ville, liste]) => (
                <div key={ville} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{ville}</div>
                  {liste.map((e) => (
                    <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid #F3F4F6" }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#0A1628" }}>{e.nom}</div>
                        <div style={{ fontSize: 10, color: "#9CA3AF" }}>{e.type ?? "—"}</div>
                      </div>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: e.actif ? "#10B981" : "#EF4444", flexShrink: 0 }} />
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
