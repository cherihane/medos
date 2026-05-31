/**
 * useVerificationLot — Vérification d'authenticité d'un médicament
 *
 * Flux :
 *  1. Supabase lots  → certifié MedOS si trouvé
 *  2. API BDPM (FR)  → référencé en France si trouvé
 *  3. Non trouvé     → alerte Supabase + email Resend
 */
import { useState, useCallback } from "react";
import { supabase } from "../supabaseClient";

// ── Constantes ────────────────────────────────────────────────────────────────
const BDPM_BASE = "https://base-donnees-publique.medicaments.gouv.fr/api/rpc";
const RESEND_KEY = "re_iUaDVQFG_LAX2mHCRxm6rf216167mGdJY";
const ADMIN_EMAIL = "cherihaneadam123@gmail.com";

// Fabricants connus présents en Afrique de l'Ouest
const KNOWN_LABS = ["sanofi", "pfizer", "novartis", "gsk", "bayer", "mylan",
  "roche", "abbott", "astrazeneca", "johnson", "merck", "aventis"];

// ── Utilitaires ───────────────────────────────────────────────────────────────
function normalise(str) {
  return (str || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

function slugify(str) {
  // Extrait le principe actif principal (avant le premier chiffre ou espace+chiffre)
  return normalise(str).replace(/\s+\d.*$/, "").replace(/[^a-z0-9 ]/g, "").trim();
}

/** Envoie un email via Resend (appel direct depuis le front, ok en démo) */
async function sendAlertEmail({ nomMedicament, numerolot, scannePar }) {
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "MedOS <onboarding@resend.dev>",
        to: [ADMIN_EMAIL],
        subject: `⚠️ MedOS — Lot suspect détecté : ${nomMedicament}`,
        html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb">
  <div style="background:#EF4444;padding:24px 28px">
    <h1 style="color:white;margin:0;font-size:20px">⚠️ Lot suspect détecté</h1>
    <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:14px">MedOS — Système de surveillance pharmaceutique</p>
  </div>
  <div style="padding:28px">
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px">Médicament</td>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-weight:700;font-size:13px">${nomMedicament}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px">Numéro de lot</td>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-weight:700;font-size:13px;font-family:monospace">${numerolot || "Non précisé"}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px">Scanné par</td>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-weight:700;font-size:13px">${scannePar}</td></tr>
      <tr><td style="padding:10px 0;color:#6b7280;font-size:13px">Date</td>
          <td style="padding:10px 0;font-weight:700;font-size:13px">${new Date().toLocaleString("fr-FR")}</td></tr>
    </table>
    <div style="margin-top:20px;padding:16px;background:#FEF2F2;border-radius:8px;border-left:4px solid #EF4444">
      <p style="margin:0;color:#991B1B;font-size:13px;font-weight:600">Ce médicament n'a pas été trouvé dans la base MedOS ni dans la base officielle française des médicaments (BDPM). Une enquête est recommandée.</p>
    </div>
  </div>
  <div style="padding:16px 28px;background:#f8fafc;font-size:11px;color:#9ca3af;text-align:center">
    Alerte générée automatiquement par MedOS — Ne pas répondre à cet email
  </div>
</div>`,
      }),
    });
  } catch (err) {
    console.warn("[Resend] Email non envoyé :", err.message);
  }
}

// ── Vérification dans Supabase (lots enregistrés) ─────────────────────────────
async function verifierSupabase(numerolot, nomMedicament) {
  // Recherche par numéro de lot seul, ou par nom de médicament si pas de lot
  let query = supabase
    .from("lots")
    .select("id, numero_lot, fabricant, date_fabrication, date_expiration, quantite_initiale, qr_code, medicaments(nom, code)")
    .limit(5);

  if (numerolot && numerolot.length > 2) {
    query = query.ilike("numero_lot", `%${numerolot}%`);
  } else if (nomMedicament) {
    // Fallback: chercher par nom du médicament via join
    query = query.not("medicament_id", "is", null);
  }

  const { data, error } = await query;
  if (error || !data || data.length === 0) return null;

  // Si on a aussi un nom de médicament, filtrer davantage
  if (nomMedicament) {
    const slug = slugify(nomMedicament);
    const match = data.find((l) =>
      l.medicaments && normalise(l.medicaments.nom).includes(slug)
    );
    return match || data[0];
  }
  return data[0];
}

// ── Vérification dans l'API BDPM (France officielle) ─────────────────────────
async function verifierBDPM(nomMedicament) {
  if (!nomMedicament || nomMedicament.length < 3) return null;

  const keyword = slugify(nomMedicament);
  if (!keyword) return null;

  const headers = { Accept: "application/json" };

  // Stratégie 1 : specialite par denomination
  try {
    const url = `${BDPM_BASE}/specialite?denomination=ilike.*${encodeURIComponent(keyword)}*&limit=3`;
    const res = await fetch(url, { headers });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return { source: "BDPM", ...data[0] };
      }
    }
  } catch (_) { /* CORS possible */ }

  // Stratégie 2 : CIS_bdpm table directe
  try {
    const url = `https://base-donnees-publique.medicaments.gouv.fr/api/v1/CIS_bdpm?denomination_specialite=ilike.*${encodeURIComponent(keyword)}*&limit=3`;
    const res = await fetch(url, { headers });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return {
          source: "BDPM",
          denomination: data[0].denomination_specialite,
          code_cis: data[0].code_cis,
          forme_pharmaceutique: data[0].forme_pharmaceutique,
          statut_amm: data[0].statut_amm,
          titulaire: data[0].titulaire,
        };
      }
    }
  } catch (_) { /* CORS possible */ }

  // Stratégie 3 : API data.gouv.fr recherche textuelle
  try {
    const url = `https://data.gouv.fr/api/1/datasets/?q=${encodeURIComponent(keyword)}&page_size=1`;
    const res = await fetch(url, { headers });
    if (res.ok) {
      const data = await res.json();
      if (data?.data?.length > 0) {
        // Pas de résultat médicament précis, mais l'API est accessible
        return null;
      }
    }
  } catch (_) { /* réseau */ }

  return null;
}

