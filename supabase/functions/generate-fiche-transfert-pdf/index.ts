/**
 * MedOS — Edge Function: generate-fiche-transfert-pdf
 *
 * Génère la fiche de transfert PDF pour un transfert de patient vers un
 * établissement HORS MedOS (pas de cycle proposé/accepté, juste une trace
 * d'émission — voir transferts_patients.est_externe). Pièce jointe de
 * l'email envoyé au contact externe via send-app-email.
 *
 * Exigence non négociable : les allergies du patient doivent être affichées
 * EN ÉVIDENCE (encadrées, en gras, en haut du document) — il n'y a personne
 * côté MedOS pour rattraper une omission côté destinataire externe.
 *
 * Payload attendu : {
 *   reference, etablissementOrigineNom,
 *   patient: { nom, prenom, dateNaissance, genre },
 *   destination: { nom, contact, email },
 *   motif, urgence, notesCliniques, medecinDemandeur, dateDemande,
 *   contexteClinique: { antecedents: string[], allergies: string[], groupe_sanguin,
 *                        dernier_compte_rendu: { date_consultation, motif, diagnostic, traitement } }
 * }
 * Réponse : { ok: true, pdfBase64, filename }
 *
 * Authentification : JWT Supabase valide obligatoire (même pattern que
 * generate-bon-commande-pdf / send-app-email).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
// Migration hors des clés legacy (audit sécurité 2026-08) : SUPABASE_ANON_KEY
// est remplacée par la clé "publishable" du nouveau système de clés API. Le
// dictionnaire est indexé par le nom donné à la clé dans le Dashboard — on
// prend la première valeur plutôt qu'un nom en dur.
const SUPABASE_ANON_KEY = Object.values(JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")!))[0] as string;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function pdfSafe(text: string): string {
  return (text ?? "").replace(/[    ]/g, " ");
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

interface FichePayload {
  reference?:              string;
  etablissementOrigineNom?: string;
  patient?:    { nom?: string; prenom?: string; dateNaissance?: string | null; genre?: string | null };
  destination?: { nom?: string; contact?: string; email?: string };
  motif?:      string;
  urgence?:    string;
  notesCliniques?: string | null;
  medecinDemandeur?: string | null;
  dateDemande?: string;
  contexteClinique?: {
    antecedents?: string[];
    allergies?:   string[];
    groupe_sanguin?: string | null;
    dernier_compte_rendu?: { date_consultation?: string; motif?: string; diagnostic?: string; traitement?: string } | null;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response("Unauthorized", { status: 401, headers: CORS_HEADERS });
  }
  const jwt = authHeader.slice(7);
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response("Unauthorized", { status: 401, headers: CORS_HEADERS });
  }

  let payload: FichePayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: CORS_HEADERS });
  }

  const {
    reference = "", etablissementOrigineNom = "MedOS",
    patient = {}, destination = {},
    motif = "—", urgence = "normale", notesCliniques = null,
    medecinDemandeur = null, dateDemande,
    contexteClinique = {},
  } = payload;

  const antecedents = contexteClinique.antecedents ?? [];
  const allergies    = contexteClinique.allergies ?? [];
  const groupeSanguin = contexteClinique.groupe_sanguin;
  const dcr = contexteClinique.dernier_compte_rendu;

  try {
    const pdfDoc = await PDFDocument.create();
    const page   = pdfDoc.addPage([595.28, 841.89]); // A4
    const font   = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const navy  = rgb(0.039, 0.086, 0.157);
    const gray  = rgb(0.42, 0.45, 0.5);
    const black = rgb(0.06, 0.06, 0.08);
    const red   = rgb(0.86, 0.15, 0.15);
    const redBg = rgb(0.996, 0.949, 0.949);
    const left  = 50;
    const right = 545;

    let y = 790;

    const etabWidth = font.widthOfTextAtSize(pdfSafe(etablissementOrigineNom), 10);
    page.drawText("MedOS", { x: left, y, size: 22, font: bold, color: navy });
    page.drawText(pdfSafe(etablissementOrigineNom), { x: right - etabWidth, y: y + 5, size: 10, font, color: gray });
    y -= 30;
    page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1.5, color: navy });
    y -= 32;

    page.drawText("Fiche de transfert de patient", { x: left, y, size: 16, font: bold, color: black });
    y -= 18;
    const dateFr = new Date().toLocaleDateString("fr-FR");
    page.drawText(pdfSafe(`${reference || "Transfert"} — Émis le ${dateFr}${urgence === "urgente" ? "  —  TRANSFERT URGENT" : ""}`), {
      x: left, y, size: 10, font, color: urgence === "urgente" ? red : gray,
    });
    y -= 30;

    // ─── Bloc allergies EN ÉVIDENCE, tout en haut, avant toute autre info ──────
    // Exigence non négociable : personne côté MedOS ne peut rattraper une
    // omission une fois le patient chez un destinataire externe.
    const allergiesTexte = allergies.length > 0 ? allergies.join(", ") : "AUCUNE ALLERGIE CONNUE";
    const boxHeight = allergies.length > 0 ? 54 : 40;
    page.drawRectangle({
      x: left, y: y - boxHeight, width: right - left, height: boxHeight,
      color: redBg, borderColor: red, borderWidth: 2,
    });
    page.drawText("ALLERGIES", { x: left + 12, y: y - 18, size: 12, font: bold, color: red });
    page.drawText(pdfSafe(allergiesTexte), { x: left + 12, y: y - 36, size: 13, font: bold, color: red });
    y -= boxHeight + 20;

    const section = (titre: string) => {
      page.drawText(pdfSafe(titre), { x: left, y, size: 10, font: bold, color: gray });
      y -= 18;
    };
    const ligne = (texte: string, opts: { color?: ReturnType<typeof rgb>; boldFont?: boolean } = {}) => {
      page.drawText(pdfSafe(texte), { x: left, y, size: 11, font: opts.boldFont ? bold : font, color: opts.color ?? black });
      y -= 17;
    };

    const ageAns = patient.dateNaissance
      ? Math.floor((Date.now() - new Date(patient.dateNaissance).getTime()) / (365.25 * 864e5))
      : null;

    section("PATIENT");
    ligne(`${patient.prenom ?? ""} ${patient.nom ?? ""}`.trim() || "—", { boldFont: true });
    ligne(`${ageAns != null ? `${ageAns} ans` : "Âge non renseigné"}${patient.genre ? ` · ${patient.genre}` : ""}`);
    ligne(`Groupe sanguin : ${groupeSanguin || "non renseigné"}`);
    y -= 8;

    section("ANTÉCÉDENTS");
    ligne(antecedents.length > 0 ? antecedents.join(", ") : "Aucun antécédent connu");
    y -= 8;

    if (dcr) {
      section("DERNIER COMPTE RENDU");
      ligne(`Date : ${dcr.date_consultation ? new Date(dcr.date_consultation).toLocaleDateString("fr-FR") : "—"}`);
      if (dcr.motif) ligne(`Motif : ${dcr.motif}`);
      if (dcr.diagnostic) ligne(`Diagnostic : ${dcr.diagnostic}`);
      if (dcr.traitement) ligne(`Traitement : ${dcr.traitement}`);
      y -= 8;
    }

    section("DÉTAILS DU TRANSFERT");
    ligne(`Motif du transfert : ${motif}`);
    ligne(`Urgence : ${urgence === "urgente" ? "Urgente" : "Normale"}`);
    if (medecinDemandeur) ligne(`Médecin demandeur : Dr. ${medecinDemandeur}`);
    if (dateDemande) ligne(`Date de la demande : ${new Date(dateDemande).toLocaleString("fr-FR")}`);
    if (notesCliniques) ligne(`Notes cliniques : ${notesCliniques}`);
    y -= 8;

    section("ÉTABLISSEMENT D'ORIGINE");
    ligne(etablissementOrigineNom || "—");
    y -= 8;

    section("ÉTABLISSEMENT DESTINATAIRE (HORS MEDOS)");
    ligne(`Nom : ${destination.nom ?? "—"}`);
    if (destination.contact) ligne(`Contact : ${destination.contact}`);
    if (destination.email) ligne(`Email : ${destination.email}`);

    page.drawLine({ start: { x: left, y: 60 }, end: { x: right, y: 60 }, thickness: 0.5, color: gray });
    page.drawText("MedOS — Intelligence Médicale Africaine", { x: left, y: 46, size: 9, font, color: gray });
    page.drawText(pdfSafe(`Document généré le ${new Date().toLocaleString("fr-FR")}`), { x: left, y: 34, size: 8, font, color: gray });

    const pdfBytes = await pdfDoc.save();
    const pdfBase64 = uint8ToBase64(pdfBytes);
    const filename = `fiche-transfert-${reference || "medos"}.pdf`;

    return new Response(JSON.stringify({ ok: true, pdfBase64, filename }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[generate-fiche-transfert-pdf] Erreur génération PDF:", e.message);
    return new Response("Erreur génération PDF: " + e.message, { status: 500, headers: CORS_HEADERS });
  }
});
