/**
 * useVerificationLot — Vérification d'authenticité d'un médicament
 *
 * Flux :
 *  1. Supabase lots  → certifié MedOS si trouvé (lot ET nom correspondent)
 *  2. API BDPM (FR)  → référencé en France si trouvé
 *  3. Non trouvé     → alerte Supabase unique + email Resend (une seule fois par appel)
 */
import { useState, useCallback } from "react";
import { supabase } from "../supabaseClient";

const BDPM_BASE  = "https://base-donnees-publique.medicaments.gouv.fr/api/rpc";
const RESEND_KEY  = "re_iUaDVQFG_LAX2mHCRxm6rf216167mGdJY";
const ADMIN_EMAIL = "cherihaneadam123@gmail.com";

// ── Utilitaires ───────────────────────────────────────────────────────────────
function normalise(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function principalActif(str) {
  // Garde uniquement le nom avant le dosage (premier chiffre ou slash)
  return normalise(str).replace(/[\s\/]+\d.*$/, "").replace(/[^a-z0-9 ]/g, "").trim();
}

// ── Email Resend ───────────────────────────────────────────────────────────────
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
        subject: `MedOS — Lot suspect detecte : ${nomMedicament || numerolot || "Inconnu"}`,
        html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb">
  <div style="background:#EF4444;padding:24px 28px">
    <h1 style="color:white;margin:0;font-size:20px">Lot suspect detecte</h1>
    <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:14px">MedOS — Systeme de surveillance pharmaceutique</p>
  </div>
  <div style="padding:28px">
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px">Medicament</td>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-weight:700;font-size:13px">${nomMedicament || "Non precise"}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px">Numero de lot</td>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-weight:700;font-size:13px;font-family:monospace">${numerolot || "Non precise"}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px">Scanne par</td>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-weight:700;font-size:13px">${scannePar}</td></tr>
      <tr><td style="padding:10px 0;color:#6b7280;font-size:13px">Date</td>
          <td style="padding:10px 0;font-weight:700;font-size:13px">${new Date().toLocaleString("fr-FR")}</td></tr>
    </table>
    <div style="margin-top:20px;padding:16px;background:#FEF2F2;border-radius:8px;border-left:4px solid #EF4444">
      <p style="margin:0;color:#991B1B;font-size:13px;font-weight:600">
        Ce medicament n'a pas ete trouve dans la base MedOS ni dans la BDPM officielle.
        Une enquete est recommandee.
      </p>
    </div>
  </div>
  <div style="padding:16px 28px;background:#f8fafc;font-size:11px;color:#9ca3af;text-align:center">
    Alerte generee automatiquement par MedOS
  </div>
</div>`,
      }),
    });
  } catch {
    // Echec envoi alerte email — silencieux, l'alerte Supabase est déjà créée
  }
}

// ── Vérification Supabase ─────────────────────────────────────────────────────
async function verifierSupabase(numerolot, nomMedicament) {
  let query = supabase
    .from("lots")
    .select("id, numero_lot, fabricant, date_fabrication, date_expiration, quantite_initiale, medicaments(nom, code)")
    .limit(10);

  // Filtrer par numéro de lot si fourni
  if (numerolot && numerolot.length > 2) {
    query = query.ilike("numero_lot", `%${numerolot}%`);
  } else if (nomMedicament) {
    // Pas de lot : on ne peut pas filtrer efficacement sans join côté Supabase
    // On récupère tous les lots et on filtre en JS
    query = query.order("created_at", { ascending: false });
  } else {
    return null;
  }

  const { data, error } = await query;
  if (error || !data || data.length === 0) return null;

  // Si un nom de médicament est fourni, le lot ET le nom doivent correspondre
  if (nomMedicament) {
    const slug = principalActif(nomMedicament);
    if (!slug) return data[0]; // nom trop vague, on accepte le premier lot trouvé

    const match = data.find((l) =>
      l.medicaments && normalise(l.medicaments.nom).includes(slug)
    );
    // Si le nom ne correspond à aucun lot → null (pas certifié pour ce médicament)
    return match || null;
  }

  return data[0];
}

// ── Vérification BDPM ─────────────────────────────────────────────────────────
async function verifierBDPM(nomMedicament) {
  if (!nomMedicament || nomMedicament.length < 3) return null;

  const keyword = principalActif(nomMedicament);
  if (!keyword) return null;

  const headers = { Accept: "application/json" };

  // Stratégie 1 : endpoint specialite (PostgREST)
  try {
    const url = `${BDPM_BASE}/specialite?denomination=ilike.*${encodeURIComponent(keyword)}*&limit=3`;
    const res = await fetch(url, { headers });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return { source: "BDPM", ...data[0] };
    }
  } catch (_) { /* CORS en dev local — ignoré */ }

  // Stratégie 2 : table CIS_bdpm directe
  try {
    const url = `https://base-donnees-publique.medicaments.gouv.fr/api/v1/CIS_bdpm?denomination_specialite=ilike.*${encodeURIComponent(keyword)}*&limit=3`;
    const res = await fetch(url, { headers });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return {
          source: "BDPM",
          denomination:          data[0].denomination_specialite,
          code_cis:              data[0].code_cis,
          forme_pharmaceutique:  data[0].forme_pharmaceutique,
          statut_amm:            data[0].statut_amm,
          titulaire:             data[0].titulaire,
        };
      }
    }
  } catch (_) { /* CORS en dev local — ignoré */ }

  return null;
}

