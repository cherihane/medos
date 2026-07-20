/**
 * MedOSDocument — moteur de documents imprimables MedOS
 *
 * Utilisation :
 *   openDocument({ titre, sousTitre, etablissement, sections })
 *
 * Helpers de contenu :
 *   tableHTML(headers, rows)
 *   kpiHTML(items)
 *   infoGridHTML(items, cols)
 *   sectionHTML(titre, contentHTML)
 *   alertBannerHTML(text, type)
 *   signatureRowHTML(labels)
 *
 * Helper auth :
 *   etabFromAuth(auth)  →  { nom, ville, type }
 */

// ── Palette ───────────────────────────────────────────────────────────────────
const NAVY  = "#0A1628";
const BLUE  = "#1D4ED8";
const GREEN = "#10B981";

// ── CSS partagé ───────────────────────────────────────────────────────────────
const SHARED_CSS = `
  @media print {
    .no-print { display: none !important; }
    body { margin: 0; }
    .page { padding: 28px 36px; }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    color: ${NAVY};
    background: #fff;
    font-size: 13px;
    line-height: 1.5;
  }
  .watermark {
    position: fixed;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-35deg);
    font-size: 130px;
    font-weight: 900;
    color: rgba(10, 22, 40, 0.03);
    pointer-events: none;
    user-select: none;
    z-index: 0;
    letter-spacing: -2px;
    white-space: nowrap;
  }
  .page {
    max-width: 920px;
    margin: 0 auto;
    padding: 44px 56px;
    position: relative;
    z-index: 1;
    min-height: 100vh;
  }

  /* ── En-tête ── */
  .doc-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    padding-bottom: 16px;
    margin-bottom: 6px;
  }
  .logo {
    font-size: 28px;
    font-weight: 900;
    color: ${NAVY};
    letter-spacing: -0.5px;
    line-height: 1;
  }
  .logo span { color: ${BLUE}; }
  .logo-sub {
    font-size: 10px;
    color: #9CA3AF;
    margin-top: 3px;
    font-weight: 400;
    letter-spacing: 0.3px;
  }
  .etab-block { text-align: right; }
  .etab-nom { font-size: 14px; font-weight: 700; color: ${NAVY}; }
  .etab-meta { font-size: 11px; color: #6B7280; margin-top: 2px; }
  .separator {
    height: 3px;
    background: linear-gradient(90deg, ${NAVY} 0%, ${BLUE} 55%, ${GREEN} 100%);
    border-radius: 2px;
    margin-bottom: 26px;
  }

  /* ── Titre du document ── */
  .doc-title { font-size: 19px; font-weight: 800; color: ${NAVY}; margin-bottom: 3px; }
  .doc-subtitle { font-size: 12px; color: #6B7280; margin-bottom: 24px; }

  /* ── Sections ── */
  .section { margin-bottom: 26px; }
  .section-title {
    font-size: 10px;
    font-weight: 700;
    color: #6B7280;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin-bottom: 10px;
    padding-bottom: 5px;
    border-bottom: 1px solid #E5E7EB;
  }

  /* ── Tableaux ── */
  .doc-table { width: 100%; border-collapse: collapse; }
  .doc-table thead th {
    background: ${NAVY};
    color: white;
    padding: 10px 14px;
    text-align: left;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .doc-table tbody td {
    padding: 9px 14px;
    font-size: 12px;
    color: #374151;
    border-bottom: 1px solid #F3F4F6;
  }
  .doc-table tbody tr:nth-child(even) td { background: #F8FAFC; }
  .doc-table tbody tr:last-child td { border-bottom: none; }

  /* ── KPI ── */
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
    margin-bottom: 20px;
  }
  .kpi-card {
    padding: 14px 16px;
    border-radius: 8px;
    background: #F8FAFC;
    border-left: 4px solid ${BLUE};
  }
  .kpi-value { font-size: 21px; font-weight: 800; }
  .kpi-label { font-size: 11px; color: #6B7280; margin-top: 3px; }

  /* ── Info grid ── */
  .info-grid {
    display: grid;
    gap: 10px;
    background: #F8FAFC;
    border-radius: 8px;
    padding: 14px 18px;
  }
  .info-item-label { font-size: 10px; color: #9CA3AF; margin-bottom: 2px; }
  .info-item-value { font-size: 13px; font-weight: 600; color: ${NAVY}; }

  /* ── Bandeaux ── */
  .alert-banner {
    padding: 9px 14px;
    border-radius: 7px;
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 14px;
  }
  .alert-danger { background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA; }
  .alert-warning { background: #FFFBEB; color: #D97706; border: 1px solid #FCD34D; }
  .alert-info { background: #EFF6FF; color: ${BLUE}; border: 1px solid #BFDBFE; }
  .alert-success { background: #DCFCE7; color: #16A34A; border: 1px solid #A7F3D0; }

  /* ── Signature ── */
  .signature-row {
    display: grid;
    gap: 40px;
    margin-top: 44px;
  }
  .sign-box { border-top: 1.5px solid ${NAVY}; padding-top: 8px; font-size: 11px; color: #6B7280; }

  /* ── Mentions légales ── */
  .mentions-legales {
    margin-top: 24px;
    padding-top: 10px;
    border-top: 1px dashed #E5E7EB;
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 10px;
    color: #6B7280;
    line-height: 1.5;
  }

  /* ── Pied de page ── */
  .doc-footer {
    margin-top: 36px;
    padding-top: 12px;
    border-top: 1px solid #E5E7EB;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 10px;
    color: #9CA3AF;
    letter-spacing: 0.2px;
  }

  /* ── Bouton impression ── */
  .print-btn {
    position: fixed;
    top: 16px;
    right: 16px;
    padding: 9px 22px;
    background: ${NAVY};
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    z-index: 9999;
    box-shadow: 0 2px 10px rgba(0,0,0,0.25);
    font-family: 'Segoe UI', Arial, sans-serif;
    transition: background 0.15s;
  }
  .print-btn:hover { background: ${BLUE}; }
`;

