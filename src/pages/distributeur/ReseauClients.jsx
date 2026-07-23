import { colors } from "../../theme";
import { useState, useEffect } from "react";
import Layout from "../../components/Layout";
import AjouterClientModal from "../../components/AjouterClientModal";
import { useAuth } from "../../context/AuthContext";
import { useDistributeurClients, useClientStockBas } from "../../hooks/useSupabaseData";
import { insertLivraison } from "../../hooks/useMutations";
import { supabase } from "../../supabaseClient";
import { useIsMobile } from "../../hooks/useWindowSize";

const inputStyle = {
  width: "100%", padding: "9px 13px", border: "1.5px solid var(--border)",
  borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box",
  color: colors.navy, backgroundColor: colors.bgCard,
};

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
        etablissement_id: client.estManuel ? null : client.id,
        distributeur_clients_id: client.relationId,
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
    // distributeur_clients_id couvre aussi bien un client MedOS qu'un client
    // manuel (etablissement_id seul ne matcherait jamais une livraison créée
    // pour un client manuel, qui n'a pas de ligne etablissements).
    supabase
      .from("livraisons")
      .select("id, numero_suivi, statut, date_depart, date_arrivee_prevue, transporteur")
      .or(`etablissement_id.eq.${client.id},distributeur_clients_id.eq.${client.relationId}`)
      .order("date_depart", { ascending: false })
      .limit(20)
      .then(({ data }) => { setLivraisons(data ?? []); setLoading(false); });
  }, [client.id, client.relationId]);

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

// Mêmes seuils que Alertes.jsx côté pharmacie — pour que ce que voit le
// distributeur ici corresponde exactement à ce que le client verrait sur son
// propre écran d'alertes.
function statutStock(m) {
  if (!m.stock_minimum || m.stock_minimum === 0) return "normal";
  const ratio = m.stock_actuel / m.stock_minimum;
  if (ratio <= 0.2) return "critique";
  if (ratio <= 0.5) return "alerte";
  return "normal";
}

const STATUT_CMD_STYLE = {
  brouillon:  { bg: "#F3F4F6", color: "#6B7280" },
  envoyee:    { bg: "#FEF9C3", color: "#A16207" },
  confirmee:  { bg: "#DBEAFE", color: "#2563EB" },
  en_transit: { bg: "#E0E7FF", color: "#4F46E5" },
  livree:     { bg: "#DCFCE7", color: "#16A34A" },
  annulee:    { bg: "#FEF2F2", color: "#DC2626" },
};

// ─── Historique d'achat du client chez ce distributeur (toujours affiché) ─────
// ─── Solde dû (point 7 — facturation) ────────────────────────────────────────
// Somme des commandes reçues de CE client dont le paiement n'est pas encore
// marqué "payé" (voir Facturation.jsx) — un client manuel n'a jamais de
// commande (pas de compte MedOS pour en passer une), donc pas de solde.
function SoldeDu({ client }) {
  const { auth } = useAuth();
  const [solde, setSolde] = useState(null);

  useEffect(() => {
    if (client.estManuel || !auth?.etablissement_id) { setSolde(0); return; }
    let cancelled = false;
    supabase
      .from("commandes")
      .select("montant_total")
      .eq("distributeur_id", auth.etablissement_id)
      .eq("etablissement_id", client.id)
      .neq("statut_paiement", "paye")
      .then(({ data }) => {
        if (cancelled) return;
        setSolde((data ?? []).reduce((s, c) => s + (c.montant_total ?? 0), 0));
      });
    return () => { cancelled = true; };
  }, [client.id, client.estManuel, auth?.etablissement_id]);

  if (client.estManuel) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-light)" }}>
      <span style={{ fontSize: 13, color: colors.textSecondary }}>Solde dû</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: solde > 0 ? "#DC2626" : "#16A34A" }}>
        {solde === null ? "…" : `${solde.toLocaleString("fr-FR")} FCFA`}
      </span>
    </div>
  );
}

