/**
 * Transferts — Transfert de patient entre établissements hospitaliers
 * (référé d'un hôpital vers un autre — pas la redistribution de stock, voir
 * Réseau.jsx pour ça, mécanisme distinct).
 */
import { colors } from "../../theme";
import { useState, useEffect, useCallback } from "react";
import Layout from "../../components/Layout";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../supabaseClient";
import { fetchTransfertsPatients, updateStatutTransfertPatient, admettrePatientTransfert, ajouterNotificationTransfert } from "../../hooks/useMutations";
import { imprimerFicheTransfertExterne } from "../../utils/ficheTransfertExterne";

// Email à l'établissement d'ORIGINE quand la destination accepte/refuse — le
// temps réel couvre déjà l'écran ouvert, l'email couvre le cas où personne
// ne regarde l'écran au moment de la décision. Best-effort, jamais bloquant,
// toujours tracé (ajouterNotificationTransfert) pour audit.
async function notifierReponseTransfert(t, accepte) {
  try {
    const { data: origineEtab } = await supabase.from("etablissements").select("email").eq("id", t.etablissement_origine_id).maybeSingle();
    if (!origineEtab?.email) {
      await ajouterNotificationTransfert(t.id, { evenement: accepte ? "accepte" : "refuse", destinataire: null, statut: "echec", erreur: "Établissement origine sans email." });
      return;
    }
    const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:${accepte ? "#16A34A" : "#DC2626"};padding:24px 32px;border-radius:8px 8px 0 0"><h1 style="color:white;font-size:18px;margin:0">Transfert ${accepte ? "accepté" : "refusé"}</h1></div>
  <div style="padding:24px 32px;border:1px solid #e5e7eb;border-top:none">
    <p style="font-size:14px;color:#374151"><strong>${t.etablissement_destination_nom ?? "L'établissement destinataire"}</strong> a ${accepte ? "accepté" : "refusé"} le transfert de <strong>${t.patient_prenom} ${t.patient_nom}</strong>.</p>
    <p style="font-size:13px;color:#374151">Connectez-vous à MedOS (Transferts patients) pour la suite.</p>
  </div>
  <div style="background:#F8FAFC;padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center"><p style="font-size:12px;color:#9CA3AF;margin:0">MedOS</p></div>
</div>`;
    const { error } = await supabase.functions.invoke("send-app-email", {
      body: { to: origineEtab.email, subject: `MedOS — Transfert ${accepte ? "accepté" : "refusé"} : ${t.patient_prenom} ${t.patient_nom}`, html },
    });
    await ajouterNotificationTransfert(t.id, {
      evenement: accepte ? "accepte" : "refuse", destinataire: origineEtab.email,
      statut: error ? "echec" : "envoye", erreur: error ? error.message : null,
    });
  } catch (e) {
    await ajouterNotificationTransfert(t.id, { evenement: accepte ? "accepte" : "refuse", destinataire: null, statut: "echec", erreur: e.message }).catch(() => {});
  }
}

// Email à l'établissement de DESTINATION quand l'origine annule un transfert
// proposé — sans ça, la destination peut préparer un lit/du personnel pour un
// patient qui ne viendra jamais, sans jamais être prévenue si elle n'a pas
// l'écran ouvert (même logique que notifierReponseTransfert ci-dessus).
async function notifierAnnulationTransfert(t) {
  try {
    const { data: destEtab } = await supabase.from("etablissements").select("email").eq("id", t.etablissement_destination_id).maybeSingle();
    if (!destEtab?.email) {
      await ajouterNotificationTransfert(t.id, { evenement: "annule", destinataire: null, statut: "echec", erreur: "Établissement destination sans email." });
      return;
    }
    const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#6B7280;padding:24px 32px;border-radius:8px 8px 0 0"><h1 style="color:white;font-size:18px;margin:0">Transfert annulé</h1></div>
  <div style="padding:24px 32px;border:1px solid #e5e7eb;border-top:none">
    <p style="font-size:14px;color:#374151"><strong>${t.etablissement_origine_nom ?? "L'établissement d'origine"}</strong> a annulé le transfert de <strong>${t.patient_prenom} ${t.patient_nom}</strong>.</p>
    <p style="font-size:13px;color:#374151">Aucune action n'est requise de votre part pour ce patient.</p>
  </div>
  <div style="background:#F8FAFC;padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center"><p style="font-size:12px;color:#9CA3AF;margin:0">MedOS</p></div>
</div>`;
    const { error } = await supabase.functions.invoke("send-app-email", {
      body: { to: destEtab.email, subject: `MedOS — Transfert annulé : ${t.patient_prenom} ${t.patient_nom}`, html },
    });
    await ajouterNotificationTransfert(t.id, {
      evenement: "annule", destinataire: destEtab.email,
      statut: error ? "echec" : "envoye", erreur: error ? error.message : null,
    });
  } catch (e) {
    await ajouterNotificationTransfert(t.id, { evenement: "annule", destinataire: null, statut: "echec", erreur: e.message }).catch(() => {});
  }
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
function age(d) {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d)) / (365.25 * 864e5));
}

