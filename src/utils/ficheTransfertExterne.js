/**
 * Fiche de transfert de patient vers un établissement HORS MedOS — impression
 * client (openDocument) + génération PDF serveur pour pièce jointe email.
 *
 * Exigence non négociable : les allergies doivent être affichées EN ÉVIDENCE
 * (encadrées, en gras, en haut du document) sur les deux formats — personne
 * côté MedOS ne peut rattraper une omission une fois le patient chez un
 * destinataire externe qui n'a pas accès à MedOS.
 */
import { supabase } from "../supabaseClient";
import { openDocument, sectionHTML, infoGridHTML } from "./MedOSDocument";

function allergiesBlockHTML(allergies) {
  const texte = allergies && allergies.length > 0 ? allergies.join(", ") : "AUCUNE ALLERGIE CONNUE";
  return `
    <div style="background:#FEF2F2;border:2.5px solid #DC2626;border-radius:10px;padding:14px 18px;margin-bottom:6px;">
      <div style="font-size:11px;font-weight:800;color:#DC2626;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Allergies</div>
      <div style="font-size:15px;font-weight:800;color:#7F1D1D;">${texte}</div>
    </div>`;
}

/**
 * Ouvre la fiche imprimable côté client (fenêtre + bouton Imprimer) — les
 * allergies apparaissent dans la toute première section, avant même le motif
 * du transfert.
 */
export async function imprimerFicheTransfertExterne({ transfert, etabOrigineNom }) {
  const ctx = transfert.contexte_clinique ?? {};
  const dcr = ctx.dernier_compte_rendu;
  const ageAns = transfert.patient_date_naissance
    ? Math.floor((Date.now() - new Date(transfert.patient_date_naissance)) / (365.25 * 864e5))
    : null;

  const sections = [
    {
      titre: "ALLERGIES",
      html: allergiesBlockHTML(ctx.allergies),
    },
    {
      titre: "Patient",
      html: infoGridHTML([
        { label: "Nom", value: `${transfert.patient_prenom} ${transfert.patient_nom}` },
        { label: "Âge", value: ageAns != null ? `${ageAns} ans` : "—" },
        { label: "Genre", value: transfert.patient_genre || "—" },
        { label: "Groupe sanguin", value: ctx.groupe_sanguin || "non renseigné" },
      ]),
    },
    {
      titre: "Antécédents",
      html: `<p style="font-size:13px;color:#0A1628;">${(ctx.antecedents ?? []).join(", ") || "Aucun antécédent connu"}</p>`,
    },
    ...(dcr ? [{
      titre: "Dernier compte rendu",
      html: infoGridHTML([
        { label: "Date", value: dcr.date_consultation ? new Date(dcr.date_consultation).toLocaleDateString("fr-FR") : "—" },
        { label: "Motif", value: dcr.motif || "—" },
        { label: "Diagnostic", value: dcr.diagnostic || "—" },
        { label: "Traitement", value: dcr.traitement || "—" },
      ], 2),
    }] : []),
    {
      titre: "Détails du transfert",
      html: infoGridHTML([
        { label: "Motif", value: transfert.motif },
        { label: "Urgence", value: transfert.urgence === "urgente" ? "Urgente" : "Normale" },
        { label: "Médecin demandeur", value: transfert.medecin_demandeur ? `Dr. ${transfert.medecin_demandeur}` : "—" },
        { label: "Notes cliniques", value: transfert.notes_cliniques || "Aucune" },
      ], 2),
    },
    {
      titre: "Établissement destinataire (hors MedOS)",
      html: infoGridHTML([
        { label: "Nom", value: transfert.destination_externe_nom || "—" },
        { label: "Contact", value: transfert.destination_externe_contact || "—" },
        { label: "Email", value: transfert.destination_externe_email || "—" },
      ]),
    },
  ];

  openDocument({
    titre: "Fiche de transfert de patient",
    sousTitre: transfert.urgence === "urgente" ? "TRANSFERT URGENT" : "",
    etablissement: { nom: etabOrigineNom },
    sections,
    autoprint: false,
  });
}

