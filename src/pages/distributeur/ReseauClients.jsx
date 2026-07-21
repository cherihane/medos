import { colors } from "../../theme";
import { useState, useEffect } from "react";
import Layout from "../../components/Layout";
import { useAuth } from "../../context/AuthContext";
import { useDistributeurClients, useClientStockBas } from "../../hooks/useSupabaseData";
import { insertLivraison, insertDistributeurClient, rechercherClientParEmail } from "../../hooks/useMutations";
import { supabase } from "../../supabaseClient";
import { useIsMobile } from "../../hooks/useWindowSize";

const inputStyle = {
  width: "100%", padding: "9px 13px", border: "1.5px solid var(--border)",
  borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box",
  color: colors.navy, backgroundColor: colors.bgCard,
};

// ─── Modal Ajouter un client (relation manuelle réelle) ───────────────────────
// Pas d'annuaire parcourable de tous les établissements MedOS (volontaire —
// cf. mission) : on rattache un établissement déjà inscrit via son email exact,
// comme on ajouterait un contact business dont on connaît les coordonnées.
function NouveauClientModal({ onClose, onSaved }) {
  const { auth } = useAuth();
  const [email, setEmail] = useState("");
  const [found, setFound] = useState(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState(null);

  const handleSearch = async () => {
    if (!email.trim()) { setErreur("Saisissez l'email de l'établissement."); return; }
    setErreur(null);
    setFound(null);
    setSearching(true);
    try {
      const res = await rechercherClientParEmail(email.trim());
      if (!res) setErreur("Aucun établissement pharmacie/hôpital/clinique actif trouvé avec cet email.");
      else setFound(res);
    } catch (e) {
      setErreur("Erreur : " + e.message);
    } finally {
      setSearching(false);
    }
  };

  const handleAdd = async () => {
    if (!found) return;
    setSaving(true);
    setErreur(null);
    try {
      await insertDistributeurClient({
        distributeur_id: auth?.etablissement_id,
        client_etablissement_id: found.id,
      });
      onSaved(`${found.nom} ajouté à votre réseau clients.`);
      onClose();
    } catch (e) {
      setErreur("Erreur : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ backgroundColor: colors.bgCard, borderRadius: 16, width: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ padding: "20px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: colors.navy }}>Ajouter un client</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted }}>×</button>
        </div>
        <div style={{ padding: "16px 24px" }}>
          <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 14 }}>
            Rattachez un établissement déjà inscrit sur MedOS (pharmacie, hôpital, clinique) en
            saisissant son email exact — un client devient automatiquement visible ici dès sa
            première commande passée chez vous, cette recherche ne sert qu'à l'ajouter avant coup.
          </div>
          <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Email de l'établissement</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={inputStyle}
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFound(null); setErreur(null); }}
              placeholder="contact@pharmacie.com"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button onClick={handleSearch} disabled={searching} style={{ padding: "9px 16px", backgroundColor: colors.bgSurface, border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: searching ? "wait" : "pointer", whiteSpace: "nowrap" }}>
              {searching ? "…" : "Rechercher"}
            </button>
          </div>

          {found && (
            <div style={{ marginTop: 14, padding: "12px 14px", backgroundColor: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>{found.nom}</div>
                <div style={{ fontSize: 11, color: colors.textMuted, textTransform: "capitalize" }}>{found.type} · {found.ville}</div>
              </div>
              <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#F59E0B" }} />
            </div>
          )}

          {erreur && (
            <div style={{ marginTop: 12, padding: "9px 13px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 12, color: "#DC2626" }}>
              {erreur}
            </div>
          )}
        </div>
        <div style={{ padding: "14px 24px 20px", display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid var(--border-light)" }}>
          <button onClick={onClose} style={{ padding: "9px 18px", backgroundColor: colors.bgCard, border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 13, color: colors.textSecondary, cursor: "pointer" }}>
            Annuler
          </button>
          <button onClick={handleAdd} disabled={!found || saving} style={{ padding: "9px 18px", backgroundColor: (!found || saving) ? "#E5E7EB" : "#F59E0B", color: (!found || saving) ? "#9CA3AF" : "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: (!found || saving) ? "not-allowed" : "pointer" }}>
            {saving ? "Ajout…" : "Ajouter au réseau"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Créer une livraison vers un client ─────────────────────────────────
function CommandeClientModal({ client, onClose, onSaved }) {
  const { auth } = useAuth();
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
        distributeur_id: auth?.etablissement_id,
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

// ─── Panneau fiche client détaillée (ruptures, besoins, historique) ───────────
function FicheClient({ client, onCommande, onHistorique }) {
  const { data: stock, loading: loadingStock } = useClientStockBas(client.id);
  const ruptures = stock.filter((m) => m.stock_actuel <= 0);
  const stockBas = stock.filter((m) => m.stock_actuel > 0 && m.stock_actuel < m.stock_minimum);

  return (
    <>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", backgroundColor: "#FFFBEB", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", fontSize: 22, fontWeight: 800, color: "#F59E0B" }}>
          {client.nom.charAt(0)}
        </div>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: colors.navy }}>{client.nom}</h3>
        <div style={{ fontSize: 12, color: colors.textMuted, textTransform: "capitalize" }}>{client.type} · {client.ville}</div>
      </div>

      {[
        { label: "Email",     value: client.email ?? "—" },
        { label: "Téléphone", value: client.telephone ?? "—" },
        { label: "Statut",    value: client.actif ? "Actif" : "Inactif" },
      ].map((f) => (
        <div key={f.label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-light)" }}>
          <span style={{ fontSize: 13, color: colors.textSecondary }}>{f.label}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: colors.navy }}>{f.value}</span>
        </div>
      ))}

      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: colors.navy, textTransform: "uppercase", marginBottom: 8 }}>
          Ruptures &amp; besoins récents
        </div>
        {loadingStock && <div style={{ fontSize: 12, color: colors.textMuted }}>Chargement…</div>}
        {!loadingStock && ruptures.length === 0 && stockBas.length === 0 && (
          <div style={{ fontSize: 12, color: colors.textMuted }}>Aucune rupture ni stock bas signalé.</div>
        )}
        {!loadingStock && [...ruptures, ...stockBas].slice(0, 8).map((m) => (
          <div key={m.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 12 }}>
            <span style={{ color: colors.text }}>{m.nom}{m.dosage ? ` ${m.dosage}` : ""}</span>
            <span style={{ fontWeight: 700, color: m.stock_actuel <= 0 ? "#DC2626" : "#D97706" }}>
              {m.stock_actuel <= 0 ? "Rupture" : `${m.stock_actuel}/${m.stock_minimum}`}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 20 }}>
        <button onClick={() => onCommande(client)} style={{ padding: "9px", backgroundColor: "#F59E0B", color: "white", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Créer livraison</button>
        <button onClick={() => onHistorique(client)} style={{ padding: "9px", backgroundColor: colors.bgSurface, color: colors.text, border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, cursor: "pointer" }}>Historique des livraisons</button>
      </div>
    </>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function ReseauClients() {
  const isMobile = useIsMobile();

  const { data: relations, loading, refetch } = useDistributeurClients();
  const etabs = relations.map((r) => r.client).filter(Boolean);
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
    // RLS scope automatiquement aux commandes routées vers CE distributeur.
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
    <Layout title="Réseau Clients" subtitle="Vos clients réels — première commande ou ajout manuel">
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
          <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy, marginBottom: 12 }}>Historique des commandes chez vous</div>
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
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: colors.navy }}>Vos clients ({loading ? "…" : etabs.length})</h3>
            <button onClick={() => setShowModal(true)} style={{ padding: "7px 14px", backgroundColor: "#F59E0B", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              + Ajouter un client
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
          {!loading && etabs.length === 0 && (
            <div style={{ padding: "40px 20px", textAlign: "center", color: colors.textMuted, fontSize: 13 }}>
              Aucun client pour l'instant. Un établissement apparaît ici dès sa première commande
              chez vous, ou en l'ajoutant manuellement.
            </div>
          )}
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
              <button onClick={(e) => { e.stopPropagation(); voirCommandesClient(c); }} style={{ padding: "5px 10px", backgroundColor: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                Commandes
              </button>
            </div>
          ))}
        </div>

        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          {!selected ? (
            <div style={{ textAlign: "center", color: colors.textMuted, fontSize: 13, paddingTop: 60 }}>
              Sélectionnez un client pour voir sa fiche
            </div>
          ) : (
            <FicheClient
              client={selected}
              onCommande={setCommandeModal}
              onHistorique={setHistoriqueModal}
            />
          )}
        </div>
      </div>
    </Layout>
  );
}
