import { colors } from "../../theme";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import { useAlertesPaginated, useMedicaments, useDistributeurClients, useClientStockBas } from "../../hooks/useSupabaseData";
import { useAuth } from "../../context/AuthContext";
import Pagination from "../../components/Pagination";
import { supabase } from "../../supabaseClient";

const severityStyle = {
  critique: { bg: "#FEF2F2", border: "#FCA5A5", color: "#EF4444", dot: "#EF4444" },
  alerte: { bg: "#FFFBEB", border: "#FCD34D", color: "#D97706", dot: "#F59E0B" },
  info: { bg: "#EFF6FF", border: "#BFDBFE", color: "#2563EB", dot: "#3B82F6" },
};

function fmt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// Mêmes seuils que Alertes.jsx côté pharmacie et FicheClient de Réseau
// clients — un médicament sous 50% de son seuil minimum est "alerte", sous
// 20% "critique".
function statutStock(m) {
  if (!m.stock_minimum || m.stock_minimum === 0) return "normal";
  const ratio = m.stock_actuel / m.stock_minimum;
  if (ratio <= 0.2) return "critique";
  if (ratio <= 0.5) return "alerte";
  return "normal";
}

function medicamentLabel(med) {
  return `${med.nom}${med.dosage ? ` ${med.dosage}` : ""}${med.forme ? ` (${med.forme})` : ""}`;
}

// Quantité suggérée : de quoi remonter à deux fois le seuil minimum, jamais
// moins que le seuil lui-même — point de départ éditable avant l'envoi de la
// commande, pas une valeur figée (même logique que côté pharmacie).
function quantiteSuggeree(med) {
  const min = med.stock_minimum || 10;
  return Math.max(min * 2 - (med.stock_actuel ?? 0), min);
}

