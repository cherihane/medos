/**
 * MedOS — Edge Function: generate-bon-commande-pdf
 *
 * Génère le PDF du bon de commande fournisseur, à partir des mêmes données
 * que printBonCommande() côté frontend, pour l'attacher aux emails envoyés
 * via send-app-email (au fournisseur ET en notification interne).
 *
 * Payload attendu : {
 *   reference, etablissementNom,
 *   fournisseur: { nom, telephone, email, pays },
 *   medicamentNom, quantite, dateLivraison, montantTotal, notes
 * }
 * Réponse : { ok: true, pdfBase64, filename }
 *
 * Authentification : JWT Supabase valide obligatoire (même pattern que send-app-email).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// pdf-lib (police standard WinAnsi) ne supporte pas certains caractères Unicode
// que toLocaleString("fr-FR") introduit silencieusement (espace insécable fine
// U+202F comme séparateur de milliers, espace insécable U+00A0...). On les
// remplace par une espace ASCII normale avant tout drawText().
function pdfSafe(text: string): string {
  return text.replace(/[    ]/g, " ");
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

interface BonCommandePayload {
  reference?:        string;
  etablissementNom?: string;
  fournisseur?:       { nom?: string; telephone?: string; email?: string; pays?: string };
  medicamentNom?:     string;
  quantite?:          number | string;
  lignes?:            { nom?: string; quantite?: number | string }[];
  dateLivraison?:     string | null;
  montantTotal?:      number;
  notes?:             string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  }

  // ── Vérification JWT (même pattern que send-app-email) ──────────────────────
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

  let payload: BonCommandePayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: CORS_HEADERS });
  }

  const {
    reference = "", etablissementNom = "MedOS", fournisseur = {},
    medicamentNom = "—", quantite = "—", lignes,
    dateLivraison = null, montantTotal = 0, notes = "",
  } = payload;

  // Rétrocompatible : les appelants historiques envoient un seul médicament
  // (medicamentNom/quantite) ; les commandes multi-produits envoient `lignes`.
  const lignesAffichees = (lignes && lignes.length > 0)
    ? lignes
    : [{ nom: medicamentNom, quantite }];

  try {
    const pdfDoc = await PDFDocument.create();
    const page   = pdfDoc.addPage([595.28, 841.89]); // A4
    const font   = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const navy  = rgb(0.039, 0.086, 0.157);
    const gray  = rgb(0.42, 0.45, 0.5);
    const black = rgb(0.06, 0.06, 0.08);
    const white = rgb(1, 1, 1);
    const left  = 50;
    const right = 545;

    let y = 790;

    const etabNomSafe = pdfSafe(etablissementNom);
    page.drawText("MedOS", { x: left, y, size: 22, font: bold, color: navy });
    const etabWidth = font.widthOfTextAtSize(etabNomSafe, 10);
    page.drawText(etabNomSafe, { x: right - etabWidth, y: y + 5, size: 10, font, color: gray });
    y -= 30;
    page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1.5, color: navy });
    y -= 32;

    page.drawText("Bon de commande fournisseur", { x: left, y, size: 16, font: bold, color: black });
    y -= 18;
    const dateFr = new Date().toLocaleDateString("fr-FR");
    page.drawText(pdfSafe(`${reference} — Émis le ${dateFr}`), { x: left, y, size: 10, font, color: gray });
    y -= 34;

    const section = (titre: string) => {
      page.drawText(pdfSafe(titre), { x: left, y, size: 10, font: bold, color: gray });
      y -= 18;
    };
    const ligne = (texte: string) => {
      page.drawText(pdfSafe(texte), { x: left, y, size: 11, font, color: black });
      y -= 17;
    };

    section("FOURNISSEUR");
    ligne(`Nom : ${fournisseur.nom ?? "—"}`);
    ligne(`Téléphone : ${fournisseur.telephone ?? "—"}`);
    ligne(`Email : ${fournisseur.email ?? "—"}`);
    ligne(`Pays : ${fournisseur.pays ?? "—"}`);
    y -= 14;

    section("DÉTAILS DE LA COMMANDE");
    ligne(`Date de livraison souhaitée : ${dateLivraison ? new Date(dateLivraison).toLocaleDateString("fr-FR") : "Non précisée"}`);
    ligne(`Montant total estimé : ${montantTotal > 0 ? montantTotal.toLocaleString("fr-FR") + " FCFA" : "—"}`);
    ligne(`Notes : ${notes || "Aucune"}`);
    y -= 14;

    section("MÉDICAMENTS COMMANDÉS");
    page.drawRectangle({ x: left, y: y - 6, width: right - left, height: 24, color: navy });
    page.drawText("Médicament", { x: left + 10, y: y + 1, size: 10, font: bold, color: white });
    page.drawText("Quantité", { x: right - 90, y: y + 1, size: 10, font: bold, color: white });
    y -= 30;
    for (const l of lignesAffichees) {
      page.drawText(pdfSafe(String(l.nom ?? "—")), { x: left + 10, y, size: 11, font, color: black });
      page.drawText(pdfSafe(String(l.quantite ?? "—")), { x: right - 90, y, size: 11, font, color: black });
      y -= 20;
    }
    y += 10;
    page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.5, color: gray });

    page.drawText("MedOS — Intelligence Médicale Africaine", { x: left, y: 50, size: 9, font, color: gray });
    page.drawText(pdfSafe(`Document généré le ${new Date().toLocaleString("fr-FR")}`), { x: left, y: 38, size: 8, font, color: gray });

    const pdfBytes = await pdfDoc.save();
    const pdfBase64 = uint8ToBase64(pdfBytes);
    const filename = `bon-de-commande-${reference || "medos"}.pdf`;

    return new Response(JSON.stringify({ ok: true, pdfBase64, filename }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[generate-bon-commande-pdf] Erreur génération PDF:", e.message);
    return new Response("Erreur génération PDF: " + e.message, { status: 500, headers: CORS_HEADERS });
  }
});
