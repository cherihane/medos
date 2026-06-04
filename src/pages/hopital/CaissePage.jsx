import { colors } from "../../theme";
import { useState, useEffect, useCallback, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import Layout from "../../components/Layout";
import Modal, { Field, Row, ModalFooter, inputStyle, selectStyle } from "../../components/Modal";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useAuth } from "../../context/AuthContext";
import { usePatients } from "../../hooks/useSupabaseData";
import { supabase } from "../../supabaseClient";
import {
  insertFacture, updateFacture,
  fetchTarifsActes, fetchTarifsActesTous, insertTarifActe, updateTarifActe, deleteTarifActe,
  insertJournalCaisse, insertClotureCaisse,
  ouvrirSessionCaisse, fetchSessionActive, fermerSessionCaisse, fetchSessionsHistorique,
  insertPaiement, fetchPaiementsFacture, fetchPaiementsSession,
  genererNumeroRecu, fetchConfigCaisse, upsertConfigCaisse, fetchFacturesAvecPaiements,
} from "../../hooks/useMutations";
import { openDocument, tableHTML, infoGridHTML, signatureRowHTML, fetchEtabFromAuth } from "../../utils/MedOSDocument";

const ACCENT = "#10B981";

const MODES_PAIEMENT = [
  { value: "especes",      label: "Especes" },
  { value: "mtn_momo",     label: "MTN MoMo" },
  { value: "airtel_money", label: "Airtel Money" },
  { value: "orange_money", label: "Orange Money" },
  { value: "cheque",       label: "Cheque" },
  { value: "tiers_payant", label: "Tiers payant" },
];

const MODE_LABEL = {
  especes: "Especes", mtn_momo: "MTN Mobile Money", airtel_money: "Airtel Money",
  orange_money: "Orange Money", cheque: "Cheque", tiers_payant: "Tiers payant",
};

const ACTES_FALLBACK = [
  "Consultation generale", "Consultation specialisee", "Analyse biologique",
  "Radiographie", "Echographie", "Chirurgie mineure", "Accouchement",
  "Hospitalisation (jour)", "Soins infirmiers", "Pansement", "Injection", "Perfusion",
];

const CATEGORIES = [
  { value: "consultation", label: "Consultation" }, { value: "examen", label: "Examen" },
  { value: "medicament", label: "Medicament" }, { value: "chirurgie", label: "Chirurgie" },
  { value: "soins", label: "Soins" }, { value: "autre", label: "Autre" },
];

function fmtDate(iso) { if (!iso) return "—"; return new Date(iso).toLocaleDateString("fr-FR"); }
function fmtHeure(iso) { if (!iso) return "—"; return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }); }
function fmtDateCourte(iso) { if (!iso) return "—"; return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }
function fmtFCFA(n) { return `${Number(n || 0).toLocaleString("fr-FR")} FCFA`; }
function genNumero() { const d = new Date(); return `FAC-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}-${Math.floor(1000+Math.random()*9000)}`; }

function StatusBadge({ statut }) {
  const map = {
    brouillon: { bg: "#F3F4F6", color: "#6B7280",  label: "Brouillon" },
    emise:     { bg: "#EFF6FF", color: "#2563EB",  label: "Emise" },
    acompte:   { bg: "#FFF7ED", color: "#C2410C",  label: "Acompte" },
    payee:     { bg: "#DCFCE7", color: "#16A34A",  label: "Payee" },
    annulee:   { bg: "#FEF2F2", color: "#DC2626",  label: "Annulee" },
  };
  const s = map[statut] ?? map.brouillon;
  return <span style={{ padding: "3px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700, backgroundColor: s.bg, color: s.color }}>{s.label}</span>;
}

function LineResume({ l, v, vc, bold }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 13 }}>
      <span style={{ color: colors.textSecondary, fontWeight: bold ? 700 : 400 }}>{l}</span>
      <span style={{ color: vc ?? colors.navy, fontWeight: bold ? 800 : 600 }}>{v}</span>
    </div>
  );
}

