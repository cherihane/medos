/**
 * MedOS — Edge Function: invite-membre
 *
 * Provisionne un vrai compte de connexion (auth.users) pour un membre du
 * personnel invité depuis Paramètres, et lui envoie un email (via send-app-email
 * / Resend, pour garder le même branding que le reste de l'app) avec un lien
 * pour définir son mot de passe.
 *
 * AVANT ce correctif : le bouton "Nouvelle invitation" de Paramètres.jsx ne
 * créait qu'une ligne dans membres_personnel (permissions) — aucun compte
 * auth.users n'était jamais créé, donc la personne invitée n'avait aucun moyen
 * réel de se connecter. Trouvé lors de l'audit exhaustif hôpital.
 *
 * Payload attendu : { email, role, role_interne, etablissement_id }
 * Authentification : JWT Supabase valide obligatoire, ET l'appelant doit être
 * le compte propriétaire de l'établissement (etablissements.email = son email)
 * — même règle que la policy RLS "membres_insert" déjà en place.
 *
 * IMPORTANT : role_interne DOIT être présent dans auth.users.user_metadata
 * pour que NAV_INTERNE (AuthContext.jsx) restreigne correctement la navigation
 * — un compte créé sans ce champ obtiendrait par défaut un accès complet
 * (comportement existant d'AuthContext.jsx, fonction protégée, non modifié
 * ici — voir DEBUG_PROGRESS.md, audit exhaustif hôpital, pour le détail).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY    = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL             = "https://medos.kelagroup.org";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitePayload {
  email:             string;
  role:              string; // "hopital" | "pharmacie" | "distributeur" | "autorite"
  role_interne?:     string | null;
  etablissement_id:  string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response("Unauthorized", { status: 401, headers: CORS_HEADERS });
  }
  const jwt = authHeader.slice(7);

  // Client scopé au JWT de l'appelant — sert à vérifier son droit (RLS)
  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: { user: caller }, error: authError } = await callerClient.auth.getUser();
  if (authError || !caller) {
    return new Response("Unauthorized", { status: 401, headers: CORS_HEADERS });
  }

  let payload: InvitePayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: CORS_HEADERS });
  }
  const { email, role, role_interne, etablissement_id } = payload;
  if (!email || !role || !etablissement_id) {
    return new Response("Missing required fields: email, role, etablissement_id", { status: 400, headers: CORS_HEADERS });
  }

  // Vérifie que l'appelant est bien le propriétaire de cet établissement —
  // même condition que la policy RLS "membres_insert" (etablissements.email
  // = auth.jwt() ->> 'email'), pour ne pas ouvrir une provision de compte à
  // n'importe qui possédant juste un JWT valide.
  const { data: etab } = await callerClient
    .from("etablissements")
    .select("id, email, nom")
    .eq("id", etablissement_id)
    .eq("email", caller.email)
    .maybeSingle();
  if (!etab) {
    return new Response("Forbidden — vous n'êtes pas le propriétaire de cet établissement", { status: 403, headers: CORS_HEADERS });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const emailNorm = email.trim().toLowerCase();

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "invite",
    email: emailNorm,
    options: {
      data: { role, role_interne: role_interne ?? null },
      redirectTo: `${SITE_URL}/reinitialisation`,
    },
  });

  // Cas déjà couvert : la personne a déjà un compte auth.users (ex. déjà
  // membre d'un autre établissement, ou déjà invitée avant). On ne peut pas
  // générer un lien "invite" pour un compte existant — on l'informe par email
  // simple plutôt que de faire échouer toute l'opération.
  if (linkError) {
    if (linkError.message?.toLowerCase().includes("already been registered") ||
        linkError.message?.toLowerCase().includes("already registered")) {
      return new Response(JSON.stringify({ ok: true, dejaExistant: true }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    console.error("[invite-membre] generateLink error:", linkError.message);
    return new Response(`Erreur de provisionnement : ${linkError.message}`, { status: 500, headers: CORS_HEADERS });
  }

  const actionLink = linkData?.properties?.action_link;

  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
  <div style="background:#0F172A;padding:20px 32px"><p style="color:white;font-size:18px;font-weight:700;margin:0">MedOS</p></div>
  <div style="padding:24px 32px">
    <h2 style="color:#0F172A;font-size:17px;margin:0 0 12px">Vous avez été invité(e) sur MedOS</h2>
    <p style="font-size:14px;color:#111827">${etab.nom ?? "Votre établissement"} vous a invité(e) sur MedOS avec le rôle <strong>${role_interne ?? role}</strong>.</p>
    <p style="font-size:14px;color:#111827">Cliquez sur le bouton ci-dessous pour définir votre mot de passe et activer votre compte :</p>
    <p style="text-align:center;margin:24px 0">
      <a href="${actionLink}" style="background:#16A34A;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:700;display:inline-block">Définir mon mot de passe</a>
    </p>
    <p style="font-size:12px;color:#9CA3AF">Ce lien est à usage personnel, ne le partagez pas.</p>
  </div>
  <div style="background:#F8FAFC;padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center"><p style="font-size:12px;color:#9CA3AF;margin:0">MedOS</p></div>
</div>`;

  try {
    await callerClient.functions.invoke("send-app-email", {
      body: { to: emailNorm, subject: "MedOS — Définissez votre mot de passe", html },
    });
  } catch (e) {
    console.error("[invite-membre] send-app-email error (non bloquant):", e);
  }

  return new Response(JSON.stringify({ ok: true, dejaExistant: false }), {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});
