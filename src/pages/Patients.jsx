import { useState } from "react";
import Layout from "../components/Layout";
import { patients } from "../data/staticData";

export default function Patients() {
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");

  const filtered = patients.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout title="Gestion Patients">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20 }}>
        {/* List */}
        <div style={{ backgroundColor: "white", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0A1628" }}>Patients ({filtered.length})</h3>
            <input
              placeholder="🔍 Rechercher patient..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: "7px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 13, outline: "none", width: 200 }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {filtered.map((p) => (
              <div
                key={p.id}
                onClick={() => setSelected(p)}
                style={{
                  padding: "14px 20px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer",
                  borderBottom: "1px solid #F3F4F6",
                  backgroundColor: selected?.id === p.id ? "#EFF6FF" : "white"
                }}
              >
                <div style={{
                  width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
                  backgroundColor: p.genre === "F" ? "#FCE7F3" : "#DBEAFE",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, fontWeight: 800,
                  color: p.genre === "F" ? "#9D174D" : "#1D4ED8"
                }}>
                  {p.name.charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#0A1628" }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "#9CA3AF" }}>{p.id} · {p.age} ans · Gr. {p.groupe}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  {p.maladies.length > 0 && (
                    <div style={{ fontSize: 11, color: "#F59E0B", fontWeight: 600 }}>{p.maladies.join(", ")}</div>
                  )}
                  <div style={{ fontSize: 11, color: "#9CA3AF" }}>{p.derniereVisite}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Profile */}
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          {!selected ? (
            <div style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, paddingTop: 60 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
              Sélectionnez un patient pour voir son profil
            </div>
          ) : (
            <>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{
                  width: 72, height: 72, borderRadius: "50%", margin: "0 auto 12px",
                  backgroundColor: selected.genre === "F" ? "#FCE7F3" : "#DBEAFE",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 28, fontWeight: 800,
                  color: selected.genre === "F" ? "#9D174D" : "#1D4ED8"
                }}>
                  {selected.name.charAt(0)}
                </div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0A1628" }}>{selected.name}</h3>
                <div style={{ fontSize: 13, color: "#9CA3AF" }}>{selected.id}</div>
              </div>

              {[
                { label: "Âge", value: `${selected.age} ans` },
                { label: "Genre", value: selected.genre === "M" ? "Masculin" : "Féminin" },
                { label: "Groupe sanguin", value: selected.groupe },
                { label: "Téléphone", value: selected.tel },
                { label: "Dernière visite", value: selected.derniereVisite },
                { label: "Ordonnances totales", value: selected.ordonnances },
              ].map((item) => (
                <div key={item.label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #F3F4F6" }}>
                  <span style={{ fontSize: 13, color: "#6B7280" }}>{item.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0A1628" }}>{item.value}</span>
                </div>
              ))}

              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>Pathologies chroniques</div>
                {selected.maladies.length === 0 ? (
                  <span style={{ fontSize: 12, color: "#9CA3AF" }}>Aucune pathologie enregistrée</span>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {selected.maladies.map((m) => (
                      <span key={m} style={{ padding: "4px 12px", backgroundColor: "#FFFBEB", color: "#F59E0B", borderRadius: 10, fontSize: 12, fontWeight: 700 }}>{m}</span>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button style={{ flex: 1, padding: "10px", backgroundColor: "#3B82F6", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Nouvelle ordonnance
                </button>
                <button style={{ flex: 1, padding: "10px", backgroundColor: "#F8FAFC", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Historique
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