// ── Onglet Stock entrepôt (distributeur lui-même) ───────────────────────────────
function StockEntrepotTab({ etablissement_id }) {
  const navigate = useNavigate();
  const { data: medicaments, loading } = useMedicaments(etablissement_id);
  const [selected, setSelected] = useState(() => new Set());

  const alertes = useMemo(() => {
    return medicaments
      .map((m) => ({ ...m, statut: statutStock(m) }))
      .filter((m) => m.statut !== "normal")
      .sort((a, b) => (a.stock_actuel / (a.stock_minimum || 1)) - (b.stock_actuel / (b.stock_minimum || 1)));
  }, [medicaments]);

  const toggleSelect = (id) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = () => setSelected((s) => s.size === alertes.length ? new Set() : new Set(alertes.map((m) => m.id)));

  const commander = (meds) => {
    const lignes = meds.map((m) => ({ medicament_id: m.id, quantite: quantiteSuggeree(m) }));
    navigate("/distributeur/entrepot", { state: { prefillLignes: lignes } });
  };

  const selectedCount = selected.size;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div style={{ fontSize: 13, color: colors.textSecondary }}>
          {loading ? "Chargement…" : `${alertes.length} médicament${alertes.length !== 1 ? "s" : ""} sous le seuil minimum`}
        </div>
        {selectedCount > 0 && (
          <button
            onClick={() => commander(alertes.filter((m) => selected.has(m.id)))}
            style={{ padding: "10px 20px", backgroundColor: "#F59E0B", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(245,158,11,0.3)" }}
          >
            Commander la sélection ({selectedCount})
          </button>
        )}
      </div>

      <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div className="table-scroll">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: colors.bgSurface }}>
                <th style={{ padding: "12px 16px", width: 36 }}>
                  <input type="checkbox" checked={alertes.length > 0 && selectedCount === alertes.length} onChange={toggleAll} disabled={alertes.length === 0} style={{ cursor: alertes.length === 0 ? "default" : "pointer" }} />
                </th>
                {["Médicament", "Stock actuel", "Seuil minimum", "Statut", ""].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} style={{ padding: "40px 16px", textAlign: "center", color: colors.textMuted, fontSize: 13 }}>Chargement…</td></tr>
              )}
              {!loading && alertes.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: "40px 16px", textAlign: "center", color: colors.textMuted, fontSize: 13 }}>
                    Aucune alerte de stock — tout l'entrepôt est au-dessus du seuil minimum.
                  </td>
                </tr>
              )}
              {!loading && alertes.map((m) => {
                const s = severityStyle[m.statut === "critique" ? "critique" : "alerte"];
                return (
                  <tr key={m.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                    <td style={{ padding: "13px 16px" }}>
                      <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleSelect(m.id)} style={{ cursor: "pointer" }} />
                    </td>
                    <td style={{ padding: "13px 16px", fontSize: 13, fontWeight: 700, color: colors.navy }}>{medicamentLabel(m)}</td>
                    <td style={{ padding: "13px 16px", fontSize: 13, fontWeight: 700, color: s.color }}>{m.stock_actuel ?? 0}</td>
                    <td style={{ padding: "13px 16px", fontSize: 12, color: colors.textSecondary }}>{m.stock_minimum ?? "—"}</td>
                    <td style={{ padding: "13px 16px" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, backgroundColor: s.bg, color: s.color }}>{m.statut === "critique" ? "Critique" : "Alerte"}</span>
                    </td>
                    <td style={{ padding: "13px 16px", textAlign: "right" }}>
                      <button onClick={() => commander([m])} style={{ padding: "7px 14px", backgroundColor: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                        Commander
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Onglet Stock clients (clients MedOS du distributeur) ────────────────────────
// Une ligne par client MedOS avec au moins une alerte — la lecture de
// `medicaments` pour un établissement tiers n'est autorisée que parce que
// ce client est réellement présent dans distributeur_clients (policy
// med_select_distributeur_clients / est_client_de_distributeur()).
function ClientAlertesCard({ client }) {
  const { data: stock, loading } = useClientStockBas(client.id);
  const alertes = useMemo(() =>
    stock.map((m) => ({ ...m, statut: statutStock(m) })).filter((m) => m.statut !== "normal"),
  [stock]);

  if (loading) {
    return <div style={{ height: 60, backgroundColor: colors.bgSurface, borderRadius: 12, animation: "pulse 1.5s ease-in-out infinite" }} />;
  }
  if (alertes.length === 0) return null;

  return (
    <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy, marginBottom: 10 }}>
        {client.nom} <span style={{ fontWeight: 400, color: colors.textMuted, textTransform: "capitalize" }}>· {client.type} · {client.ville}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {alertes.map((m) => {
          const s = severityStyle[m.statut === "critique" ? "critique" : "alerte"];
          return (
            <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", backgroundColor: s.bg, borderRadius: 8 }}>
              <span style={{ fontSize: 12, color: colors.text }}>{medicamentLabel(m)}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: s.color }}>{m.statut === "critique" ? "Critique" : "Alerte"} · {m.stock_actuel}/{m.stock_minimum}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StockClientsTab() {
  const { data: relations, loading } = useDistributeurClients();
  const clients = relations.map((r) => r.client).filter(Boolean).filter((c) => c.derniere_connexion);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[1, 2].map((i) => <div key={i} style={{ height: 60, backgroundColor: colors.bgSurface, borderRadius: 12, animation: "pulse 1.5s ease-in-out infinite" }} />)}
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: 40, textAlign: "center", color: colors.textMuted, fontSize: 13 }}>
        Aucun de vos clients n'utilise MedOS pour l'instant — aucune alerte de stock à remonter.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {clients.map((c) => <ClientAlertesCard key={c.id} client={c} />)}
    </div>
  );
}

// ── Onglet Notifications (générique, historique existant) ──────────────────────
function NotificationsTab() {
  const [filter, setFilter] = useState("tous");
  const { data: alertes, loading, error, total, page, setPage, totalPages } = useAlertesPaginated(filter);
  const [readIds, setReadIds] = useState(new Set());
  const [markingAll, setMarkingAll] = useState(false);

  const markRead = (id) => setReadIds((prev) => new Set([...prev, id]));
  const unreadCount = alertes.filter((a) => !readIds.has(a.id)).length;

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      const { data: unread } = await supabase.from("alertes").select("id").eq("resolu", false);
      if (unread && unread.length > 0) setReadIds(new Set(unread.map((a) => a.id)));
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {["tous", "critique", "alerte", "info"].map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", textTransform: "capitalize",
              border: filter === f ? "2px solid #F59E0B" : "1.5px solid var(--border)",
              backgroundColor: filter === f ? "#FFFBEB" : "white",
              color: filter === f ? "#D97706" : "#6B7280",
            }}>{f}</button>
          ))}
          {unreadCount > 0 && <span style={{ padding: "3px 10px", backgroundColor: "#EF4444", color: "white", borderRadius: 12, fontSize: 12, fontWeight: 700 }}>{unreadCount} non lues</span>}
        </div>
        <button onClick={markAllRead} disabled={markingAll} style={{ padding: "8px 16px", backgroundColor: colors.bgCard, border: "1.5px solid var(--border)", borderRadius: 10, fontSize: 13, color: colors.text, cursor: markingAll ? "wait" : "pointer", fontWeight: 600 }}>
          {markingAll ? "…" : "Tout marquer lu"}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 8 }}>
        {loading && [1,2,3].map((i) => (
          <div key={i} style={{ height: 72, backgroundColor: colors.bgSurface, borderRadius: 14, animation: "pulse 1.5s ease-in-out infinite" }} />
        ))}
        {!loading && alertes.length === 0 && (
          <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: 40, textAlign: "center", color: colors.textMuted, fontSize: 13 }}>Aucune alerte</div>
        )}
        {!loading && alertes.map((alert) => {
          const s = severityStyle[alert.severite] ?? severityStyle.info;
          const isRead = readIds.has(alert.id);
          return (
            <div key={alert.id} style={{ backgroundColor: isRead ? "white" : s.bg, border: `1px solid ${isRead ? "#E5E7EB" : s.border}`, borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, opacity: isRead ? 0.7 : 1 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: isRead ? 500 : 700, color: colors.navy, marginBottom: 4 }}>{alert.titre}</div>
                {alert.message && alert.message !== alert.titre && (
                  <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>{alert.message}</div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, fontWeight: 700, backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{alert.severite}</span>
                  <span style={{ fontSize: 11, color: colors.textMuted }}>{alert.type}</span>
                  <span style={{ fontSize: 12, color: colors.textMuted }}>{fmt(alert.created_at)}</span>
                </div>
              </div>
              {!isRead && <button onClick={() => markRead(alert.id)} style={{ padding: "6px 14px", backgroundColor: colors.bgCard, border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: colors.text, cursor: "pointer" }}>Marquer lu</button>}
              <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: isRead ? "#D1D5DB" : s.dot }} />
            </div>
          );
        })}
      </div>
      <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
    </div>
  );
}

export default function AlertesDistributeur() {
  const { auth } = useAuth();
  const [tab, setTab] = useState("entrepot"); // "entrepot" | "clients" | "notifications"

  return (
    <Layout title="Alertes" subtitle="Stock bas entrepôt, stock bas clients MedOS et notifications de distribution">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      <div style={{ display: "flex", gap: 2, backgroundColor: colors.bgCard, borderRadius: 10, padding: 3, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 20, width: "fit-content" }}>
        {[
          { key: "entrepot", label: "Stock entrepôt" },
          { key: "clients", label: "Stock clients" },
          { key: "notifications", label: "Notifications" },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: "8px 18px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", backgroundColor: tab === t.key ? "#F59E0B" : "transparent", color: tab === t.key ? "white" : "#6B7280" }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "entrepot" && <StockEntrepotTab etablissement_id={auth?.etablissement_id} />}
      {tab === "clients" && <StockClientsTab />}
      {tab === "notifications" && <NotificationsTab />}
    </Layout>
  );
}
