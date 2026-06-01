import { useState } from "react";
import Layout from "../components/Layout";
import { usePatients } from "../hooks/useSupabaseData";

function age(dateNaissance) {
  if (!dateNaissance) return null;
  return Math.floor((Date.now() - new Date(dateNaissance)) / (365.25 * 864e5));
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export default function Patients() {
  const { data: patients, loading } = usePatients();
  const [selected, setSelected]     = useState(null);
  const [search, setSearch]         = useState("");

  const filtered = patients.filter((p) => {
    const q = search.toLowerCase();
    const nom = `${p.prenom ?? ""} ${p.nom ?? ""}`.trim();
    return (
      nom.toLowerCase().includes(q) ||
      (p.numero_dossier ?? "").toLowerCase().includes(q) ||
      (p.telephone ?? "").includes(q)
    );
  });

  return (
    <Layout title="Gestion Patients">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20 }}>
        {/* Liste */}
        <div style={{ backgroundColor: "white", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0A1628", flexShrink: 0 }}>
              Patients {!loading && `(${filtered.length})`}
            </h3>
            <input
              placeholder="Rechercher nom, dossier, telephone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: "7px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 13, outline: "none", flex: 1 }}
            />
          </div>

          {loading ? (
            <div style={{ padding: "48px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>
              Chargement des patients…
            </div>
          ) : patients.length === 0 ? (
            <div style={{ padding: "64px 24px", textAlign: "center" }}>
              <div style={{ marginBottom: 16, color: "#D1D5DB", display: "flex", justifyContent: "center" }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
                Aucun patient enregistre
              </div>
              <div style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 20 }}>
                Les dossiers patients apparaitront ici une fois crees.
              </div>
              <button style={{ padding: "10px 24px", backgroundColor: "#3B82F6", color: "white", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                + Nouveau patient
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
              Aucun patient ne correspond a la recherche.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {filtered.map((p) => {
                const nom = `${p.prenom ?? ""} ${p.nom ?? ""}`.trim();
                const initiale = p.prenom?.charAt(0).toUpperCase() ?? p.nom?.charAt(0).toUpperCase() ?? "?";
                const ageVal = age(p.date_naissance);
                const hasAlertes = (p.allergies?.length ?? 0) > 0 || (p.antecedents ?? []).some((a) =>
                  ["diabète", "hypertension", "cancer", "vhb", "vih", "hémophilie"].some((k) => a.toLowerCase().includes(k))
                );
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelected(p)}
                    style={{
                      padding: "14px 20px",
                      display: "flex", alignItems: "center", gap: 14,
                      cursor: "pointer",
                      borderBottom: "1px solid #F3F4F6",
                      backgroundColor: selected?.id === p.id ? "#EFF6FF" : "white",
                    }}
                  >
                    <div style={{
                      width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
                      backgroundColor: p.genre === "F" ? "#FCE7F3" : "#DBEAFE",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 16, fontWeight: 800,
                      color: p.genre === "F" ? "#9D174D" : "#1D4ED8",
                    }}>
                      {initiale}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#0A1628" }}>{nom || "—"}</div>
                      <div style={{ fontSize: 12, color: "#9CA3AF" }}>
                        {p.numero_dossier ?? "—"}
                        {ageVal != null ? ` · ${ageVal} ans` : ""}
                        {p.groupe_sanguin ? ` · Gr. ${p.groupe_sanguin}` : ""}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      {hasAlertes && (
                        <div style={{ fontSize: 11, color: "#F59E0B", fontWeight: 700, marginBottom: 2 }}>
                          Attention
                        </div>
                      )}
                      {p.service && (
                        <div style={{ fontSize: 11, color: "#9CA3AF" }}>{p.service}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Profil */}
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          {!selected ? (
            <div style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, paddingTop: 60 }}>
              <div style={{ marginBottom: 12, display: "flex", justifyContent: "center", opacity: 0.3 }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              </div>
              Selectionnez un patient pour voir son profil
            </div>
          ) : (() => {
            const nom = `${selected.prenom ?? ""} ${selected.nom ?? ""}`.trim();
            const initiale = selected.prenom?.charAt(0).toUpperCase() ?? "?";
            const ageVal = age(selected.date_naissance);
            return (
              <>
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <div style={{
                    width: 72, height: 72, borderRadius: "50%", margin: "0 auto 12px",
                    backgroundColor: selected.genre === "F" ? "#FCE7F3" : "#DBEAFE",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 28, fontWeight: 800,
                    color: selected.genre === "F" ? "#9D174D" : "#1D4ED8",
                  }}>
                    {initiale}
                  </div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0A1628" }}>{nom || "—"}</h3>
                  <div style={{ fontSize: 12, color: "#9CA3AF" }}>{selected.numero_dossier ?? "—"}</div>
                </div>

                {[
                  { label: "Age",           value: ageVal != null ? `${ageVal} ans` : "—" },
                  { label: "Genre",         value: selected.genre === "M" ? "Masculin" : selected.genre === "F" ? "Feminin" : selected.genre ?? "—" },
                  { label: "Groupe sanguin", value: selected.groupe_sanguin ?? "—" },
                  { label: "Telephone",     value: selected.telephone ?? "—" },
                  { label: "Date naissance", value: fmtDate(selected.date_naissance) },
                  { label: "Service",       value: selected.service ?? "—" },
                  { label: "Derniere visite", value: fmtDate(selected.derniere_visite) },
                ].map((item) => (
                  <div key={item.label} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #F3F4F6" }}>
                    <span style={{ fontSize: 13, color: "#6B7280" }}>{item.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#0A1628" }}>{item.value}</span>
                  </div>
                ))}

                {(selected.allergies?.length > 0) && (
                  <div style={{ marginTop: 14, padding: "10px 14px", backgroundColor: "#FEF2F2", borderRadius: 10, borderLeft: "3px solid #EF4444" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#EF4444", marginBottom: 4 }}>Allergies</div>
                    <div style={{ fontSize: 12, color: "#374151" }}>{selected.allergies.join(", ")}</div>
                  </div>
                )}

                {(selected.antecedents?.length > 0) && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>Antecedents</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {selected.antecedents.map((a) => (
                        <span key={a} style={{ padding: "4px 12px", backgroundColor: "#FFFBEB", color: "#F59E0B", borderRadius: 10, fontSize: 12, fontWeight: 600 }}>
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                  <button style={{ flex: 1, padding: "10px", backgroundColor: "#3B82F6", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    Nouvelle ordonnance
                  </button>
                  <button style={{ flex: 1, padding: "10px", backgroundColor: "#F8FAFC", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    Historique
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      </div>
    </Layout>
  );
}