/** Génère la fiche PDF côté serveur (pour pièce jointe email) via l'Edge Function. */
async function genererFicheTransfertPdf({ transfert, etabOrigineNom }) {
  try {
    const { data, error } = await supabase.functions.invoke("generate-fiche-transfert-pdf", {
      body: {
        reference: transfert.id?.slice(0, 8).toUpperCase(),
        etablissementOrigineNom: etabOrigineNom,
        patient: {
          nom: transfert.patient_nom, prenom: transfert.patient_prenom,
          dateNaissance: transfert.patient_date_naissance, genre: transfert.patient_genre,
        },
        destination: {
          nom: transfert.destination_externe_nom,
          contact: transfert.destination_externe_contact,
          email: transfert.destination_externe_email,
        },
        motif: transfert.motif, urgence: transfert.urgence,
        notesCliniques: transfert.notes_cliniques,
        medecinDemandeur: transfert.medecin_demandeur,
        dateDemande: transfert.date_demande,
        contexteClinique: transfert.contexte_clinique,
      },
    });
    if (error || !data?.pdfBase64) return null;
    return { filename: data.filename, content: data.pdfBase64 };
  } catch {
    return null;
  }
}

/**
 * Envoie la fiche de transfert par email au contact externe, avec le PDF en
 * pièce jointe. Lève une erreur explicite si aucun email n'est renseigné ou
 * si l'envoi échoue — jamais de faux succès silencieux.
 */
export async function envoyerFicheTransfertExterne({ transfert, etabOrigineNom }) {
  if (!transfert.destination_externe_email?.trim()) {
    throw new Error("Aucune adresse email renseignée pour ce destinataire — la fiche n'a pas été envoyée par email (imprimez-la et transmettez-la par un autre moyen).");
  }

  const pieceJointe = await genererFicheTransfertPdf({ transfert, etabOrigineNom });
  const ctx = transfert.contexte_clinique ?? {};
  const allergiesTexte = (ctx.allergies ?? []).length > 0 ? ctx.allergies.join(", ") : "Aucune allergie connue";

  const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#0A1628;padding:24px 32px;border-radius:8px 8px 0 0">
    <h1 style="color:white;font-size:18px;margin:0">Transfert de patient — ${etabOrigineNom}</h1>
  </div>
  <div style="padding:24px 32px;border:1px solid #e5e7eb;border-top:none">
    <p style="font-size:14px;color:#374151">
      ${transfert.destination_externe_contact ? `Bonjour ${transfert.destination_externe_contact},` : "Bonjour,"}
    </p>
    <p style="font-size:14px;color:#374151">
      ${etabOrigineNom} vous transmet le transfert du patient <strong>${transfert.patient_prenom} ${transfert.patient_nom}</strong>.
      La fiche complète est jointe à cet email (PDF).
    </p>
    <div style="background:#FEF2F2;border:2px solid #DC2626;border-radius:8px;padding:14px 18px;margin:16px 0">
      <div style="font-size:11px;font-weight:800;color:#DC2626;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Allergies</div>
      <div style="font-size:15px;font-weight:800;color:#7F1D1D">${allergiesTexte}</div>
    </div>
    <p style="font-size:13px;color:#374151">
      <strong>Motif du transfert :</strong> ${transfert.motif}<br/>
      <strong>Urgence :</strong> ${transfert.urgence === "urgente" ? "Urgente" : "Normale"}
    </p>
    <p style="font-size:12px;color:#9CA3AF;margin-top:24px">
      Émis le ${new Date().toLocaleDateString("fr-FR")}
    </p>
  </div>
  <div style="background:#F8FAFC;padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center">
    <p style="font-size:12px;color:#9CA3AF;margin:0">MedOS — ${etabOrigineNom}</p>
  </div>
</div>`;

  const { error } = await supabase.functions.invoke("send-app-email", {
    body: {
      to: transfert.destination_externe_email,
      subject: `Transfert de patient — ${transfert.patient_prenom} ${transfert.patient_nom}`,
      html,
      ...(pieceJointe ? { attachments: [pieceJointe] } : {}),
    },
  });
  if (error) {
    throw new Error(`L'email n'a pas pu être envoyé à ${transfert.destination_externe_email} : ${error.message}`);
  }
}
