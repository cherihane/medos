import { colors } from "../../theme";
import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import Modal, { Field, Row, ModalFooter, inputStyle } from "../../components/Modal";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import {
  useFournisseursPaginated, useCommandesRealtime, useCommandesPaginated,
  useCommandeHistorique, useMedicaments, useFournisseurs,
} from "../../hooks/useSupabaseData";
import { insertCommande, updateCommande, deleteCommande, insertCommandeLignes, insertFournisseur, updateFournisseur } from "../../hooks/useMutations";
import { useAuth } from "../../context/AuthContext";
import { openDocument, tableHTML, infoGridHTML, fetchEtabFromAuth } from "../../utils/MedOSDocument";
import { supabase } from "../../supabaseClient";
import Pagination from "../../components/Pagination";

// Génère et ouvre le bon de commande — utilisable à la création (données du
// formulaire en mémoire) ET après coup depuis l'historique (données lues
// depuis la ligne `commandes` persistée + ses jointures). Un seul document,
// une seule fonction, pas de duplication de mise en page. `lignes` est un
// tableau [{ nom, quantite }] — une commande peut porter plusieurs produits.
async function printBonCommande({ fournisseur, lignes, dateLivraison, notes, montantTotal, reference, auth }) {
  const etab = await fetchEtabFromAuth(auth);
  const dateFr = new Date().toLocaleDateString("fr-FR");
  openDocument({
    titre: "Bon de commande fournisseur",
    sousTitre: reference ? `${reference} — Émis le ${dateFr}` : `Émis le ${dateFr}`,
    etablissement: etab,
    sections: [
      {
        titre: "Fournisseur",
        html: infoGridHTML([
          { label: "Nom", value: fournisseur.nom },
          { label: "Téléphone", value: fournisseur.telephone ?? "—" },
          { label: "Email", value: fournisseur.email ?? "—" },
          { label: "Pays", value: fournisseur.pays ?? "—" },
        ]),
      },
      {
        titre: "Détails de la commande",
        html: infoGridHTML([
          { label: "Date de livraison souhaitée", value: dateLivraison ? new Date(dateLivraison).toLocaleDateString("fr-FR") : "Non précisée" },
          { label: "Montant total estimé", value: montantTotal > 0 ? `${montantTotal.toLocaleString("fr-FR")} FCFA` : "—" },
          { label: "Notes", value: notes || "Aucune" },
        ], 3),
      },
      {
        titre: "Médicaments commandés",
        html: tableHTML(["Médicament", "Quantité"], lignes.map((l) => [l.nom, String(l.quantite)])),
      },
    ],
  });
}

// Ouvre le bon de commande d'une commande déjà enregistrée (bouton "Voir le
// bon de commande" dans l'historique) à partir des données persistées.
// Utilise commande_lignes si la commande est multi-produits, sinon retombe
// sur les colonnes historiques medicament_id/quantite (commandes créées
// avant la migration commande_lignes).
function printBonCommandeDepuisHistorique(commande, auth) {
  const lignes = (commande.commande_lignes && commande.commande_lignes.length > 0)
    ? commande.commande_lignes.map((l) => ({ nom: l.medicament_nom, quantite: l.quantite }))
    : [{
        nom: commande.medicaments
          ? `${commande.medicaments.nom}${commande.medicaments.dosage ? " " + commande.medicaments.dosage : ""}`
          : (commande.notes || "—"),
        quantite: commande.quantite ?? "—",
      }];
  return printBonCommande({
    fournisseur: commande.fournisseurs ?? { nom: "—" },
    lignes,
    dateLivraison: commande.date_livraison_prevue,
    notes: commande.notes,
    montantTotal: commande.montant_total ?? 0,
    reference: commande.reference,
    auth,
  });
}

// Génère le PDF du bon de commande côté serveur (Edge Function
// generate-bon-commande-pdf, mêmes données que printBonCommande), pour
// l'attacher aux emails envoyés au fournisseur et en notification interne.
// Retourne { filename, content } au format attendu par send-app-email, ou
// null si la génération échoue (l'envoi d'email continue sans pièce jointe
// plutôt que d'être bloqué entièrement par un souci de mise en page PDF).
async function genererPieceJointeBonCommande({ fournisseur, lignes, dateLivraison, montantTotal, reference, etabNom, notes }) {
  try {
    const { data, error } = await supabase.functions.invoke("generate-bon-commande-pdf", {
      body: {
        reference, etablissementNom: etabNom,
        fournisseur: { nom: fournisseur.nom, telephone: fournisseur.telephone, email: fournisseur.email, pays: fournisseur.pays },
        lignes, dateLivraison, montantTotal, notes,
      },
    });
    if (error || !data?.pdfBase64) return null;
    return { filename: data.filename, content: data.pdfBase64 };
  } catch {
    return null;
  }
}

// Tableau HTML des lignes de commande, réutilisé dans l'email fournisseur et
// la notification interne.
function lignesTableHTML(lignes) {
  return `
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <thead>
        <tr style="background:#F8FAFC">
          <th style="text-align:left;padding:8px 12px;font-size:12px;color:#6B7280;border-bottom:1px solid #e5e7eb">Médicament</th>
          <th style="text-align:right;padding:8px 12px;font-size:12px;color:#6B7280;border-bottom:1px solid #e5e7eb">Quantité</th>
        </tr>
      </thead>
      <tbody>
        ${lignes.map((l) => `
        <tr>
          <td style="padding:8px 12px;font-size:13px;border-bottom:1px solid #f3f4f6">${l.nom}</td>
          <td style="text-align:right;padding:8px 12px;font-size:13px;border-bottom:1px solid #f3f4f6">${l.quantite}</td>
        </tr>`).join("")}
      </tbody>
    </table>`;
}

// Résumé compact du contenu d'une commande pour les objets d'email.
function resumeLignesTexte(lignes) {
  return lignes.length === 1
    ? `${lignes[0].nom} (${lignes[0].quantite} unités)`
    : `${lignes.length} produits`;
}

