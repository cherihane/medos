import { useState } from "react";
import Layout from "../../components/Layout";
import Modal, { Field, Row, ModalFooter, inputStyle, selectStyle } from "../../components/Modal";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useFournisseurs, useCommandesRealtime } from "../../hooks/useSupabaseData";
import { insertCommande } from "../../hooks/useMutations";

// ── Statuts commandes ─────────────────────────────────────────────────────────
const STATUT_STYLE = {
  en_attente:   { bg: "#FEF9C3", color: "#A16207",  label: "En attente",        icon: "⏳" },
  validee:      { bg: "#DBEAFE", color: "#2563EB",  label: "Validée",            icon: "✓" },
  en_livraison: { bg: "#E0E7FF", color: "#4F46E5",  label: "En livraison",       icon: "🚚" },
  livree:       { bg: "#DCFCE7", color: "#16A34A",  label: "Livrée",             icon: "✓✓" },
  annulee:      { bg: "#FEF2F2", color: "#DC2626",  label: "Annulée / refusée",  icon: "✕" },
};

function MesCommandesPanel() {
  const { data: commandes, loading } = useCommandesRealtime();

  if (loading) return null;
  if (commandes.length === 0) return null;

  return (
    <div style={{ backgroundColor: "white", borderRadius: 14, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0A1628" }}>
          Mes commandes en cours
        </h3>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, backgroundColor: "#DCFCE7", color: "#16A34A", padding: "3px 8px", borderRadius: 10 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#16A34A", display: "inline-block", animation: "livePulse 1.5s ease-in-out infinite" }} />
          TEMPS RÉEL
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {commandes.slice(0, 8).map((c) => {
          const s = STATUT_STYLE[c.statut] || { bg: "#F3F4F6", color: "#6B7280", label: c.statut, icon: "?" };
          return (
            <div key={c.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 14px",
              backgroundColor: s.bg,
              borderRadius: 10,
              borderLeft: `3px solid ${s.color}`,
              animation: "fadeIn 0.3s ease",
            }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0A1628" }}>
                  {c.fournisseurs?.nom ?? "—"}
                </div>
                <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>
                  {c.reference ?? c.id.slice(0, 8).toUpperCase()} · {new Date(c.date_commande).toLocaleDateString("fr-FR")}
                  {c.notes && ` · ${c.notes.slice(0, 50)}${c.notes.length > 50 ? "…" : ""}`}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, marginLeft: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#374151" }}>
                  {(c.montant_total ?? 0).toLocaleString()} FCFA
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, color: s.color, padding: "2px 8px", backgroundColor: "white", borderRadius: 8, whiteSpace: "nowrap" }}>
                  {s.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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

// ── Modal Passer commande ──────────────────────────────────────────────────────
function CommandeModal({ fournisseur, onClose, onSaved }) {
  const [form, setForm] = useState({
    produit: "",
    quantite: "",
    date_livraison_prevue: "",
    montant_total: 0,
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.produit.trim()) return alert("Veuillez indiquer le produit à commander.");
    setSaving(true);
    try {
      await insertCommande({
        fournisseur_id: fournisseur.id,
        statut: "en_attente",
        date_commande: new Date().toISOString(),
        date_livraison_prevue: form.date_livraison_prevue || null,
        montant_total: Number(form.montant_total) || 0,
        notes: `${form.produit}${form.quantite ? " — Qté: " + form.quantite : ""}${form.notes ? " — " + form.notes : ""}`,
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
    <Modal title={`Commander chez ${fournisseur.nom}`} onClose={onClose}>
      <Field label="Produit / médicament *">
        <input style={inputStyle} value={form.produit} onChange={set("produit")} placeholder="Ex: Amoxicilline 500mg" />
      </Field>
      <Row>
        <Field label="Quantité">
          <input style={inputStyle} type="number" min="1" value={form.quantite} onChange={set("quantite")} placeholder="Ex: 500" />
        </Field>
        <Field label="Montant estimé (FCFA)">
          <input style={inputStyle} type="number" min="0" value={form.montant_total} onChange={set("montant_total")} />
        </Field>
      </Row>
      <Field label="Date de livraison souhaitée">
        <input style={inputStyle} type="date" value={form.date_livraison_prevue} onChange={set("date_livraison_prevue")} />
      </Field>
      <Field label="Notes complémentaires">
        <input style={inputStyle} value={form.notes} onChange={set("notes")} placeholder="Instructions particulières…" />
      </Field>
      <ModalFooter onCancel={onClose} onSubmit={handleSave} submitLabel="Passer la commande" saving={saving} />
    </Modal>
  );
}

// ── Modal Détails fournisseur ─────────────────────────────────────────────────
function DetailsModal({ fournisseur, onClose }) {
  return (
    <Modal title={fournisseur.nom} onClose={onClose} width={480}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[
          { label: "Pays",               value: fournisseur.pays || "—" },
          { label: "Statut",             value: fournisseur.actif !== false ? "Actif" : "Inactif" },
          { label: "Contact",            value: fournisseur.contact_nom || "—" },
          { label: "Téléphone",          value: fournisseur.telephone || "—" },
          { label: "Email",              value: fournisseur.email || "—" },
          { label: "Délai livraison",    value: fournisseur.delai_livraison || "—" },
          { label: "Conditions paiement", value: fournisseur.conditions_paiement || "—" },
          { label: "Réf",               value: fournisseur.id?.slice(0, 8).toUpperCase() },
        ].map((item) => (
          <div key={item.label} style={{ padding: "10px 14px", backgroundColor: "#F8FAFC", borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 3 }}>{item.label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0A1628" }}>{item.value}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16 }}>
        <button onClick={onClose} style={{ width: "100%", padding: "10px", backgroundColor: "#F8FAFC", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, cursor: "pointer" }}>
          Fermer
        </button>
      </div>
    </Modal>
  );
}

export default function Fournisseurs() {
  const { data: fournisseurs, loading, error } = useFournisseurs();
  const { toasts, success } = useToast();
  const [commandModal, setCommandModal] = useState(null);
  const [detailModal, setDetailModal] = useState(null);

  return (
    <Layout title="Fournisseurs" subtitle="Gestion des partenaires et des approvisionnements">
      <style>{`
        @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes livePulse{ 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes fadeIn   { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
      <Toast toasts={toasts} />

      {commandModal && (
        <CommandeModal
          fournisseur={commandModal}
          onClose={() => setCommandModal(null)}
          onSaved={() => { success(`Commande passée chez ${commandModal.nom}`); }}
        />
      )}
      {detailModal && (
        <DetailsModal fournisseur={detailModal} onClose={() => setDetailModal(null)} />
      )}

      <MesCommandesPanel />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 14, color: "#6B7280" }}>
          {loading ? "Chargement…" : error ? "Erreur de connexion" : `${fournisseurs.length} fournisseur${fournisseurs.length !== 1 ? "s" : ""} enregistré${fournisseurs.length !== 1 ? "s" : ""}`}
        </div>
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
                  { label: "Délai livraison",     value: s.delai_livraison || "—" },
                  { label: "Conditions paiement", value: s.conditions_paiement || "—" },
                  { label: "Contact",             value: s.contact_nom || "—" },
                  { label: "Référence",           value: s.id?.slice(0, 8).toUpperCase() },
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
                <button
                  onClick={() => setCommandModal(s)}
                  style={{ flex: 1, padding: "9px", backgroundColor: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  Passer commande
                </button>
                <button
                  onClick={() => setDetailModal(s)}
                  style={{ flex: 1, padding: "9px", backgroundColor: "#F8FAFC", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
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
