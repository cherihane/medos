/**
 * OfflineIndicator — indicateur permanent d'état de connexion, visible sur
 * tous les écrans (monté une seule fois dans Layout.jsx). Trois états :
 *  - hors ligne : bandeau rouge fixe
 *  - en ligne, synchronisation en cours ou en attente d'erreur/conflit : bandeau ambre
 *  - en ligne, rien en attente : petite pastille verte discrète, en haut à droite
 */
import { useState } from "react";
import { useSyncQueue } from "../context/SyncContext";
import { colors } from "../theme";

export default function OfflineIndicator() {
  const sync = useSyncQueue();
  const [expanded, setExpanded] = useState(false);
  if (!sync) return null;

  const { online, pendingCount, conflicts, errors, syncing, syncNow } = sync;
  const hasAttention = pendingCount > 0 || conflicts.length > 0 || errors.length > 0;

  if (online && !hasAttention) {
    return (
      <div
        title="Connecté — toutes les données sont synchronisées"
        style={{
          position: "fixed", top: 10, right: 10, zIndex: 2000,
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 11, color: colors.textSecondary, background: "rgba(255,255,255,0.9)",
          padding: "3px 8px", borderRadius: 20, border: `1px solid ${colors.border}`,
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: colors.success, display: "inline-block" }} />
        En ligne
      </div>
    );
  }

  const bg = online ? colors.warningLight : colors.errorLight;
  const border = online ? colors.warningBorder : colors.errorBorder;
  const dot = online ? colors.warning : colors.error;

  return (
    <div
      style={{
        position: "fixed", top: 10, right: 10, zIndex: 2000,
        maxWidth: expanded ? 360 : 280,
        background: bg, border: `1.5px solid ${border}`, borderRadius: 10,
        padding: "8px 12px", boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
        cursor: hasAttention ? "pointer" : "default", fontSize: 12,
      }}
      onClick={() => hasAttention && setExpanded((e) => !e)}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, display: "inline-block", flexShrink: 0 }} />
        <span style={{ fontWeight: 700, color: colors.text }}>
          {!online ? "Hors ligne" : syncing ? "Synchronisation…" : "En ligne"}
        </span>
        {pendingCount > 0 && (
          <span style={{ background: dot, color: "white", borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>
            {pendingCount}
          </span>
        )}
      </div>

      {!online && (
        <div style={{ marginTop: 4, color: colors.textSecondary, lineHeight: 1.4 }}>
          Vos actions sont enregistrées localement et seront synchronisées dès le retour du réseau.
        </div>
      )}

      {conflicts.length > 0 && (
        <div style={{ marginTop: 4, color: colors.errorDark, fontWeight: 600 }}>
          {conflicts.length} conflit(s) à résoudre
        </div>
      )}
      {errors.length > 0 && (
        <div style={{ marginTop: 4, color: colors.errorDark, fontWeight: 600 }}>
          {errors.length} action(s) en échec — voir Paramètres › Synchronisation
        </div>
      )}

      {expanded && hasAttention && (
        <div style={{ marginTop: 8, borderTop: `1px solid ${border}`, paddingTop: 8, display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflowY: "auto" }}>
          {sync.queue.map((item) => (
            <div key={item.id} style={{ fontSize: 11, color: colors.textSecondary }}>
              <span style={{
                display: "inline-block", width: 6, height: 6, borderRadius: "50%", marginRight: 6,
                background: item.status === "error" ? colors.error : item.status === "conflict" ? colors.warning : colors.textSecondary,
              }} />
              {item.description}
            </div>
          ))}
          {online && (
            <button
              onClick={(e) => { e.stopPropagation(); syncNow(); }}
              disabled={syncing}
              style={{ marginTop: 4, padding: "5px 10px", fontSize: 11, fontWeight: 700, borderRadius: 6, border: `1px solid ${colors.primary}`, background: "white", color: colors.primary, cursor: syncing ? "wait" : "pointer" }}
            >
              {syncing ? "Synchronisation…" : "Synchroniser maintenant"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
