import { useState } from "react";
import Layout from "../../components/Layout";

const livraisons = [
  { id: "LIV-2024-031", client: "Hôpital Central", ville: "Yamoussoukro", chauffeur: "Koné Mamadou", vehicule: "CI-4521-AB", depart: "08h30", arrivee: "11h45", status: "en route", produits: 8, montant: "1 820 000 FCFA" },
  { id: "LIV-2024-030", client: "Pharmacie Lumière", ville: "Abidjan", chauffeur: "Bamba Seydou", vehicule: "CI-7823-CD", depart: "07h00", arrivee: "08h30", status: "livré", produits: 5, montant: "342 000 FCFA" },
  { id: "LIV-2024-029", client: "Clinique du Nord", ville: "Bouaké", chauffeur: "Coulibaly Idriss", vehicule: "CI-2341-EF", depart: "06h00", arrivee: "11h00", status: "planifié", produits: 12, montant: "245 500 FCFA" },
  { id: "LIV-2024-028", client: "Centre de Santé", ville: "Daloa", chauffeur: "Diomande Ali", vehicule: "CI-9012-GH", depart: "09h00", arrivee: "13h30", status: "livré", produits: 6, montant: "98 200 FCFA" },
  { id: "LIV-2024-027", client: "Pharmacie Espoir", ville: "San Pédro", chauffeur: "Traoré Jean", vehicule: "CI-5678-IJ", depart: "—", arrivee: "—", status: "annulé", produits: 3, montant: "67 000 FCFA" },
];

const statusStyle = {
  "en route": { bg: "#DBEAFE", color: "#2563EB" },
  "livré": { bg: "#DCFCE7", color: "#16A34A" },
  "planifié": { bg: "#FEF9C3", color: "#A16207" },
  "annulé": { bg: "#FEF2F2", color: "#EF4444" },
};

export default function Livraisons() {
  const [filter, setFilter] = useState("tous");
  const filtered = livraisons.filter((l) => filter === "tous" || l.status === filter);

  return (
    <Layout title="Livraisons" subtitle="Suivi des livraisons en temps réel">
      <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
        {[
          { label: "En route", value: livraisons.filter(l => l.status === "en route").length, color: "#3B82F6" },
          { label: "Livrées aujourd'hui", value: livraisons.filter(l => l.status === "livré").length, color: "#10B981" },
          { label: "Planifiées", value: livraisons.filter(l => l.status === "planifié").length, color: "#F59E0B" },
          { label: "Annulées", value: livraisons.filter(l => l.status === "annulé").length, color: "#EF4444" },
        ].map((s) => (
          <div key={s.label} style={{ backgroundColor: "white", padding: "14px 20px", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${s.color}` }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["tous", "en route", "livré", "planifié", "annulé"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", textTransform: "capitalize",
            border: filter === f ? "2px solid #F59E0B" : "1.5px solid #E5E7EB",
            backgroundColor: filter === f ? "#FFFBEB" : "white",
            color: filter === f ? "#D97706" : "#6B7280",
          }}>{f}</button>
        ))}
      </div>

      <div style={{ backgroundColor: "white", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: "#F8FAFC" }}>
              {["Référence", "Client", "Chauffeur", "Véhicule", "Départ", "Arrivée prévue", "Produits", "Montant", "Statut"].map((h) => (
                <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6B7280", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => {
              const s = statusStyle[l.status];
              return (
                <tr key={l.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "13px 14px", fontWeight: 600, color: "#F59E0B" }}>{l.id}</td>
                  <td style={{ padding: "13px 14px", fontWeight: 600, color: "#0A1628" }}>
                    {l.client}
                    <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 400 }}>{l.ville}</div>
                  </td>
                  <td style={{ padding: "13px 14px", color: "#374151" }}>{l.chauffeur}</td>
                  <td style={{ padding: "13px 14px", color: "#6B7280", fontFamily: "monospace", fontSize: 12 }}>{l.vehicule}</td>
                  <td style={{ padding: "13px 14px", color: "#6B7280" }}>{l.depart}</td>
                  <td style={{ padding: "13px 14px", color: "#6B7280" }}>{l.arrivee}</td>
                  <td style={{ padding: "13px 14px", color: "#374151" }}>{l.produits} réf.</td>
                  <td style={{ padding: "13px 14px", fontWeight: 700, color: "#0A1628" }}>{l.montant}</td>
                  <td style={{ padding: "13px 14px" }}>
                    <span style={{ padding: "3px 10px", backgroundColor: s.bg, color: s.color, borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{l.status}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
