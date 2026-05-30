/**
 * MedOS — Edge Function: check-stock-alert
 *
 * Déclenchée par un webhook Supabase sur chaque UPDATE de medicaments.
 * Si stock_actuel < stock_minimum :
 *   1. Insère une alerte dans la table alertes (si pas déjà active)
 *   2. Envoie un email professionnel via Resend au gérant
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY   = Deno.env.get("RESEND_API_KEY")!;
const APP_URL          = Deno.env.get("APP_URL") ?? "http://localhost:3000";

// Email du gérant (peut être surchargé par etablissement.email)
const ADMIN_EMAIL      = Deno.env.get("ADMIN_EMAIL") ?? "admin@medos.app";
const FROM_EMAIL       = "MedOS Alertes <alertes@medos.app>";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

// ─── Types ────────────────────────────────────────────────────────────────────
interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: Medicament;
  old_record?: Medicament;
}

interface Medicament {
  id: string;
  nom: string;
  code?: string;
  categorie?: string;
  stock_actuel: number;
  stock_minimum: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Vérifie si une alerte rupture non résolue existe déjà pour ce médicament */
async function alerteExisteDeja(medicamentId: string): Promise<boolean> {
  const { data } = await supabase
    .from("alertes")
    .select("id")
    .eq("medicament_id", medicamentId)
    .eq("type", "rupture")
    .eq("resolu", false)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/** Insère une alerte dans la table alertes */
async function insererAlerte(med: Medicament): Promise<void> {
  const { error } = await supabase.from("alertes").insert({
    type: "rupture",
    severite: med.stock_actuel === 0 ? "critique" : "alerte",
    titre: `Rupture de stock : ${med.nom}`,
    message: `Le stock de ${med.nom} (${med.stock_actuel} unités) est passé sous le seuil minimum (${med.stock_minimum} unités). Réapprovisionnement requis.`,
    medicament_id: med.id,
    lu: false,
    resolu: false,
  });
  if (error) console.error("[alerte] Erreur insertion:", error.message);
}

/** Résout les alertes rupture si le stock est repassé au-dessus du seuil */
async function resoudreAlertes(medicamentId: string): Promise<void> {
  const { error } = await supabase
    .from("alertes")
    .update({ resolu: true })
    .eq("medicament_id", medicamentId)
    .eq("type", "rupture")
    .eq("resolu", false);
  if (error) console.error("[alerte] Erreur résolution:", error.message);
}

/** Construit et envoie l'email via Resend */
async function envoyerEmail(med: Medicament, destinataire: string): Promise<void> {
  const stockUrl = `${APP_URL}/pharmacie/inventaire`;
  const severite = med.stock_actuel === 0 ? "RUPTURE TOTALE" : "STOCK CRITIQUE";
  const couleur  = med.stock_actuel === 0 ? "#DC2626" : "#D97706";
  const bgCouleur = med.stock_actuel === 0 ? "#FEF2F2" : "#FFFBEB";

  const pct = med.stock_minimum > 0
    ? Math.round((med.stock_actuel / med.stock_minimum) * 100)
    : 0;

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Alerte Stock MedOS</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="580" cellpadding="0" cellspacing="0" style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0A1628 0%,#1E3A5F 100%);padding:28px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="color:#3B82F6;font-size:22px;font-weight:900;letter-spacing:-0.5px;">Med</span><span style="color:white;font-size:22px;font-weight:900;letter-spacing:-0.5px;">OS</span>
                    <span style="display:block;color:#93C5FD;font-size:11px;margin-top:2px;font-weight:500;letter-spacing:2px;">SYSTÈME D'ALERTE STOCK</span>
                  </td>
                  <td align="right">
                    <span style="background:${couleur};color:white;padding:6px 14px;border-radius:20px;font-size:11px;font-weight:800;letter-spacing:1px;">${severite}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Alert Banner -->
          <tr>
            <td style="background:${bgCouleur};border-bottom:3px solid ${couleur};padding:16px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size:14px;font-weight:700;color:${couleur};">
                      ⚠️ Le stock de <strong>${med.nom}</strong> est passé sous le seuil minimum
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:32px 36px;">
              <h2 style="margin:0 0 24px;font-size:20px;font-weight:800;color:#0A1628;">${med.nom}</h2>
              ${med.categorie ? `<p style="margin:0 0 20px;font-size:13px;color:#6B7280;text-transform:uppercase;letter-spacing:1px;font-weight:600;">${med.categorie}</p>` : ""}

              <!-- Stock Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border-radius:12px;overflow:hidden;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;border-bottom:1px solid #E5E7EB;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <span style="font-size:12px;color:#9CA3AF;display:block;margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Stock actuel</span>
                          <span style="font-size:32px;font-weight:900;color:${couleur};">${med.stock_actuel}</span>
                          <span style="font-size:14px;color:#6B7280;margin-left:4px;">unités</span>
                        </td>
                        <td align="right">
                          <span style="font-size:12px;color:#9CA3AF;display:block;margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Seuil minimum</span>
                          <span style="font-size:32px;font-weight:900;color:#374151;">${med.stock_minimum}</span>
                          <span style="font-size:14px;color:#6B7280;margin-left:4px;">unités</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <span style="font-size:12px;color:#6B7280;font-weight:600;">Niveau de stock</span>
                        </td>
                        <td align="right">
                          <span style="font-size:12px;font-weight:800;color:${couleur};">${pct}% du seuil</span>
                        </td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding-top:8px;">
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="background:#E5E7EB;border-radius:4px;height:8px;overflow:hidden;">
                                <table cellpadding="0" cellspacing="0" style="width:${Math.min(pct,100)}%;background:${couleur};height:8px;border-radius:4px;">
                                  <tr><td></td></tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Recommendation -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#EFF6FF;border-left:4px solid #3B82F6;border-radius:0 8px 8px 0;margin-bottom:28px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <span style="font-size:13px;color:#1E40AF;font-weight:700;display:block;margin-bottom:4px;">💡 Recommandation</span>
                    <span style="font-size:13px;color:#2563EB;line-height:1.6;">
                      Commander au minimum <strong>${Math.max(0, med.stock_minimum * 3 - med.stock_actuel)} unités</strong> pour reconstituer un stock de 3 mois.
                    </span>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${stockUrl}" style="display:inline-block;background:linear-gradient(135deg,#3B82F6,#2563EB);color:white;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:14px;font-weight:700;letter-spacing:0.3px;">
                      📦 Voir la page Stock dans MedOS
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F8FAFC;padding:20px 36px;border-top:1px solid #E5E7EB;">
              <p style="margin:0;font-size:11px;color:#9CA3AF;text-align:center;line-height:1.8;">
                Cet email a été envoyé automatiquement par <strong style="color:#6B7280;">MedOS</strong> — Système de gestion pharmaceutique.<br/>
                Alerte générée le ${new Date().toLocaleString("fr-FR", { timeZone: "Africa/Kinshasa", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })} (heure Kinshasa)
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [destinataire],
      subject: `⚠️ ${severite} — ${med.nom} (${med.stock_actuel} unités restantes)`,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[email] Resend erreur:", res.status, body);
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }

  console.log("[email] Envoyé avec succès à", destinataire);
}

// ─── Handler principal ────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  // Vérification méthode
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Vérification secret webhook (optionnel mais recommandé)
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
  if (webhookSecret) {
    const authHeader = req.headers.get("x-webhook-secret");
    if (authHeader !== webhookSecret) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { type, record, old_record } = payload;

  // On ne traite que les updates (et inserts avec stock déjà bas)
  if (type !== "UPDATE" && type !== "INSERT") {
    return new Response(JSON.stringify({ skipped: true, reason: "not UPDATE/INSERT" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const med = record;

  // Cas 1 : stock repassé au-dessus du seuil → résoudre les alertes
  if (med.stock_actuel >= med.stock_minimum) {
    if (old_record && old_record.stock_actuel < old_record.stock_minimum) {
      console.log(`[stock] ${med.nom} repassé au-dessus du seuil — résolution alertes`);
      await resoudreAlertes(med.id);
    }
    return new Response(JSON.stringify({ ok: true, action: "resolved_or_ok" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Cas 2 : stock sous le seuil
  console.log(`[stock] ${med.nom} — stock ${med.stock_actuel} < seuil ${med.stock_minimum}`);

  // Éviter les doublons d'alertes
  const dejaAlerte = await alerteExisteDeja(med.id);

  if (!dejaAlerte) {
    // Insérer l'alerte en base
    await insererAlerte(med);
    console.log(`[alerte] Alerte créée pour ${med.nom}`);
  } else {
    console.log(`[alerte] Alerte déjà active pour ${med.nom} — pas de doublon`);
  }

  // Envoyer l'email (même si alerte déjà active, on notifie à chaque baisse)
  const stockChange = old_record
    ? old_record.stock_actuel !== med.stock_actuel
    : true;

  if (stockChange) {
    try {
      await envoyerEmail(med, ADMIN_EMAIL);
    } catch (err) {
      console.error("[email] Échec envoi:", err);
      // On ne fail pas la fonction si l'email échoue
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      medicament: med.nom,
      stock_actuel: med.stock_actuel,
      stock_minimum: med.stock_minimum,
      alerte_creee: !dejaAlerte,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