const STATUT_LABEL = {
  propose:  { label: "Proposé",  color: "#D97706", bg: "#FFFBEB" },
  accepte:  { label: "Accepté",  color: "#2563EB", bg: "#EFF6FF" },
  refuse:   { label: "Refusé",   color: "#DC2626", bg: "#FEF2F2" },
  en_cours: { label: "En cours", color: "#7C3AED", bg: "#F5F3FF" },
  termine:  { label: "Terminé",  color: "#16A34A", bg: "#DCFCE7" },
  annule:   { label: "Annulé",   color: "#6B7280", bg: "#F3F4F6" },
  emis:     { label: "Émis (hors MedOS)", color: "#0369A1", bg: "#F0F9FF" },
};

function StatutBadge({ statut }) {
  const s = STATUT_LABEL[statut] ?? STATUT_LABEL.propose;
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 10, backgroundColor: s.bg, color: s.color, whiteSpace: "nowrap" }}>{s.label}</span>;
}

function UrgenceBadge({ urgence }) {
  if (urgence !== "urgente") return null;
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 10, backgroundColor: "#FEF2F2", color: "#DC2626" }}>Urgent</span>;
}

function ContexteClinique({ ctx }) {
  if (!ctx) return null;
  const dcr = ctx.dernier_compte_rendu;
  return (
    <div style={{ padding: "12px 14px", backgroundColor: "#F8FAFC", borderRadius: 10, border: "1px solid var(--border-light)", marginTop: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: colors.textSecondary, textTransform: "uppercase", marginBottom: 8 }}>Contexte clinique transmis</div>
      <div style={{ fontSize: 12, color: colors.text, lineHeight: 1.7 }}>
        <div><span style={{ fontWeight: 600 }}>Antécédents : </span>{(ctx.antecedents ?? []).join(", ") || "aucun connu"}</div>
        <div><span style={{ fontWeight: 600 }}>Allergies : </span>{(ctx.allergies ?? []).join(", ") || "aucune connue"}</div>
        <div><span style={{ fontWeight: 600 }}>Groupe sanguin : </span>{ctx.groupe_sanguin || "non renseigné"}</div>
        {dcr && (
          <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--border-light)" }}>
            <div style={{ fontWeight: 600 }}>Dernier compte rendu ({fmtDate(dcr.date_consultation)}) :</div>
            {dcr.motif && <div>Motif : {dcr.motif}</div>}
            {dcr.diagnostic && <div>Diagnostic : {dcr.diagnostic}</div>}
            {dcr.traitement && <div>Traitement : {dcr.traitement}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

function TransfertCard({ t, sens, onAction, busy }) {
  const [showCtx, setShowCtx] = useState(false);
  const ageAns = age(t.patient_date_naissance);
  return (
    <div style={{ background: "white", border: t.est_externe ? "1px solid #BAE6FD" : "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: colors.navy }}>
            {t.patient_prenom} {t.patient_nom} {ageAns != null ? `· ${ageAns} ans` : ""} {t.patient_genre ? `· ${t.patient_genre}` : ""}
          </div>
          <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 3 }}>
            {t.est_externe
              ? <>Vers <strong>{t.destination_externe_nom}</strong> <span style={{ color: "#0369A1", fontWeight: 600 }}>(hors MedOS)</span></>
              : sens === "entrant"
                ? <>Depuis <strong>{t.etablissement_origine_nom ?? "établissement inconnu"}</strong></>
                : <>Vers <strong>{t.etablissement_destination_nom ?? "établissement inconnu"}</strong></>}
            {t.medecin_demandeur ? ` · Dr. ${t.medecin_demandeur}` : ""}
          </div>
          {t.est_externe && (t.destination_externe_contact || t.destination_externe_email) && (
            <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
              {t.destination_externe_contact ?? ""}{t.destination_externe_contact && t.destination_externe_email ? " · " : ""}{t.destination_externe_email ?? ""}
            </div>
          )}
          <div style={{ fontSize: 12, color: colors.text, marginTop: 6 }}>{t.motif}</div>
          {t.notes_cliniques && <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 3, fontStyle: "italic" }}>{t.notes_cliniques}</div>}
          <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 6 }}>Demandé le {fmtDateTime(t.date_demande)}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <UrgenceBadge urgence={t.urgence} />
            <StatutBadge statut={t.statut} />
          </div>
        </div>
      </div>

      <button onClick={() => setShowCtx((v) => !v)} style={{ marginTop: 10, background: "none", border: "none", color: "#2563EB", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}>
        {showCtx ? "Masquer le contexte clinique" : "Voir le contexte clinique"}
      </button>
      {showCtx && <ContexteClinique ctx={t.contexte_clinique} />}

      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        {t.est_externe && (
          <button onClick={() => imprimerFicheTransfertExterne({ transfert: t, etabOrigineNom: t.etablissement_origine_nom })} style={{ padding: "7px 14px", background: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            Réimprimer la fiche
          </button>
        )}
        {!t.est_externe && sens === "entrant" && t.statut === "propose" && (
          <>
            <button disabled={busy} onClick={() => onAction(t, "accepter")} style={{ padding: "7px 14px", background: "#16A34A", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: busy ? "wait" : "pointer" }}>Accepter</button>
            <button disabled={busy} onClick={() => onAction(t, "refuser")} style={{ padding: "7px 14px", background: "#FEF2F2", color: "#DC2626", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: busy ? "wait" : "pointer" }}>Refuser</button>
          </>
        )}
        {!t.est_externe && sens === "entrant" && t.statut === "accepte" && (
          <button disabled={busy} onClick={() => onAction(t, "admettre")} style={{ padding: "7px 14px", background: "#7C3AED", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: busy ? "wait" : "pointer" }}>Admettre le patient</button>
        )}
        {!t.est_externe && sens === "entrant" && t.statut === "en_cours" && (
          <button disabled={busy} onClick={() => onAction(t, "cloturer")} style={{ padding: "7px 14px", background: "#0A1628", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: busy ? "wait" : "pointer" }}>Clôturer le transfert</button>
        )}
        {!t.est_externe && sens === "sortant" && t.statut === "propose" && (
          <button disabled={busy} onClick={() => onAction(t, "annuler")} style={{ padding: "7px 14px", background: "#F8FAFC", color: colors.text, border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: busy ? "wait" : "pointer" }}>Annuler</button>
        )}
        {!t.est_externe && t.statut === "en_cours" && t.patient_id_destination && sens === "entrant" && (
          <div style={{ fontSize: 11, color: colors.textMuted, alignSelf: "center" }}>Dossier créé côté destination — n° {t.patient_id_destination.slice(0, 8)}</div>
        )}
      </div>
    </div>
  );
}

export default function Transferts() {
  const { auth } = useAuth();
  const { toasts, success, error: showError } = useToast();
  const etabId = auth?.etablissement_id ?? null;
  const [transferts, setTransferts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    if (!etabId) { setLoading(false); return; }
    const data = await fetchTransfertsPatients(etabId);
    setTransferts(data);
    setLoading(false);
  }, [etabId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!etabId) return;
    const channel = supabase.channel("transferts-patients-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "transferts_patients" }, () => load())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [etabId, load]);

  const entrants = transferts.filter((t) => t.etablissement_destination_id === etabId);
  const sortants  = transferts.filter((t) => t.etablissement_origine_id === etabId);

  const handleAction = async (t, action) => {
    setBusyId(t.id);
    try {
      if (action === "accepter") {
        await updateStatutTransfertPatient(t.id, "accepte");
        notifierReponseTransfert(t, true).catch(() => {}); // best-effort, ne bloque jamais la décision déjà enregistrée
        success("Transfert accepté.");
      }
      else if (action === "refuser") {
        await updateStatutTransfertPatient(t.id, "refuse");
        notifierReponseTransfert(t, false).catch(() => {});
        success("Transfert refusé.");
      }
      else if (action === "annuler") {
        await updateStatutTransfertPatient(t.id, "annule");
        notifierAnnulationTransfert(t).catch(() => {});
        success("Transfert annulé.");
      }
      else if (action === "cloturer") { await updateStatutTransfertPatient(t.id, "termine"); success("Transfert clôturé."); }
      else if (action === "admettre") {
        await admettrePatientTransfert(t, etabId);
        success(`${t.patient_prenom} ${t.patient_nom} admis(e) — dossier créé en continuité.`);
      }
      await load();
    } catch (e) {
      showError("Erreur : " + e.message);
    } finally {
      setBusyId(null);
    }
  };

  const enAttente = entrants.filter((t) => t.statut === "propose").length;

  return (
    <Layout title="Transferts patients" subtitle="Référencement d'un patient vers un autre établissement hospitalier">
      <Toast toasts={toasts} />

      <div className="kpi-row">
        {[
          { label: "Entrants en attente", value: loading ? "…" : enAttente, color: "#D97706" },
          { label: "Entrants (total)",    value: loading ? "…" : entrants.length, color: "#2563EB" },
          { label: "Sortants (total)",    value: loading ? "…" : sortants.length, color: "#7C3AED" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "18px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: colors.navy }}>Transferts entrants</h3>
        {loading && <div style={{ height: 60, backgroundColor: colors.bgSurface, borderRadius: 10 }} />}
        {!loading && entrants.length === 0 && (
          <div style={{ fontSize: 13, color: colors.textMuted, textAlign: "center", padding: 20 }}>Aucun transfert entrant.</div>
        )}
        {!loading && entrants.map((t) => (
          <TransfertCard key={t.id} t={t} sens="entrant" onAction={handleAction} busy={busyId === t.id} />
        ))}
      </div>

      <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginTop: 20 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: colors.navy }}>Transferts sortants</h3>
        {loading && <div style={{ height: 60, backgroundColor: colors.bgSurface, borderRadius: 10 }} />}
        {!loading && sortants.length === 0 && (
          <div style={{ fontSize: 13, color: colors.textMuted, textAlign: "center", padding: 20 }}>
            Aucun transfert sortant. Initiez un transfert depuis le dossier d'un patient (bouton "Transférer").
          </div>
        )}
        {!loading && sortants.map((t) => (
          <TransfertCard key={t.id} t={t} sens="sortant" onAction={handleAction} busy={busyId === t.id} />
        ))}
      </div>
    </Layout>
  );
}
