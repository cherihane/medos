import { useState } from "react";
import Layout from "../../components/Layout";
import Modal, { Field, ModalFooter, selectStyle } from "../../components/Modal";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useCommandes } from "../../hooks/useSupabaseData";
import { updateCommande } from "../../hooks/useMutations";

function getStatut(cmd) {
  if (cmd.statut === "annulee") return "annulee";
  const montant = cmd.montant_total ?? 0;
  if (montant > 5000000) return "critique";
  if (montant > 2000000) return "alerte";
  return "normal";
}

const statusStyle = {
  normal:   { bg: "#DCFCE7", color: "#16A34A" },
  alerte:   { bg: "#FFFBEB", color: "#F59E0B" },
  critique: { bg: "#FEF2F2", color: "#EF4444" },
  annulee:  { bg: "#F3F4F6", color: "#9CA3AF" },
};

function fmt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

function Skeleton() {
  return (
    <div style={{ backgroundColor: "white", borderRadius: 16, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", animation: "pulse 1.5s ease-in-out infinite" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ width: 200, height: 16, backgroundColor: "#F3F4F6", borderRadius: 6, marginBottom: 8 }} />
          <div style={{ width: 140, height: 12, backgroundColor: "#F3F4F6", borderRadius: 6 }} />
        </div>
        <div style={{ width: 80, height: 28, backgroundColor: "#F3F4F6", borderRadius: 8 }} />
      </div>
      <div style={{ height: 10, backgroundColor: "#F3F4F6", borderRadius: 6, marginBottom: 12 }} />
      <div style={{ display: "flex", gap: 8 }}>
        {[1,2,3].map((i) => <div key={i} style={{ flex: 1, height: 34, backgroundColor: "#F3F4F6", borderRadius: 8 }} />)}
      </div>
    </div>
  );
}

// ── Modal paiement ────────────────────────────────────────────────────────────
function PaiementModal({ commande, onClose, onSaved }) {
  const [mode, setMode] = useState("virement");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateCommande(commande.id, {
        statut: "livree",
        notes: (commande.notes ? commande.notes + " | " : "") + `Paiement enregistré (${mode}) le ${new Date().toLocaleDateString("fr-FR")}`,
      });
      onSaved();
      onClose();
    } catch (e) {
      alert("Erreur : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Enregistrer un paiement" onClose={onClose} width={420}>
      <div style={{ padding: "14px 16px", backgroundColor: "#F8FAFC", borderRadius: 10, marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: "#9CA3AF" }}>Commande</div>
        <div style={{ fontWeight: 700, color: "#0A1628" }}>{commande.reference ?? commande.id.slice(0,8).toUpperCase()}</div>
        <div style={{ fontSize: 13, color: "#374151", marginTop: 4 }}>
          Montant : <strong>{(commande.montant_total ?? 0).toLocaleString()} FCFA</strong>
        </div>
      </div>
      <Field label="Mode de paiement">
        <select style={selectStyle} value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="virement">Virement bancaire</option>
          <option value="cheque">Chèque</option>
          <option value="especes">Espèces</option>
          <option value="mobile_money">Mobile Money</option>
        </select>
      </Field>
      <ModalFooter onCancel={onClose} onSubmit={handleSave} submitLabel="Confirmer le paiement" saving={saving} />
    </Modal>
  );
}

export default function Credits() {
  const { data: commandes, loading, error, refetch } = useCommandes();
  const { toasts, success, error: toastError } = useToast();
  const [paiementModal, setPaiementModal] = useState(null);

  const actives = commandes.filter((c) => !["annulee"].includes(c.statut));
  const totalEncours = actives.reduce((s, c) => s + (c.montant_total ?? 0), 0);
  const enAlerte   = actives.filter((c) => getStatut(c) === "alerte").length;
  const enCritique = actives.filter((c) => getStatut(c) === "critique").length;

  return (
    <Layout title="Crédits" subtitle="Suivi des commandes et encours clients">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <Toast toasts={toasts} />

      {paiementModal && (
        <PaiementModal
          commande={paiementModal}
          onClose={() => setPaiementModal(null)}
          onSaved={() => { refetch(); success("Paiement enregistré avec succès"); }}
        />
      )}

      {/* ── KPI ── */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Encours total",     value: loading ? "…" : `${totalEncours.toLocaleString()} FCFA`, color: "#3B82F6" },
          { label: "Commandes actives", value: loading ? "…" : actives.length,                          color: "#8B5CF6" },
          { label: "En alerte",         value: loading ? "…" : enAlerte,                                color: "#F59E0B" },
          { label: "Critiques",         value: loading ? "…" : enCritique,                              color: "#EF4444" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: "white", borderRadius: 14, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#0A1628", marginTop: 4 }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{k.label}</div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "14px 18px", marginBottom: 20, fontSize: 13, color: "#DC2626" }}>
          Erreur Supabase : {error.message}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {loading && [1,2,3].map((i) => <Skeleton key={i} />)}
        {!loading && !error && actives.length === 0 && (
          <div style={{ backgroundColor: "white", borderRadius: 14, padding: "40px", textAlign: "center", color: "#9CA3AF", fontSize: 13, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            Aucune commande en encours
          </div>
        )}
        {!loading && actives.map((c) => {
          const statut = getStatut(c);
          const s = statusStyle[statut];
          const montant = c.montant_total ?? 0;
          const client = c.etablissements?.nom ?? "Client inconnu";
          const fourn = c.fournisseurs?.nom ?? "—";
          const pct = Math.min(100, Math.round((montant / 10000000) * 100));

          return (
            <div key={c.id} style={{ backgroundColor: "white", borderRadius: 16, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: "#0A1628", marginBottom: 2 }}>{client}</div>
                  <div style={{ fontSize: 12, color: "#9CA3AF" }}>
                    {c.reference ?? c.id.slice(0,8).toUpperCase()} · Fournisseur : {fourn}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, color: "#6B7280" }}>Livraison : <strong>{fmt(c.date_livraison_prevue)}</strong></span>
                  <span style={{ padding: "4px 12px", borderRadius: 12, fontSize: 12, fontWeight: 700, backgroundColor: s.bg, color: s.color }}>{c.statut}</span>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14 }}>
                <span style={{ color: "#6B7280" }}>Montant</span>
                <span style={{ fontWeight: 800, color: "#0A1628" }}>{montant.toLocaleString()} FCFA</span>
              </div>
              <div style={{ height: 10, backgroundColor: "#E5E7EB", borderRadius: 6, marginBottom: 6 }}>
                <div style={{ height: "100%", width: `${pct}%`, borderRadius: 6, backgroundColor: pct >= 90 ? "#EF4444" : pct >= 60 ? "#F59E0B" : "#10B981" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#9CA3AF", marginBottom: 16 }}>
                <span>Passée le {fmt(c.date_commande)}</span>
                <span style={{ fontFamily: "monospace" }}>{c.statut.toUpperCase()}</span>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setPaiementModal(c)}
                  style={{ padding: "8px 16px", backgroundColor: "#DCFCE7", color: "#16A34A", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  Enregistrer paiement
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