// Envoi réel de l'email de commande au fournisseur (même pattern que le
// module Distributeur : supabase.functions.invoke("send-app-email", ...)).
// Lève une erreur explicite si le fournisseur n'a pas d'email, ou si
// l'envoi échoue — jamais de faux succès silencieux.
async function envoyerEmailCommande({ fournisseur, lignes, dateLivraison, montantTotal, reference, etabNom, pieceJointe }) {
  if (!fournisseur.email || !fournisseur.email.trim()) {
    throw new Error(
      `${fournisseur.nom} n'a pas d'adresse email renseignée — impossible d'envoyer la commande par email. Ajoutez une adresse email à ce fournisseur ou contactez-le par un autre moyen.`
    );
  }

  const dateFr = new Date().toLocaleDateString("fr-FR");
  const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#0A1628;padding:24px 32px;border-radius:8px 8px 0 0">
    <h1 style="color:white;font-size:18px;margin:0">Nouvelle commande — ${reference}</h1>
  </div>
  <div style="padding:24px 32px;border:1px solid #e5e7eb;border-top:none">
    <p style="font-size:14px;color:#374151">Bonjour ${fournisseur.contact_nom || ""},</p>
    <p style="font-size:14px;color:#374151">
      ${etabNom} souhaite passer la commande suivante :
    </p>
    ${lignesTableHTML(lignes)}
    <p style="font-size:13px;color:#374151">
      <strong>Date de livraison souhaitée :</strong> ${dateLivraison ? new Date(dateLivraison).toLocaleDateString("fr-FR") : "Non précisée"}<br/>
      <strong>Montant total estimé :</strong> ${montantTotal > 0 ? montantTotal.toLocaleString("fr-FR") + " FCFA" : "Non précisé"}
    </p>
    <p style="font-size:12px;color:#9CA3AF;margin-top:24px">
      Commande émise le ${dateFr}
    </p>
  </div>
  <div style="background:#F8FAFC;padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center">
    <p style="font-size:12px;color:#9CA3AF;margin:0">MedOS — ${etabNom}</p>
  </div>
</div>`;

  const { error } = await supabase.functions.invoke("send-app-email", {
    body: {
      to:      fournisseur.email,
      subject: `Commande MedOS ${reference} — ${resumeLignesTexte(lignes)}`,
      html,
      ...(pieceJointe ? { attachments: [pieceJointe] } : {}),
    },
  });
  if (error) {
    throw new Error(`L'email n'a pas pu être envoyé à ${fournisseur.email} : ${error.message}`);
  }
}

// Notification interne : informe le(s) responsable(s) de l'établissement
// qu'une commande a été passée (qui, chez qui, quoi), avec le même bon de
// commande en pièce jointe. Aucune liste de destinataires admin dédiée
// n'existe ailleurs dans le code — on retombe sur l'email de l'établissement
// (le compte créateur), seul destinataire garanti d'exister.
async function envoyerNotificationInterne({ fournisseur, lignes, dateLivraison, montantTotal, reference, etabNom, etablissement_id, userEmail, pieceJointe }) {
  const { data: etab, error: etabError } = await supabase
    .from("etablissements")
    .select("email")
    .eq("id", etablissement_id)
    .maybeSingle();
  if (etabError || !etab?.email) {
    throw new Error("Impossible de déterminer le destinataire de la notification interne (email de l'établissement introuvable).");
  }

  const dateFr = new Date().toLocaleDateString("fr-FR");
  const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#0A1628;padding:24px 32px;border-radius:8px 8px 0 0">
    <h1 style="color:white;font-size:18px;margin:0">Commande passée — ${reference}</h1>
  </div>
  <div style="padding:24px 32px;border:1px solid #e5e7eb;border-top:none">
    <p style="font-size:14px;color:#374151">
      <strong>${userEmail}</strong> a passé une commande chez <strong>${fournisseur.nom}</strong>.
    </p>
    ${lignesTableHTML(lignes)}
    <p style="font-size:13px;color:#374151">
      <strong>Date de livraison souhaitée :</strong> ${dateLivraison ? new Date(dateLivraison).toLocaleDateString("fr-FR") : "Non précisée"}<br/>
      <strong>Montant total estimé :</strong> ${montantTotal > 0 ? montantTotal.toLocaleString("fr-FR") + " FCFA" : "Non précisé"}
    </p>
    <p style="font-size:12px;color:#9CA3AF;margin-top:24px">
      Commande émise le ${dateFr}
    </p>
  </div>
  <div style="background:#F8FAFC;padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center">
    <p style="font-size:12px;color:#9CA3AF;margin:0">MedOS — ${etabNom}</p>
  </div>
</div>`;

  const { error } = await supabase.functions.invoke("send-app-email", {
    body: {
      to:      etab.email,
      subject: `[MedOS] Commande passée ${reference} — ${fournisseur.nom}`,
      html,
      ...(pieceJointe ? { attachments: [pieceJointe] } : {}),
    },
  });
  if (error) {
    throw new Error(`La notification interne n'a pas pu être envoyée à ${etab.email} : ${error.message}`);
  }
}

// Actions de transition manuelle du statut — statut courant → action suivante proposée
const STATUT_ACTIONS = {
  envoyee:    [{ label: "Marquer confirmée", next: "confirmee" }, { label: "Annuler", next: "annulee", danger: true }],
  confirmee:  [{ label: "Marquer en transit", next: "en_transit" }, { label: "Annuler", next: "annulee", danger: true }],
  en_transit: [{ label: "Marquer reçue", next: "livree" }, { label: "Annuler", next: "annulee", danger: true }],
};