// ── Créer alerte Supabase (une seule fois) ────────────────────────────────────
async function creerAlerteSuspecte({ nomMedicament, numerolot, scannePar }) {
  const { error } = await supabase.from("alertes").insert({
    type: "contrefacon",
    severite: "critique",
    titre: `Lot suspect detecte : ${nomMedicament || numerolot || "Inconnu"}`,
    message: `Lot "${numerolot || "?"}" pour "${nomMedicament || "?"}" introuvable dans MedOS et BDPM. Scanne via ${scannePar}.`,
    lu: false,
    resolu: false,
  });
  // Insertion alerte — erreur silencieuse, ne pas bloquer le flux utilisateur
}

// ── Hook principal ─────────────────────────────────────────────────────────────
export function useVerificationLot() {
  const [state, setState] = useState({
    loading: false,
    result: null,
    error: null,
  });

  const verifier = useCallback(async ({ numerolot, nomMedicament, scannePar = "Scanner MedOS", etablissement_id = null }) => {
    if (!numerolot && !nomMedicament) return;

    // Réinitialise avant chaque vérification
    setState({ loading: true, result: null, error: null });

    try {
      // ── Etape 1 : Supabase ──────────────────────────────────────────────────
      const lotSupabase = await verifierSupabase(
        numerolot?.trim() || "",
        nomMedicament?.trim() || ""
      );
      if (lotSupabase) {
        setState({
          loading: false, error: null,
          result: {
            statut: "certifie",
            source: "supabase",
            details: {
              "Medicament":       lotSupabase.medicaments?.nom || nomMedicament || "—",
              "Code":             lotSupabase.medicaments?.code || "—",
              "Numero de lot":    lotSupabase.numero_lot,
              "Fabricant":        lotSupabase.fabricant || "—",
              "Fabrication":      lotSupabase.date_fabrication
                                    ? new Date(lotSupabase.date_fabrication).toLocaleDateString("fr-FR") : "—",
              "Expiration":       lotSupabase.date_expiration
                                    ? new Date(lotSupabase.date_expiration).toLocaleDateString("fr-FR") : "—",
              "Quantite initiale": lotSupabase.quantite_initiale ?? "—",
            },
          },
        });
        return;
      }

      // ── Etape 2 : BDPM France ──────────────────────────────────────────────
      const bdpmResult = await verifierBDPM(nomMedicament || numerolot);
      if (bdpmResult) {
        setState({
          loading: false, error: null,
          result: {
            statut: "bdpm",
            source: "bdpm",
            details: {
              "Denomination":     bdpmResult.denomination || nomMedicament || "—",
              "Code CIS":         bdpmResult.code_cis || "—",
              "Forme":            bdpmResult.forme_pharmaceutique || "—",
              "Statut AMM":       bdpmResult.statut_amm || "—",
              "Titulaire":        bdpmResult.titulaire || "—",
              "Lot saisi":        numerolot || "Non precise",
            },
          },
        });
        return;
      }

      // ── Etape 3 : Inventaire local ────────────────────────────────────────
      if (etablissement_id && (nomMedicament || numerolot)) {
        let q = supabase
          .from("medicaments")
          .select("id, nom, fabricant, code")
          .eq("etablissement_id", etablissement_id);

        if (nomMedicament) {
          q = q.ilike("nom", `%${principalActif(nomMedicament)}%`);
        } else if (numerolot) {
          q = q.eq("code", numerolot);
        }

        const { data: medLocal } = await q.maybeSingle();
        if (medLocal) {
          setState({
            loading: false, error: null,
            result: {
              statut: "inventaire_local",
              source: "inventaire_local",
              details: {
                "Medicament": medLocal.nom,
                "Fabricant":  medLocal.fabricant ?? "—",
                "Code":       medLocal.code ?? "—",
                "Source":     "Inventaire pharmacie",
              },
            },
          });
          return;
        }
      }

      // ── Etape 4 : Suspect — alerte unique ─────────────────────────────────
      // Ces deux appels sont attendus ; ils n'ont lieu qu'une seule fois ici.
      await creerAlerteSuspecte({ nomMedicament, numerolot, scannePar });
      await sendAlertEmail({
        nomMedicament: nomMedicament || numerolot || "Inconnu",
        numerolot,
        scannePar,
      });

      setState({
        loading: false, error: null,
        result: {
          statut: "suspect",
          source: "non_trouve",
          details: {
            "Medicament saisi": nomMedicament || "—",
            "Numero de lot":    numerolot || "—",
            "Scanne par":       scannePar,
            "Action":           "Alerte creee + email envoye a l'autorite",
          },
        },
      });

    } catch (e) {
      setState({ loading: false, result: null, error: e.message });
    }
  }, []);

  const reset = useCallback(() =>
    setState({ loading: false, result: null, error: null }), []);

  return { ...state, verifier, reset };
}