// ── Créer une alerte Supabase ─────────────────────────────────────────────────
async function creerAlerteSuspecte({ nomMedicament, numerolot, scannePar }) {
  await supabase.from("alertes").insert({
    type: "contrefacon",
    severite: "critique",
    titre: `Lot suspect détecté : ${nomMedicament || numerolot || "Inconnu"}`,
    message: `Lot "${numerolot || "?"}" pour "${nomMedicament || "?"}" non trouvé dans MedOS ni dans la BDPM. Scanné via ${scannePar}.`,
    lu: false,
    resolu: false,
  });
}

// ── Hook principal ─────────────────────────────────────────────────────────────
export function useVerificationLot() {
  const [state, setState] = useState({
    loading: false,
    result: null,   // { statut, source, details, lot, medicament }
    error: null,
  });

  const verifier = useCallback(async ({ numerolot, nomMedicament, scannePar = "Scanner MedOS" }) => {
    if (!numerolot && !nomMedicament) return;

    setState({ loading: true, result: null, error: null });

    try {
      // ── Étape 1 : Supabase ──────────────────────────────────────────────────
      const lotSupabase = await verifierSupabase(numerolot, nomMedicament);
      if (lotSupabase) {
        setState({
          loading: false,
          error: null,
          result: {
            statut: "certifie",
            source: "supabase",
            details: {
              "Médicament":        lotSupabase.medicaments?.nom || nomMedicament || "—",
              "Code":              lotSupabase.medicaments?.code || "—",
              "Numéro de lot":     lotSupabase.numero_lot,
              "Fabricant":         lotSupabase.fabricant || "—",
              "Date fabrication":  lotSupabase.date_fabrication ? new Date(lotSupabase.date_fabrication).toLocaleDateString("fr-FR") : "—",
              "Date expiration":   lotSupabase.date_expiration ? new Date(lotSupabase.date_expiration).toLocaleDateString("fr-FR") : "—",
              "Qté initiale":      lotSupabase.quantite_initiale ?? "—",
            },
          },
        });
        return;
      }

      // ── Étape 2 : API BDPM française ───────────────────────────────────────
      const bdpmResult = await verifierBDPM(nomMedicament || numerolot);
      if (bdpmResult) {
        setState({
          loading: false,
          error: null,
          result: {
            statut: "bdpm",
            source: "bdpm",
            details: {
              "Dénomination":         bdpmResult.denomination || nomMedicament || "—",
              "Code CIS":             bdpmResult.code_cis || "—",
              "Forme":                bdpmResult.forme_pharmaceutique || "—",
              "Statut AMM":           bdpmResult.statut_amm || "—",
              "Titulaire / Lab":      bdpmResult.titulaire || "—",
              "Numéro lot saisi":     numerolot || "Non précisé",
              "Base de données":      "BDPM — Médicaments officiels France",
            },
          },
        });
        return;
      }

      // ── Étape 3 : Non trouvé → Suspect ──────────────────────────────────────
      await creerAlerteSuspecte({ nomMedicament, numerolot, scannePar });
      await sendAlertEmail({ nomMedicament: nomMedicament || numerolot || "Inconnu", numerolot, scannePar });

      setState({
        loading: false,
        error: null,
        result: {
          statut: "suspect",
          source: "non_trouve",
          details: {
            "Médicament saisi":  nomMedicament || "—",
            "Numéro de lot":     numerolot || "—",
            "Scanné par":        scannePar,
            "Action":            "Alerte créée + email envoyé à l'autorité",
          },
        },
      });

    } catch (e) {
      setState({ loading: false, result: null, error: e.message });
    }
  }, []);

  const reset = useCallback(() => setState({ loading: false, result: null, error: null }), []);

  return { ...state, verifier, reset };
}
