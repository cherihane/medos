import { useState } from "react";
import Layout from "../../components/Layout";
import { useEtablissements } from "../../hooks/useSupabaseData";

export default function ReseauClients() {
  const { data: etabs, loading } = useEtablissements();
  const [selected, setSelected] = useState(null);

  return (
    <Layout title="Réseau Clients" subtitle="Gestion du portefeuille client et des relations commerciales">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Clients actifs",  value: loading ? "…" : etabs.filter(e => e.actif).length, color: "#F59E0B" },
          { label: "Hôpitaux",        value: loading ? "…" : etabs.filter(e => e.type === "hopital").length, color: "#10B981" },
          { label: "Pharmacies",      value: loading ? "…" : etabs.filter(e => e.type === "pharmacie").length, color: "#3B82F6" },
          { label: "Total",           value: loading ? "…" : etabs.length, color: "#8B5CF6" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: "white", borderRadius: 14, padding: "18px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20 }}>
        <div style={{ backgroundColor: "white", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between" }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0A1628" }}>Tous les établissements ({loading ? "…" : etabs.length})</h3>
            <button style={{ padding: "7px 14px", backgroundColor: "#F59E0B", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ Nouveau client</button>
          </div>
          {loading && [1,2,3,4].map((i) => (
            <div key={i} style={{ padding: "13px 20px", display: "flex", gap: 12, borderBottom: "1px solid #F3F4F6", animation: "pulse 1.5s ease-in-out infinite" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: "#F3F4F6" }} />
              <div style={{ flex: 1 }}><div style={{ height: 13, width: 160, backgroundColor: "#F3F4F6", borderRadius: 6, marginBottom: 6 }} /><div style={{ height: 11, width: 100, backgroundColor: "#F3F4F6", borderRadius: 6 }} /></div>
            </div>
          ))}
          {!loading && etabs.map((c) => (
            <div key={c.id} onClick={() => setSelected(c)}
              style={{ padding: "13px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", borderBottom: "1px solid #F3F4F6", backgroundColor: selected?.id === c.id ? "#FFFBEB" : "white" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: "#FFFBEB", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: "#F59E0B" }}>
                  {c.nom.charAt(0)}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#0A1628" }}>{c.nom}</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF" }}>{c.type} · {c.ville}</div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: c.actif ? "#10B981" : "#9CA3AF", marginLeft: "auto" }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          {!selected ? (
            <div style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, paddingTop: 60 }}>
              Sélectionnez un établissement pour voir sa fiche
            </div>
          ) : (
            <>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", backgroundColor: "#FFFBEB", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", fontSize: 22, fontWeight: 800, color: "#F59E0B" }}>
                  {selected.nom.charAt(0)}
                </div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0A1628" }}>{selected.nom}</h3>
                <div style={{ fontSize: 12, color: "#9CA3AF" }}>{selected.type} · {selected.ville}</div>
              </div>
              {[
                { label: "Email",    value: selected.email ?? "—" },
                { label: "Téléphone", value: selected.telephone ?? "—" },
                { label: "Adresse",  value: selected.adresse ?? "—" },
                { label: "Statut",   value: selected.actif ? "Actif" : "Inactif" },
              ].map((f) => (
                <div key={f.label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #F3F4F6" }}>
                  <span style={{ fontSize: 13, color: "#6B7280" }}>{f.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0A1628", textTransform: "capitalize" }}>{f.value}</span>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                <button style={{ flex: 1, padding: "9px", backgroundColor: "#F59E0B", color: "white", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Créer commande</button>
                <button style={{ flex: 1, padding: "9px", backgroundColor: "#F8FAFC", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 12, cursor: "pointer" }}>Historique</button>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
