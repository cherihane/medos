/**
 * NotificationsContext — Supabase Realtime pour MedOS
 *
 * Souscrit à :
 *  • commandes INSERT  → notifie le distributeur
 *  • commandes UPDATE  → notifie pharmacie / hôpital (changement de statut)
 *  • alertes   INSERT  → notifie tous les rôles
 *
 * Expose :
 *  { unreadCount, unreadByType, notifications, lastNotif, markAllRead, dismissLast }
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "./AuthContext";

const NotificationsContext = createContext({
  unreadCount: 0,
  unreadByType: { commande: 0, alerte: 0 },
  notifications: [],
  lastNotif: null,
  markAllRead: () => {},
  dismissLast: () => {},
});

const STATUT_LABELS = {
  validee:      "Commande validée par le distributeur",
  en_livraison: "Commande en cours de livraison",
  livree:       "Commande livrée",
  annulee:      "Commande annulée / refusée",
};

export function NotificationsProvider({ children }) {
  const { auth } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [lastNotif, setLastNotif]         = useState(null);
  const channelsRef = useRef([]);
  const dismissTimer = useRef(null);

  // Ajoute une notification et déclenche l'auto-dismiss du toast après 6 s
  const push = useCallback((notif) => {
    const n = { ...notif, id: Date.now() + Math.random(), ts: Date.now(), read: false };
    setNotifications((prev) => [n, ...prev].slice(0, 50));
    setLastNotif(n);
    clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => setLastNotif(null), 6000);
  }, []);

  useEffect(() => {
    if (!auth) {
      setNotifications([]);
      setLastNotif(null);
      return;
    }

    // Nettoyage des canaux précédents
    channelsRef.current.forEach((ch) => supabase.removeChannel(ch));
    channelsRef.current = [];

    // ── Canal commandes ──────────────────────────────────────────────────────
    const cmdCh = supabase
      .channel(`medos:commandes:${auth.role}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "commandes" },
        (p) => {
          if (auth.role !== "distributeur") return;
          push({
            type: "commande",
            title: "Nouvelle commande reçue",
            message: `Réf. ${p.new.reference || p.new.id?.slice(0, 8).toUpperCase()}`,
            navPath: "/distributeur/dashboard",
            severite: "info",
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "commandes" },
        (p) => {
          if (auth.role !== "pharmacie" && auth.role !== "hopital") return;
          const title = STATUT_LABELS[p.new.statut];
          if (!title) return;
          push({
            type: "commande",
            title,
            message: `Réf. ${p.new.reference || p.new.id?.slice(0, 8).toUpperCase()}`,
            navPath: `/${auth.role}/fournisseurs`,
            severite: p.new.statut === "annulee" ? "critique" : "info",
            statut: p.new.statut,
          });
        }
      )
      .subscribe();

    // ── Canal alertes ────────────────────────────────────────────────────────
    const altCh = supabase
      .channel(`medos:alertes:${auth.role}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alertes" },
        (p) => {
          push({
            type: "alerte",
            title: p.new.titre || "Nouvelle alerte stock",
            message: p.new.message || "",
            severite: p.new.severite || "info",
            navPath: `/${auth.role}/alertes`,
          });
        }
      )
      .subscribe();

    channelsRef.current = [cmdCh, altCh];

    return () => {
      channelsRef.current.forEach((ch) => supabase.removeChannel(ch));
      channelsRef.current = [];
      clearTimeout(dismissTimer.current);
    };
  }, [auth, push]);

  const markAllRead = useCallback(() =>
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true }))), []);

  const dismissLast = useCallback(() => {
    clearTimeout(dismissTimer.current);
    setLastNotif(null);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const unreadByType = {
    commande: notifications.filter((n) => !n.read && n.type === "commande").length,
    alerte:   notifications.filter((n) => !n.read && n.type === "alerte").length,
  };

  return (
    <NotificationsContext.Provider
      value={{ unreadCount, unreadByType, notifications, lastNotif, markAllRead, dismissLast }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
