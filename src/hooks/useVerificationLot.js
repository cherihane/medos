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

const BDPM_BASE = "https://base-donnees-publique.medicaments.gouv.fr/api/rpc";

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
    const html = `
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
</div>`;
    await supabase.functions.invoke("send-app-email", {
      body: {
        to: "admin_alert",
        subject: `MedOS — Lot suspect detecte : ${nomMedicament || numerolot || "Inconnu"}`,
        html,
      },
    });
  } catch {
    // Echec envoi alerte email — silencieux, l'alerte Supabase est déjà créée
  }
}

// ── Vérification Supabase ─────────────────────────────────────────────────────
// Passe par la RPC verifier_lot_public (SECURITY DEFINER) plutôt que par un
// select direct sur `lots` : la registre anti-contrefaçon reste public par
// nom/code de médicament uniquement, sans dépendre d'une policy RLS
// table-level qui exposerait toute la ligne `medicaments` (stock, prix,
// établissement) de tout établissement dès qu'un lot existe (faille trouvée
// et corrigée en session 15 — voir 20260726b_medicaments_lot_public_fix.sql).
async function verifierSupabase(numerolot, nomMedicament) {
  if (!numerolot && !nomMedicament) return null;

  const { data, error } = await supabase.rpc("verifier_lot_public", {
    p_numero_lot: numerolot && numerolot.length > 2 ? numerolot : null,
  });
  if (error || !data || data.length === 0) return null;

  const toLotShape = (l) => ({
    numero_lot: l.numero_lot,
    fabricant: l.fabricant,
    date_fabrication: l.date_fabrication,
    date_expiration: l.date_expiration,
    quantite_initiale: l.quantite_initiale,
    medicaments: { nom: l.med_nom, code: l.med_code },
  });

  // Si un nom de médicament est fourni, le lot ET le nom doivent correspondre
  if (nomMedicament) {
    const slug = principalActif(nomMedicament);
    if (!slug) return toLotShape(data[0]); // nom trop vague, on accepte le premier lot trouvé

    const match = data.find((l) => l.med_nom && normalise(l.med_nom).includes(slug));
    // Si le nom ne correspond à aucun lot → null (pas certifié pour ce médicament)
    return match ? toLotShape(match) : null;
  }

  return toLotShape(data[0]);
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
async function creerAlerteSuspecte({ nomMedicament, numerolot, scannePar, etablissement_id }) {
  const { error } = await supabase.from("alertes").insert({
    etablissement_id: etablissement_id ?? null,
    type: "contrefacon",
    severite: "critique",
    titre: `Lot suspect detecte : ${nomMedicament || numerolot || "Inconnu"}`,
    message: `Lot "${numerolot || "?"}" pour "${nomMedicament || "?"}" introuvable dans MedOS et BDPM. Scanne via ${scannePar}.`,
    lu: false,
    resolu: false,
  });
  // Insertion alerte — erreur silencieuse, ne pas bloquer le flux utilisateur
}

// ── Recherche pour pré-remplissage (Inventaire, Mouvements) ───────────────────
// Contrairement à verifierSupabase() ci-dessus (pensé pour l'écran Scanner —
// vérification d'authenticité, avec correspondance nom+lot), cette fonction
// sert à pré-remplir un formulaire dès qu'un QR/code-barres scanné correspond
// à un lot certifié MedOS : cherche d'abord une correspondance exacte sur
// qr_code (ce que le scan encode le plus souvent), puis sur numero_lot.
// Retourne les infos du médicament de référence + la date de péremption du
// lot scanné, ou null si rien ne correspond (comportement actuel inchangé
// dans ce cas — jamais bloquant).
export async function rechercherLotPourPrefill(codeScanne) {
  const code = (codeScanne || "").trim();
  if (!code) return null;

  // RPC SECURITY DEFINER (prefill_medicament_via_lot) plutôt qu'un select
  // direct sur `lots` avec jointure `medicaments(...)` — même correctif que
  // verifierSupabase() ci-dessus, voir 20260726b_medicaments_lot_public_fix.sql.
  const { data: med } = await supabase.rpc("prefill_medicament_via_lot", { p_code: code }).maybeSingle();
  if (!med) return null;

  const nom = med.dosage && !normalise(med.nom).includes(normalise(med.dosage))
    ? `${med.nom} ${med.dosage}`.trim()
    : med.nom;

  return {
    medicament_id:    med.medicament_id ?? null,
    nom:              nom || "",
    categorie:        med.categorie ?? "",
    forme:            med.forme ?? "",
    fabricant:        med.fabricant || "",
    dci:              med.dci ?? "",
    prix_achat:       med.prix_achat ?? "",
    prix_unitaire:    med.prix_unitaire ?? "",
    date_peremption:  med.date_expiration ? med.date_expiration.slice(0, 10) : "",
  };
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
      await creerAlerteSuspecte({ nomMedicament, numerolot, scannePar, etablissement_id });
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
