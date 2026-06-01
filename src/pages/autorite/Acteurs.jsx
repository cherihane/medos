import { useState } from "react";
import Layout from "../../components/Layout";
import { useAuth } from "../../context/AuthContext";
import { useEtablissements } from "../../hooks/useSupabaseData";
import { openDocument, tableHTML, fetchEtabFromAuth } from "../../utils/MedOSDocument";

// ─── Modal Inspection ────────────────────────────────────────────────────────
function InspectionModal({ acteur, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ backgroundColor: "white", borderRadius: 16, width: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ padding: "20px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Fiche d'inspection</h3>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 3 }}>{acteur.nom}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF" }}>x</button>
        </div>
        <div style={{ padding: "18px 24px" }}>
          {[
            ["Nom",   acteur.nom ?? "—"],
            ["Type",  acteur.type ?? "—"],
            ["Ville", acteur.ville ?? "—"],
            ["Pays",  acteur.pays ?? "—"],
            ["Statut", acteur.actif ? "Actif" : "Inactif"],
          ].map(([label, val]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #F3F4F6" }}>
              <span style={{ fontSize: 13, color: "#6B7280" }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#0A1628" }}>{val}</span>
            </div>
          ))}
          <div style={{ marginTop: 16, padding: "12px 14px", backgroundColor: acteur.actif ? "#DCFCE7" : "#FEF2F2", borderRadius: 8, fontSize: 12, color: "#374151" }}>
            <strong>Observation :</strong>{" "}
            {acteur.actif
              ? "Etablissement actif dans le systeme MedOS."
              : "Etablissement marque comme inactif. Verification requise."}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <button onClick={onClose} style={{ padding: "9px 20px", backgroundColor: "#8B5CF6", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function exportRegistre(liste, etab) {
  const dateFr = new Date().toLocaleDateString("fr-FR");
  const rows = liste.map((a) => {
    const statutColor = a.actif ? "#16A34A" : "#DC2626";
    const statutBadge = `<span style="padding:2px 8px;border-radius:4px;background:${a.actif ? "#DCFCE7" : "#FEF2F2"};color:${statutColor};font-weight:700;font-size:10px">${a.actif ? "actif" : "inactif"}</span>`;
    return [a.nom ?? "—", a.type ?? "—", a.ville ?? "—", a.pays ?? "—", statutBadge];
  });
  openDocument({
    titre: "Registre des acteurs pharmaceutiques",
    sousTitre: `Exporte le ${dateFr} — ${liste.length} etablissement${liste.length !== 1 ? "s" : ""} enregistres`,
    etablissement: etab,
    sections: [{
      titre: "Repertoire complet",
      html: tableHTML(["Nom", "Type", "Ville", "Pays", "Statut"], rows),
    }],
  });
}

export default function Acteurs() {
  const { auth } = useAuth();
  const { data: etablissements, loading } = useEtablissements();
  const [inspected, setInspected] = useState(null);
  const [search, setSearch] = useState("");

  const filtered = etablissements.filter((e) => {
    const q = search.toLowerCase();
    return (
      (e.nom ?? "").toLowerCase().includes(q) ||
      (e.type ?? "").toLowerCase().includes(q) ||
      (e.ville ?? "").toLowerCase().includes(q) ||
      (e.pays ?? "").toLowerCase().includes(q)
    );
  });

  const actifs   = etablissements.filter((e) => e.actif).length;
  const inactifs = etablissements.length - actifs;

  const kpis = [
    { label: "Acteurs enregistres", value: loading ? "…" : etablissements.length, color: "#8B5CF6" },
    { label: "Actifs",              value: loading ? "…" : actifs,                color: "#10B981" },
    { label: "Inactifs",            value: loading ? "…" : inactifs,              color: "#EF4444" },
    { label: "Villes representees", value: loading ? "…" : [...new Set(etablissements.map((e) => e.ville).filter(Boolean))].length, color: "#3B82F6" },
  ];

  return (
    <Layout title="Acteurs" subtitle="Repertoire des acteurs pharmaceutiques">
      {inspected && <InspectionModal acteur={inspected} onClose={() => setInspected(null)} />}

      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ backgroundColor: "white", borderRadius: 14, padding: "18px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ backgroundColor: "white", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0A1628", flexShrink: 0 }}>
            Registre des acteurs {!loading && `(${filtered.length})`}
          </h3>
          <input
            placeholder="Rechercher nom, type, ville..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "7px 12px", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 12, outline: "none", flex: 1, maxWidth: 300 }}
          />
          <button
            onClick={async () => { const etab = await fetchEtabFromAuth(auth); exportRegistre(filtered, etab); }}
            disabled={filtered.length === 0}
            style={{ padding: "7px 14px", backgroundColor: filtered.length === 0 ? "#E5E7EB" : "#8B5CF6", color: filtered.length === 0 ? "#9CA3AF" : "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: filtered.length === 0 ? "not-allowed" : "pointer", flexShrink: 0 }}
          >
            Exporter
          </button>
        </div>

        {loading ? (
          <div style={{ padding: "48px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>
            Chargement des acteurs…
          </div>
        ) : etablissements.length === 0 ? (
          <div style={{ padding: "64px 24px", textAlign: "center" }}>
            <div style={{ marginBottom: 16, color: "#D1D5DB", display: "flex", justifyContent: "center" }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#374151", marginBottom: 8 }}>Aucun acteur enregistre</div>
            <div style={{ fontSize: 13, color: "#9CA3AF" }}>Les etablissements enregistres dans le systeme apparaitront ici.</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
            Aucun acteur ne correspond a la recherche.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: "#F8FAFC" }}>
                {["Nom", "Type", "Ville", "Pays", "Statut", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6B7280", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "13px 16px", fontWeight: 600, color: "#0A1628" }}>{a.nom ?? "—"}</td>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ padding: "2px 8px", backgroundColor: "#EFF6FF", color: "#2563EB", borderRadius: 8, fontSize: 11, fontWeight: 600 }}>{a.type ?? "—"}</span>
                  </td>
                  <td style={{ padding: "13px 16px", color: "#6B7280" }}>{a.ville ?? "—"}</td>
                  <td style={{ padding: "13px 16px", color: "#6B7280" }}>{a.pays ?? "—"}</td>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ padding: "3px 10px", backgroundColor: a.actif ? "#DCFCE7" : "#FEF2F2", color: a.actif ? "#16A34A" : "#EF4444", borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
                      {a.actif ? "actif" : "inactif"}
                    </span>
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <button
                      onClick={() => setInspected(a)}
                      style={{ padding: "4px 12px", backgroundColor: "#F8FAFC", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 6, fontSize: 11, cursor: "pointer" }}
                    >
                      Inspecter
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}