// ── Modal encaissement ─────────────────────────────────────────────────────────
function ModalEncaissement({ facture, patient, session, etabId, auth, config, onClose, onSaved }) {
  const [paiementsExistants, setPaiementsExistants] = useState([]);
  const [taux, setTaux]           = useState(facture.taux_couverture ?? 0);
  const [typeCouv, setTypeCouv]   = useState(facture.type_couverture ?? "");
  const [montantSaisi, setMontantSaisi] = useState("");
  const [mode, setMode]           = useState("especes");
  const [reference, setReference] = useState("");
  const [saving, setSaving]       = useState(false);
  const [erreur, setErreur]       = useState(null);

  useEffect(() => { fetchPaiementsFacture(facture.id).then(setPaiementsExistants); }, [facture.id]);

  const sousTot       = facture.sous_total ?? 0;
  const montCouv      = Math.round(sousTot * (Number(taux) || 0) / 100);
  const tvaMont       = config?.tva_active && config?.tva_taux > 0 ? Math.round((sousTot - montCouv) * Number(config.tva_taux) / 100) : 0;
  const totalAPayer   = sousTot - montCouv + tvaMont;
  const dejaPayé      = paiementsExistants.reduce((s, p) => s + (p.montant ?? 0), 0);
  const resteDu       = Math.max(0, totalAPayer - dejaPayé);
  const montEnc       = Number(montantSaisi) || 0;
  const monnaieR      = Math.max(0, montEnc - resteDu);
  const estAcompte    = montEnc > 0 && montEnc < resteDu;

  const assureurs = config?.assureurs ?? [];
  const typesCouvOpts = [
    { value: "", label: "-- Aucune --" },
    { value: "assurance", label: "Assurance" }, { value: "cnss", label: "CNSS" },
    { value: "mutuelle", label: "Mutuelle" },
    ...assureurs.map((a) => ({ value: a.nom, label: a.nom })),
  ];

  const handleSubmit = async () => {
    if (!montEnc || montEnc <= 0) { setErreur("Saisissez un montant."); return; }
    setSaving(true); setErreur(null);
    try {
      const numeroRecu  = await genererNumeroRecu(etabId);
      const montantPaye = Math.min(montEnc, resteDu);

      await insertPaiement({
        facture_id: facture.id, etablissement_id: etabId,
        session_id: session?.id ?? null,
        caissier_email: auth?.user?.email ?? "",
        montant: montantPaye, montant_recu: montEnc,
        monnaie_rendue: monnaieR, mode_paiement: mode,
        reference_paiement: reference || null, numero_recu: numeroRecu,
      });

      if (montEnc >= resteDu) {
        await updateFacture(facture.id, {
          statut: "payee", mode_paiement: mode, date_paiement: new Date().toISOString(),
          taux_couverture: Number(taux), type_couverture: typeCouv || null,
          montant_couverture: montCouv, reste_patient: 0,
        });
      } else {
        await updateFacture(facture.id, {
          statut: "acompte", taux_couverture: Number(taux), type_couverture: typeCouv || null,
          montant_couverture: montCouv, reste_patient: resteDu - montantPaye,
        });
      }

      await insertJournalCaisse({
        etablissement_id: etabId, caissier_email: auth?.user?.email ?? "",
        montant_total: montantPaye, montant_recu: montEnc, monnaie_rendue: monnaieR,
        mode_paiement: mode, nb_articles: (facture.lignes ?? []).length, detail: facture.numero_facture,
      });

      const etab = await fetchEtabFromAuth(auth);
      const lignesRows = (facture.lignes ?? []).map((l) => [l.libelle ?? "—", String(l.quantite ?? 1), fmtFCFA(l.prix_unitaire ?? 0), fmtFCFA((l.quantite ?? 1) * (l.prix_unitaire ?? 0))]);
      openDocument({
        titre: `Recu de paiement ${numeroRecu}`,
        sousTitre: `${new Date().toLocaleString("fr-FR")} — ${MODE_LABEL[mode] ?? mode}`,
        etablissement: etab,
        sections: [
          { titre: "Patient", html: infoGridHTML([
            { label: "Nom",      value: patient ? `${patient.prenom} ${patient.nom}` : "—" },
            { label: "Facture",  value: facture.numero_facture },
            { label: "Date",     value: fmtDate(facture.date_facture) },
            { label: "Caissier", value: session?.caissier_nom ?? auth?.user?.email ?? "—" },
          ]) },
          { titre: "Detail des prestations", html: tableHTML(["Prestation","Qte","Prix unit.","Total"], lignesRows, { alignRight: [1,2,3] }) },
          { titre: "Recapitulatif", html: `<div style="padding:14px 18px;background:#F8FAFC;border-radius:8px;font-size:13px">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>Sous-total</span><strong>${fmtFCFA(sousTot)}</strong></div>
            ${Number(taux) > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:6px;color:#16A34A"><span>Prise en charge ${typeCouv} (${taux}%)</span><strong>- ${fmtFCFA(montCouv)}</strong></div>` : ""}
            ${tvaMont > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:6px;color:#6B7280"><span>TVA (${config.tva_taux}%)</span><strong>${fmtFCFA(tvaMont)}</strong></div>` : ""}
            <div style="display:flex;justify-content:space-between;border-top:2px solid #E5E7EB;padding-top:10px;margin-top:6px"><strong>Montant paye ce reglement</strong><strong style="color:#16A34A;font-size:16px">${fmtFCFA(montantPaye)}</strong></div>
            ${monnaieR > 0 ? `<div style="display:flex;justify-content:space-between;margin-top:6px;color:#6B7280"><span>Monnaie rendue</span><span>${fmtFCFA(monnaieR)}</span></div>` : ""}
            <div style="display:flex;justify-content:space-between;margin-top:6px"><span>Mode de paiement</span><strong>${MODE_LABEL[mode] ?? mode}</strong></div>
            ${reference ? `<div style="display:flex;justify-content:space-between;margin-top:4px;color:#6B7280"><span>Reference</span><span>${reference}</span></div>` : ""}
            ${config?.mention_legale ? `<div style="margin-top:12px;font-size:11px;color:#9CA3AF">${config.mention_legale}</div>` : ""}
          </div>` },
          { titre: "", html: signatureRowHTML(["Caissier","Cachet de l'etablissement"]) },
        ],
      });
      onSaved(); onClose();
    } catch (e) { setErreur("Erreur : " + e.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={`Encaissement — ${facture.numero_facture}`} onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <Field label="Prise en charge (%)">
          <input style={inputStyle} type="number" min="0" max="100" value={taux} onChange={(e) => setTaux(e.target.value)} />
        </Field>
        <Field label="Type de couverture">
          <select style={selectStyle} value={typeCouv} onChange={(e) => setTypeCouv(e.target.value)}>
            {typesCouvOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      </div>

      <div style={{ backgroundColor: colors.bgSurface, borderRadius: 10, padding: "12px 16px", marginBottom: 14 }}>
        <LineResume l="Sous-total actes" v={fmtFCFA(sousTot)} />
        {Number(taux) > 0 && <LineResume l={`Prise en charge (${taux}%)`} v={`- ${fmtFCFA(montCouv)}`} vc={ACCENT} />}
        {tvaMont > 0 && <LineResume l={`TVA (${config.tva_taux}%)`} v={fmtFCFA(tvaMont)} vc="#6B7280" />}
        <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 8, marginTop: 6 }}>
          <LineResume l="TOTAL A PAYER" v={fmtFCFA(totalAPayer)} bold />
          {dejaPayé > 0 && <LineResume l="Deja paye" v={`- ${fmtFCFA(dejaPayé)}`} vc="#6B7280" />}
          <LineResume l="RESTE DU" v={fmtFCFA(resteDu)} vc="#DC2626" bold />
        </div>
      </div>

      <Field label="Montant encaisse (FCFA)">
        <input style={{ ...inputStyle, fontSize: 18, fontWeight: 700 }} type="number" min="0"
          value={montantSaisi} onChange={(e) => setMontantSaisi(e.target.value)} placeholder="0" autoFocus />
      </Field>

      {montEnc > 0 && (
        <div style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 10, fontSize: 13, fontWeight: 600,
          backgroundColor: monnaieR > 0 ? "#DCFCE7" : estAcompte ? "#FFF7ED" : "#EFF6FF",
          color: monnaieR > 0 ? "#16A34A" : estAcompte ? "#C2410C" : "#2563EB" }}>
          {monnaieR > 0 && `Monnaie a rendre : ${fmtFCFA(monnaieR)}`}
          {estAcompte && `Paiement partiel — il restera ${fmtFCFA(resteDu - montEnc)} a payer`}
          {!monnaieR && !estAcompte && montEnc === resteDu && "Montant exact — aucune monnaie"}
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: colors.textSecondary, textTransform: "uppercase", marginBottom: 8 }}>Mode de paiement</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {MODES_PAIEMENT.map((m) => (
            <button key={m.value} onClick={() => setMode(m.value)} style={{
              padding: "6px 14px", borderRadius: 8,
              border: `1.5px solid ${mode === m.value ? ACCENT : colors.border}`,
              backgroundColor: mode === m.value ? ACCENT : colors.bgCard,
              color: mode === m.value ? "white" : colors.text,
              fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>{m.label}</button>
          ))}
        </div>
      </div>

      {mode !== "especes" && mode !== "tiers_payant" && (
        <Field label="Reference (N° transaction / cheque)">
          <input style={inputStyle} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ex: MTN-20260604-XXXX" />
        </Field>
      )}

      {erreur && <div style={{ padding: "9px 13px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 12, color: "#DC2626", marginBottom: 10 }}>{erreur}</div>}
      <ModalFooter onCancel={onClose} onSubmit={handleSubmit} submitLabel="Valider et imprimer le recu" saving={saving} />
    </Modal>
  );
}

// ── Modal fermeture caisse ─────────────────────────────────────────────────────
function ModalFermetureCaisse({ session, paiements, etabId, auth, onClose, onSaved }) {
  const totalEspeces     = paiements.filter((p) => p.mode_paiement === "especes").reduce((s, p) => s + p.montant, 0);
  const totalMobile      = paiements.filter((p) => ["mtn_momo","airtel_money","orange_money"].includes(p.mode_paiement)).reduce((s, p) => s + p.montant, 0);
  const totalCheque      = paiements.filter((p) => p.mode_paiement === "cheque").reduce((s, p) => s + p.montant, 0);
  const totalTiers       = paiements.filter((p) => p.mode_paiement === "tiers_payant").reduce((s, p) => s + p.montant, 0);
  const totalTheorique   = (session.fond_initial ?? 0) + totalEspeces + totalMobile + totalCheque + totalTiers;

  const [physique, setPhysique] = useState("");
  const [notes, setNotes]       = useState("");
  const [saving, setSaving]     = useState(false);

  const physiqueN = Number(physique) || 0;
  const ecart     = physique !== "" ? physiqueN - totalTheorique : null;
  const hasEcart  = ecart !== null && ecart !== 0;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const ecartFinal = ecart ?? 0;
      await fermerSessionCaisse(session.id, {
        total_especes: totalEspeces, total_mobile_money: totalMobile,
        total_cheque: totalCheque, total_tiers_payant: totalTiers,
        total_theorique: totalTheorique,
        total_physique_compte: physique !== "" ? physiqueN : null,
        ecart: ecartFinal, notes_fermeture: notes || null,
      });
      await insertClotureCaisse({
        etablissement_id: etabId, date_journee: today,
        total_encaisse: totalTheorique - (session.fond_initial ?? 0),
        nb_transactions: paiements.length,
        gerant_email: auth?.user?.email ?? "",
      });

      const etab = await fetchEtabFromAuth(auth);
      const resume = [
        ["Fond initial declare",  fmtFCFA(session.fond_initial ?? 0)],
        ["Encaisse especes",      fmtFCFA(totalEspeces)],
        ["Encaisse mobile money", fmtFCFA(totalMobile)],
        ["Encaisse cheques",      fmtFCFA(totalCheque)],
        ["Encaisse tiers payant", fmtFCFA(totalTiers)],
        ["TOTAL THEORIQUE",       fmtFCFA(totalTheorique)],
        ...(physique !== "" ? [["Total physique compte", fmtFCFA(physiqueN)], ["ECART", `${ecartFinal >= 0 ? "+" : ""}${fmtFCFA(ecartFinal)}`]] : []),
      ];
      const lignesTx = paiements.map((p) => [
        fmtHeure(p.created_at),
        p.factures_hopital?.numero_facture ?? "—",
        p.factures_hopital?.patients ? `${p.factures_hopital.patients.prenom} ${p.factures_hopital.patients.nom}` : "—",
        MODE_LABEL[p.mode_paiement] ?? p.mode_paiement,
        fmtFCFA(p.montant), p.numero_recu,
      ]);
      openDocument({
        titre: `Arrete de caisse — ${new Date().toLocaleDateString("fr-FR")}`,
        sousTitre: `Caissier : ${session.caissier_nom ?? session.caissier_email} — ${paiements.length} transactions`,
        etablissement: etab,
        sections: [
          { titre: "Resume par mode de paiement", html: tableHTML(["Mode / Ligne","Montant"], resume) },
          ...(lignesTx.length > 0 ? [{ titre: "Detail des transactions", html: tableHTML(["Heure","Facture","Patient","Mode","Montant","Recu"], lignesTx) }] : []),
          { titre: "", html: signatureRowHTML(["Caissier","Responsable financier"]) },
        ],
      });
      onSaved(); onClose();
    } catch (e) { alert("Erreur : " + e.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={`Arrete de caisse — ${new Date().toLocaleDateString("fr-FR")}`} onClose={onClose}>
      <div style={{ backgroundColor: colors.bgSurface, borderRadius: 10, padding: "12px 16px", marginBottom: 14 }}>
        <LineResume l="Fond initial declare"  v={fmtFCFA(session.fond_initial ?? 0)} />
        <LineResume l="Encaisse especes"      v={fmtFCFA(totalEspeces)} />
        <LineResume l="Encaisse mobile money" v={fmtFCFA(totalMobile)} />
        <LineResume l="Encaisse cheques"      v={fmtFCFA(totalCheque)} />
        <LineResume l="Encaisse tiers payant" v={fmtFCFA(totalTiers)} />
        <div style={{ borderTop: `2px solid ${colors.border}`, paddingTop: 8, marginTop: 6 }}>
          <LineResume l="TOTAL THEORIQUE" v={fmtFCFA(totalTheorique)} bold />
        </div>
      </div>
      <Field label="Total physique compte (FCFA)">
        <input style={{ ...inputStyle, fontSize: 16, fontWeight: 700 }} type="number" min="0"
          value={physique} onChange={(e) => setPhysique(e.target.value)} placeholder="Saisir le total compte en caisse" />
      </Field>
      {ecart !== null && (
        <div style={{ padding: "10px 14px", borderRadius: 8, marginBottom: 12, fontSize: 14, fontWeight: 700,
          backgroundColor: hasEcart ? "#FEF2F2" : "#DCFCE7", color: hasEcart ? "#DC2626" : "#16A34A" }}>
          Ecart : {ecart >= 0 ? "+" : ""}{fmtFCFA(ecart)}
          {hasEcart && "  — Ecart detecte, verifiez les transactions"}
        </div>
      )}
      <Field label="Notes">
        <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 60 }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observations eventuelles..." />
      </Field>
      <ModalFooter onCancel={onClose} onSubmit={handleSubmit} submitLabel="Valider et imprimer l'arrete" saving={saving} />
    </Modal>
  );
}

// ── Onglet 1 — Caisse du jour ──────────────────────────────────────────────────
function OngletCaisseJour({ etabId, auth, config }) {
  const [session, setSession]         = useState(null);
  const [checkDone, setCheckDone]     = useState(false);
  const [fondForm, setFondForm]       = useState({ fond_initial: "", caissier_nom: "" });
  const [opening, setOpening]         = useState(false);
  const [facturesFile, setFacturesFile] = useState([]);
  const [paiements, setPaiements]     = useState([]);
  const [loadingFile, setLoadingFile] = useState(false);
  const [encaisserModal, setEncaisserModal] = useState(null);
  const [fermerModal, setFermerModal] = useState(false);
  const { data: patients }            = usePatients();
  const { toasts, success }           = useToast();
  const email = auth?.user?.email ?? "";

  const checkSession = useCallback(async () => {
    if (!etabId || !email) return;
    const s = await fetchSessionActive(etabId, email);
    setSession(s); setCheckDone(true);
  }, [etabId, email]);

  useEffect(() => { checkSession(); }, [checkSession]);

  const loadData = useCallback(async () => {
    if (!session || !etabId) return;
    setLoadingFile(true);
    const [facs, pays] = await Promise.all([
      fetchFacturesAvecPaiements(etabId),
      fetchPaiementsSession(session.id),
    ]);
    setFacturesFile(facs.filter((f) => ["emise","acompte"].includes(f.statut)));
    setPaiements(pays);
    setLoadingFile(false);
  }, [session, etabId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleOuvrir = async () => {
    if (!fondForm.fond_initial) return alert("Saisissez le fond de caisse.");
    setOpening(true);
    try {
      const s = await ouvrirSessionCaisse({
        etablissement_id: etabId, caissier_email: email,
        caissier_nom: fondForm.caissier_nom || null,
        fond_initial: Number(fondForm.fond_initial),
        date_session: new Date().toISOString().slice(0, 10),
      });
      setSession(s); success("Caisse ouverte");
    } catch (e) { alert("Erreur : " + e.message); }
    finally { setOpening(false); }
  };

  const encaisseJour   = paiements.reduce((s, p) => s + (p.montant ?? 0), 0);
  const totalTheorique = (session?.fond_initial ?? 0) + encaisseJour;

  if (!checkDone) return <div style={{ padding: 40, textAlign: "center", color: colors.textMuted }}>Chargement...</div>;

  if (!session) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
        <Toast toasts={toasts} />
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 16, padding: "36px 44px", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", width: 420, maxWidth: "100%" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: colors.navy, marginBottom: 4 }}>Bonjour, {email}</div>
          <div style={{ fontSize: 13, color: colors.textMuted, marginBottom: 24 }}>Aucune session ouverte aujourd'hui.</div>
          <Field label="Votre nom complet">
            <input style={inputStyle} value={fondForm.caissier_nom} onChange={(e) => setFondForm((f) => ({ ...f, caissier_nom: e.target.value }))} placeholder="Dr. Kamga Jean-Baptiste" />
          </Field>
          <Field label="Fond de caisse initial (FCFA)">
            <input style={{ ...inputStyle, fontSize: 16, fontWeight: 700 }} type="number" min="0"
              value={fondForm.fond_initial} onChange={(e) => setFondForm((f) => ({ ...f, fond_initial: e.target.value }))} placeholder="Ex: 50000" autoFocus />
          </Field>
          <button onClick={handleOuvrir} disabled={opening}
            style={{ width: "100%", padding: "14px", backgroundColor: opening ? "#D1D5DB" : ACCENT, color: "white", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: opening ? "wait" : "pointer", marginTop: 8 }}>
            {opening ? "Ouverture en cours..." : "Ouvrir la caisse"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Toast toasts={toasts} />
      {encaisserModal && (
        <ModalEncaissement
          facture={encaisserModal.facture} patient={encaisserModal.patient}
          session={session} etabId={etabId} auth={auth} config={config}
          onClose={() => setEncaisserModal(null)}
          onSaved={() => { loadData(); success("Paiement enregistre"); }}
        />
      )}
      {fermerModal && (
        <ModalFermetureCaisse
          session={session} paiements={paiements} etabId={etabId} auth={auth}
          onClose={() => setFermerModal(false)}
          onSaved={() => { setSession(null); setFermerModal(false); success("Caisse fermee"); }}
        />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <span style={{ fontSize: 13, color: colors.textSecondary }}>Session ouverte par </span>
          <span style={{ fontWeight: 700, color: colors.navy }}>{session.caissier_nom ?? session.caissier_email}</span>
          <span style={{ fontSize: 12, color: colors.textMuted, marginLeft: 8 }}>{fmtHeure(session.heure_ouverture)}</span>
        </div>
        <button onClick={() => setFermerModal(true)}
          style={{ padding: "7px 18px", backgroundColor: "#FEF2F2", color: "#DC2626", border: "1.5px solid #FCA5A5", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Fermer la caisse
        </button>
      </div>

      <div className="kpi-row" style={{ marginBottom: 20 }}>
        {[
          { label: "Fond initial",     value: fmtFCFA(session.fond_initial), color: "#9CA3AF" },
          { label: "Encaisse du jour", value: fmtFCFA(encaisseJour),         color: ACCENT },
          { label: "Total theorique",  value: fmtFCFA(totalTheorique),       color: "#3B82F6" },
          { label: "Transactions",     value: paiements.length,              color: "#8B5CF6" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: colors.bgCard, borderRadius: 12, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 16 }}>
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: colors.navy }}>Factures a encaisser ({facturesFile.length})</h3>
          {loadingFile && [1,2,3].map((i) => <div key={i} style={{ height: 72, backgroundColor: colors.bgSurface, borderRadius: 10, marginBottom: 8, animation: "pulse 1.5s ease-in-out infinite" }} />)}
          {!loadingFile && facturesFile.length === 0 && <div style={{ textAlign: "center", color: colors.textMuted, padding: 32, fontSize: 13 }}>Aucune facture en attente d'encaissement.</div>}
          {!loadingFile && facturesFile.map((f) => {
            const pat = patients.find((p) => p.id === f.patient_id) ?? f.patients ?? {};
            const dp = (f.paiements_facture ?? []).reduce((s, p) => s + (p.montant ?? 0), 0);
            const rd = Math.max(0, (f.sous_total ?? 0) - (f.montant_couverture ?? 0) - dp);
            return (
              <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", backgroundColor: colors.bgSurface, borderRadius: 10, marginBottom: 8, border: `1px solid ${colors.border}` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: colors.navy }}>{pat.prenom} {pat.nom}</span>
                    <span style={{ fontSize: 11, color: "#3B82F6", fontWeight: 600 }}>{f.numero_facture}</span>
                    {f.statut === "acompte" && <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 8, backgroundColor: "#FFF7ED", color: "#C2410C" }}>Acompte</span>}
                    {f.taux_couverture > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 8, backgroundColor: "#DCFCE7", color: "#16A34A" }}>{f.type_couverture ?? "Couverture"} {f.taux_couverture}%</span>}
                  </div>
                  <div style={{ fontSize: 12, color: colors.textSecondary }}>
                    Sous-total : {fmtFCFA(f.sous_total)}
                    {dp > 0 && <span style={{ color: ACCENT }}> · Deja paye : {fmtFCFA(dp)}</span>}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#DC2626" }}>Reste : {fmtFCFA(rd)}</div>
                </div>
                <button onClick={() => setEncaisserModal({ facture: f, patient: pat })}
                  style={{ padding: "8px 16px", backgroundColor: ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", marginLeft: 12, flexShrink: 0 }}>
                  Encaisser
                </button>
              </div>
            );
          })}
        </div>

        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: colors.navy }}>Journal en temps reel</h3>
          {paiements.length === 0 && <div style={{ fontSize: 12, color: colors.textMuted, textAlign: "center", padding: 24 }}>Aucune transaction dans cette session.</div>}
          {paiements.map((p) => {
            const pat = p.factures_hopital?.patients;
            return (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "9px 0", borderBottom: `1px solid ${colors.borderLight}` }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: colors.navy }}>{pat ? `${pat.prenom} ${pat.nom}` : "—"}</div>
                  <div style={{ fontSize: 11, color: colors.textMuted }}>{fmtHeure(p.created_at)} · {MODE_LABEL[p.mode_paiement] ?? p.mode_paiement} · {p.numero_recu}</div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT, flexShrink: 0, marginLeft: 8 }}>{fmtFCFA(p.montant)}</span>
              </div>
            );
          })}
          {paiements.length > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", fontSize: 14, fontWeight: 800, color: ACCENT }}>
              <span>Total encaisse</span><span>{fmtFCFA(encaisseJour)}</span>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  );
}

// ── Fonctions factures partagées ───────────────────────────────────────────────
async function chargerActesNonFactures(patient_id) {
  const sept = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [cRes, eRes, dRes] = await Promise.all([
    supabase.from("consultations").select("id, service, medecin_nom, heure_fin, motif").eq("patient_id", patient_id).eq("statut", "termine").gte("heure_fin", sept),
    supabase.from("examens").select("id, type_examen, libelle, date_prescription").eq("patient_id", patient_id).eq("statut", "resultat_disponible"),
    supabase.from("dispensations").select("id, quantite, created_at, medicaments(nom)").eq("patient_id", patient_id).gte("created_at", sept),
  ]);
  return [
    ...(cRes.data ?? []).map((c) => ({ id: "c_"+c.id, source: "consultation", categorie: "consultation", libelle: `Consultation — ${c.service}${c.medecin_nom ? " — "+c.medecin_nom : ""}`, date: c.heure_fin })),
    ...(eRes.data ?? []).map((e) => ({ id: "e_"+e.id, source: "examen", categorie: "examen", libelle: `Examen : ${e.type_examen}${e.libelle ? " — "+e.libelle : ""}`, date: e.date_prescription })),
    ...(dRes.data ?? []).map((d) => ({ id: "d_"+d.id, source: "dispensation", categorie: "medicament", libelle: `Medicament : ${d.medicaments?.nom ?? "—"} x${d.quantite}`, date: d.created_at })),
  ];
}

async function imprimerFacture(facture, patients, auth) {
  const patient = patients.find((p) => p.id === facture.patient_id) ?? {};
  const etab = await fetchEtabFromAuth(auth);
  const lignesRows = (facture.lignes ?? []).map((l) => [l.libelle ?? "—", String(l.quantite ?? 1), fmtFCFA(l.prix_unitaire ?? 0), fmtFCFA((l.quantite ?? 1) * (l.prix_unitaire ?? 0))]);
  openDocument({
    titre: `Facture ${facture.numero_facture}`, sousTitre: `Emise le ${fmtDate(facture.date_facture)}`, etablissement: etab,
    sections: [
      { titre: "Patient", html: infoGridHTML([{ label: "Patient", value: `${patient.prenom ?? ""} ${patient.nom ?? ""}` }, { label: "Date", value: fmtDate(facture.date_facture) }, { label: "Statut", value: (facture.statut ?? "").toUpperCase() }]) },
      { titre: "Prestations", html: tableHTML(["Prestation","Qte","Prix unit.","Total"], lignesRows, { alignRight: [1,2,3] }) + `<div style="padding:14px 18px;background:#F8FAFC;border-radius:8px;font-size:13px;margin-top:16px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>Sous-total</span><strong>${fmtFCFA(facture.sous_total ?? 0)}</strong></div>
        ${facture.taux_couverture > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:6px;color:#16A34A"><span>Prise en charge ${facture.type_couverture ?? ""} — ${facture.taux_couverture}%</span><strong>- ${fmtFCFA(facture.montant_couverture ?? 0)}</strong></div>` : ""}
        <div style="display:flex;justify-content:space-between;border-top:2px solid #E5E7EB;padding-top:10px"><strong>Reste a payer</strong><strong style="color:#DC2626">${fmtFCFA(facture.reste_patient ?? facture.sous_total ?? 0)}</strong></div>
      </div>` },
    ],
  });
}

function FactureModal({ patients, etabId, config, onClose, onSaved }) {
  const [patient_id, setPatientId]           = useState("");
  const [filtrePatient, setFiltrePatient]     = useState("");
  const [tarifs, setTarifs]                  = useState([]);
  const [actesNonFactures, setActesNonFactures] = useState([]);
  const [actesCoches, setActesCoches]        = useState({});
  const [loadingActes, setLoadingActes]      = useState(false);
  const [lignes, setLignes]                  = useState([{ libelle: "", quantite: 1, prix_unitaire: 0 }]);
  const [taux, setTaux]                      = useState(0);
  const [typeCouv, setTypeCouv]              = useState("");
  const [notes, setNotes]                    = useState("");
  const [saving, setSaving]                  = useState(false);

  useEffect(() => { fetchTarifsActes(etabId).then(setTarifs); }, [etabId]);

  const handlePatientChange = async (pid) => {
    setPatientId(pid); setActesNonFactures([]); setActesCoches({});
    if (!pid) return;
    setLoadingActes(true);
    setActesNonFactures(await chargerActesNonFactures(pid));
    setLoadingActes(false);
  };

  const toggleActe = (acte) => {
    setActesCoches((prev) => {
      const next = { ...prev };
      if (next[acte.id]) delete next[acte.id];
      else { const t = tarifs.find((x) => x.categorie === acte.categorie); next[acte.id] = { ...acte, prix_unitaire: t?.prix_defaut ?? 0 }; }
      return next;
    });
  };

  const stActes  = Object.values(actesCoches).reduce((s, a) => s + (Number(a.prix_unitaire) || 0), 0);
  const stLignes = lignes.reduce((s, l) => s + (Number(l.quantite)||0)*(Number(l.prix_unitaire)||0), 0);
  const sousTot  = stActes + stLignes;
  const montCouv = Math.round(sousTot * (Number(taux) || 0) / 100);
  const tvaMont  = config?.tva_active && config?.tva_taux > 0 ? Math.round((sousTot - montCouv) * Number(config.tva_taux) / 100) : 0;
  const restePat = sousTot - montCouv + tvaMont;
  const assureurs = config?.assureurs ?? [];

  const handleSave = async () => {
    if (!patient_id) return alert("Selectionnez un patient.");
    const lignesActes  = Object.values(actesCoches).map((a) => ({ libelle: a.libelle, quantite: 1, prix_unitaire: Number(a.prix_unitaire) || 0 }));
    const lignesValides = lignes.filter((l) => l.libelle.trim());
    const toutesLignes  = [...lignesActes, ...lignesValides];
    if (toutesLignes.length === 0) return alert("Ajoutez au moins une ligne.");
    setSaving(true);
    try {
      await insertFacture({
        numero_facture: genNumero(), patient_id, etablissement_id: etabId ?? null,
        lignes: toutesLignes, sous_total: sousTot,
        taux_couverture: Number(taux), type_couverture: typeCouv || null,
        montant_couverture: montCouv, reste_patient: restePat,
        notes: notes || null, statut: "brouillon",
        date_facture: new Date().toISOString().slice(0, 10),
      });
      onSaved(); onClose();
    } catch (e) { alert("Erreur : " + e.message); }
    finally { setSaving(false); }
  };

  const patsFiltres = patients.filter((p) => {
    const q = filtrePatient.toLowerCase();
    return q === "" || `${p.prenom} ${p.nom}`.toLowerCase().includes(q);
  }).slice(0, 100);

  return (
    <Modal title="Nouvelle facture" onClose={onClose}>
      <Field label="Rechercher un patient"><input style={inputStyle} placeholder="Nom ou prenom..." value={filtrePatient} onChange={(e) => setFiltrePatient(e.target.value)} /></Field>
      <Field label="Patient *">
        <select style={selectStyle} value={patient_id} onChange={(e) => handlePatientChange(e.target.value)}>
          <option value="">-- Selectionner un patient --</option>
          {patsFiltres.map((p) => <option key={p.id} value={p.id}>{p.nom} {p.prenom}</option>)}
        </select>
      </Field>
      {patient_id && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: colors.text, marginBottom: 8 }}>Actes recents du patient (7 derniers jours)</div>
          {loadingActes && <div style={{ fontSize: 12, color: colors.textMuted }}>Chargement...</div>}
          {!loadingActes && actesNonFactures.map((acte) => {
            const coche = !!actesCoches[acte.id];
            const tarif = tarifs.find((t) => t.categorie === acte.categorie);
            return (
              <div key={acte.id} onClick={() => toggleActe(acte)}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", marginBottom: 5, borderRadius: 8, cursor: "pointer", border: `1.5px solid ${coche ? ACCENT : "#E5E7EB"}`, backgroundColor: coche ? "#F0FDF4" : "#F8FAFC" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${coche ? ACCENT : "#D1D5DB"}`, backgroundColor: coche ? ACCENT : "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {coche && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: colors.navy }}>{acte.libelle}</div>
                    <div style={{ fontSize: 11, color: "#6B7280" }}>{fmtDateCourte(acte.date)}</div>
                  </div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: tarif ? ACCENT : "#9CA3AF" }}>{tarif ? fmtFCFA(tarif.prix_defaut) : "Non configure"}</span>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 700, color: colors.text }}>Lignes supplementaires</div>
      {lignes.map((l, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8, marginBottom: 8, alignItems: "end" }}>
          <div>
            {i === 0 && <label style={{ fontSize: 11, color: colors.textSecondary, display: "block", marginBottom: 4 }}>Acte / tarif</label>}
            <select style={{ ...selectStyle, width: "100%" }}
              value={tarifs.find((t) => t.libelle === l.libelle)?.id ?? l.libelle}
              onChange={(e) => {
                const t = tarifs.find((x) => x.id === e.target.value);
                if (t) setLignes((prev) => prev.map((x, j) => j === i ? { ...x, libelle: t.libelle, prix_unitaire: t.prix_defaut } : x));
                else setLignes((prev) => prev.map((x, j) => j === i ? { ...x, libelle: e.target.value } : x));
              }}>
              <option value="">-- Choisir --</option>
              {tarifs.length > 0 ? tarifs.map((t) => <option key={t.id} value={t.id}>{t.libelle} ({Number(t.prix_defaut).toLocaleString("fr-FR")} FCFA)</option>) : ACTES_FALLBACK.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            {i === 0 && <label style={{ fontSize: 11, color: colors.textSecondary, display: "block", marginBottom: 4 }}>Qte</label>}
            <input style={inputStyle} type="number" min="1" value={l.quantite} onChange={(e) => setLignes((prev) => prev.map((x, j) => j === i ? { ...x, quantite: e.target.value } : x))} />
          </div>
          <div>
            {i === 0 && <label style={{ fontSize: 11, color: colors.textSecondary, display: "block", marginBottom: 4 }}>Prix (FCFA)</label>}
            <input style={inputStyle} type="number" min="0" value={l.prix_unitaire} onChange={(e) => setLignes((prev) => prev.map((x, j) => j === i ? { ...x, prix_unitaire: e.target.value } : x))} />
          </div>
          <button onClick={() => setLignes((prev) => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 18, padding: "0 6px", marginTop: i === 0 ? 18 : 0 }}>x</button>
        </div>
      ))}
      <button onClick={() => setLignes((prev) => [...prev, { libelle: "", quantite: 1, prix_unitaire: 0 }])} style={{ fontSize: 12, color: "#3B82F6", background: "none", border: "none", cursor: "pointer", marginBottom: 12 }}>+ Ajouter une ligne</button>
      <Row>
        <Field label="Couverture (%)">
          <input style={inputStyle} type="number" min="0" max="100" value={taux} onChange={(e) => setTaux(e.target.value)} />
        </Field>
        <Field label="Type de couverture">
          <select style={selectStyle} value={typeCouv} onChange={(e) => setTypeCouv(e.target.value)}>
            <option value="">-- Aucune --</option>
            <option value="assurance">Assurance</option>
            <option value="cnss">CNSS</option>
            <option value="mutuelle">Mutuelle</option>
            {assureurs.map((a) => <option key={a.nom} value={a.nom}>{a.nom}</option>)}
          </select>
        </Field>
      </Row>
      <div style={{ backgroundColor: colors.bgSurface, borderRadius: 10, padding: "12px 16px", marginBottom: 12 }}>
        <LineResume l="Sous-total" v={fmtFCFA(sousTot)} />
        {Number(taux) > 0 && <LineResume l={`Prise en charge (${taux}%)`} v={`- ${fmtFCFA(montCouv)}`} vc={ACCENT} />}
        {tvaMont > 0 && <LineResume l={`TVA (${config.tva_taux}%)`} v={fmtFCFA(tvaMont)} vc="#6B7280" />}
        <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 8, marginTop: 4 }}>
          <LineResume l="Reste a payer" v={fmtFCFA(restePat)} vc="#EF4444" bold />
        </div>
      </div>
      <Field label="Notes"><textarea style={{ ...inputStyle, resize: "vertical", minHeight: 60 }} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <ModalFooter onCancel={onClose} onSubmit={handleSave} submitLabel="Creer la facture" saving={saving} />
    </Modal>
  );
}