// ── Helpers de contenu ────────────────────────────────────────────────────────

/**
 * Construit un tableau HTML stylé.
 * @param {string[]} headers
 * @param {string[][]} rows  — chaque ligne est un tableau de cellules HTML
 * @param {{ alignRight?: number[] }} opts  — indices de colonnes alignées à droite
 */
export function tableHTML(headers, rows, { alignRight = [] } = {}) {
  const ths = headers
    .map((h, i) => `<th${alignRight.includes(i) ? ' style="text-align:right"' : ""}>${h}</th>`)
    .join("");
  const trs = rows
    .map((row) =>
      "<tr>" +
      row
        .map((cell, i) =>
          `<td${alignRight.includes(i) ? ' style="text-align:right;font-variant-numeric:tabular-nums"' : ""}>${cell}</td>`
        )
        .join("") +
      "</tr>"
    )
    .join("");
  return `<table class="doc-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}

/**
 * Construit une grille KPI.
 * @param {{ label: string, value: string|number, color?: string }[]} items
 */
export function kpiHTML(items) {
  const cards = items
    .map(
      ({ label, value, color = BLUE }) =>
        `<div class="kpi-card" style="border-left-color:${color}">
          <div class="kpi-value" style="color:${color}">${value}</div>
          <div class="kpi-label">${label}</div>
        </div>`
    )
    .join("");
  return `<div class="kpi-grid">${cards}</div>`;
}

/**
 * Construit une grille d'informations.
 * @param {{ label: string, value: string }[]} items
 * @param {number} cols  — nombre de colonnes (défaut 2)
 */
export function infoGridHTML(items, cols = 2) {
  const cells = items
    .map(
      ({ label, value }) =>
        `<div class="info-item">
          <div class="info-item-label">${label}</div>
          <div class="info-item-value">${value ?? "—"}</div>
        </div>`
    )
    .join("");
  return `<div class="info-grid" style="grid-template-columns:repeat(${cols},1fr)">${cells}</div>`;
}

/**
 * Construit une section avec titre.
 */
export function sectionHTML(titre, contentHTML) {
  return `<div class="section">
    <div class="section-title">${titre}</div>
    ${contentHTML}
  </div>`;
}

/**
 * Construit un bandeau d'alerte coloré.
 * @param {string} text
 * @param {"danger"|"warning"|"info"|"success"} type
 */
export function alertBannerHTML(text, type = "warning") {
  return `<div class="alert-banner alert-${type}">${text}</div>`;
}

/**
 * Construit une rangée de cases à signer.
 * @param {string[]} labels
 */
export function signatureRowHTML(labels) {
  const boxes = labels
    .map((l) => `<div class="sign-box">${l}</div>`)
    .join("");
  return `<div class="signature-row" style="grid-template-columns:repeat(${labels.length},1fr)">${boxes}</div>`;
}

// ── Helper auth ───────────────────────────────────────────────────────────────

// Valeurs génériques de roleConfig qui ne doivent pas apparaître dans un document imprimé.
const GENERIC_STRUCTURES = new Set([
  "Votre Pharmacie", "Votre Hôpital", "Votre Distributeur", "Votre Autorité Sanitaire", "MedOS",
]);

function isGeneric(str) {
  return !str || GENERIC_STRUCTURES.has(str.trim());
}

/**
 * Construit l'objet établissement depuis le contexte auth (synchrone, valeurs statiques).
 * Utilisé comme fallback interne — préférer fetchEtabFromAuth pour les documents imprimés.
 * @param {object|null} auth
 * @returns {{ nom: string, ville: string, type: string }}
 */
export function etabFromAuth(auth) {
  if (!auth) return { nom: "MedOS", ville: "", type: "" };
  const [ville = ""] = (auth.location ?? "").split(",");
  const structure = auth.structure ?? "";
  const nom = isGeneric(structure) ? (auth.user?.email || "MedOS") : structure;
  return {
    nom,
    ville: ville.trim(),
    type: auth.label ?? "",
  };
}

const ETAB_FALLBACK = { largeur_ticket_mm: 80, taux_tva: 0, licence_pharmacien_responsable: "", mentions_legales: "" };

/**
 * Construit l'objet établissement depuis le contexte auth en interrogeant la base de données.
 * Priorité : nom réel dans `etablissements` > auth.structure (si non générique) > auth.user.email > "MedOS".
 * @param {object|null} auth
 * @returns {Promise<{ nom: string, ville: string, type: string, largeur_ticket_mm: number, taux_tva: number, licence_pharmacien_responsable: string, mentions_legales: string }>}
 */
export async function fetchEtabFromAuth(auth) {
  if (!auth) return { nom: "MedOS", ville: "", type: "", ...ETAB_FALLBACK };

  // 1. Cherche dans la table etablissements via etablissement_id
  if (auth.etablissement_id) {
    try {
      const { supabase } = await import("../supabaseClient");
      const { data } = await supabase
        .from("etablissements")
        .select("nom, ville, type, largeur_ticket_mm, taux_tva, licence_pharmacien_responsable, mentions_legales")
        .eq("id", auth.etablissement_id)
        .maybeSingle();
      if (data?.nom) {
        return {
          nom:   data.nom,
          ville: data.ville || "",
          type:  data.type  || auth.label || "",
          largeur_ticket_mm: data.largeur_ticket_mm === 58 ? 58 : 80,
          taux_tva: Number(data.taux_tva) || 0,
          licence_pharmacien_responsable: data.licence_pharmacien_responsable || "",
          mentions_legales: data.mentions_legales || "",
        };
      }
    } catch {
      // réseau indisponible — continue avec le fallback
    }
  }

  // 2. auth.structure si non générique
  const structure = auth.structure ?? "";
  if (!isGeneric(structure)) {
    const [ville = ""] = (auth.location ?? "").split(",");
    return { nom: structure, ville: ville.trim(), type: auth.label ?? "", ...ETAB_FALLBACK };
  }

  // 3. Email de l'utilisateur en dernier recours
  return {
    nom:   auth.user?.email || "MedOS",
    ville: "",
    type:  auth.label ?? "",
    ...ETAB_FALLBACK,
  };
}

// ── Ouverture document ────────────────────────────────────────────────────────

/**
 * Construit et ouvre un document imprimable MedOS.
 *
 * @param {{
 *   titre: string,
 *   sousTitre?: string,
 *   etablissement?: { nom?: string, ville?: string, type?: string },
 *   sections: { titre: string, html: string }[],
 *   autoprint?: boolean,
 * }} opts
 */
export function openDocument({
  titre,
  sousTitre = "",
  etablissement = {},
  sections = [],
  autoprint = false,
}) {
  const win = window.open("", "_blank", "width=960,height=720");
  if (!win) {
    // eslint-disable-next-line no-alert
    alert("Le navigateur a bloqué l'ouverture de la fenêtre. Autorisez les popups pour MedOS.");
    return;
  }

  const now   = new Date();
  const dateFr = now.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const heure  = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const dateHeure = `${dateFr} à ${heure}`;

  const etabNom   = etablissement.nom  ?? "MedOS";
  const etabVille = etablissement.ville ?? "";
  const etabType  = etablissement.type  ?? "";
  const etabMeta  = [etabVille, etabType].filter(Boolean).join(" · ");

  // Mentions légales — affichées uniquement si renseignées dans Paramètres
  // (licence du pharmacien responsable + texte libre, adaptable pays par pays).
  const licence  = etablissement.licence_pharmacien_responsable ?? "";
  const mentions = etablissement.mentions_legales ?? "";
  const mentionsLegalesHTML = (licence || mentions)
    ? `<div class="mentions-legales">
        ${licence ? `<span>Pharmacien responsable — Licence n° ${licence}</span>` : ""}
        ${mentions ? `<span>${mentions}</span>` : ""}
      </div>`
    : "";

  const sectionsHTML = sections
    .map(({ titre: st, html }) => sectionHTML(st, html))
    .join("");

  win.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titre} — MedOS</title>
<style>${SHARED_CSS}</style>
</head>
<body>

<div class="watermark">MedOS</div>
<button class="print-btn no-print" onclick="window.print()">Imprimer</button>

<div class="page">

  <!-- En-tête -->
  <div class="doc-header">
    <div>
      <div class="logo">Med<span>OS</span></div>
      <div class="logo-sub">Intelligence Médicale Africaine</div>
    </div>
    <div class="etab-block">
      <div class="etab-nom">${etabNom}</div>
      ${etabMeta ? `<div class="etab-meta">${etabMeta}</div>` : ""}
    </div>
  </div>
  <div class="separator"></div>

  <!-- Titre -->
  <div class="doc-title">${titre}</div>
  ${sousTitre ? `<div class="doc-subtitle">${sousTitre}</div>` : ""}

  <!-- Contenu -->
  ${sectionsHTML}

  ${mentionsLegalesHTML}

  <!-- Pied de page -->
  <div class="doc-footer">
    <span>MedOS — Intelligence Médicale Africaine</span>
    <span>Document généré le ${dateHeure}</span>
  </div>

</div>

${autoprint ? "<script>window.onload=function(){window.print();}<\/script>" : ""}
</body>
</html>`);

  win.document.close();
}
