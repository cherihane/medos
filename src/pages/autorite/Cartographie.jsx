import { colors } from "../../theme";
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
    { label: "Structures enregistrées", value: loading ? "…" : etablissements.length, color: "#8B5CF6" },
    { label: "Villes couvertes",        value: loading ? "…" : villes,                color: "#10B981" },
    { label: "Structures actives",      value: loading ? "…" : actifs,                color: "#3B82F6" },
    { label: "Types d'acteurs",         value: loading ? "…" : typesUniques,          color: "#F59E0B" },
  ];

  return (
    <Layout title="Cartographie" subtitle="Geolocalisation des structures de sante sur le territoire national">
      <div className="kpi-row">
        {kpis.map((k) => (
          <div key={k.label} style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div className="dash-grid-2-1">
        {/* Zone géographique hiérarchique */}
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 16, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.navy }}>
              Repartition geographique
            </h3>
            <span style={{ fontSize: 12, color: colors.textMuted }}>
              {villes} ville{villes > 1 ? "s" : ""} · {etablissements.length} structure{etablissements.length > 1 ? "s" : ""}
            </span>
          </div>

          {loading ? (
            [1,2,3,4].map((i) => <div key={i} style={{ height: 60, backgroundColor: colors.bgSurface, borderRadius: 10, marginBottom: 8, animation: "pulse 1.5s infinite" }} />)
          ) : etablissements.length === 0 ? (
            <div style={{ padding: "48px 0", textAlign: "center", color: colors.textMuted, fontSize: 13 }}>
              Aucun etablissement enregistre dans le systeme.
            </div>
          ) : (
            <div style={{ maxHeight: 520, overflowY: "auto", paddingRight: 4 }}>
              {parVille.map(([ville, structures]) => {
                const actives = structures.filter((e) => e.actif).length;
                const pct = Math.round((actives / structures.length) * 100);
                return (
                  <div key={ville} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", backgroundColor: colors.bgSurface, borderRadius: 10, marginBottom: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: pct > 70 ? "#10B981" : pct > 40 ? "#F59E0B" : "#EF4444" }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>{ville}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: colors.textMuted }}>{structures.length} structure{structures.length > 1 ? "s" : ""}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: pct > 70 ? "#10B981" : "#F59E0B" }}>{pct}% actives</span>
                      </div>
                    </div>
                    {structures.map((e) => (
                      <div key={e.id} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "7px 14px 7px 28px",
                        borderLeft: `2px solid ${typeColor(e.type)}`,
                        marginLeft: 16, marginBottom: 3,
                        backgroundColor: colors.bgSurface,
                        borderRadius: "0 8px 8px 0",
                      }}>
                        <div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: colors.navy }}>{e.nom}</span>
                          <span style={{ fontSize: 11, color: colors.textMuted, marginLeft: 6 }}>{e.type}</span>
                        </div>
                        <span style={{
                          fontSize: 10, padding: "2px 7px", borderRadius: 6, fontWeight: 700,
                          backgroundColor: e.actif ? "#DCFCE7" : "#FEF2F2",
                          color: e.actif ? "#16A34A" : "#DC2626",
                        }}>
                          {e.actif ? "Actif" : "Inactif"}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ textAlign: "center", padding: "12px 0 0", fontSize: 11, color: colors.textMuted, borderTop: "1px solid var(--border-light)", marginTop: 12 }}>
            Carte interactive disponible dans la prochaine version — integration Leaflet/OpenStreetMap prevue
          </div>
        </div>

        {/* Panneau lateral */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h4 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: colors.navy }}>Types d'etablissements</h4>
            {Object.entries(TYPE_COLORS).map(([type, color]) => (
              <div key={type} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: color }} />
                <span style={{ fontSize: 12, color: colors.text, textTransform: "capitalize" }}>{type}</span>
              </div>
            ))}
            <div style={{ borderTop: "1px solid var(--border)", marginTop: 12, paddingTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: colors.textSecondary, marginBottom: 8 }}>Statut</div>
              {[["Actif", "#10B981"], ["Inactif", "#EF4444"]].map(([s, c]) => (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: c }} />
                  <span style={{ fontSize: 11, color: colors.textSecondary }}>{s}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, overflowY: "auto", maxHeight: 320 }}>
            <h4 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: colors.navy }}>
              Structures {!loading && `(${etablissements.length})`}
            </h4>
            {loading ? (
              <div style={{ color: colors.textMuted, fontSize: 13 }}>Chargement…</div>
            ) : etablissements.length === 0 ? (
              <div style={{ color: colors.textMuted, fontSize: 13 }}>Aucun établissement enregistré.</div>
            ) : (
              parVille.map(([ville, liste]) => (
                <div key={ville} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{ville}</div>
                  {liste.map((e) => (
                    <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid var(--border-light)" }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: colors.navy }}>{e.nom}</div>
                        <div style={{ fontSize: 10, color: colors.textMuted }}>{e.type ?? "—"}</div>
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
