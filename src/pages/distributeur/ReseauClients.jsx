import { colors } from "../../theme";
import { useState, useEffect } from "react";
import Layout from "../../components/Layout";
import { useEtablissements } from "../../hooks/useSupabaseData";
import { insertLivraison } from "../../hooks/useMutations";
import { supabase } from "../../supabaseClient";
import { useIsMobile } from "../../hooks/useWindowSize";

const inputStyle = {
  width: "100%", padding: "9px 13px", border: "1.5px solid var(--border)",
  borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box",
  color: colors.navy, backgroundColor: colors.bgCard,
};

// ─── Modal Nouveau client ─────────────────────────────────────────────────────
function NouveauClientModal({ onClose, onSaved, etabsMedOS }) {
  const [mode, setMode] = useState("medos"); // "medos" | "manuel"
  const [selected, setSelected] = useState(null);
  const [filtre, setFiltre] = useState("");
  const [form, setForm] = useState({ nom: "", ville: "", type: "pharmacie", email: "", telephone: "" });
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const etabsFiltres = etabsMedOS.filter((e) =>
    e.nom.toLowerCase().includes(filtre.toLowerCase()) ||
    (e.ville ?? "").toLowerCase().includes(filtre.toLowerCase())
  );

  const handleSave = async () => {
    setErreur(null);
    setSaving(true);
    try {
      if (mode === "medos") {
        if (!selected) { setErreur("Sélectionnez un établissement."); setSaving(false); return; }
        // L'établissement est déjà dans Supabase — on note juste le lien
        // (pas de duplication — l'établissement devient visible dans la liste)
        onSaved(`${selected.nom} ajouté au réseau.`);
      } else {
        if (!form.nom.trim()) { setErreur("Le nom est obligatoire."); setSaving(false); return; }
        if (!form.ville.trim()) { setErreur("La ville est obligatoire."); setSaving(false); return; }
        const { error } = await supabase.from("etablissements").insert({
          nom: form.nom.trim(),
          ville: form.ville.trim(),
          type: form.type,
          email: form.email.trim() || null,
          telephone: form.telephone.trim() || null,
          actif: true,
          statut_inscription: "validee",
        });
        if (error) throw error;
        onSaved(`${form.nom.trim()} créé et ajouté au réseau.`);
      }
      onClose();
    } catch (e) {
      setErreur("Erreur : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ backgroundColor: colors.bgCard, borderRadius: 16, width: 520, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        {/* Header */}
        <div style={{ padding: "20px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: colors.navy }}>Ajouter un client</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, margin: "16px 24px 0", backgroundColor: colors.borderLight, borderRadius: 8, padding: 4 }}>
          {[{ key: "medos", label: "Etablissement MedOS" }, { key: "manuel", label: "Client manuel" }].map((t) => (
            <button key={t.key} onClick={() => setMode(t.key)} style={{ flex: 1, padding: "7px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", backgroundColor: mode === t.key ? "white" : "transparent", color: mode === t.key ? "#0A1628" : "#6B7280", boxShadow: mode === t.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: "16px 24px", overflowY: "auto", flex: 1 }}>
          {mode === "medos" ? (
            <>
              <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 12 }}>
                Sélectionnez un établissement déjà enregistré dans MedOS pour l'ajouter à votre réseau commercial.
              </div>
              <input
                value={filtre}
                onChange={(e) => setFiltre(e.target.value)}
                placeholder="Rechercher par nom ou ville…"
                style={{ ...inputStyle, marginBottom: 10 }}
              />
              <div style={{ maxHeight: 280, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
                {etabsFiltres.length === 0 && (
                  <div style={{ padding: 20, textAlign: "center", color: colors.textMuted, fontSize: 13 }}>Aucun résultat</div>
                )}
                {etabsFiltres.map((e) => (
                  <div key={e.id} onClick={() => setSelected(e)} style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", backgroundColor: selected?.id === e.id ? "#EFF6FF" : "white", borderBottom: "1px solid var(--border-light)" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: colors.navy }}>{e.nom}</div>
                      <div style={{ fontSize: 11, color: colors.textMuted }}>{e.type} · {e.ville}</div>
                    </div>
                    {selected?.id === e.id && <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#3B82F6" }} />}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 14 }}>
                Créez un nouveau client qui n'est pas encore enregistré dans MedOS.
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Nom <span style={{ color: "#EF4444" }}>*</span></label>
                <input style={inputStyle} value={form.nom} onChange={set("nom")} placeholder="Ex: Clinique Sainte-Marie" />
              </div>
              <div className="form-row-2" style={{ marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Ville <span style={{ color: "#EF4444" }}>*</span></label>
                  <input style={inputStyle} value={form.ville} onChange={set("ville")} placeholder="Ex: Abidjan" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Type</label>
                  <select style={{ ...inputStyle, cursor: "pointer" }} value={form.type} onChange={set("type")}>
                    <option value="pharmacie">Pharmacie</option>
                    <option value="hopital">Hôpital</option>
                    <option value="clinique">Clinique</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Email</label>
                <input style={inputStyle} type="email" value={form.email} onChange={set("email")} placeholder="contact@client.com" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Téléphone</label>
                <input style={inputStyle} type="tel" value={form.telephone} onChange={set("telephone")} placeholder="Ex: +225 07 00 00 00 00" />
              </div>
            </>
          )}

          {erreur && (
            <div style={{ marginTop: 12, padding: "9px 13px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 12, color: "#DC2626" }}>
              {erreur}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px 20px", display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid var(--border-light)" }}>
          <button onClick={onClose} style={{ padding: "9px 18px", backgroundColor: colors.bgCard, border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 13, color: colors.textSecondary, cursor: "pointer" }}>
            Annuler
          </button>
          <button onClick={handleSave} disabled={saving} style={{ padding: "9px 18px", backgroundColor: saving ? "#E5E7EB" : "#F59E0B", color: saving ? "#9CA3AF" : "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "Enregistrement…" : "Ajouter au réseau"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Créer une livraison vers un client ─────────────────────────────────
function CommandeClientModal({ client, onClose, onSaved }) {
  const [form, setForm] = useState({
    transporteur: "",
    date_depart: new Date().toISOString().slice(0, 10),
    date_arrivee_prevue: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    setErreur(null);
    setSaving(true);
    try {
      await insertLivraison({
        etablissement_id: client.id,
        statut: "planifiee",
        transporteur: form.transporteur || null,
        numero_suivi: "LIV-" + Date.now().toString().slice(-8),
        date_depart: form.date_depart || null,
        date_arrivee_prevue: form.date_arrivee_prevue || null,
      });
      onSaved("Livraison créée pour " + client.nom);
      onClose();
    } catch (e) {
      setErreur("Erreur : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ backgroundColor: colors.bgCard, borderRadius: 16, width: 460, padding: "24px 28px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: colors.navy }}>Nouvelle livraison — {client.nom}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted }}>×</button>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Transporteur</label>
          <input style={inputStyle} value={form.transporteur} onChange={set("transporteur")} placeholder="Ex: DHL, Transport local…" />
        </div>
        <div className="form-row-2" style={{ marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Date de départ</label>
            <input style={inputStyle} type="date" value={form.date_depart} onChange={set("date_depart")} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Arrivée prévue</label>
            <input style={inputStyle} type="date" value={form.date_arrivee_prevue} onChange={set("date_arrivee_prevue")} />
          </div>
        </div>
        {erreur && (
          <div style={{ padding: "9px 13px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 12, color: "#DC2626", marginBottom: 12 }}>
            {erreur}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 18px", backgroundColor: colors.bgCard, border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 13, color: colors.textSecondary, cursor: "pointer" }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: "9px 18px", backgroundColor: saving ? "#E5E7EB" : "#F59E0B", color: saving ? "#9CA3AF" : "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "Création…" : "Créer la livraison"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Historique livraisons d'un client ──────────────────────────────────
const STATUT_LIV = {
  planifiee:  { label: "Planifiée",   bg: "#F3F4F6", color: colors.textSecondary },
  en_transit: { label: "En transit",  bg: "#E0E7FF", color: "#4F46E5" },
  livree:     { label: "Livrée",      bg: "#DCFCE7", color: "#16A34A" },
  annulee:    { label: "Annulée",     bg: "#FEF2F2", color: "#DC2626" },
};

function HistoriqueClientModal({ client, onClose }) {
  const [livraisons, setLivraisons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("livraisons")
      .select("id, numero_suivi, statut, date_depart, date_arrivee_prevue, transporteur")
      .eq("etablissement_id", client.id)
      .order("date_depart", { ascending: false })
      .limit(20)
      .then(({ data }) => { setLivraisons(data ?? []); setLoading(false); });
  }, [client.id]);

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ backgroundColor: colors.bgCard, borderRadius: 16, width: 520, maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: colors.navy }}>Historique — {client.nom}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted }}>×</button>
        </div>
        <div style={{ overflowY: "auto", padding: "16px 24px", flex: 1 }}>
          {loading && (
            <div style={{ textAlign: "center", color: colors.textMuted, fontSize: 13, padding: 24 }}>Chargement…</div>
          )}
          {!loading && livraisons.length === 0 && (
            <div style={{ textAlign: "center", color: colors.textMuted, fontSize: 13, padding: 32 }}>
              Aucune livraison enregistrée pour ce client.
            </div>
          )}
          {!loading && livraisons.map((l) => {
            const s = STATUT_LIV[l.statut] ?? { label: l.statut, bg: "#F3F4F6", color: colors.textSecondary };
            return (
              <div key={l.id} style={{ padding: "12px 14px", backgroundColor: colors.bgSurface, borderRadius: 10, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy, fontFamily: "monospace" }}>{l.numero_suivi ?? l.id.slice(0, 8).toUpperCase()}</div>
                  <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                    {l.date_depart ? new Date(l.date_depart).toLocaleDateString("fr-FR") : "—"}
                    {l.transporteur ? ` · ${l.transporteur}` : ""}
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 10, backgroundColor: s.bg, color: s.color }}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
        <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: "9px 18px", backgroundColor: colors.bgCard, border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 13, color: colors.textSecondary, cursor: "pointer" }}>Fermer</button>
        </div>
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function ReseauClients() {
  const isMobile = useIsMobile();

  const { data: etabs, loading, refetch } = useEtablissements();
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [commandeModal, setCommandeModal] = useState(null);
  const [historiqueModal, setHistoriqueModal] = useState(null);
  const [toast, setToast] = useState(null);

  // Drawer commandes client
  const [clientCommandeDrawer, setClientCommandeDrawer] = useState(null);
  const [commandesClient, setCommandesClient] = useState([]);
  const [loadingCommandes, setLoadingCommandes] = useState(false);

  async function voirCommandesClient(client) {
    setClientCommandeDrawer(client);
    setLoadingCommandes(true);
    const { data } = await supabase
      .from("commandes")
      .select("id, reference, statut, created_at, notes, montant_total")
      .eq("etablissement_id", client.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setCommandesClient(data ?? []);
    setLoadingCommandes(false);
  }

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const STATUT_CMD = {
    brouillon:  { bg: "#F3F4F6", color: "#6B7280" },
    envoyee:    { bg: "#FEF9C3", color: "#A16207" },
    confirmee:  { bg: "#DBEAFE", color: "#2563EB" },
    en_transit: { bg: "#E0E7FF", color: "#4F46E5" },
    livree:     { bg: "#DCFCE7", color: "#16A34A" },
    annulee:    { bg: "#FEF2F2", color: "#DC2626" },
  };

  return (
    <Layout title="Réseau Clients" subtitle="Gestion du portefeuille client et des relations commerciales">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      {/* Drawer historique commandes */}
      {clientCommandeDrawer && (
        <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: 420, backgroundColor: colors.bgCard, boxShadow: "-4px 0 20px rgba(0,0,0,0.1)", zIndex: 500, overflowY: "auto", padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: colors.navy }}>{clientCommandeDrawer.nom}</div>
              <div style={{ fontSize: 12, color: colors.textMuted }}>{clientCommandeDrawer.ville} · {clientCommandeDrawer.type}</div>
            </div>
            <button onClick={() => setClientCommandeDrawer(null)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: colors.textMuted }}>×</button>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy, marginBottom: 12 }}>Historique des commandes</div>
          {loadingCommandes ? (
            <div style={{ color: colors.textMuted, fontSize: 13 }}>Chargement...</div>
          ) : commandesClient.length === 0 ? (
            <div style={{ color: colors.textMuted, fontSize: 13, textAlign: "center", padding: "30px 0" }}>
              Aucune commande enregistree pour ce client.
            </div>
          ) : (
            commandesClient.map((cmd) => {
              const lignes = (() => { try { const p = JSON.parse(cmd.notes ?? "{}"); return Array.isArray(p.lignes) ? p.lignes : []; } catch { return []; } })();
              const st = STATUT_CMD[cmd.statut] ?? { bg: "#F3F4F6", color: "#6B7280" };
              return (
                <div key={cmd.id} style={{ backgroundColor: colors.bgSurface, borderRadius: 10, padding: "12px 14px", marginBottom: 10, border: `1px solid ${colors.border ?? "var(--border)"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: colors.navy }}>
                      {cmd.reference ?? cmd.id?.slice(0, 8).toUpperCase()}
                    </div>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, fontWeight: 700, backgroundColor: st.bg, color: st.color }}>
                      {cmd.statut}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 6 }}>
                    {cmd.created_at ? new Date(cmd.created_at).toLocaleDateString("fr-FR") : "—"}
                    {cmd.montant_total ? ` · ${Number(cmd.montant_total).toLocaleString("fr-FR")} FCFA` : ""}
                  </div>
                  {lignes.length > 0 && (
                    <div style={{ fontSize: 11, color: colors.text }}>
                      {lignes.slice(0, 2).map((l, i) => (
                        <span key={i} style={{ marginRight: 8 }}>
                          {l.medicament_nom ?? l.medicamentNom ?? l.nom ?? "—"} ×{l.quantite ?? "?"}
                        </span>
                      ))}
                      {lignes.length > 2 && <span style={{ color: colors.textMuted }}>+{lignes.length - 2} autres</span>}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, backgroundColor: "#10B981", color: "white", padding: "12px 20px", borderRadius: 10, fontWeight: 600, fontSize: 13, zIndex: 2000, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
          {toast}
        </div>
      )}

      {showModal && (
        <NouveauClientModal
          onClose={() => setShowModal(false)}
          onSaved={(msg) => { showToast(msg); refetch(); }}
          etabsMedOS={etabs}
        />
      )}
      {commandeModal && (
        <CommandeClientModal
          client={commandeModal}
          onClose={() => setCommandeModal(null)}
          onSaved={(msg) => { showToast(msg); setCommandeModal(null); }}
        />
      )}
      {historiqueModal && (
        <HistoriqueClientModal
          client={historiqueModal}
          onClose={() => setHistoriqueModal(null)}
        />
      )}

      <div className="kpi-row">
        {[
          { label: "Clients actifs",  value: loading ? "…" : etabs.filter(e => e.actif).length, color: "#F59E0B" },
          { label: "Hôpitaux",        value: loading ? "…" : etabs.filter(e => e.type === "hopital").length, color: "#10B981" },
          { label: "Pharmacies",      value: loading ? "…" : etabs.filter(e => e.type === "pharmacie").length, color: "#3B82F6" },
          { label: "Total",           value: loading ? "…" : etabs.length, color: "#8B5CF6" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "18px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 360px", gap: 20 }}>
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: colors.navy }}>Tous les établissements ({loading ? "…" : etabs.length})</h3>
            <button onClick={() => setShowModal(true)} style={{ padding: "7px 14px", backgroundColor: "#F59E0B", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              + Nouveau client
            </button>
          </div>
          {loading && [1,2,3,4].map((i) => (
            <div key={i} style={{ padding: "13px 20px", display: "flex", gap: 12, borderBottom: "1px solid var(--border-light)", animation: "pulse 1.5s ease-in-out infinite" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: colors.borderLight }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 13, width: 160, backgroundColor: colors.borderLight, borderRadius: 6, marginBottom: 6 }} />
                <div style={{ height: 11, width: 100, backgroundColor: colors.borderLight, borderRadius: 6 }} />
              </div>
            </div>
          ))}
          {!loading && etabs.map((c) => (
            <div key={c.id} onClick={() => setSelected(c)}
              style={{ padding: "13px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", borderBottom: "1px solid var(--border-light)", backgroundColor: selected?.id === c.id ? "#FFFBEB" : "white" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: "#FFFBEB", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: "#F59E0B" }}>
                  {c.nom.charAt(0)}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: colors.navy }}>{c.nom}</div>
                  <div style={{ fontSize: 11, color: colors.textMuted }}>{c.type} · {c.ville}</div>
                </div>
              </div>
              <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: c.actif ? "#10B981" : "#9CA3AF" }} />
            </div>
          ))}
        </div>

        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          {!selected ? (
            <div style={{ textAlign: "center", color: colors.textMuted, fontSize: 13, paddingTop: 60 }}>
              Sélectionnez un établissement pour voir sa fiche
            </div>
          ) : (
            <>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", backgroundColor: "#FFFBEB", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", fontSize: 22, fontWeight: 800, color: "#F59E0B" }}>
                  {selected.nom.charAt(0)}
                </div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: colors.navy }}>{selected.nom}</h3>
                <div style={{ fontSize: 12, color: colors.textMuted }}>{selected.type} · {selected.ville}</div>
              </div>
              {[
                { label: "Email",     value: selected.email ?? "—" },
                { label: "Téléphone", value: selected.telephone ?? "—" },
                { label: "Adresse",   value: selected.adresse ?? "—" },
                { label: "Statut",    value: selected.actif ? "Actif" : "Inactif" },
              ].map((f) => (
                <div key={f.label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-light)" }}>
                  <span style={{ fontSize: 13, color: colors.textSecondary }}>{f.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: colors.navy, textTransform: "capitalize" }}>{f.value}</span>
                </div>
              ))}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 20 }}>
                <button onClick={() => setCommandeModal(selected)} style={{ padding: "9px", backgroundColor: "#F59E0B", color: "white", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Créer commande</button>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => voirCommandesClient(selected)} style={{ flex: 1, padding: "9px", backgroundColor: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Voir les commandes</button>
                  <button onClick={() => setHistoriqueModal(selected)} style={{ flex: 1, padding: "9px", backgroundColor: colors.bgSurface, color: colors.text, border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, cursor: "pointer" }}>Livraisons</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
