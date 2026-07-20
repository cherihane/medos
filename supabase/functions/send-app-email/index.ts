/**
 * MedOS — Edge Function: send-app-email
 *
 * Proxy d'envoi d'emails via Resend, côté serveur uniquement.
 * La clé RESEND_API_KEY ne quitte jamais le backend.
 *
 * Payload attendu : { to: string, subject: string, html: string, attachments?: { filename: string, content: string }[] }
 * attachments[].content = fichier encodé en base64 (ex: PDF généré par generate-bon-commande-pdf)
 * Cas spécial     : to === "admin_alert" → utilise ADMIN_ALERT_EMAIL (env var)
 *
 * Authentification : JWT Supabase valide obligatoire (Authorization: Bearer <jwt>)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY    = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ADMIN_ALERT_EMAIL = Deno.env.get("ADMIN_ALERT_EMAIL") ?? "cherihaneadam123@gmail.com";
const FROM_EMAIL        = "MedOS <noreply@mail.kelagroup.org>";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailAttachment {
  filename: string;
  content:  string; // base64
}

interface EmailPayload {
  to:          string;
  subject:     string;
  html:        string;
  attachments?: EmailAttachment[];
}

Deno.serve(async (req: Request) => {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  }

  // ── Vérification JWT ──────────────────────────────────────────────────────
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

  // ── Lecture du payload ────────────────────────────────────────────────────
  let payload: EmailPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: CORS_HEADERS });
  }

  const { to: toRaw, subject, html, attachments } = payload;
  if (!toRaw || !subject || !html) {
    return new Response("Missing required fields: to, subject, html", { status: 400, headers: CORS_HEADERS });
  }

  // Résolution de l'adresse admin si sentinel
  const to = toRaw === "admin_alert" ? ADMIN_ALERT_EMAIL : toRaw;

  // ── Envoi via Resend ──────────────────────────────────────────────────────
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL, to: [to], subject, html,
      ...(attachments?.length ? { attachments } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[send-app-email] Resend error:", res.status, body);
    return new Response(`Resend error ${res.status}: ${body}`, { status: 502, headers: CORS_HEADERS });
  }

  const resendResult = await res.json();
  console.log("[send-app-email] Email envoyé à", to, "| Sujet:", subject, "| Resend id:", resendResult.id);

  return new Response(JSON.stringify({ ok: true, id: resendResult.id }), {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});