function ModalVoirPaiements({ facture, patient, onClose }) {
  const [paiements, setPaiements] = useState([]);
  const [loading, setLoading]     = useState(true);
  useEffect(() => { fetchPaiementsFacture(facture.id).then((d) => { setPaiements(d); setLoading(false); }); }, [facture.id]);
  return (
    <Modal title={`Paiements — ${facture.numero_facture}`} onClose={onClose}>
      <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 12 }}>
        Patient : <strong>{patient?.prenom} {patient?.nom}</strong> · Sous-total : <strong>{fmtFCFA(facture.sous_total)}</strong>
      </div>
      {loading && <div style={{ textAlign: "center", color: colors.textMuted, padding: 20 }}>Chargement...</div>}
      {!loading && paiements.length === 0 && <div style={{ textAlign: "center", color: colors.textMuted, padding: 20 }}>Aucun paiement enregistre.</div>}
      {!loading && paiements.map((p) => (
        <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "9px 12px", backgroundColor: colors.bgSurface, borderRadius: 8, marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: colors.navy }}>{p.numero_recu}</div>
            <div style={{ fontSize: 11, color: colors.textMuted }}>{fmtDate(p.created_at)} · {MODE_LABEL[p.mode_paiement] ?? p.mode_paiement}{p.reference_paiement ? ` · ${p.reference_paiement}` : ""}</div>
          </div>
          <span style={{ fontWeight: 800, color: ACCENT, fontSize: 13 }}>{fmtFCFA(p.montant)}</span>
        </div>
      ))}
      <button onClick={onClose} style={{ width: "100%", marginTop: 8, padding: "10px", backgroundColor: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Fermer</button>
    </Modal>
  );
}

