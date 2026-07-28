/**
 * AccesElargiContext — rôles de secours + accès élargi en urgence (hôpital).
 *
 * Contexte INDÉPENDANT d'AuthContext.jsx : ne touche à AUCUNE de ses fonctions
 * protégées (setLoading/buildAuthBase/enrichWithEtablissement/mountedRef/
 * getSession/onAuthStateChange). Il consomme uniquement `auth` déjà construit
 * par ailleurs (même règle que le heartbeat de Layout.jsx) et ajoute, en plus,
 * un accès temporaire à des pages normalement hors du rôle habituel.
 *
 * Pas de tâche planifiée (cron) côté serveur dans ce projet : l'octroi
 * automatique après le délai est donc réévalué PARESSEUSEMENT par ce contexte
 * (toutes les POLL_MS), sur n'importe quel client hôpital connecté de
 * l'établissement — pas à l'instant exact où le délai expire. Limitation
 * assumée et documentée, pas un vrai ordonnanceur.
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient";
import { useAuth, NAV_INTERNE } from "./AuthContext";
import {
  fetchDemandeActive,
  fetchDemandesAcces,
  insertDemandeAcces,
  approuverDemandeAcces,
  refuserDemandeAcces,
  marquerRevueFaite,
  verifierEtAccorderAutomatique,
  insertJournalAccesElargi,
} from "../hooks/useMutations";

const AccesElargiContext = createContext({
  demandeActive: null,
  demandes: [],
  mesRolesSecours: [],
  delaiMinutes: 15,
  estDirection: false,
  loading: false,
  pagesSupplementaires: [],
  demander: async () => {},
  approuver: async () => {},
  refuser: async () => {},
  marquerRevue: async () => {},
  logAcces: () => {},
  refresh: async () => {},
});

const POLL_MS = 30 * 1000;

export function AccesElargiProvider({ children }) {
  const { auth } = useAuth();
  const [demandeActive, setDemandeActive] = useState(null);
  const [demandes, setDemandes] = useState([]);
  const [mesRolesSecours, setMesRolesSecours] = useState([]);
  const [delaiMinutes, setDelaiMinutes] = useState(15);
  const [loading, setLoading] = useState(false);
  const demandeActiveRef = useRef(null);

  const estHopital = auth?.role === "hopital";
  const etabId = estHopital ? auth?.etablissement_id ?? null : null;
  const email = auth?.user?.email ?? null;
  const roleInterne = auth?.role_interne ?? null;
  const estDirection = estHopital && (!roleInterne || roleInterne === "Directeur");

  const refresh = useCallback(async () => {
    if (!etabId || !email) {
      setDemandeActive(null);
      setDemandes([]);
      setMesRolesSecours([]);
      return;
    }
    setLoading(true);
    try {
      const { data: etab } = await supabase
        .from("etablissements")
        .select("delai_acces_elargi_minutes")
        .eq("id", etabId)
        .single();
      const delai = etab?.delai_acces_elargi_minutes ?? 15;
      setDelaiMinutes(delai);

      // Octroi automatique paresseux — évalué à chaque rafraîchissement, sur
      // n'importe quel client hôpital connecté de cet établissement.
      await verifierEtAccorderAutomatique(etabId, delai).catch(() => {});

      const [active, mine, all] = await Promise.all([
        fetchDemandeActive(etabId, email),
        supabase.from("membres_personnel").select("roles_secours").eq("etablissement_id", etabId).eq("email", email).maybeSingle(),
        // RLS scope déjà à l'établissement (mes_etablissements()) — la liste
        // complète est chargée pour tous, le widget décide ce qu'il affiche
        // selon le rôle (Direction voit tout + approuve, le reste ne voit que
        // ses propres demandes), même approche que les autres pages hôpital
        // (contrôle au niveau composant, pas au niveau RLS).
        fetchDemandesAcces(etabId),
      ]);
      setDemandeActive(active);
      demandeActiveRef.current = active;
      setMesRolesSecours(mine?.data?.roles_secours ?? []);
      setDemandes(all);
    } finally {
      setLoading(false);
    }
  }, [etabId, email, estDirection]);

  useEffect(() => {
    refresh();
    if (!etabId) return;
    const interval = setInterval(refresh, POLL_MS);
    return () => clearInterval(interval);
  }, [refresh, etabId]);

  useEffect(() => {
    if (!etabId) return;
    const ch = supabase
      .channel(`medos:acces-elargi:${etabId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "demandes_acces_elargi", filter: `etablissement_id=eq.${etabId}` },
        () => { refresh(); }
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [etabId, refresh]);

  const demander = useCallback(async (role_demande, motif) => {
    if (!etabId || !email) throw new Error("Session invalide.");
    if (!role_demande) throw new Error("Sélectionnez un rôle.");
    if (!motif || !motif.trim()) throw new Error("Le motif est obligatoire.");
    const nouvelle = await insertDemandeAcces({
      etablissement_id: etabId, demandeur_email: email,
      role_actuel: roleInterne, role_demande, motif: motif.trim(),
    });
    try {
      const { data: etab } = await supabase.from("etablissements").select("email, nom").eq("id", etabId).single();
      if (etab?.email) {
        const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
  <div style="background:#0F172A;padding:20px 32px"><p style="color:white;font-size:18px;font-weight:700;margin:0">MedOS</p></div>
  <div style="padding:24px 32px">
    <h2 style="color:#B91C1C;font-size:17px;margin:0 0 12px">Demande d'accès élargi</h2>
    <p style="font-size:14px;color:#111827"><strong>${email}</strong> demande un accès élargi vers le rôle <strong>${role_demande}</strong>.</p>
    <p style="font-size:14px;color:#111827"><strong>Motif :</strong> ${motif.trim()}</p>
    <p style="font-size:13px;color:#6B7280">Si vous ne répondez pas sous ${delaiMinutes} minutes, l'accès sera accordé automatiquement pour une durée limitée, et une revue restera obligatoire de votre côté.</p>
    <p style="font-size:13px;color:#6B7280">Connectez-vous à MedOS pour approuver ou refuser cette demande.</p>
  </div>
  <div style="background:#F8FAFC;padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center"><p style="font-size:12px;color:#9CA3AF;margin:0">MedOS</p></div>
</div>`;
        await supabase.functions.invoke("send-app-email", {
          body: { to: etab.email, subject: `MedOS — Demande d'accès élargi : ${email}`, html },
        });
      }
    } catch { /* best-effort : la demande reste tracée même si l'email échoue */ }
    await refresh();
    return nouvelle;
  }, [etabId, email, roleInterne, delaiMinutes, refresh]);

  const approuver = useCallback(async (id, duree_heures) => {
    await approuverDemandeAcces(id, { decide_par: email, duree_heures });
    await refresh();
  }, [email, refresh]);

  const refuser = useCallback(async (id) => {
    await refuserDemandeAcces(id, email);
    await refresh();
  }, [email, refresh]);

  const marquerRevue = useCallback(async (id) => {
    await marquerRevueFaite(id, email);
    await refresh();
  }, [email, refresh]);

  const logAcces = useCallback((page) => {
    const active = demandeActiveRef.current;
    if (!active || !etabId || !email) return;
    insertJournalAccesElargi({ etablissement_id: etabId, demande_id: active.id, utilisateur_email: email, page_accedee: page }).catch(() => {});
  }, [etabId, email]);

  const pagesDejaAutorisees = new Set((auth?.nav ?? []).map((i) => i.path));
  const pagesSupplementaires = demandeActive
    ? (NAV_INTERNE.hopital?.[demandeActive.role_demande] ?? []).filter((p) => !pagesDejaAutorisees.has(p))
    : [];

  return (
    <AccesElargiContext.Provider
      value={{
        demandeActive, demandes, mesRolesSecours, delaiMinutes, estDirection,
        loading, pagesSupplementaires, demander, approuver, refuser, marquerRevue, logAcces, refresh,
      }}
    >
      {children}
    </AccesElargiContext.Provider>
  );
}

export function useAccesElargi() {
  return useContext(AccesElargiContext);
}
