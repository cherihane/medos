import { useState } from "react";
import Layout from "../../components/Layout";
import { networkClients, suppliers } from "../../data/staticData";

export default function ReseauClients() {
  const [selected, setSelected] = useState(null);
  const allClients = [
    ...networkClients.map((c) => ({ ...c, type: "Pharmacie/Hôpital", tel: "+225 07 XX XX XX", encours: Math.round(Math.random() * 2000000 + 500000) })),
    { name: "Hôpital Général Bouaké", ville: "Bouaké", commandes: 18, ca: "2.1", status: "actif", type: "Hôpital", tel: "+225 07 11 22 33", encours: 1200000 },
    { name: "Centre Médical Yopougon", ville: "Abidjan", commandes: 31, ca: "3.8", status: "actif", type: "Centre médical", tel: "+225 05 44 55 66", encours: 800000 },
  ];

  return (
    <Layout title="Réseau Clients" subtitle="Gestion du portefeuille client et des relations commerciales">
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Clients actifs", value: "84", color: "#F59E0B" },
          { label: "Nouveaux ce mois", value: "+7", color: "#10B981" },
          { label: "CA total", value: "24.8M FCFA", color: "#3B82F6" },
          { label: "Fidélité moyenne", value: "2.4 ans", color: "#8B5CF6" },
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
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0A1628" }}>Tous les clients ({allClients.length})</h3>
            <button style={{ padding: "7px 14px", backgroundColor: "#F59E0B", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ Nouveau client</button>
          </div>
          {allClients.map((c) => (
            <div key={c.name} onClick={() => setSelected(c)}
              style={{ padding: "13px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", borderBottom: "1px solid #F3F4F6", backgroundColor: selected?.name === c.name ? "#FFFBEB" : "white" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: c.status === "actif" ? "#FFFBEB" : "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: c.status === "actif" ? "#F59E0B" : "#9CA3AF" }}>
                  {c.name.charAt(0)}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#0A1628" }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF" }}>{c.type} · {c.ville}</div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{c.ca}M FCFA</div>
                <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: c.status === "actif" ? "#10B981" : "#9CA3AF", marginLeft: "auto", marginTop: 4 }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          {!selected ? (
            <div style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, paddingTop: 60 }}>
              Sélectionnez un client pour voir sa fiche
            </div>
          ) : (
            <>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", backgroundColor: "#FFFBEB", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", fontSize: 22, fontWeight: 800, color: "#F59E0B" }}>
                  {selected.name.charAt(0)}
                </div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0A1628" }}>{selected.name}</h3>
                <div style={{ fontSize: 12, color: "#9CA3AF" }}>{selected.type} · {selected.ville}</div>
              </div>
              {[
                { label: "Commandes total", value: selected.commandes },
                { label: "CA généré", value: `${selected.ca}M FCFA` },
                { label: "Encours crédit", value: `${(selected.encours || 0).toLocaleString()} FCFA` },
                { label: "Statut", value: selected.status },
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