function PanelTarifs({ etabId, onClose }) {
  const [tarifs, setTarifs]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState({ libelle: "", categorie: "consultation", prix_defaut: 0 });
  const [saving, setSaving]     = useState(false);
  const { toasts, success }     = useToast();
  const load = useCallback(async () => { setLoading(true); setTarifs(await fetchTarifsActesTous(etabId)); setLoading(false); }, [etabId]);
  useEffect(() => { load(); }, [load]);
  const handleSave = async () => {
    if (!form.libelle.trim()) return alert("Libelle obligatoire.");
    setSaving(true);
    try {
      if (editing) await updateTarifActe(editing.id, { libelle: form.libelle, categorie: form.categorie, prix_defaut: Number(form.prix_defaut) });
      else await insertTarifActe({ ...form, etablissement_id: etabId ?? null, prix_defaut: Number(form.prix_defaut) });
      setShowForm(false); setEditing(null); setForm({ libelle: "", categorie: "consultation", prix_defaut: 0 });
      load(); success(editing ? "Tarif mis a jour" : "Tarif ajoute");
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1300, display: "flex", alignItems: "flex-start", justifyContent: "flex-end" }}>
      <Toast toasts={toasts} />
      <div style={{ width: 420, height: "100vh", backgroundColor: colors.bgCard, boxShadow: "-8px 0 32px rgba(0,0,0,0.15)", overflowY: "auto", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: colors.navy }}>Gestion des tarifs</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: colors.textMuted }}>x</button>
        </div>
        {showForm && (
          <div style={{ backgroundColor: colors.bgSurface, borderRadius: 10, padding: 16, marginBottom: 16, border: `1.5px solid ${ACCENT}` }}>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: colors.textSecondary, display: "block", marginBottom: 4 }}>Libelle *</label>
              <input style={{ ...inputStyle, width: "100%" }} value={form.libelle} onChange={(e) => setForm((f) => ({ ...f, libelle: e.target.value }))} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: colors.textSecondary, display: "block", marginBottom: 4 }}>Categorie</label>
                <select style={selectStyle} value={form.categorie} onChange={(e) => setForm((f) => ({ ...f, categorie: e.target.value }))}>
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: colors.textSecondary, display: "block", marginBottom: 4 }}>Prix defaut (FCFA)</label>
                <input style={inputStyle} type="number" min="0" value={form.prix_defaut} onChange={(e) => setForm((f) => ({ ...f, prix_defaut: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setShowForm(false); setEditing(null); }} style={{ flex: 1, padding: "8px", background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 12, cursor: "pointer" }}>Annuler</button>
              <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: "8px", background: saving ? "#D1D5DB" : ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>{saving ? "..." : editing ? "Sauvegarder" : "Ajouter"}</button>
            </div>
          </div>
        )}
        {!showForm && <button onClick={() => setShowForm(true)} style={{ marginBottom: 14, padding: "7px 14px", background: ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Ajouter un tarif</button>}
        {loading && <div style={{ textAlign: "center", color: colors.textMuted, padding: 20 }}>Chargement...</div>}
        {!loading && tarifs.map((t) => (
          <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 10, marginBottom: 6, background: colors.bgSurface, border: "1px solid #E5E7EB" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>{t.libelle}</div>
              <div style={{ fontSize: 11, color: "#6B7280" }}>{CATEGORIES.find((c) => c.value === t.categorie)?.label ?? t.categorie}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>{Number(t.prix_defaut).toLocaleString("fr-FR")} FCFA</span>
              <button onClick={() => { setEditing(t); setForm({ libelle: t.libelle, categorie: t.categorie ?? "consultation", prix_defaut: t.prix_defaut }); setShowForm(true); }} style={{ fontSize: 10, padding: "2px 7px", border: "none", borderRadius: 5, background: "#EFF6FF", color: "#2563EB", cursor: "pointer", fontWeight: 600 }}>Edit</button>
              <button onClick={async () => { if (!window.confirm("Supprimer ?")) return; await deleteTarifActe(t.id); load(); }} style={{ fontSize: 10, padding: "2px 7px", border: "none", borderRadius: 5, background: "#FEF2F2", color: "#EF4444", cursor: "pointer", fontWeight: 600 }}>Sup.</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Onglet 2 — Factures ────────────────────────────────────────────────────────
function OngletFactures({ etabId, auth, config, session }) {
  const { data: patients } = usePatients();
  const { toasts, success } = useToast();
  const [factures, setFactures]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [filterStatut, setFilterStatut]   = useState("tous");
  const [filterPeriode, setFilterPeriode] = useState("mois");
  const [showModal, setShowModal]         = useState(false);
  const [showTarifs, setShowTarifs]       = useState(false);
  const [encaisserModal, setEncaisserModal]       = useState(null);
  const [voirPaiementsModal, setVoirPaiementsModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFactures(await fetchFacturesAvecPaiements(etabId));
    setLoading(false);
  }, [etabId]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let f = factures;
    if (filterStatut !== "tous") f = f.filter((x) => x.statut === filterStatut);
    const now = new Date();
    if (filterPeriode === "semaine") { const d = new Date(now); d.setDate(now.getDate()-7); f = f.filter((x) => x.date_facture && new Date(x.date_facture) >= d); }
    else if (filterPeriode === "mois") { f = f.filter((x) => x.date_facture && x.date_facture.slice(0,7) === now.toISOString().slice(0,7)); }
    return f;
  }, [factures, filterStatut, filterPeriode]);

  const totalEmises = factures.filter((f) => f.statut === "emise").reduce((s, f) => s + (f.sous_total ?? 0), 0);
  const totalPayees = factures.filter((f) => f.statut === "payee").reduce((s, f) => s + (f.reste_patient ?? 0), 0);
  const nbAcompte   = factures.filter((f) => f.statut === "acompte").length;

  return (
    <div>
      <Toast toasts={toasts} />
      {showModal && <FactureModal patients={patients} etabId={etabId} config={config} onClose={() => setShowModal(false)} onSaved={() => { load(); success("Facture creee"); }} />}
      {encaisserModal && (
        <ModalEncaissement
          facture={encaisserModal.facture} patient={encaisserModal.patient}
          session={session} etabId={etabId} auth={auth} config={config}
          onClose={() => setEncaisserModal(null)}
          onSaved={() => { load(); success("Paiement enregistre"); }}
        />
      )}
      {voirPaiementsModal && <ModalVoirPaiements facture={voirPaiementsModal.facture} patient={voirPaiementsModal.patient} onClose={() => setVoirPaiementsModal(null)} />}
      {showTarifs && <PanelTarifs etabId={etabId} onClose={() => setShowTarifs(false)} />}

      <div className="kpi-row" style={{ marginBottom: 20 }}>
        {[
          { label: "Total factures", value: loading ? "…" : factures.length,  color: "#3B82F6" },
          { label: "Montant emis",   value: loading ? "…" : fmtFCFA(totalEmises), color: "#F59E0B" },
          { label: "Encaisse",       value: loading ? "…" : fmtFCFA(totalPayees), color: ACCENT },
          { label: "En acompte",     value: loading ? "…" : nbAcompte,         color: "#C2410C" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: colors.bgCard, padding: "16px 20px", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {["tous","brouillon","emise","acompte","payee","annulee"].map((s) => (
            <button key={s} onClick={() => setFilterStatut(s)} style={{ padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", textTransform: "capitalize", backgroundColor: filterStatut === s ? "#3B82F6" : colors.bgSurface, color: filterStatut === s ? "white" : colors.textSecondary }}>{s}</button>
          ))}
          <div style={{ width: 1, backgroundColor: colors.border, margin: "0 4px" }} />
          {["semaine","mois","tout"].map((p) => (
            <button key={p} onClick={() => setFilterPeriode(p)} style={{ padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", backgroundColor: filterPeriode === p ? "#8B5CF6" : colors.bgSurface, color: filterPeriode === p ? "white" : colors.textSecondary }}>{p === "semaine" ? "7 jours" : p === "mois" ? "Ce mois" : "Tout"}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowTarifs(true)} style={{ padding: "7px 14px", backgroundColor: colors.bgCard, color: "#374151", border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Gerer les tarifs</button>
          <button onClick={() => setShowModal(true)} style={{ padding: "7px 16px", backgroundColor: ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Nouvelle facture</button>
        </div>
      </div>

      <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div className="table-scroll">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ backgroundColor: colors.bgSurface }}>
                {["Numero","Patient","Date","Sous-total","Couverture","TVA","Reste","Statut","Actions"].map((h) => (
                  <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: colors.textSecondary, borderBottom: `1px solid ${colors.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && [1,2,3].map((i) => <tr key={i}>{[120,140,80,100,80,60,100,70,100].map((w,j) => <td key={j} style={{ padding: "12px 14px" }}><div style={{ height: 12, width: w, backgroundColor: colors.borderLight, borderRadius: 6 }} /></td>)}</tr>)}
              {!loading && filtered.length === 0 && <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: colors.textMuted }}>Aucune facture.</td></tr>}
              {!loading && filtered.map((f) => {
                const patient = patients.find((p) => p.id === f.patient_id) ?? f.patients ?? {};
                const tvaMont = config?.tva_active && config?.tva_taux > 0 ? Math.round(((f.sous_total ?? 0) - (f.montant_couverture ?? 0)) * Number(config.tva_taux) / 100) : 0;
                return (
                  <tr key={f.id} style={{ borderBottom: `1px solid ${colors.borderLight}` }}>
                    <td style={{ padding: "11px 14px", fontWeight: 700, color: "#3B82F6" }}>{f.numero_facture}</td>
                    <td style={{ padding: "11px 14px", fontWeight: 600, color: colors.navy }}>{patient.prenom} {patient.nom}</td>
                    <td style={{ padding: "11px 14px", color: colors.textSecondary }}>{fmtDate(f.date_facture)}</td>
                    <td style={{ padding: "11px 14px", fontWeight: 600 }}>{fmtFCFA(f.sous_total)}</td>
                    <td style={{ padding: "11px 14px", color: ACCENT }}>{f.taux_couverture > 0 ? `${f.taux_couverture}% ${f.type_couverture ?? ""}` : "—"}</td>
                    <td style={{ padding: "11px 14px", color: "#6B7280" }}>{tvaMont > 0 ? fmtFCFA(tvaMont) : "—"}</td>
                    <td style={{ padding: "11px 14px", fontWeight: 700, color: "#EF4444" }}>{fmtFCFA(f.reste_patient ?? f.sous_total)}</td>
                    <td style={{ padding: "11px 14px" }}><StatusBadge statut={f.statut} /></td>
                    <td style={{ padding: "11px 14px" }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        <button onClick={() => imprimerFacture(f, patients, auth)} style={{ padding: "3px 8px", backgroundColor: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 5, fontSize: 10, cursor: "pointer", fontWeight: 600 }}>Imprimer</button>
                        {f.statut === "brouillon" && <button onClick={async () => { await updateFacture(f.id, { statut: "emise" }); load(); success("Facture emise"); }} style={{ padding: "3px 8px", backgroundColor: "#FEF3C7", color: "#D97706", border: "none", borderRadius: 5, fontSize: 10, cursor: "pointer", fontWeight: 600 }}>Emettre</button>}
                        {["emise","acompte"].includes(f.statut) && <button onClick={() => setEncaisserModal({ facture: f, patient })} style={{ padding: "3px 8px", backgroundColor: "#DCFCE7", color: "#16A34A", border: "none", borderRadius: 5, fontSize: 10, cursor: "pointer", fontWeight: 600 }}>Encaisser</button>}
                        {["brouillon","emise"].includes(f.statut) && <button onClick={async () => { if (!window.confirm("Annuler cette facture ?")) return; await updateFacture(f.id, { statut: "annulee" }); load(); }} style={{ padding: "3px 8px", backgroundColor: "#FEF2F2", color: "#DC2626", border: "none", borderRadius: 5, fontSize: 10, cursor: "pointer", fontWeight: 600 }}>Annuler</button>}
                        <button onClick={() => setVoirPaiementsModal({ facture: f, patient })} style={{ padding: "3px 8px", backgroundColor: colors.bgSurface, color: colors.textSecondary, border: `1px solid ${colors.border}`, borderRadius: 5, fontSize: 10, cursor: "pointer", fontWeight: 600 }}>Paiements</button>
                      </div>
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

// ── Onglet 3 — Historique ──────────────────────────────────────────────────────
const MOIS_LABELS = ["Janvier","Fevrier","Mars","Avril","Mai","Juin","Juillet","Aout","Septembre","Octobre","Novembre","Decembre"];

function OngletHistorique({ etabId, auth }) {
  const [sessions, setSessions]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [detail, setDetail]           = useState(null);
  const [detailPays, setDetailPays]   = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const now = new Date();
  const [moisSel, setMoisSel]         = useState(now.getMonth());
  const [anneeSel, setAnneeSel]       = useState(now.getFullYear());
  const [rapportData, setRapportData] = useState(null);
  const [loadingRapport, setLoadingRapport] = useState(false);

  useEffect(() => { fetchSessionsHistorique(etabId).then((d) => { setSessions(d); setLoading(false); }); }, [etabId]);

  const handleDetail = async (s) => {
    setDetail(s); setLoadingDetail(true);
    setDetailPays(await fetchPaiementsSession(s.id));
    setLoadingDetail(false);
  };

  const chargerRapport = useCallback(async () => {
    setLoadingRapport(true);
    const debut = new Date(anneeSel, moisSel, 1).toISOString();
    const fin   = new Date(anneeSel, moisSel + 1, 0, 23, 59, 59).toISOString();
    const { data } = await supabase.from("paiements_facture").select("montant, mode_paiement, created_at").eq("etablissement_id", etabId).gte("created_at", debut).lte("created_at", fin);
    const pays = data ?? [];
    const parMode = {};
    MODES_PAIEMENT.forEach((m) => { parMode[m.value] = 0; });
    pays.forEach((p) => { if (parMode[p.mode_paiement] !== undefined) parMode[p.mode_paiement] += p.montant; });
    const nbJours = new Date(anneeSel, moisSel + 1, 0).getDate();
    const parJour = Array.from({ length: nbJours }, (_, i) => ({ jour: i + 1, total: 0 }));
    pays.forEach((p) => { const j = new Date(p.created_at).getDate() - 1; if (parJour[j]) parJour[j].total += p.montant; });
    setRapportData({ parMode, parJour, total: pays.reduce((s, p) => s + p.montant, 0) });
    setLoadingRapport(false);
  }, [etabId, moisSel, anneeSel]);

  useEffect(() => { chargerRapport(); }, [chargerRapport]);

  const exporterRapport = async () => {
    if (!rapportData) return;
    const etab = await fetchEtabFromAuth(auth);
    const moisLabel = new Date(anneeSel, moisSel, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    const rows = [...Object.entries(rapportData.parMode).map(([mode, total]) => [MODE_LABEL[mode] ?? mode, fmtFCFA(total)]), ["TOTAL", fmtFCFA(rapportData.total)]];
    openDocument({ titre: `Rapport financier — ${moisLabel}`, sousTitre: `Genere le ${new Date().toLocaleDateString("fr-FR")}`, etablissement: etab, sections: [{ titre: "Encaisse par mode de paiement", html: tableHTML(["Mode","Montant"], rows) }] });
  };

  return (
    <div>
      <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 20 }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: colors.navy }}>Sessions de caisse</h3>
        {loading && <div style={{ textAlign: "center", color: colors.textMuted, padding: 20 }}>Chargement...</div>}
        {!loading && sessions.length === 0 && <div style={{ textAlign: "center", color: colors.textMuted, padding: 20, fontSize: 13 }}>Aucune session enregistree.</div>}
        {!loading && sessions.map((s) => (
          <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 14px", backgroundColor: colors.bgSurface, borderRadius: 10, marginBottom: 6 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>{fmtDate(s.date_session)} — {s.caissier_nom ?? s.caissier_email}</div>
              <div style={{ fontSize: 11, color: colors.textMuted }}>Fond : {fmtFCFA(s.fond_initial)} · Theorique : {fmtFCFA(s.total_theorique)} · {s.statut}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {s.ecart !== null && s.ecart !== 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#DC2626", backgroundColor: "#FEF2F2", padding: "2px 8px", borderRadius: 8 }}>Ecart {s.ecart > 0 ? "+" : ""}{fmtFCFA(s.ecart)}</span>}
              <button onClick={() => handleDetail(s)} style={{ padding: "4px 10px", backgroundColor: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Detail</button>
            </div>
          </div>
        ))}
      </div>

      {detail && (
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: colors.navy }}>Session du {fmtDate(detail.date_session)} — {detail.caissier_nom ?? detail.caissier_email}</h3>
            <button onClick={() => setDetail(null)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: colors.textMuted }}>x</button>
          </div>
          {loadingDetail && <div style={{ textAlign: "center", color: colors.textMuted, padding: 16 }}>Chargement...</div>}
          {!loadingDetail && detailPays.map((p) => {
            const pat = p.factures_hopital?.patients;
            return (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${colors.borderLight}`, fontSize: 12 }}>
                <div>
                  <span style={{ fontWeight: 600, color: colors.navy }}>{pat ? `${pat.prenom} ${pat.nom}` : "—"}</span>
                  <span style={{ color: colors.textMuted, marginLeft: 8 }}>{p.factures_hopital?.numero_facture ?? "—"} · {MODE_LABEL[p.mode_paiement] ?? p.mode_paiement} · {p.numero_recu}</span>
                </div>
                <span style={{ fontWeight: 700, color: ACCENT }}>{fmtFCFA(p.montant)}</span>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.navy }}>Rapport mensuel</h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select style={{ ...selectStyle, width: "auto" }} value={moisSel} onChange={(e) => setMoisSel(Number(e.target.value))}>
              {MOIS_LABELS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <input style={{ ...inputStyle, width: 80 }} type="number" value={anneeSel} onChange={(e) => setAnneeSel(Number(e.target.value))} />
            <button onClick={exporterRapport} style={{ padding: "7px 14px", backgroundColor: "#7C3AED", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Exporter</button>
          </div>
        </div>
        {loadingRapport && <div style={{ textAlign: "center", color: colors.textMuted, padding: 20 }}>Chargement...</div>}
        {rapportData && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy, marginBottom: 10 }}>Total : <span style={{ color: ACCENT }}>{fmtFCFA(rapportData.total)}</span></div>
              {Object.entries(rapportData.parMode).filter(([,v]) => v > 0).map(([mode, total]) => (
                <div key={mode} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${colors.borderLight}`, fontSize: 12 }}>
                  <span style={{ color: colors.textSecondary }}>{MODE_LABEL[mode] ?? mode}</span>
                  <span style={{ fontWeight: 700, color: colors.navy }}>{fmtFCFA(total)}</span>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={rapportData.parJour}>
                <XAxis dataKey="jour" tick={{ fontSize: 10 }} interval={4} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
                <Tooltip formatter={(v) => fmtFCFA(v)} />
                <Bar dataKey="total" fill={ACCENT} radius={[3,3,0,0]} name="Encaisse" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Onglet 4 — Configuration ───────────────────────────────────────────────────
function OngletConfiguration({ etabId, config, onConfigSaved }) {
  const [form, setForm] = useState({
    tva_active: config?.tva_active ?? false,
    tva_taux: config?.tva_taux ?? 0,
    assureurs: config?.assureurs ?? [],
    mention_legale: config?.mention_legale ?? "",
  });
  const [saving, setSaving]               = useState(false);
  const [saved, setSaved]                 = useState(false);
  const [newAssureur, setNewAssureur]     = useState({ nom: "", code: "", contact: "", email: "" });
  const [showAssureurForm, setShowAssureurForm] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsertConfigCaisse(etabId, form);
      setSaved(true); setTimeout(() => setSaved(false), 2500);
      onConfigSaved(form);
    } catch (e) { alert("Erreur : " + e.message); }
    finally { setSaving(false); }
  };

  const ajouterAssureur = () => {
    if (!newAssureur.nom.trim()) return alert("Le nom est obligatoire.");
    setForm((f) => ({ ...f, assureurs: [...f.assureurs, { ...newAssureur }] }));
    setNewAssureur({ nom: "", code: "", contact: "", email: "" });
    setShowAssureurForm(false);
  };

  const sectionTitle = (t) => <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: colors.navy, paddingBottom: 8, borderBottom: `2px solid ${ACCENT}` }}>{t}</h3>;

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }}>
        {sectionTitle("TVA")}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>TVA active</span>
          <div onClick={() => setForm((f) => ({ ...f, tva_active: !f.tva_active }))}
            style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: form.tva_active ? ACCENT : "#D1D5DB", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
            <div style={{ position: "absolute", top: 3, left: form.tva_active ? 23 : 3, width: 18, height: 18, borderRadius: "50%", backgroundColor: "white", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
          </div>
          <span style={{ fontSize: 12, color: colors.textMuted }}>{form.tva_active ? "Activee" : "Desactivee"}</span>
        </div>
        {form.tva_active && (
          <Field label="Taux TVA (%)">
            <input style={{ ...inputStyle, maxWidth: 120 }} type="number" min="0" max="100" value={form.tva_taux} onChange={(e) => setForm((f) => ({ ...f, tva_taux: e.target.value }))} />
          </Field>
        )}
      </div>

      <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }}>
        {sectionTitle("Assureurs / Tiers payants")}
        {form.assureurs.length === 0 && !showAssureurForm && <div style={{ fontSize: 13, color: colors.textMuted, marginBottom: 12 }}>Aucun assureur configure.</div>}
        {form.assureurs.map((a, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", backgroundColor: colors.bgSurface, borderRadius: 10, marginBottom: 6 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>{a.nom}{a.code ? ` (${a.code})` : ""}</div>
              <div style={{ fontSize: 11, color: colors.textMuted }}>{[a.contact, a.email].filter(Boolean).join(" · ") || "—"}</div>
            </div>
            <button onClick={() => setForm((f) => ({ ...f, assureurs: f.assureurs.filter((_,j) => j !== i) }))} style={{ padding: "3px 8px", backgroundColor: "#FEF2F2", color: "#DC2626", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Supprimer</button>
          </div>
        ))}
        {showAssureurForm && (
          <div style={{ backgroundColor: colors.bgSurface, borderRadius: 10, padding: 14, marginBottom: 10, border: `1.5px solid ${ACCENT}` }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <Field label="Nom *"><input style={inputStyle} value={newAssureur.nom} onChange={(e) => setNewAssureur((a) => ({ ...a, nom: e.target.value }))} /></Field>
              <Field label="Code"><input style={inputStyle} value={newAssureur.code} onChange={(e) => setNewAssureur((a) => ({ ...a, code: e.target.value }))} /></Field>
              <Field label="Telephone"><input style={inputStyle} value={newAssureur.contact} onChange={(e) => setNewAssureur((a) => ({ ...a, contact: e.target.value }))} /></Field>
              <Field label="Email"><input style={inputStyle} value={newAssureur.email} onChange={(e) => setNewAssureur((a) => ({ ...a, email: e.target.value }))} /></Field>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowAssureurForm(false)} style={{ flex: 1, padding: "7px", background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 7, fontSize: 12, cursor: "pointer" }}>Annuler</button>
              <button onClick={ajouterAssureur} style={{ flex: 2, padding: "7px", background: ACCENT, color: "white", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Ajouter</button>
            </div>
          </div>
        )}
        {!showAssureurForm && <button onClick={() => setShowAssureurForm(true)} style={{ padding: "7px 14px", backgroundColor: ACCENT, color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", marginTop: 4 }}>+ Ajouter un assureur</button>}
      </div>

      <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }}>
        {sectionTitle("Infos de la caisse")}
        <Field label="Mention legale sur les recus">
          <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 70 }} value={form.mention_legale} onChange={(e) => setForm((f) => ({ ...f, mention_legale: e.target.value }))} placeholder="Ex: Recu non remboursable. Merci de votre confiance." />
        </Field>
      </div>

      <button onClick={handleSave} disabled={saving}
        style={{ padding: "12px 28px", backgroundColor: saving ? "#D1D5DB" : ACCENT, color: "white", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
        {saving ? "Enregistrement..." : saved ? "Enregistre" : "Enregistrer la configuration"}
      </button>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function CaissePage() {
  const { auth } = useAuth();
  const [onglet, setOnglet]   = useState("caisse");
  const [etabId, setEtabId]   = useState(auth?.etablissement_id ?? null);
  const [config, setConfig]   = useState({ tva_taux: 0, tva_active: false, assureurs: [], mention_legale: "" });
  const [session, setSession] = useState(null);

  useEffect(() => {
    const resolve = async () => {
      let eid = auth?.etablissement_id;
      if (!eid && auth?.user?.email) {
        const { data } = await supabase.from("etablissements").select("id").eq("email", auth.user.email).maybeSingle();
        eid = data?.id ?? null;
      }
      if (!eid && auth?.user?.email) {
        const { data } = await supabase.from("membres_personnel").select("etablissement_id").eq("email", auth.user.email).eq("actif", true).maybeSingle();
        eid = data?.etablissement_id ?? null;
      }
      if (eid) setEtabId(eid);
    };
    resolve();
  }, [auth]);

  useEffect(() => { if (etabId) fetchConfigCaisse(etabId).then(setConfig); }, [etabId]);
  useEffect(() => {
    if (!etabId || !auth?.user?.email) return;
    fetchSessionActive(etabId, auth.user.email).then(setSession);
  }, [etabId, auth?.user?.email]);

  const onglets = [
    { key: "caisse",      label: "Caisse du jour" },
    { key: "factures",    label: "Factures" },
    { key: "historique",  label: "Historique" },
    { key: "config",      label: "Configuration" },
  ];

  return (
    <Layout title="Caisse" subtitle="Gestion des encaissements et facturation hospitaliere">
      <div style={{ display: "flex", gap: 2, marginBottom: 24, borderBottom: `2px solid ${colors.border}` }}>
        {onglets.map((o) => (
          <button key={o.key} onClick={() => setOnglet(o.key)} style={{
            padding: "10px 20px", background: "none", border: "none", cursor: "pointer",
            borderBottom: onglet === o.key ? `3px solid ${ACCENT}` : "3px solid transparent",
            marginBottom: -2, fontSize: 13, fontWeight: onglet === o.key ? 800 : 400,
            color: onglet === o.key ? ACCENT : colors.textSecondary,
          }}>{o.label}</button>
        ))}
      </div>
      {onglet === "caisse"      && <OngletCaisseJour      etabId={etabId} auth={auth} config={config} />}
      {onglet === "factures"    && <OngletFactures        etabId={etabId} auth={auth} config={config} session={session} />}
      {onglet === "historique"  && <OngletHistorique      etabId={etabId} auth={auth} />}
      {onglet === "config"      && <OngletConfiguration   etabId={etabId} config={config} onConfigSaved={setConfig} />}
    </Layout>
  );
}
