/**
 * MedOS — Edge Function: send-inscription-email
 *
 * Appelee depuis le frontend apres soumission du formulaire d'inscription.
 * Envoie deux emails en parallele :
 *   1. Confirmation de reception a l'organisme demandeur
 *   2. Notification a l'admin MedOS (contact@kelagroup.org) avec toutes les infos
 *
 * Invocation : supabase.functions.invoke("send-inscription-email", { body: payload })
 */

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL     = "MedOS <noreply@mail.kelagroup.org>";
const ADMIN_EMAIL    = "contact@kelagroup.org";
const APP_URL        = Deno.env.get("APP_URL") ?? "http://81.17.98.80";
const SUPABASE_DASHBOARD = "https://supabase.com/dashboard";

// ─── Types ────────────────────────────────────────────────────────────────────

interface InscriptionPayload {
  nom:                string;
  type:               string;
  ville:              string;
  pays:               string;
  email:              string;
  adresse?:           string;
  licence_numero:     string;
  responsable_prenom?: string;
  responsable_nom?:   string;
  telephone?:         string;
  notes_inscription?: Record<string, unknown>;
}

// ─── Helpers email ────────────────────────────────────────────────────────────

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    pharmacie:    "Pharmacie",
    hopital:      "Hopital / Clinique",
    distributeur: "Distributeur pharmaceutique",
    autorite:     "Autorite sanitaire",
  };
  return map[type] ?? type;
}

function infoRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:9px 14px;font-size:12px;font-weight:600;color:#6B7280;background:#F8FAFC;border-bottom:1px solid #E5E7EB;width:36%;">${label}</td>
      <td style="padding:9px 14px;font-size:13px;color:#0A1628;background:white;border-bottom:1px solid #E5E7EB;">${value || "—"}</td>
    </tr>`;
}

// ─── Email 1 — Confirmation a l'organisme ─────────────────────────────────────

function emailConfirmationOrganisme(p: InscriptionPayload): string {
  const dateStr = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric",
  });

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Demande MedOS recue</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0A1628 0%,#1E3A5F 100%);padding:28px 36px;">
            <span style="color:#3B82F6;font-size:24px;font-weight:900;letter-spacing:-0.5px;">Med</span><span style="color:white;font-size:24px;font-weight:900;letter-spacing:-0.5px;">OS</span>
            <span style="display:block;color:#93C5FD;font-size:11px;margin-top:4px;font-weight:500;letter-spacing:2px;">SYSTEME DE GESTION PHARMACEUTIQUE</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 36px;">
            <h1 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#0A1628;">Votre demande a ete recue</h1>
            <p style="margin:0 0 24px;font-size:13px;color:#6B7280;line-height:1.6;">
              Bonjour,<br/><br/>
              Nous avons bien recu votre demande d'acces a la plateforme MedOS pour l'etablissement
              <strong style="color:#0A1628;">${p.nom}</strong>.
            </p>

            <!-- Recapitulatif -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;margin-bottom:24px;">
              ${infoRow("Numero de dossier", p.email)}
              ${infoRow("Etablissement", p.nom)}
              ${infoRow("Type", typeLabel(p.type))}
              ${infoRow("Ville", `${p.ville}, ${p.pays}`)}
              ${infoRow("Licence", p.licence_numero)}
              ${infoRow("Date de depot", dateStr)}
            </table>

            <!-- Message principal -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#EFF6FF;border-left:4px solid #3B82F6;border-radius:0 8px 8px 0;margin-bottom:24px;">
              <tr>
                <td style="padding:16px 18px;">
                  <p style="margin:0;font-size:13px;color:#1E40AF;line-height:1.7;">
                    Notre equipe verifie votre licence officielle aupres du Ministere de la Sante.
                    Ce processus prend generalement <strong>24 a 48 heures ouvrables</strong>.
                  </p>
                  <p style="margin:8px 0 0;font-size:13px;color:#1E40AF;line-height:1.7;">
                    Vous recevrez une reponse par email a cette adresse des qu'une decision sera prise.
                    Si votre demande est acceptee, vos identifiants de connexion vous seront communiques directement.
                  </p>
                </td>
              </tr>
            </table>

            <p style="margin:0;font-size:13px;color:#6B7280;line-height:1.6;">
              Pour toute question, contactez-nous a <a href="mailto:${ADMIN_EMAIL}" style="color:#3B82F6;">${ADMIN_EMAIL}</a>.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F8FAFC;padding:18px 36px;border-top:1px solid #E5E7EB;">
            <p style="margin:0;font-size:11px;color:#9CA3AF;text-align:center;line-height:1.8;">
              MedOS — Intelligence Medicale Africaine<br/>
              Cet email a ete envoye automatiquement suite a votre inscription sur
              <a href="${APP_URL}" style="color:#6B7280;">${APP_URL}</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Email 2 — Notification admin ────────────────────────────────────────────

function emailNotificationAdmin(p: InscriptionPayload): string {
  const dateStr = new Date().toLocaleString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const notes = p.notes_inscription ?? {};
  const responsable = [notes.responsable_prenom, notes.responsable_nom]
    .filter(Boolean).join(" ") || "—";

  // Boutons qui renvoient vers le dashboard Supabase (l'admin met a jour manuellement)
  const btnValider = `${SUPABASE_DASHBOARD}/project/_/editor?query=UPDATE+etablissements+SET+actif%3Dtrue%2C+statut_inscription%3D%27valide%27+WHERE+email%3D%27${encodeURIComponent(p.email)}%27`;
  const btnRefuser = `${SUPABASE_DASHBOARD}/project/_/editor?query=UPDATE+etablissements+SET+statut_inscription%3D%27refuse%27+WHERE+email%3D%27${encodeURIComponent(p.email)}%27`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Nouvelle inscription MedOS</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 0;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0A1628 0%,#1E3A5F 100%);padding:24px 36px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="color:#3B82F6;font-size:22px;font-weight:900;">Med</span><span style="color:white;font-size:22px;font-weight:900;">OS</span>
                  <span style="display:block;color:#93C5FD;font-size:10px;margin-top:3px;letter-spacing:2px;font-weight:500;">ADMIN — NOUVELLE INSCRIPTION</span>
                </td>
                <td align="right">
                  <span style="background:#F59E0B;color:white;padding:5px 12px;border-radius:16px;font-size:11px;font-weight:800;letter-spacing:0.5px;">EN ATTENTE</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:28px 36px;">
            <h2 style="margin:0 0 6px;font-size:18px;font-weight:800;color:#0A1628;">Nouvelle demande d'acces</h2>
            <p style="margin:0 0 22px;font-size:12px;color:#9CA3AF;">Recue le ${dateStr}</p>

            <!-- Infos etablissement -->
            <h3 style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.8px;">Etablissement</h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;margin-bottom:20px;">
              ${infoRow("Nom", p.nom)}
              ${infoRow("Type", typeLabel(p.type))}
              ${infoRow("Ville", p.ville)}
              ${infoRow("Pays", p.pays)}
              ${infoRow("Adresse", p.adresse ?? "—")}
              ${infoRow("Licence", p.licence_numero)}
            </table>

            <!-- Infos responsable -->
            <h3 style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.8px;">Responsable</h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;margin-bottom:20px;">
              ${infoRow("Nom complet", responsable)}
              ${infoRow("Email", p.email)}
              ${infoRow("Telephone", String(notes.telephone ?? "—"))}
            </table>

            <!-- Infos specifiques -->
            ${Object.keys(notes).filter(k => !["responsable_prenom","responsable_nom","telephone"].includes(k)).length > 0 ? `
            <h3 style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.8px;">Details specifiques</h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;margin-bottom:24px;">
              ${Object.entries(notes)
                .filter(([k]) => !["responsable_prenom","responsable_nom","telephone"].includes(k))
                .map(([k, v]) => infoRow(k.replace(/_/g, " "), String(v ?? "—")))
                .join("")}
            </table>` : ""}

            <!-- Actions -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
              <tr>
                <td style="padding-right:8px;">
                  <a href="${btnValider}" style="display:block;text-align:center;background:#10B981;color:white;text-decoration:none;padding:13px 0;border-radius:8px;font-size:13px;font-weight:700;">
                    Valider le compte
                  </a>
                </td>
                <td style="padding-left:8px;">
                  <a href="${btnRefuser}" style="display:block;text-align:center;background:#EF4444;color:white;text-decoration:none;padding:13px 0;border-radius:8px;font-size:13px;font-weight:700;">
                    Refuser
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:8px 0 0;font-size:11px;color:#9CA3AF;text-align:center;line-height:1.6;">
              Ces boutons ouvrent le SQL Editor Supabase avec la requete pre-remplie.<br/>
              Verifiez les informations avant de valider. L'email automatique est envoye des que actif passe a true.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F8FAFC;padding:16px 36px;border-top:1px solid #E5E7EB;">
            <p style="margin:0;font-size:11px;color:#9CA3AF;text-align:center;">
              MedOS Admin — notification automatique d'inscription
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Envoi via Resend ─────────────────────────────────────────────────────────

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

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Log de diagnostic — visible dans Supabase Dashboard > Edge Functions > Logs
  console.log("[send-inscription-email] RESEND_API_KEY present:", !!RESEND_API_KEY);
  console.log("[send-inscription-email] FROM_EMAIL:", FROM_EMAIL);
  console.log("[send-inscription-email] ADMIN_EMAIL:", ADMIN_EMAIL);

  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let payload: InscriptionPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!payload.email || !payload.nom) {
    return new Response("email et nom requis", { status: 400 });
  }

  const errors: string[] = [];

  // Email 1 : confirmation a l'organisme
  try {
    await sendEmail(
      payload.email,
      `Demande d'acces MedOS recue — Dossier ${payload.email}`,
      emailConfirmationOrganisme(payload),
    );
    console.log("[email-1] Confirmation envoyee a", payload.email);
  } catch (e) {
    console.error("[email-1] Echec:", e);
    errors.push(`email-1: ${e}`);
  }

  // Email 2 : notification admin
  try {
    await sendEmail(
      ADMIN_EMAIL,
      `Nouvelle inscription MedOS — ${payload.nom} (${payload.pays})`,
      emailNotificationAdmin(payload),
    );
    console.log("[email-2] Notification admin envoyee");
  } catch (e) {
    console.error("[email-2] Echec:", e);
    errors.push(`email-2: ${e}`);
  }

  return new Response(
    JSON.stringify({ ok: errors.length === 0, errors }),
    { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
  );
});
