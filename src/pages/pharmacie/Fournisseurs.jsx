import Layout from "../../components/Layout";
import { useFournisseurs } from "../../hooks/useSupabaseData";

function Skeleton() {
  return (
    <div style={{ backgroundColor: "white", borderRadius: 16, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", animation: "pulse 1.5s ease-in-out infinite" }}>
      <div style={{ display: "flex", gap: 14, marginBottom: 16 }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: "#F3F4F6" }} />
        <div>
          <div style={{ width: 140, height: 14, backgroundColor: "#F3F4F6", borderRadius: 6, marginBottom: 8 }} />
          <div style={{ width: 80, height: 12, backgroundColor: "#F3F4F6", borderRadius: 6 }} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ height: 52, backgroundColor: "#F8FAFC", borderRadius: 10 }} />
        ))}
      </div>
      <div style={{ height: 48, backgroundColor: "#F8FAFC", borderRadius: 10 }} />
    </div>
  );
}

export default function Fournisseurs() {
  const { data: fournisseurs, loading, error } = useFournisseurs();

  return (
    <Layout title="Fournisseurs" subtitle="Gestion des partenaires et des approvisionnements">
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 14, color: "#6B7280" }}>
          {loading ? "Chargement…" : error ? "Erreur de connexion" : `${fournisseurs.length} fournisseur${fournisseurs.length !== 1 ? "s" : ""} enregistré${fournisseurs.length !== 1 ? "s" : ""}`}
        </div>
        <button style={{ padding: "8px 18px", backgroundColor: "#3B82F6", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + Nouveau fournisseur
        </button>
      </div>

      {error && (
        <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "14px 18px", marginBottom: 20, fontSize: 13, color: "#DC2626" }}>
          Impossible de charger les fournisseurs : {error.message}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {loading && [1, 2, 3, 4].map((i) => <Skeleton key={i} />)}

        {!loading && !error && fournisseurs.length === 0 && (
          <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "60px 0", color: "#9CA3AF", fontSize: 14 }}>
            Aucun fournisseur trouvé dans la base de données.
          </div>
        )}

        {!loading && fournisseurs.map((s) => {
          const actif = s.actif !== false;
          return (
            <div key={s.id} style={{ backgroundColor: "white", borderRadius: 16, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: actif ? "#EFF6FF" : "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={actif ? "#3B82F6" : "#9CA3AF"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
                      <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "#0A1628" }}>{s.nom}</div>
                    <div style={{ fontSize: 12, color: "#9CA3AF" }}>{s.pays}</div>
                  </div>
                </div>
                <span style={{ padding: "4px 12px", borderRadius: 12, fontSize: 11, fontWeight: 700, backgroundColor: actif ? "#DCFCE7" : "#F3F4F6", color: actif ? "#16A34A" : "#9CA3AF" }}>
                  {actif ? "actif" : "inactif"}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                {[
                  { label: "Délai livraison",        value: s.delai_livraison || "—" },
                  { label: "Conditions paiement",    value: s.conditions_paiement || "—" },
                  { label: "Contact",                value: s.contact_nom || "—" },
                  { label: "Référence",              value: s.id?.slice(0, 8).toUpperCase() },
                ].map((item) => (
                  <div key={item.label} style={{ padding: "10px 12px", backgroundColor: "#F8FAFC", borderRadius: 10 }}>
                    <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#0A1628" }}>{item.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ padding: "10px 12px", backgroundColor: "#F8FAFC", borderRadius: 10, marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 2 }}>Contact</div>
                <div style={{ fontSize: 13, color: "#3B82F6" }}>{s.email || "—"}</div>
                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{s.telephone || "—"}</div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ flex: 1, padding: "9px", backgroundColor: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  Passer commande
                </button>
                <button style={{ flex: 1, padding: "9px", backgroundColor: "#F8FAFC", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  Voir détails
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