function HistoriqueAchat({ client }) {
  const [commandes, setCommandes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from("commandes")
      .select("id, reference, statut, created_at, notes, montant_total")
      .eq("etablissement_id", client.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => { if (!cancelled) { setCommandes(data ?? []); setLoading(false); } });
    return () => { cancelled = true; };
  }, [client.id]);

  if (loading) return <div style={{ fontSize: 12, color: colors.textMuted }}>Chargement…</div>;
  if (commandes.length === 0) return <div style={{ fontSize: 12, color: colors.textMuted }}>Aucune commande enregistrée pour ce client.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {commandes.map((cmd) => {
        const lignes = (() => { try { const p = JSON.parse(cmd.notes ?? "{}"); return Array.isArray(p.lignes) ? p.lignes : []; } catch { return []; } })();
        const st = STATUT_CMD_STYLE[cmd.statut] ?? { bg: "#F3F4F6", color: "#6B7280" };
        return (
          <div key={cmd.id} style={{ backgroundColor: colors.bgSurface, borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: colors.navy }}>{cmd.reference ?? cmd.id?.slice(0, 8).toUpperCase()}</span>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, fontWeight: 700, backgroundColor: st.bg, color: st.color }}>{cmd.statut}</span>
            </div>
            <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
              {cmd.created_at ? new Date(cmd.created_at).toLocaleDateString("fr-FR") : "—"}
              {cmd.montant_total ? ` · ${Number(cmd.montant_total).toLocaleString("fr-FR")} FCFA` : ""}
              {lignes.length > 0 && ` · ${lignes.length} produit${lignes.length > 1 ? "s" : ""}`}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Panneau fiche client détaillée (stock bas si MedOS, historique sinon) ────
// "Utilise MedOS" = a déjà émis au moins un heartbeat de connexion
// (derniere_connexion non nul, voir Layout.jsx) — un client simplement
// rattaché par email mais qui ne s'est jamais connecté n'a par définition
// aucune donnée de stock fiable à afficher.
function FicheClient({ client, onCommande, onHistorique }) {
  const usesMedOS = !!client.derniere_connexion;
  const { data: stock, loading: loadingStock } = useClientStockBas(usesMedOS ? client.id : null);
  const alertesStock = stock.map((m) => ({ ...m, statut: statutStock(m) })).filter((m) => m.statut !== "normal");

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
        { label: "Utilise MedOS", value: usesMedOS ? "Oui" : "Non" },
      ].map((f) => (
        <div key={f.label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-light)" }}>
          <span style={{ fontSize: 13, color: colors.textSecondary }}>{f.label}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: colors.navy }}>{f.value}</span>
        </div>
      ))}
      <SoldeDu client={client} />

      {!usesMedOS && (
        <div style={{ marginTop: 14, padding: "10px 12px", backgroundColor: "#F3F4F6", borderRadius: 10, fontSize: 12, color: colors.textSecondary }}>
          Ce client n'utilise pas encore MedOS — visibilité limitée à l'historique de commandes.
        </div>
      )}

      {usesMedOS && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: colors.navy, textTransform: "uppercase", marginBottom: 8 }}>
            Alertes de stock bas
          </div>
          {loadingStock && <div style={{ fontSize: 12, color: colors.textMuted }}>Chargement…</div>}
          {!loadingStock && alertesStock.length === 0 && (
            <div style={{ fontSize: 12, color: colors.textMuted }}>Aucune alerte de stock chez ce client.</div>
          )}
          {!loadingStock && alertesStock.slice(0, 8).map((m) => (
            <div key={m.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 12 }}>
              <span style={{ color: colors.text }}>{m.nom}{m.dosage ? ` ${m.dosage}` : ""}</span>
              <span style={{ fontWeight: 700, color: m.statut === "critique" ? "#DC2626" : "#D97706" }}>
                {m.statut === "critique" ? "Critique" : "Alerte"} · {m.stock_actuel}/{m.stock_minimum}
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: colors.navy, textTransform: "uppercase", marginBottom: 8 }}>
          Historique d'achat {usesMedOS ? "détaillé" : ""}
        </div>
        <HistoriqueAchat client={client} />
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

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  return (
    <Layout title="Réseau Clients" subtitle="Vue enrichie de vos clients réels — activité MedOS et historique">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, backgroundColor: "#10B981", color: "white", padding: "12px 20px", borderRadius: 10, fontWeight: 600, fontSize: 13, zIndex: 2000, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
          {toast}
        </div>
      )}

      {showModal && (
        <AjouterClientModal
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
          { label: "Utilisent MedOS", value: loading ? "…" : etabs.filter(e => e.derniere_connexion).length, color: "#F59E0B" },
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
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, fontWeight: 700, backgroundColor: c.derniere_connexion ? "#DCFCE7" : "#F3F4F6", color: c.derniere_connexion ? "#16A34A" : "#9CA3AF" }}>
                {c.derniere_connexion ? "MedOS" : "hors MedOS"}
              </span>
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
