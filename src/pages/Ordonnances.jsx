import { useState } from "react";
import Layout from "../components/Layout";
import { useOrdonnances } from "../hooks/useSupabaseData";
import { useIsMobile } from "../hooks/useWindowSize";

const STATUT_STYLE = {
  en_attente: { bg: "#DBEAFE", color: "#2563EB", label: "En attente" },
  validee:    { bg: "#EDE9FE", color: "#7C3AED", label: "Validee" },
  traitee:    { bg: "#DCFCE7", color: "#16A34A", label: "Traitee" },
  refusee:    { bg: "#FEF2F2", color: "#EF4444", label: "Refusee" },
  expiree:    { bg: "#F3F4F6", color: "#9CA3AF", label: "Expiree" },
};

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export default function Ordonnances() {
  const isMobile = useIsMobile();

  const { data: ordonnances, loading } = useOrdonnances();
  const [selected, setSelected]        = useState(null);
  const [search, setSearch]            = useState("");

  const filtered = ordonnances.filter((o) => {
    const q = search.toLowerCase();
    const nom = o.patients ? `${o.patients.prenom ?? ""} ${o.patients.nom ?? ""}`.trim() : "";
    return (
      (o.reference ?? "").toLowerCase().includes(q) ||
      nom.toLowerCase().includes(q) ||
      (o.medecin_nom ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <Layout title="Ordonnances">
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 380px", gap: 20 }}>
        {/* Liste */}
        <div style={{ backgroundColor: "white", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0A1628", flexShrink: 0 }}>
              Ordonnances {!loading && `(${filtered.length})`}
            </h3>
            <input
              placeholder="Rechercher ref., patient, medecin..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: "7px 12px", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 12, outline: "none", flex: 1 }}
            />
          </div>

          {loading ? (
            <div style={{ padding: "48px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>
              Chargement des ordonnances…
            </div>
          ) : ordonnances.length === 0 ? (
            <div style={{ padding: "64px 24px", textAlign: "center" }}>
              <div style={{ marginBottom: 16, color: "#D1D5DB", display: "flex", justifyContent: "center" }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
                Aucune ordonnance enregistrée
              </div>
              <div style={{ fontSize: 13, color: "#9CA3AF" }}>
                Les ordonnances créées par les médecins apparaîtront ici.
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
              Aucune ordonnance ne correspond a la recherche.
            </div>
          ) : (
            <div className="table-scroll"><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ backgroundColor: "#F8FAFC" }}>
                  {["Reference", "Patient", "Medecin", "Date emission", "Statut"].map((h) => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6B7280", borderBottom: "1px solid #E5E7EB" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => {
                  const s = STATUT_STYLE[o.statut] ?? STATUT_STYLE.en_attente;
                  const nomPatient = o.patients
                    ? `${o.patients.prenom ?? ""} ${o.patients.nom ?? ""}`.trim()
                    : "—";
                  return (
                    <tr
                      key={o.id}
                      onClick={() => setSelected(o)}
                      style={{
                        borderBottom: "1px solid #F3F4F6",
                        cursor: "pointer",
                        backgroundColor: selected?.id === o.id ? "#EFF6FF" : "white",
                      }}
                    >
                      <td style={{ padding: "13px 16px", fontWeight: 600, color: "#3B82F6", fontFamily: "monospace", fontSize: 12 }}>
                        {o.reference ?? "—"}
                      </td>
                      <td style={{ padding: "13px 16px", fontWeight: 600, color: "#0A1628" }}>
                        {nomPatient}
                      </td>
                      <td style={{ padding: "13px 16px", color: "#6B7280" }}>
                        {o.medecin_nom ? `Dr. ${o.medecin_nom}` : "—"}
                      </td>
                      <td style={{ padding: "13px 16px", color: "#6B7280", fontSize: 12 }}>
                        {fmtDate(o.date_emission)}
                      </td>
                      <td style={{ padding: "13px 16px" }}>
                        <span style={{ padding: "3px 10px", backgroundColor: s.bg, color: s.color, borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
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

        {/* Detail */}
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          {!selected ? (
            <div style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, paddingTop: 60 }}>
              <div style={{ marginBottom: 12, display: "flex", justifyContent: "center", opacity: 0.3 }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
              </div>
              Selectionnez une ordonnance pour voir les details
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#0A1628", fontFamily: "monospace" }}>
                    {selected.reference ?? "—"}
                  </h3>
                  {(() => {
                    const s = STATUT_STYLE[selected.statut] ?? STATUT_STYLE.en_attente;
                    return (
                      <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 10, fontWeight: 700, backgroundColor: s.bg, color: s.color }}>
                        {s.label}
                      </span>
                    );
                  })()}
                </div>
                <span style={{ fontSize: 12, color: "#9CA3AF" }}>{fmtDate(selected.date_emission)}</span>
              </div>

              {[
                {
                  label: "Patient",
                  value: selected.patients
                    ? `${selected.patients.prenom ?? ""} ${selected.patients.nom ?? ""}`.trim()
                    : "—",
                },
                { label: "Prescripteur", value: selected.medecin_nom ? `Dr. ${selected.medecin_nom}` : "—" },
                { label: "Date emission",   value: fmtDate(selected.date_emission) },
                { label: "Date expiration", value: fmtDate(selected.date_expiration) },
              ].map((item) => (
                <div key={item.label} style={{ padding: "12px 14px", backgroundColor: "#F8FAFC", borderRadius: 10, marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0A1628" }}>{item.value}</div>
                </div>
              ))}

              {selected.notes && (
                <div style={{ padding: "12px 14px", backgroundColor: "#FFFBEB", borderRadius: 10, marginBottom: 10, borderLeft: "3px solid #F59E0B" }}>
                  <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 3 }}>Notes</div>
                  <div style={{ fontSize: 13, color: "#374151" }}>{selected.notes}</div>
                </div>
              )}

              {selected.statut === "en_attente" && (
                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                  <button style={{ flex: 1, padding: "10px", backgroundColor: "#10B981", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    Valider
                  </button>
                  <button style={{ flex: 1, padding: "10px", backgroundColor: "#FEF2F2", color: "#EF4444", border: "1px solid #FCA5A5", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    Refuser
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