// ── Statuts commandes ─────────────────────────────────────────────────────────
const STATUT_STYLE = {
  brouillon:  { bg: "#F3F4F6", color: colors.textSecondary,  label: "Brouillon" },
  envoyee:    { bg: "#FEF9C3", color: "#A16207",  label: "Envoyée" },
  confirmee:  { bg: "#DBEAFE", color: "#2563EB",  label: "Confirmée" },
  en_transit: { bg: "#E0E7FF", color: "#4F46E5",  label: "En transit" },
  livree:     { bg: "#DCFCE7", color: "#16A34A",  label: "Livrée" },
  annulee:    { bg: "#FEF2F2", color: "#DC2626",  label: "Annulée / refusée" },
};

// ── Panneau commandes temps réel ──────────────────────────────────────────────
function MesCommandesPanel({ etablissement_id }) {
  const { data: commandes, loading } = useCommandesRealtime(etablissement_id);
  if (loading || commandes.length === 0) return null;
  return (
    <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.navy }}>Mes commandes en cours</h3>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, backgroundColor: "#DCFCE7", color: "#16A34A", padding: "3px 8px", borderRadius: 10 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#16A34A", display: "inline-block", animation: "livePulse 1.5s ease-in-out infinite" }} />
          TEMPS RÉEL
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {commandes.slice(0, 8).map((c) => {
          const s = STATUT_STYLE[c.statut] || { bg: "#F3F4F6", color: colors.textSecondary, label: c.statut };
          return (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", backgroundColor: s.bg, borderRadius: 10, borderLeft: `3px solid ${s.color}`, animation: "fadeIn 0.3s ease" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: colors.navy }}>{c.fournisseurs?.nom ?? "—"}</div>
                <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                  {c.reference ?? c.id.slice(0, 8).toUpperCase()} · {new Date(c.date_commande).toLocaleDateString("fr-FR")}
                  {c.notes && ` · ${c.notes.slice(0, 50)}${c.notes.length > 50 ? "…" : ""}`}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, marginLeft: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: colors.text }}>{(c.montant_total ?? 0).toLocaleString()} FCFA</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: s.color, padding: "2px 8px", backgroundColor: colors.bgCard, borderRadius: 8, whiteSpace: "nowrap" }}>{s.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Skeleton chargement ───────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div style={{ backgroundColor: colors.bgCard, borderRadius: 16, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", animation: "pulse 1.5s ease-in-out infinite" }}>
      <div style={{ display: "flex", gap: 14, marginBottom: 16 }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: colors.borderLight }} />
        <div style={{ flex: 1 }}>
          <div style={{ width: 140, height: 14, backgroundColor: colors.borderLight, borderRadius: 6, marginBottom: 8 }} />
          <div style={{ width: 80, height: 12, backgroundColor: colors.borderLight, borderRadius: 6 }} />
        </div>
      </div>
      <div className="form-row-2" style={{ gap: 10, marginBottom: 14 }}>
        {[1, 2, 3, 4].map((i) => <div key={i} style={{ height: 52, backgroundColor: colors.bgSurface, borderRadius: 10 }} />)}
      </div>
      <div style={{ height: 48, backgroundColor: colors.bgSurface, borderRadius: 10 }} />
    </div>
  );
}

// ── Modal Fournisseur (ajout + édition) ───────────────────────────────────────
const EMPTY_FORM = {
  nom: "", pays: "", delai_livraison: "", conditions_paiement: "",
  contact_nom: "", email: "", telephone: "", notes: "",
};

