/**
 * MedOS — Edge Function: send-activation-email
 *
 * Declenchee par un webhook pg_net sur UPDATE de la table etablissements.
 * Gere deux cas :
 *   - actif passe de false a true  → Email 3 : compte valide
 *   - statut_inscription passe a "refuse" → Email 4 : compte refuse
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY   = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FROM_EMAIL       = "MedOS <noreply@mail.kelagroup.org>";
const APP_URL          = Deno.env.get("APP_URL") ?? "http://81.17.98.80";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

// ─── Types ────────────────────────────────────────────────────────────────────

interface Etablissement {
  id:                  string;
  nom:                 string;
  type:                string;
  ville:               string;
  pays:                string;
  email:               string;
  actif:               boolean;
  statut_inscription?: string;
  notes_inscription?:  Record<string, unknown>;
}

interface WebhookPayload {
  type:        "UPDATE";
  table:       string;
  record:      Etablissement;
  old_record?: Etablissement;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend ${res.status}: ${body}`);
  }
}

// ─── Email 3 — Compte valide ──────────────────────────────────────────────────

function emailCompteValide(etab: Etablissement): string {
  const notes = etab.notes_inscription ?? {};
  const prenom = String(notes.responsable_prenom ?? "");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Compte MedOS active</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#065F46 0%,#059669 100%);padding:28px 36px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="color:#6EE7B7;font-size:24px;font-weight:900;letter-spacing:-0.5px;">Med</span><span style="color:white;font-size:24px;font-weight:900;letter-spacing:-0.5px;">OS</span>
                  <span style="display:block;color:#A7F3D0;font-size:11px;margin-top:4px;font-weight:500;letter-spacing:2px;">COMPTE ACTIVE</span>
                </td>
                <td align="right">
                  <span style="background:white;color:#059669;padding:6px 14px;border-radius:16px;font-size:11px;font-weight:800;">VALIDE</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 36px;">
            <h1 style="margin:0 0 6px;font-size:20px;font-weight:800;color:#0A1628;">Bienvenue sur MedOS !</h1>
            <p style="margin:0 0 24px;font-size:13px;color:#6B7280;line-height:1.6;">
              ${prenom ? `Bonjour ${prenom},` : "Bonjour,"}<br/><br/>
              Votre compte pour l'etablissement <strong style="color:#0A1628;">${etab.nom}</strong>
              a ete valide par notre equipe. Vous pouvez desormais vous connecter a la plateforme.
            </p>

            <!-- Acces -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:12px;overflow:hidden;margin-bottom:24px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 14px;font-size:13px;font-weight:700;color:#065F46;">Vos informations de connexion</p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:6px 0;">
                        <span style="font-size:12px;color:#6B7280;font-weight:600;display:block;margin-bottom:2px;">Adresse de la plateforme</span>
                        <a href="${APP_URL}" style="font-size:14px;font-weight:800;color:#059669;text-decoration:none;">${APP_URL}</a>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:10px 0 6px;border-top:1px solid #A7F3D0;margin-top:10px;">
                        <span style="font-size:12px;color:#6B7280;font-weight:600;display:block;margin-bottom:2px;">Identifiant (email)</span>
                        <span style="font-size:14px;font-weight:700;color:#0A1628;">${etab.email}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:10px 0 0;border-top:1px solid #A7F3D0;">
                        <span style="font-size:12px;color:#6B7280;font-weight:600;display:block;margin-bottom:2px;">Mot de passe</span>
                        <span style="font-size:13px;color:#374151;">Celui que vous avez choisi lors de l'inscription.</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td align="center">
                  <a href="${APP_URL}" style="display:inline-block;background:linear-gradient(135deg,#059669,#065F46);color:white;text-decoration:none;padding:14px 40px;border-radius:10px;font-size:14px;font-weight:700;letter-spacing:0.3px;">
                    Se connecter a MedOS
                  </a>
                </td>
              </tr>
            </table>

            <!-- Prochaines etapes -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F4FB;border-left:4px solid #3B82F6;border-radius:0 8px 8px 0;margin-bottom:8px;">
              <tr>
                <td style="padding:14px 18px;">
                  <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#1D4ED8;">Prochaines etapes</p>
                  <p style="margin:0;font-size:13px;color:#2563EB;line-height:1.7;">
                    Connectez-vous avec vos identifiants ci-dessus.<br/>
                    Depuis les parametres, vous pouvez inviter votre equipe et configurer votre etablissement.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F8FAFC;padding:18px 36px;border-top:1px solid #E5E7EB;">
            <p style="margin:0;font-size:11px;color:#9CA3AF;text-align:center;line-height:1.8;">
              MedOS — Intelligence Medicale Africaine<br/>
              Pour toute question : <a href="mailto:contact@kelagroup.org" style="color:#6B7280;">contact@kelagroup.org</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Email 4 — Compte refuse ──────────────────────────────────────────────────

function emailCompteRefuse(etab: Etablissement): string {
  const notes = etab.notes_inscription ?? {};
  const prenom = String(notes.responsable_prenom ?? "");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Demande MedOS — Decision</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0A1628 0%,#1E3A5F 100%);padding:28px 36px;">
            <span style="color:#3B82F6;font-size:24px;font-weight:900;letter-spacing:-0.5px;">Med</span><span style="color:white;font-size:24px;font-weight:900;letter-spacing:-0.5px;">OS</span>
            <span style="display:block;color:#93C5FD;font-size:11px;margin-top:4px;font-weight:500;letter-spacing:2px;">DECISION SUR VOTRE DEMANDE</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 36px;">
            <h1 style="margin:0 0 6px;font-size:20px;font-weight:800;color:#0A1628;">Votre demande n'a pas ete acceptee</h1>
            <p style="margin:0 0 24px;font-size:13px;color:#6B7280;line-height:1.6;">
              ${prenom ? `Bonjour ${prenom},` : "Bonjour,"}<br/><br/>
              Apres examen de votre dossier pour l'etablissement
              <strong style="color:#0A1628;">${etab.nom}</strong>,
              nous ne sommes pas en mesure de valider votre acces a la plateforme MedOS a ce stade.
            </p>

            <!-- Bandeau raison -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;margin-bottom:24px;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#DC2626;">Raison du refus</p>
                  <p style="margin:0;font-size:13px;color:#374151;line-height:1.7;">
                    Votre numero de licence (${etab.licence_numero || "non renseigne"}) n'a pas pu etre verifie aupres du Ministere de la Sante,
                    ou les informations fournies sont incompletes ou incorrectes.
                  </p>
                </td>
              </tr>
            </table>

            <!-- Que faire -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F4FB;border-left:4px solid #3B82F6;border-radius:0 8px 8px 0;margin-bottom:24px;">
              <tr>
                <td style="padding:14px 18px;">
                  <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#1D4ED8;">Que faire ?</p>
                  <p style="margin:0;font-size:13px;color:#2563EB;line-height:1.7;">
                    Si vous pensez qu'il s'agit d'une erreur ou si votre situation a change,
                    contactez-nous a <a href="mailto:contact@kelagroup.org" style="color:#2563EB;font-weight:700;">contact@kelagroup.org</a>
                    en joignant une copie de votre licence officielle.
                    Nous reexaminerons votre dossier dans les meilleurs delais.
                  </p>
                </td>
              </tr>
            </table>

            <p style="margin:0;font-size:13px;color:#6B7280;line-height:1.6;">
              Nous restons disponibles pour tout renseignement complementaire.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F8FAFC;padding:18px 36px;border-top:1px solid #E5E7EB;">
            <p style="margin:0;font-size:11px;color:#9CA3AF;text-align:center;line-height:1.8;">
              MedOS — Intelligence Medicale Africaine<br/>
              <a href="mailto:contact@kelagroup.org" style="color:#6B7280;">contact@kelagroup.org</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Verification du secret webhook
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

  if (type !== "UPDATE" || !record?.email) {
    return new Response(JSON.stringify({ skipped: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const etab = record;
  const old  = old_record;

  // Recuperer les notes_inscription depuis la DB (elles ne sont pas toujours dans le payload webhook)
  if (!etab.notes_inscription && etab.id) {
    const { data } = await supabase
      .from("etablissements")
      .select("notes_inscription, licence_numero")
      .eq("id", etab.id)
      .maybeSingle();
    if (data) {
      etab.notes_inscription = data.notes_inscription ?? {};
      if (!etab.licence_numero && data.licence_numero) {
        (etab as unknown as Record<string, unknown>).licence_numero = data.licence_numero;
      }
    }
  }

  const actions: string[] = [];

  // Cas 1 : actif vient de passer a true → email compte valide
  if (etab.actif === true && old?.actif === false) {
    try {
      await sendEmail(
        etab.email,
        "Votre compte MedOS est active — Bienvenue !",
        emailCompteValide(etab),
      );
      actions.push("email-3-valide");
      console.log("[email-3] Compte valide envoye a", etab.email);
    } catch (e) {
      console.error("[email-3] Echec:", e);
    }
  }

  // Cas 2 : statut_inscription vient de passer a "refuse"
  const wasRefuse = old?.statut_inscription !== "refuse";
  const isRefuse  = etab.statut_inscription === "refuse";
  if (isRefuse && wasRefuse) {
    try {
      await sendEmail(
        etab.email,
        "Demande d'acces MedOS — Decision concernant votre dossier",
        emailCompteRefuse(etab),
      );
      actions.push("email-4-refuse");
      console.log("[email-4] Refus envoye a", etab.email);
    } catch (e) {
      console.error("[email-4] Echec:", e);
    }
  }

  if (actions.length === 0) {
    return new Response(JSON.stringify({ skipped: true, reason: "no relevant change" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, actions }), {
    headers: { "Content-Type": "application/json" },
  });
});
