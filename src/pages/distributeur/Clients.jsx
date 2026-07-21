import { colors } from "../../theme";
import { useState } from "react";
import Layout from "../../components/Layout";
import Modal from "../../components/Modal";
import { useDistributeurClients } from "../../hooks/useSupabaseData";

// ── Modal Fiche client ─────────────────────────────────────────────────────────
function FicheModal({ client, onClose }) {
  return (
    <Modal title={client.nom} onClose={onClose} width={460}>
      <div className="form-row-2">
        {[
          { label: "Type",          value: client.type || "—" },
          { label: "Ville",         value: client.ville || "—" },
          { label: "Utilise MedOS", value: client.derniere_connexion ? "Oui" : "Non" },
          { label: "Téléphone",     value: client.telephone || "—" },
          { label: "Email",         value: client.email || "—" },
          { label: "Adresse",       value: client.adresse || "—" },
        ].map((item) => (
          <div key={item.label} style={{ padding: "10px 14px", backgroundColor: colors.bgSurface, borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 3 }}>{item.label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>{item.value}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16 }}>
        <button onClick={onClose} style={{ width: "100%", padding: "10px", backgroundColor: colors.bgSurface, border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, cursor: "pointer" }}>Fermer</button>
      </div>
    </Modal>
  );
}

// Répertoire simple des clients réels (relation distributeur_clients — jamais
// un annuaire de tous les établissements MedOS). La vue enrichie avec
// alertes de stock et historique d'achat détaillé vit dans Réseau clients ;
// cet écran reste volontairement un simple répertoire de fiches.
export default function Clients() {
  const { data: relations, loading, error } = useDistributeurClients();
  const etabs = relations.map((r) => r.client).filter(Boolean);
  const [ficheModal, setFicheModal] = useState(null);

  return (
    <Layout title="Clients" subtitle="Répertoire de vos clients réels — fiches et coordonnées">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      {ficheModal && <FicheModal client={ficheModal} onClose={() => setFicheModal(null)} />}

      {error && (
        <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "14px 18px", marginBottom: 16, fontSize: 13, color: "#DC2626" }}>
          Une erreur s'est produite. Veuillez réessayer.
        </div>
      )}

      <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: colors.navy }}>
            Établissements clients ({loading ? "…" : etabs.length})
          </h3>
        </div>
        <div className="table-scroll"><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: colors.bgSurface }}>
              {["Client", "Ville", "Type", "Email", "MedOS", "Actions"].map((h) => (
                <th key={h} style={{ padding: "12px 18px", textAlign: "left", fontSize: 12, fontWeight: 700, color: colors.textSecondary, borderBottom: "1px solid var(--border)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && [1,2,3,4].map((i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border-light)", animation: "pulse 1.5s ease-in-out infinite" }}>
                {[180,100,80,140,60,100].map((w, j) => (
                  <td key={j} style={{ padding: "14px 18px" }}><div style={{ height: 13, width: w, backgroundColor: colors.borderLight, borderRadius: 6 }} /></td>
                ))}
              </tr>
            ))}
            {!loading && etabs.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: colors.textMuted, fontSize: 13 }}>Aucun client pour l'instant</td></tr>
            )}
            {!loading && etabs.map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                <td style={{ padding: "14px 18px", fontWeight: 600, color: colors.navy }}>{c.nom}</td>
                <td style={{ padding: "14px 18px", color: colors.textSecondary }}>{c.ville}</td>
                <td style={{ padding: "14px 18px", color: colors.textSecondary, textTransform: "capitalize" }}>{c.type}</td>
                <td style={{ padding: "14px 18px", color: colors.textSecondary, fontSize: 12 }}>{c.email ?? "—"}</td>
                <td style={{ padding: "14px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: c.derniere_connexion ? "#10B981" : "#9CA3AF" }} />
                    <span style={{ fontSize: 12, color: c.derniere_connexion ? "#16A34A" : "#9CA3AF", fontWeight: 600 }}>{c.derniere_connexion ? "oui" : "non"}</span>
                  </div>
                </td>
                <td style={{ padding: "14px 18px" }}>
                  <button
                    onClick={() => setFicheModal(c)}
                    style={{ padding: "4px 12px", backgroundColor: colors.bgSurface, color: colors.text, border: "1px solid var(--border)", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>
                    Fiche
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </Layout>
  );
}
