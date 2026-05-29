import Layout from "../../components/Layout";
import { networkClients } from "../../data/staticData";

export default function Reseau() {
  return (
    <Layout title="Réseau Hospitalier" subtitle="Connexions inter-établissements et partage de ressources">
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Établissements connectés", value: "12", color: "#10B981" },
          { label: "Transferts ce mois", value: "34", color: "#3B82F6" },
          { label: "Médicaments mutualisés", value: "87", color: "#8B5CF6" },
          { label: "Économies générées", value: "4.2M FCFA", color: "#F59E0B" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: "white", borderRadius: 14, padding: "18px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Établissements du réseau</h3>
          {[
            { name: "CHU de Cocody", type: "CHU", distance: "4.2 km", status: "connecté", transferts: 12 },
            { name: "Clinique Sainte-Marie", type: "Clinique", distance: "7.8 km", status: "connecté", transferts: 5 },
            { name: "Hôpital Général d'Abobo", type: "Hôpital", distance: "15.3 km", status: "connecté", transferts: 8 },
            { name: "Centre de Santé Adjamé", type: "CS", distance: "3.1 km", status: "limité", transferts: 2 },
            { name: "Polyclinique du Plateau", type: "Clinique", distance: "2.7 km", status: "connecté", transferts: 7 },
          ].map((e) => (
            <div key={e.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", backgroundColor: "#F8FAFC", borderRadius: 10, marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: e.status === "connecté" ? "#10B981" : "#F59E0B" }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#0A1628" }}>{e.name}</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF" }}>{e.type} · {e.distance}</div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{e.transferts} transferts</div>
                <button style={{ padding: "3px 10px", backgroundColor: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600, marginTop: 4 }}>
                  Transférer
                </button>
              </div>
            </div>
          ))}
        </div>

        <div>
          <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Transferts récents</h3>
            {[
              { from: "CHU Cocody", to: "Hôpital Central", produit: "Insuline 100UI", qte: 50, date: "Aujourd'hui 14h32" },
              { from: "Hôpital Central", to: "Clinique Sainte-Marie", produit: "Amoxicilline 500mg", qte: 120, date: "Hier 09h15" },
              { from: "Polyclinique Plateau", to: "Hôpital Central", produit: "Paracétamol 1g", qte: 200, date: "Hier 16h00" },
            ].map((t, i) => (
              <div key={i} style={{ padding: "12px 0", borderBottom: "1px solid #F3F4F6" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: "#0A1628" }}>{t.produit}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{t.qte} unités</span>
                </div>
                <div style={{ fontSize: 11, color: "#9CA3AF" }}>{t.from} → {t.to}</div>
                <div style={{ fontSize: 11, color: "#9CA3AF" }}>{t.date}</div>
              </div>
            ))}
          </div>

          <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Demandes en attente</h3>
            {[
              { etablissement: "CS Adjamé", produit: "Sérum physiologique", urgence: "haute" },
              { etablissement: "Clinique Sainte-Marie", produit: "Metformine 850mg", urgence: "normale" },
            ].map((d, i) => (
              <div key={i} style={{ padding: "12px 14px", backgroundColor: "#FFFBEB", borderRadius: 10, marginBottom: 8, border: "1px solid #FCD34D" }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#0A1628", marginBottom: 2 }}>{d.produit}</div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 8 }}>Demandé par : {d.etablissement}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ padding: "5px 12px", backgroundColor: "#10B981", color: "white", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Accepter</button>
                  <button style={{ padding: "5px 12px", backgroundColor: "#F8FAFC", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>Refuser</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