function FournisseurModal({ initial, onClose, onSaved }) {
  const { auth } = useAuth();
  const [form, setForm] = useState(initial
    ? {
        nom:                  initial.nom               || "",
        pays:                 initial.pays              || "",
        delai_livraison:      initial.delai_livraison   || "",
        conditions_paiement:  initial.conditions_paiement || "",
        contact_nom:          initial.contact_nom       || "",
        email:                initial.email             || "",
        telephone:            initial.telephone         || "",
        notes:                initial.notes             || "",
      }
    : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const set = (k) => (e) => { setFormError(null); setForm((f) => ({ ...f, [k]: e.target.value })); };
  const isEdit = !!initial;

  const handleSave = async () => {
    if (!form.nom.trim()) { setFormError("Le nom du fournisseur est obligatoire."); return; }
    setSaving(true);
    try {
      if (isEdit) {
        await updateFournisseur(initial.id, form);
      } else {
        await insertFournisseur({ ...form, actif: true, etablissement_id: auth?.etablissement_id ?? null });
      }
      onSaved();
      onClose();
    } catch (e) {
      setFormError("Erreur : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? `Modifier — ${initial.nom}` : "Ajouter un fournisseur"} onClose={onClose} width={520}>
      <Field label="Nom du fournisseur *">
        <input style={inputStyle} value={form.nom} onChange={set("nom")} placeholder="Ex: PharmaDistrib Congo" autoFocus />
      </Field>
      <Row>
        <Field label="Pays">
          <input style={inputStyle} value={form.pays} onChange={set("pays")} placeholder="Ex: Congo, France…" />
        </Field>
        <Field label="Délai de livraison">
          <input style={inputStyle} value={form.delai_livraison} onChange={set("delai_livraison")} placeholder="Ex: 5-7 jours" />
        </Field>
      </Row>
      <Field label="Conditions de paiement">
        <input style={inputStyle} value={form.conditions_paiement} onChange={set("conditions_paiement")} placeholder="Ex: 30 jours net, virement…" />
      </Field>
      <Row>
        <Field label="Nom du contact">
          <input style={inputStyle} value={form.contact_nom} onChange={set("contact_nom")} placeholder="Ex: Jean Dupont" />
        </Field>
        <Field label="Téléphone">
          <input style={inputStyle} value={form.telephone} onChange={set("telephone")} placeholder="Ex: +242 06 000 0000" />
        </Field>
      </Row>
      <Field label="Email">
        <input style={inputStyle} type="email" value={form.email} onChange={set("email")} placeholder="contact@fournisseur.com" />
      </Field>
      <Field label="Notes">
        <input style={inputStyle} value={form.notes} onChange={set("notes")} placeholder="Informations complémentaires…" />
      </Field>
      {formError && (
        <div style={{ padding: "10px 14px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 13, color: "#DC2626" }}>
          {formError}
        </div>
      )}
      <ModalFooter
        onCancel={onClose}
        onSubmit={handleSave}
        submitLabel={isEdit ? "Enregistrer les modifications" : "Ajouter le fournisseur"}
        saving={saving}
      />
    </Modal>
  );
}

// ── Modal Passer commande (panier multi-produits) ─────────────────────────────
// `prefillLignes`, si fourni (venant de l'écran Alertes), pré-remplit le
// panier avec les médicaments et quantités suggérées — l'utilisateur peut
// toujours ajuster les quantités ou ajouter/retirer des lignes avant d'envoyer.
function CommandeModal({ fournisseur, etablissement_id, auth, prefillLignes, onClose, onSaved }) {
  const { data: medicaments, loading: loadingMeds } = useMedicaments();
  const [cart, setCart] = useState(() =>
    (prefillLignes || []).map((l) => ({
      medicament_id: l.medicament_id,
      nom:           l.nom,
      quantite:      l.quantite,
      prix_unitaire: l.prix_unitaire ?? 0,
    }))
  );
  const [medicamentId, setMedicamentId]   = useState("");
  const [quantite, setQuantite]           = useState("");
  const [dateLivraison, setDateLivraison] = useState("");
  const [notes, setNotes]                 = useState("");
  const [saving, setSaving]               = useState(false);
  const [formError, setFormError]         = useState(null);

  const selectedMed = medicaments.find((m) => m.id === medicamentId) || null;
  const montantTotal = cart.reduce((s, it) => s + (Number(it.quantite) || 0) * (it.prix_unitaire || 0), 0);

  const addToCart = () => {
    if (!medicamentId) { setFormError("Choisissez un médicament."); return; }
    const qty = parseInt(quantite, 10);
    if (!qty || qty <= 0) { setFormError("Quantité invalide."); return; }
    const med = medicaments.find((m) => m.id === medicamentId);
    setFormError(null);
    setCart((c) => {
      const existing = c.find((it) => it.medicament_id === medicamentId);
      if (existing) {
        return c.map((it) => it.medicament_id === medicamentId ? { ...it, quantite: (Number(it.quantite) || 0) + qty } : it);
      }
      const nom = `${med.nom}${med.dosage ? ` ${med.dosage}` : ""}${med.forme ? ` (${med.forme})` : ""}`;
      return [...c, { medicament_id: med.id, nom, quantite: qty, prix_unitaire: med.prix_unitaire ?? 0 }];
    });
    setMedicamentId("");
    setQuantite("");
  };

  const updateCartQuantite = (medicament_id, val) => {
    const n = parseInt(val, 10);
    setCart((c) => c.map((it) => it.medicament_id === medicament_id ? { ...it, quantite: Number.isNaN(n) ? "" : n } : it));
  };
  const removeFromCart = (medicament_id) => setCart((c) => c.filter((it) => it.medicament_id !== medicament_id));

  const handleSave = async () => {
    if (cart.length === 0) { setFormError("Ajoutez au moins un médicament à la commande."); return; }
    for (const it of cart) {
      if (!it.quantite || it.quantite <= 0) { setFormError(`Quantité invalide pour "${it.nom}".`); return; }
    }
    setSaving(true);
    try {
      const reference = "CMD-" + Date.now().toString().slice(-8);
      const isSingleLine = cart.length === 1;
      const commande = await insertCommande({
        reference,
        fournisseur_id:        fournisseur.id,
        statut:                "envoyee",
        date_commande:         new Date().toISOString(),
        date_livraison_prevue: dateLivraison || null,
        montant_total:         montantTotal,
        // Colonnes historiques conservées pour rétrocompatibilité (affichage
        // des commandes créées avant commande_lignes) — renseignées seulement
        // pour une commande à une seule ligne.
        medicament_id:         isSingleLine ? cart[0].medicament_id : null,
        quantite:              isSingleLine ? cart[0].quantite : null,
        notes:                 notes || null,
        ...(etablissement_id ? { etablissement_id } : {}),
      });

      await insertCommandeLignes(cart.map((it) => ({
        commande_id:      commande.id,
        etablissement_id: etablissement_id ?? null,
        medicament_id:    it.medicament_id,
        medicament_nom:   it.nom,
        quantite:         it.quantite,
        prix_unitaire:    it.prix_unitaire ?? null,
      })));

      // L'email est une étape distincte de l'enregistrement de la commande :
      // la commande reste valide même si l'envoi échoue, mais le statut réel
      // de l'envoi est toujours tracé et remonté honnêtement à l'utilisateur.
      const etab = await fetchEtabFromAuth(auth);
      const lignesInfo = cart.map((it) => ({ nom: it.nom, quantite: it.quantite }));
      const commandeInfo = {
        fournisseur, lignes: lignesInfo,
        dateLivraison, montantTotal, reference, etabNom: etab.nom, notes,
      };

      // Un seul PDF généré, réutilisé pour les deux emails (fournisseur +
      // notification interne). null si la génération échoue — les emails
      // partent alors sans pièce jointe plutôt que d'être bloqués.
      const pieceJointe = await genererPieceJointeBonCommande(commandeInfo);

      let emailStatut = "non_envoye";
      let emailErreur = null;
      try {
        await envoyerEmailCommande({ ...commandeInfo, pieceJointe });
        emailStatut = "envoye";
      } catch (emailErr) {
        emailStatut = "echec";
        emailErreur = emailErr.message;
      }
      await updateCommande(commande.id, { email_statut: emailStatut, email_erreur: emailErreur });

      let notifInterneStatut = "envoye";
      let notifInterneErreur = null;
      try {
        await envoyerNotificationInterne({
          ...commandeInfo, etablissement_id, userEmail: auth?.user?.email ?? "un utilisateur", pieceJointe,
        });
      } catch (notifErr) {
        notifInterneStatut = "echec";
        notifInterneErreur = notifErr.message;
      }

      onSaved({ emailStatut, emailErreur, notifInterneStatut, notifInterneErreur, fournisseurNom: fournisseur.nom, reference });
      onClose();
    } catch (e) {
      setFormError("Erreur : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const selectStyle = {
    ...inputStyle,
    backgroundColor: colors.bgCard,
    cursor: loadingMeds ? "wait" : "pointer",
  };

  return (
    <Modal title={`Commander chez ${fournisseur.nom}`} onClose={onClose} width={620}>
      {prefillLignes && prefillLignes.length > 0 && (
        <div style={{ marginBottom: 16, padding: "8px 12px", backgroundColor: "#EFF6FF", color: "#2563EB", borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
          {prefillLignes.length > 1
            ? `${prefillLignes.length} produits pré-remplis depuis les alertes de stock bas.`
            : `Produit pré-rempli depuis une alerte de stock bas.`}
        </div>
      )}

      {/* Ajout d'un médicament au panier */}
      <Field label="Ajouter un médicament">
        <div style={{ display: "flex", gap: 8 }}>
          <select
            style={{ ...selectStyle, flex: 1 }}
            value={medicamentId}
            onChange={(e) => setMedicamentId(e.target.value)}
          >
            <option value="">{loadingMeds ? "Chargement…" : "— Sélectionner un médicament —"}</option>
            {medicaments.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nom}{m.dosage ? ` ${m.dosage}` : ""}{m.forme ? ` (${m.forme})` : ""}
              </option>
            ))}
          </select>
          <input
            style={{ ...inputStyle, width: 100 }}
            type="number"
            min="1"
            value={quantite}
            onChange={(e) => setQuantite(e.target.value)}
            placeholder="Qté"
          />
          <button type="button" onClick={addToCart} disabled={!medicamentId} style={{ padding: "9px 16px", borderRadius: 8, border: "none", backgroundColor: medicamentId ? "#0A1628" : "#E5E7EB", color: medicamentId ? "white" : "#9CA3AF", cursor: medicamentId ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
            + Ajouter
          </button>
        </div>
        {selectedMed && (
          <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 6 }}>
            Prix unitaire : <strong style={{ color: colors.navy }}>
              {selectedMed.prix_unitaire > 0 ? `${selectedMed.prix_unitaire.toLocaleString("fr-FR")} FCFA / ${selectedMed.unite || "unité"}` : "non renseigné"}
            </strong>
          </div>
        )}
      </Field>

      {cart.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
            Produits de la commande ({cart.length})
          </label>
          <div style={{ border: "1.5px solid #E5E7EB", borderRadius: 10, overflow: "hidden" }}>
            {cart.map((it, i) => (
              <div key={it.medicament_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderBottom: i < cart.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#0A1628" }}>{it.nom}</div>
                <input
                  type="number"
                  min="1"
                  value={it.quantite}
                  onChange={(e) => updateCartQuantite(it.medicament_id, e.target.value)}
                  style={{ width: 80, padding: "6px 8px", border: "1.5px solid #E5E7EB", borderRadius: 6, fontSize: 13, textAlign: "center" }}
                />
                <button type="button" onClick={() => removeFromCart(it.medicament_id)} style={{ width: 26, height: 26, borderRadius: "50%", border: "none", backgroundColor: "#FEF2F2", color: "#DC2626", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>×</button>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "right", fontSize: 13, fontWeight: 700, color: colors.navy, marginTop: 8 }}>
            Montant total : {montantTotal > 0 ? `${montantTotal.toLocaleString("fr-FR")} FCFA` : "—"}
          </div>
        </div>
      )}

      <Field label="Date de livraison souhaitée">
        <input
          style={inputStyle}
          type="date"
          value={dateLivraison}
          onChange={(e) => setDateLivraison(e.target.value)}
        />
      </Field>

      <Field label="Notes complémentaires">
        <input
          style={inputStyle}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Instructions particulières…"
        />
      </Field>

      {formError && (
        <div style={{ padding: "10px 14px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 13, color: "#DC2626", marginBottom: 4 }}>
          {formError}
        </div>
      )}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", padding: "16px 0 0" }}>
        <button onClick={onClose} style={{ padding: "9px 18px", background: "white", border: "1.5px solid var(--border)", borderRadius: 9, fontSize: 13, color: colors.textSecondary, cursor: "pointer" }}>Annuler</button>
        {cart.length > 0 && (
          <button
            onClick={() => printBonCommande({ fournisseur, lignes: cart.map((it) => ({ nom: it.nom, quantite: it.quantite })), dateLivraison, notes, montantTotal, auth })}
            style={{ padding: "9px 16px", background: "#F8FAFC", color: colors.text, border: "1.5px solid var(--border)", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Imprimer
          </button>
        )}
        <button onClick={handleSave} disabled={saving} style={{ padding: "9px 18px", background: saving ? "#E5E7EB" : "#10B981", color: saving ? "#9CA3AF" : "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
          {saving ? "Envoi…" : cart.length > 1 ? `Passer la commande (${cart.length} produits)` : "Passer la commande"}
        </button>
      </div>
    </Modal>
  );
}

// ── Historique des statuts (append-only, voir trigger SQL) ───────────────────
const STATUT_LABEL_HISTORIQUE = {
  brouillon: "Brouillon créé", envoyee: "Commande envoyée", confirmee: "Confirmée par le fournisseur",
  en_transit: "En transit", livree: "Reçue (stock mis à jour)", annulee: "Annulée",
};

function CommandeHistoriqueInline({ commandeId }) {
  const { data: historique, loading } = useCommandeHistorique(commandeId);
  if (loading) return <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 10 }}>Chargement de l'historique…</div>;
  if (historique.length === 0) return null;
  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed var(--border)" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 }}>
        Historique du statut
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {historique.map((h) => (
          <div key={h.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <span style={{ color: colors.text }}>{STATUT_LABEL_HISTORIQUE[h.statut] ?? h.statut}</span>
            <span style={{ color: colors.textMuted }}>{new Date(h.changed_at).toLocaleString("fr-FR")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Carte commande (onglet historique) ────────────────────────────────────────
function CommandeCard({ commande, auth, onChanged }) {
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState(false);
  const { success, error: toastError } = useToast();
  const s = STATUT_STYLE[commande.statut] || { bg: "#F3F4F6", color: colors.textSecondary, label: commande.statut };
  const actions = STATUT_ACTIONS[commande.statut] || [];

  const lignes = commande.commande_lignes && commande.commande_lignes.length > 0
    ? commande.commande_lignes
    : null;
  const medicamentLabel = lignes
    ? (lignes.length === 1 ? `${lignes[0].medicament_nom} × ${lignes[0].quantite}` : `${lignes.length} produits`)
    : commande.medicaments
      ? `${commande.medicaments.nom}${commande.medicaments.dosage ? " " + commande.medicaments.dosage : ""} × ${commande.quantite ?? "—"}`
      : (commande.notes || "—");

  const handleStatutChange = async (next, label) => {
    if (next === "annulee" && !window.confirm(`Confirmer l'annulation de la commande ${commande.reference ?? ""} ?`)) return;
    setUpdating(true);
    try {
      await updateCommande(commande.id, { statut: next });
      success(`${commande.reference ?? "Commande"} — ${label.toLowerCase()}${next === "livree" ? " : stock mis à jour" : ""}`);
      onChanged();
    } catch (e) {
      toastError("Erreur : " + e.message);
    } finally {
      setUpdating(false);
    }
  };

  // Suppression complète : uniquement pour les brouillons (protégé aussi
  // côté RLS — voir cmd_delete). Pour tout autre statut, seule "Annuler" est
  // disponible, afin de garder une trace d'audit complète.
  const handleDelete = async () => {
    if (!window.confirm(`Supprimer définitivement le brouillon ${commande.reference ?? ""} ? Cette action est irréversible.`)) return;
    setUpdating(true);
    try {
      await deleteCommande(commande.id);
      success(`${commande.reference ?? "Brouillon"} supprimé.`);
      onChanged();
    } catch (e) {
      toastError("Erreur : " + e.message);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "18px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: colors.navy }}>{commande.reference || commande.id.slice(0, 8).toUpperCase()}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: s.color, padding: "2px 8px", backgroundColor: s.bg, borderRadius: 8 }}>{s.label}</span>
            {commande.email_statut === "envoye" && (
              <span title="Email envoyé au fournisseur" style={{ fontSize: 10, fontWeight: 700, color: "#16A34A", backgroundColor: "#DCFCE7", padding: "2px 8px", borderRadius: 8 }}>✉ Envoyé</span>
            )}
            {commande.email_statut === "echec" && (
              <span title={commande.email_erreur || "Échec de l'envoi"} style={{ fontSize: 10, fontWeight: 700, color: "#DC2626", backgroundColor: "#FEF2F2", padding: "2px 8px", borderRadius: 8 }}>✉ Non envoyé</span>
            )}
            {commande.email_statut === "non_envoye" && (
              <span style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", backgroundColor: "#F3F4F6", padding: "2px 8px", borderRadius: 8 }}>✉ Pas d'email</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
            {commande.fournisseurs?.nom ?? "—"} · {medicamentLabel} · {new Date(commande.date_commande).toLocaleDateString("fr-FR")}
          </div>
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, color: colors.navy }}>{(commande.montant_total ?? 0).toLocaleString()} FCFA</div>
      </div>

      {lignes && lignes.length > 1 && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 3 }}>
          {lignes.map((l) => (
            <div key={l.id} style={{ fontSize: 12, color: colors.text, display: "flex", justifyContent: "space-between", padding: "4px 10px", backgroundColor: colors.bgSurface, borderRadius: 6 }}>
              <span>{l.medicament_nom}</span>
              <span style={{ fontWeight: 700 }}>× {l.quantite}</span>
            </div>
          ))}
        </div>
      )}

      {commande.email_statut === "echec" && commande.email_erreur && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#DC2626", backgroundColor: "#FEF2F2", padding: "6px 10px", borderRadius: 8 }}>
          {commande.email_erreur}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
        {actions.map((a) => (
          <button
            key={a.next}
            disabled={updating}
            onClick={() => handleStatutChange(a.next, a.label)}
            style={{
              padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: updating ? "wait" : "pointer", border: "none",
              backgroundColor: a.danger ? "#FEF2F2" : "#EFF6FF",
              color: a.danger ? "#DC2626" : "#2563EB",
            }}
          >
            {a.label}
          </button>
        ))}
        {commande.statut === "brouillon" && (
          <button
            disabled={updating}
            onClick={handleDelete}
            style={{ padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: updating ? "wait" : "pointer", border: "none", backgroundColor: "#FEF2F2", color: "#DC2626" }}
          >
            Supprimer
          </button>
        )}
        <button
          onClick={() => printBonCommandeDepuisHistorique(commande, auth)}
          style={{ padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", backgroundColor: colors.bgSurface, color: colors.text, border: "1px solid var(--border)" }}
        >
          Voir le bon de commande
        </button>
        <button
          onClick={() => setExpanded((e) => !e)}
          style={{ padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", backgroundColor: "transparent", color: colors.textMuted, border: "none" }}
        >
          {expanded ? "Masquer l'historique ▲" : "Historique ▾"}
        </button>
      </div>

      {expanded && <CommandeHistoriqueInline commandeId={commande.id} />}
    </div>
  );
}

// ── Onglet Commandes (historique filtrable) ───────────────────────────────────
const STATUTS_FILTRE = [
  { key: "",           label: "Tous" },
  { key: "envoyee",    label: "Envoyée" },
  { key: "confirmee",  label: "Confirmée" },
  { key: "en_transit", label: "En transit" },
  { key: "livree",     label: "Reçue" },
  { key: "annulee",    label: "Annulée" },
];

function CommandesTab({ etablissement_id, auth }) {
  const [filtreStatut, setFiltreStatut]         = useState("");
  const [filtreFournisseur, setFiltreFournisseur] = useState("");
  const [search, setSearch]                     = useState("");
  const { data: fournisseursListe }              = useFournisseurs();
  const { data: commandes, loading, error, total, page, setPage, totalPages, refetch } =
    useCommandesPaginated(etablissement_id, 20, { statut: filtreStatut, fournisseur_id: filtreFournisseur, search });

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 18, backgroundColor: colors.bgCard, padding: 14, borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <input
          placeholder="Rechercher par référence…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: "7px 12px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 12, minWidth: 200 }}
        />
        <select
          value={filtreFournisseur}
          onChange={(e) => setFiltreFournisseur(e.target.value)}
          style={{ padding: "7px 12px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 12, backgroundColor: colors.bgCard }}
        >
          <option value="">Tous les fournisseurs</option>
          {fournisseursListe.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
        </select>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {STATUTS_FILTRE.map((s) => (
            <button
              key={s.key}
              onClick={() => setFiltreStatut(s.key)}
              style={{
                padding: "6px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "none",
                backgroundColor: filtreStatut === s.key ? "#3B82F6" : "#F3F4F6",
                color: filtreStatut === s.key ? "white" : "#6B7280",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", fontSize: 12, color: colors.textMuted }}>
          {loading ? "Chargement…" : `${total} commande${total !== 1 ? "s" : ""}`}
        </div>
      </div>

      {error && (
        <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "14px 18px", marginBottom: 20, fontSize: 13, color: "#DC2626" }}>
          Une erreur s'est produite. Veuillez réessayer.
        </div>
      )}

      {loading && <div style={{ textAlign: "center", padding: "40px 0", color: colors.textMuted, fontSize: 13 }}>Chargement…</div>}
      {!loading && commandes.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: colors.textMuted, fontSize: 14 }}>Aucune commande trouvée.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {commandes.map((c) => <CommandeCard key={c.id} commande={c} auth={auth} onChanged={refetch} />)}
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function Fournisseurs() {
  const { auth } = useAuth();
  const etablissement_id = auth?.etablissement_id ?? null;
  const location = useLocation();
  const navigate = useNavigate();
  const [filtre, setFiltre] = useState("actifs"); // "actifs" | "inactifs" | "tous"
  const { data: liste, loading, error, total, page, setPage, totalPages, refetch } = useFournisseursPaginated(filtre);
  const { toasts, success, error: toastError } = useToast();
  const [tab, setTab] = useState("fournisseurs"); // "fournisseurs" | "commandes"

  const [addModal, setAddModal]         = useState(false);
  const [editModal, setEditModal]       = useState(null);   // fournisseur à éditer
  const [commandModal, setCommandModal] = useState(null);   // fournisseur à commander
  const [toggling, setToggling]         = useState(null);   // id en cours de désactivation

  // Produits pré-remplis venant de l'écran Alertes ("Commander" sur une ou
  // plusieurs alertes de stock bas) — en attente qu'un fournisseur soit
  // choisi. Consommé une seule fois : on vide l'état de navigation tout de
  // suite pour qu'un rafraîchissement de page ne le redéclenche pas.
  const [pendingPrefill, setPendingPrefill] = useState(location.state?.prefillLignes ?? null);
  useEffect(() => {
    if (location.state?.prefillLignes) {
      setTab("fournisseurs");
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleActif = async (f) => {
    setToggling(f.id);
    try {
      await updateFournisseur(f.id, { actif: !f.actif });
      success(f.actif ? `${f.nom} désactivé` : `${f.nom} réactivé`);
      refetch();
    } catch (e) {
      toastError("Erreur : " + e.message);
    } finally {
      setToggling(null);
    }
  };

  const FILTRES = [
    { key: "actifs",   label: "Actifs" },
    { key: "inactifs", label: "Inactifs" },
    { key: "tous",     label: "Tous" },
  ];

  return (
    <Layout title="Fournisseurs" subtitle="Gestion des partenaires et des approvisionnements">
      <style>{`
        @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes livePulse{ 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes fadeIn   { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
      <Toast toasts={toasts} />

      {/* Modals */}
      {addModal && (
        <FournisseurModal
          onClose={() => setAddModal(false)}
          onSaved={() => { success("Fournisseur ajouté avec succès"); refetch(); }}
        />
      )}
      {editModal && (
        <FournisseurModal
          initial={editModal}
          onClose={() => setEditModal(null)}
          onSaved={() => { success(`${editModal.nom} mis à jour`); refetch(); setEditModal(null); }}
        />
      )}
      {commandModal && (
        <CommandeModal
          fournisseur={commandModal}
          etablissement_id={etablissement_id}
          auth={auth}
          prefillLignes={pendingPrefill}
          onClose={() => setCommandModal(null)}
          onSaved={({ emailStatut, emailErreur, notifInterneStatut, notifInterneErreur, fournisseurNom, reference }) => {
            setPendingPrefill(null);
            if (emailStatut === "envoye") {
              success(`Commande ${reference} envoyée chez ${fournisseurNom} — email de confirmation transmis.`);
            } else {
              toastError(`Commande ${reference} enregistrée chez ${fournisseurNom}, mais l'email n'a pas pu être envoyé : ${emailErreur}`);
            }
            if (notifInterneStatut === "echec") {
              toastError(`Commande ${reference} : la notification interne n'a pas pu être envoyée : ${notifInterneErreur}`);
            }
          }}
        />
      )}

      {pendingPrefill && pendingPrefill.length > 0 && !commandModal && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 12, padding: "14px 18px", marginBottom: 20, fontSize: 13, color: "#1E40AF" }}>
          <span>
            {pendingPrefill.length > 1 ? `${pendingPrefill.length} produits` : "1 produit"} en attente de commande (depuis les alertes de stock bas) — choisissez un fournisseur ci-dessous pour continuer.
          </span>
          <button onClick={() => setPendingPrefill(null)} style={{ background: "none", border: "none", color: "#1E40AF", fontWeight: 600, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap", marginLeft: 12 }}>
            Annuler
          </button>
        </div>
      )}

      {/* Onglets */}
      <div style={{ display: "flex", gap: 2, backgroundColor: colors.bgCard, borderRadius: 10, padding: 3, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 20, width: "fit-content" }}>
        {[
          { key: "fournisseurs", label: "Fournisseurs" },
          { key: "commandes", label: "Commandes" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "8px 18px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer",
              backgroundColor: tab === t.key ? "#3B82F6" : "transparent",
              color: tab === t.key ? "white" : "#6B7280",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "commandes" && <CommandesTab etablissement_id={etablissement_id} auth={auth} />}

      {tab === "fournisseurs" && (
      <>
      {/* Commandes temps réel */}
      <MesCommandesPanel etablissement_id={etablissement_id} />

      {/* Barre d'actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Filtres */}
          <div style={{ display: "flex", backgroundColor: colors.bgCard, borderRadius: 10, padding: 3, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", gap: 2 }}>
            {FILTRES.map((f) => (
              <button
                key={f.key}
                onClick={() => setFiltre(f.key)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  border: "none",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  backgroundColor: filtre === f.key ? "#3B82F6" : "transparent",
                  color: filtre === f.key ? "white" : "#6B7280",
                  transition: "all 0.15s",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 13, color: colors.textMuted }}>
            {loading ? "Chargement…" : `${total} fournisseur${total !== 1 ? "s" : ""}`}
          </div>
        </div>

        {/* Bouton ajouter */}
        <button
          onClick={() => setAddModal(true)}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "9px 18px",
            backgroundColor: "#3B82F6", color: "white",
            border: "none", borderRadius: 10,
            fontSize: 13, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 2px 8px rgba(59,130,246,0.3)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Ajouter un fournisseur
        </button>
      </div>

      {error && (
        <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "14px 18px", marginBottom: 20, fontSize: 13, color: "#DC2626" }}>
          Impossible de charger les fournisseurs. Veuillez réessayer.
        </div>
      )}

      {/* Grille */}
      <div className="dash-grid-2">
        {loading && [1, 2, 3, 4].map((i) => <Skeleton key={i} />)}

        {!loading && liste.length === 0 && (
          <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "60px 0", color: colors.textMuted, fontSize: 14 }}>
            {filtre === "inactifs" ? "Aucun fournisseur inactif." : "Aucun fournisseur trouvé."}
          </div>
        )}

        {!loading && liste.map((s) => {
          const actif = s.actif !== false;
          return (
            <div key={s.id} style={{ backgroundColor: colors.bgCard, borderRadius: 16, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", opacity: actif ? 1 : 0.75 }}>

              {/* En-tête carte */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: actif ? "#EFF6FF" : "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={actif ? "#3B82F6" : "#9CA3AF"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
                      <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: colors.navy }}>{s.nom}</div>
                    <div style={{ fontSize: 12, color: colors.textMuted }}>{s.pays || "—"}</div>
                  </div>
                </div>
                <span style={{ padding: "4px 12px", borderRadius: 12, fontSize: 11, fontWeight: 700, backgroundColor: actif ? "#DCFCE7" : "#F3F4F6", color: actif ? "#16A34A" : "#9CA3AF", flexShrink: 0 }}>
                  {actif ? "actif" : "inactif"}
                </span>
              </div>

              {/* Infos */}
              <div className="form-row-2" style={{ gap: 10, marginBottom: 14 }}>
                {[
                  { label: "Délai livraison",      value: s.delai_livraison       || "—" },
                  { label: "Conditions paiement",  value: s.conditions_paiement   || "—" },
                  { label: "Contact",              value: s.contact_nom           || "—" },
                  { label: "Référence",            value: s.id?.slice(0, 8).toUpperCase() },
                ].map((item) => (
                  <div key={item.label} style={{ padding: "10px 12px", backgroundColor: colors.bgSurface, borderRadius: 10 }}>
                    <div style={{ fontSize: 10, color: colors.textMuted, marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontWeight: 700, fontSize: 12, color: colors.navy }}>{item.value}</div>
                  </div>
                ))}
              </div>

              {/* Contact email / tél */}
              <div style={{ padding: "10px 12px", backgroundColor: colors.bgSurface, borderRadius: 10, marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: colors.textMuted, marginBottom: 2 }}>Contact</div>
                <div style={{ fontSize: 13, color: "#3B82F6" }}>{s.email || "—"}</div>
                <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{s.telephone || "—"}</div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 6 }}>
                {actif && (
                  <button
                    onClick={() => setCommandModal(s)}
                    style={{ flex: 1, padding: "9px", backgroundColor: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                  >
                    Commander
                  </button>
                )}
                <button
                  onClick={() => setEditModal(s)}
                  style={{ flex: 1, padding: "9px", backgroundColor: colors.bgSurface, color: colors.text, border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  Modifier
                </button>
                <button
                  onClick={() => handleToggleActif(s)}
                  disabled={toggling === s.id}
                  style={{
                    padding: "9px 12px",
                    backgroundColor: actif ? "#FEF2F2" : "#F0FDF4",
                    color: actif ? "#DC2626" : "#16A34A",
                    border: `1px solid ${actif ? "#FECACA" : "#BBF7D0"}`,
                    borderRadius: 8, fontSize: 12, fontWeight: 600,
                    cursor: toggling === s.id ? "wait" : "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {toggling === s.id ? "…" : actif ? "Désactiver" : "Réactiver"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
      </>
      )}
    </Layout>
  );
}
