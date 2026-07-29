/**
 * MedOS — Edge Function: check-banque-sang-alert
 *
 * Déclenchée par un trigger sur chaque INSERT/UPDATE de poches_sang.
 * La banque de sang n'avait jusqu'ici QU'un bandeau visuel dans la page
 * BanqueSang.jsx (SEUIL_BAS) — aucune alerte persistée, aucun email : un
 * stock bas ou une rupture ne se voyait que si quelqu'un avait cette page
 * précise ouverte au bon moment. Trouvé lors de l'audit exhaustif hôpital
 * (mission : alertes cliniques banque de sang).
 *
 * Recompte, pour l'établissement et le groupe sanguin concernés, le nombre
 * de poches "disponible" — si <= SEUIL_BAS, crée/maintient une alerte et
 * envoie un email (même seuil que BanqueSang.jsx, gardé synchronisé
 * manuellement — pas de source unique partagée entre SQL et frontend ici).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY   = Deno.env.get("RESEND_API_KEY")!;
const APP_URL          = Deno.env.get("APP_URL") ?? "https://medos.kelagroup.org";
const ADMIN_EMAIL      = Deno.env.get("ADMIN_EMAIL") ?? "admin@medos.app";
const FROM_EMAIL       = "MedOS Alertes <alertes@mail.kelagroup.org>";
const SEUIL_BAS        = 2; // doit rester synchronisé avec SEUIL_BAS dans BanqueSang.jsx

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

interface Poche {
  id: string;
  etablissement_id: string;
  groupe_sanguin: string;
  statut: string;
}

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  record: Poche;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const poche = payload.record;
  if (!poche?.etablissement_id || !poche?.groupe_sanguin) {
    return new Response(JSON.stringify({ skipped: true, reason: "missing fields" }), {
      headers: { "Content-Type": "application/json" },
    });
  }
  const groupe = poche.groupe_sanguin;

  const { count } = await supabase
    .from("poches_sang")
    .select("id", { count: "exact", head: true })
    .eq("etablissement_id", poche.etablissement_id)
    .eq("groupe_sanguin", groupe)
    .eq("statut", "disponible");

  const disponibles = count ?? 0;

  const { data: alerteExistante } = await supabase
    .from("alertes")
    .select("id")
    .eq("etablissement_id", poche.etablissement_id)
    .eq("type", "rupture")
    .eq("produit", groupe)
    .eq("resolu", false)
    .limit(1);

  if (disponibles > SEUIL_BAS) {
    if (alerteExistante?.length) {
      await supabase.from("alertes").update({ resolu: true })
        .eq("etablissement_id", poche.etablissement_id).eq("type", "rupture").eq("produit", groupe).eq("resolu", false);
    }
    return new Response(JSON.stringify({ ok: true, action: "resolved_or_ok", disponibles }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Stock bas ou rupture pour ce groupe
  if (!alerteExistante?.length) {
    await supabase.from("alertes").insert({
      type: "rupture",
      severite: disponibles === 0 ? "critique" : "alerte",
      titre: `Banque de sang — stock bas : ${groupe}`,
      message: `Il ne reste que ${disponibles} poche(s) disponible(s) pour le groupe ${groupe}. Réapprovisionnement ou appel aux donneurs recommandé.`,
      produit: groupe,
      etablissement_id: poche.etablissement_id,
      lu: false,
      resolu: false,
    });
  }

  try {
    const { data: etab } = await supabase.from("etablissements").select("email").eq("id", poche.etablissement_id).maybeSingle();
    const destinataire = etab?.email || ADMIN_EMAIL;
    const severite = disponibles === 0 ? "RUPTURE TOTALE" : "STOCK CRITIQUE";
    const couleur = disponibles === 0 ? "#DC2626" : "#D97706";
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
  <div style="background:#0F172A;padding:20px 32px"><p style="color:white;font-size:18px;font-weight:700;margin:0">MedOS</p></div>
  <div style="padding:24px 32px">
    <span style="background:${couleur};color:white;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:800">${severite}</span>
    <h2 style="color:${couleur};font-size:18px;margin:14px 0 12px">Banque de sang — groupe ${groupe}</h2>
    <p style="font-size:14px;color:#111827">Il ne reste que <strong>${disponibles} poche(s)</strong> disponible(s) pour le groupe <strong>${groupe}</strong> (seuil d'alerte : ${SEUIL_BAS}).</p>
    <p style="font-size:13px;color:#6B7280">Réapprovisionnement ou appel aux donneurs recommandé.</p>
    <p style="text-align:center;margin:20px 0">
      <a href="${APP_URL}/hopital/banque-sang" style="background:${couleur};color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700">Voir la banque de sang</a>
    </p>
  </div>
</div>`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM_EMAIL, to: [destinataire], subject: `${severite} — Banque de sang ${groupe}`, html }),
    });
    if (!res.ok) console.error("[banque-sang] Resend erreur:", res.status, await res.text());
  } catch (err) {
    console.error("[banque-sang] Échec envoi email (non bloquant):", err);
  }

  return new Response(JSON.stringify({ ok: true, groupe, disponibles }), {
    headers: { "Content-Type": "application/json" },
  });
});
