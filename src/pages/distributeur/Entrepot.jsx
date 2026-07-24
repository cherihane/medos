/**
 * Entrepôt — Distributeur
 *
 * - Liste de tous les médicaments avec stock, seuil, prix grossiste
 * - Alertes stock faible
 * - Modal "Réceptionner livraison" : génère un numéro de lot MedOS unique,
 *   l'insère dans la table `lots` (authentifié) et incrémente le stock
 */
import { colors } from "../../theme";
import { useState, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useMedicaments, useFabricants, useFabricantsPaginated, useCommandesFabricantPaginated, useCommandeHistorique } from "../../hooks/useSupabaseData";
import { insertLot, incrementStock, insertCommande, updateCommande, deleteCommande, insertCommandeLignes, insertFabricant, updateFabricant, insertMedicament, updateMedicament, deleteMedicament } from "../../hooks/useMutations";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../supabaseClient";
import { openDocument, tableHTML, infoGridHTML, fetchEtabFromAuth } from "../../utils/MedOSDocument";
import Pagination from "../../components/Pagination";
import QrScanner from "../../components/QrScanner";
import { ModalScanEnregistrer } from "./Tracabilite";

function printBonCommandeFabricant({ header, lignes, etab }) {
  const dateFr = new Date().toLocaleDateString("fr-FR");
  const totalQty = lignes.reduce((s, l) => s + (l.quantite || 0), 0);
  openDocument({
    titre: "Bon de commande fabricant",
    sousTitre: `Émis le ${dateFr} — ${lignes.length} référence${lignes.length !== 1 ? "s" : ""} · ${totalQty.toLocaleString("fr-FR")} unités`,
    etablissement: etab,
    sections: [
      {
        titre: "Destinataire",
        html: infoGridHTML([
          { label: "Fabricant", value: header.fabricant || "—" },
          { label: "Email", value: header.email_fabricant || "—" },
          { label: "Date de livraison souhaitée", value: header.date_livraison ? new Date(header.date_livraison).toLocaleDateString("fr-FR") : "Non précisée" },
          { label: "Instructions", value: header.notes || "Aucune" },
        ]),
      },
      {
        titre: "Médicaments commandés",
        html: tableHTML(
          ["Médicament", "Quantité"],
          lignes.map((l) => [l.medicamentNom || l.nom || "—", `${(l.quantite || 0).toLocaleString("fr-FR")} unités`]),
          { alignRight: [1] }
        ),
      },
    ],
  });
}

// ── Email (via Edge Function sécurisée) ───────────────────────────────────────

// Génère le PDF du bon de commande côté serveur (mêmes données que
// printBonCommandeFabricant), pour l'attacher à l'email envoyé au fabricant.
// Retourne null si la génération échoue — l'envoi continue sans pièce jointe.
async function genererPieceJointeBonCommandeFabricant({ fabricantNom, emailFabricant, lignes, dateLivraison, notes, etabNom, reference }) {
  try {
    const { data, error } = await supabase.functions.invoke("generate-bon-commande-pdf", {
      body: {
        reference, etablissementNom: etabNom, entiteLabel: "FABRICANT",
        fournisseur: { nom: fabricantNom, email: emailFabricant },
        lignes: lignes.map((l) => ({ nom: l.medicamentNom, quantite: l.quantite })),
        dateLivraison, notes,
      },
    });
    if (error || !data?.pdfBase64) return null;
    return { filename: data.filename, content: data.pdfBase64 };
  } catch {
    return null;
  }
}

// lignes = [{ medicamentNom, quantite }]
async function sendCommandeEmail({ emailFabricant, fabricant, lignes, dateLivraison, notes, distributeur, pieceJointe }) {
  const dateStr = dateLivraison
    ? new Date(dateLivraison).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
    : "Non précisée";
  const now = new Date().toLocaleString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const totalQty = lignes.reduce((s, l) => s + l.quantite, 0);

  const lignesHtml = lignes.map((l, i) => `
    <tr style="background:${i % 2 === 0 ? "#ffffff" : "#F8FAFC"}">
      <td style="padding:10px 14px;font-size:13px;color:#0A1628;font-weight:600;border-bottom:1px solid #e5e7eb">${l.medicamentNom}</td>
      <td style="padding:10px 14px;font-size:13px;color:#374151;text-align:right;border-bottom:1px solid #e5e7eb">${l.quantite.toLocaleString("fr-FR")} unités</td>
    </tr>`).join("");

  const html = `
<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
  <div style="background:#F59E0B;padding:28px 32px">
    <h1 style="color:white;margin:0;font-size:20px;font-weight:700">Bon de commande médicaments</h1>
    <p style="color:rgba(255,255,255,0.88);margin:6px 0 0;font-size:13px">MedOS — Plateforme de distribution médicale</p>
  </div>
  <div style="padding:28px 32px">
    <p style="font-size:14px;color:#374151;margin:0 0 6px">Bonjour${fabricant ? ` <strong>${fabricant}</strong>` : ""},</p>
    <p style="font-size:14px;color:#374151;margin:0 0 22px">
      Le distributeur <strong>${distributeur}</strong> vous adresse le bon de commande ci-dessous via la plateforme MedOS.
      Merci de confirmer la disponibilité dans les meilleurs délais.
    </p>

    <div className="table-scroll"><table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <tr style="background:#F8FAFC">
        <td style="padding:9px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:12px;width:44%">Date de livraison souhaitée</td>
        <td style="padding:9px 0;border-bottom:1px solid #e5e7eb;font-weight:700;font-size:13px;color:#0A1628">${dateStr}</td>
      </tr>
      ${notes ? `<tr>
        <td style="padding:9px 0;color:#6b7280;font-size:12px">Instructions particulières</td>
        <td style="padding:9px 0;font-size:13px;color:#374151">${notes}</td>
      </tr>` : ""}
    </table></div>

    <h2 style="font-size:14px;font-weight:700;color:#0A1628;margin:0 0 10px">Médicaments commandés</h2>
    <div className="table-scroll"><table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px">
      <thead>
        <tr style="background:#0A1628">
          <th style="padding:10px 14px;text-align:left;font-size:12px;color:#fff;font-weight:700">Médicament</th>
          <th style="padding:10px 14px;text-align:right;font-size:12px;color:#fff;font-weight:700">Quantité</th>
        </tr>
      </thead>
      <tbody>${lignesHtml}
        <tr style="background:#FFFBEB">
          <td style="padding:10px 14px;font-size:13px;font-weight:700;color:#92400E">${lignes.length} référence${lignes.length > 1 ? "s" : ""}</td>
          <td style="padding:10px 14px;font-size:13px;font-weight:700;color:#92400E;text-align:right">${totalQty.toLocaleString("fr-FR")} unités au total</td>
        </tr>
      </tbody>
    </table></div>

    <div style="background:#FFFBEB;border-left:4px solid #F59E0B;border-radius:6px;padding:12px 16px;margin-bottom:24px">
      <p style="font-size:12px;color:#92400E;margin:0">
        Merci de répondre directement à cet email pour confirmer la disponibilité et le délai de livraison.
      </p>
    </div>
    <p style="font-size:12px;color:#9CA3AF;margin:0">Commande émise le ${now}</p>
  </div>
  <div style="background:#F8FAFC;padding:14px 32px;border-top:1px solid #e5e7eb;text-align:center">
    <p style="font-size:12px;color:#9CA3AF;margin:0">MedOS — ${distributeur}</p>
  </div>
</div>`;

  const { error } = await supabase.functions.invoke("send-app-email", {
    body: {
      to:      emailFabricant,
      subject: `Bon de commande MedOS — ${lignes.length} médicament${lignes.length > 1 ? "s" : ""} (${totalQty.toLocaleString("fr-FR")} unités)`,
      html,
      ...(pieceJointe ? { attachments: [pieceJointe] } : {}),
    },
  });
  if (error) {
    throw new Error(`L'email n'a pas pu être envoyé à ${emailFabricant} : ${error.message}`);
  }
}

// ── Utilitaires ───────────────────────────────────────────────────────────────
const ACCENT = "#F59E0B";
const BG_ACCENT = "#FFFBEB";

function pct(actuel, min) {
  if (!min || min === 0) return 100;
  return Math.min(100, Math.round((actuel / (min * 2)) * 100));
}

function stockColor(actuel, min) {
  if (actuel === 0) return "#EF4444";
  if (actuel < min) return "#F59E0B";
  return "#10B981";
}

function fmt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

/** Génère MEDOS-AAAA-DIST-XXXXX */
function genererNumeroLot(annee = new Date().getFullYear()) {
  const suffix = Math.random().toString(36).toUpperCase().slice(2, 7);
  return `MEDOS-${annee}-DIST-${suffix}`;
}

// ── Modal Réception ───────────────────────────────────────────────────────────
const inputStyle = {
  width: "100%", padding: "9px 12px", border: "1.5px solid var(--border)",
  borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", color: colors.navy,
};
const labelStyle = { fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 5 };

function ModalReception({ medicaments, etablissement_id, onClose, onSuccess }) {
  const [form, setForm] = useState({
    nom: "",
    dosage: "",
    forme: "",
    fabricant: "",
    quantite: "",
    date_fabrication: "",
    date_expiration: "",
    prix_unitaire: "",
    prix_achat: "",
  });
  const [lotGenere, setLotGenere] = useState(genererNumeroLot());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Un produit déjà réceptionné une première fois réutilise sa fiche
  // médicament (nom identique, insensible à la casse) — sinon une nouvelle
  // fiche est créée dans le catalogue du distributeur. Pas de contrainte à
  // choisir depuis une liste figée : on peut toujours réceptionner un
  // nouveau produit jamais vu, comme un vrai arrivage fabricant.
  const existant = medicaments.find((m) => m.nom.trim().toLowerCase() === form.nom.trim().toLowerCase());

  const handleSubmit = useCallback(async () => {
    if (!form.nom.trim() || !form.fabricant || !form.quantite || !form.date_expiration) {
      setErr("Remplissez les champs obligatoires.");
      return;
    }
    const qty = parseInt(form.quantite, 10);
    if (isNaN(qty) || qty <= 0) { setErr("Quantité invalide."); return; }

    setSaving(true);
    setErr(null);
    try {
      let medicamentId = existant?.id;
      if (!medicamentId) {
        const nouveau = await insertMedicament({
          nom: form.nom.trim(),
          dosage: form.dosage.trim() || null,
          forme: form.forme.trim() || null,
          fabricant: form.fabricant.trim(),
          etablissement_id,
          stock_actuel: 0,
          stock_minimum: 10,
          prix_unitaire: form.prix_unitaire ? Number(form.prix_unitaire) : null,
          prix_achat: form.prix_achat ? Number(form.prix_achat) : null,
        });
        medicamentId = nouveau.id;
      }
      // 1. Insérer le lot dans Supabase → alimentera le scanner
      await insertLot({
        numero_lot: lotGenere,
        medicament_id: medicamentId,
        fabricant: form.fabricant,
        quantite_initiale: qty,
        date_fabrication: form.date_fabrication || null,
        date_expiration: form.date_expiration,
        qr_code: JSON.stringify({ lot: lotGenere, medicament_id: medicamentId }),
        ...(form.prix_achat ? { prix_achat: Number(form.prix_achat) } : {}),
      });
      // 2. Incrémenter le stock du médicament
      await incrementStock(medicamentId, qty);
      onSuccess(lotGenere, qty);
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  }, [form, lotGenere, onSuccess, existant, etablissement_id]);

  return (
    <div style={{
      position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)",
      zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{ backgroundColor: colors.bgCard, borderRadius: 16, padding: 28, width: "100%", maxWidth: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: colors.navy }}>Réceptionner une livraison</h3>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: colors.textSecondary }}>Un lot MedOS certifié sera généré automatiquement</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted, lineHeight: 1 }}>×</button>
        </div>

        {/* Numéro de lot généré */}
        <div style={{ backgroundColor: "#FFFBEB", borderRadius: 10, padding: "12px 16px", marginBottom: 20, border: "1px solid #FDE68A", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 11, color: "#92400E", fontWeight: 600, marginBottom: 2 }}>Numéro de lot MedOS généré</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#B45309", fontFamily: "monospace" }}>{lotGenere}</div>
          </div>
          <button
            onClick={() => setLotGenere(genererNumeroLot())}
            style={{ fontSize: 11, padding: "5px 10px", backgroundColor: colors.bgCard, border: "1px solid #FCD34D", borderRadius: 6, cursor: "pointer", color: "#B45309", fontWeight: 600 }}
          >
            Regénérer
          </button>
        </div>

        {/* Formulaire */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Médicament <span style={{ color: "#EF4444" }}>*</span></label>
            <input
              value={form.nom}
              onChange={(e) => set("nom", e.target.value)}
              placeholder="Ex: Amoxicilline 500mg — nouveau ou déjà reçu"
              list="entrepot-medicaments-existants"
              style={inputStyle}
            />
            <datalist id="entrepot-medicaments-existants">
              {medicaments.map((m) => <option key={m.id} value={m.nom} />)}
            </datalist>
            {form.nom.trim() && (
              <div style={{ fontSize: 11, color: existant ? "#2563EB" : "#16A34A", marginTop: 4 }}>
                {existant ? "Produit déjà dans votre catalogue — le stock sera incrémenté." : "Nouveau produit — une fiche sera créée dans votre catalogue."}
              </div>
            )}
          </div>

          <div className="form-row-2">
            <div>
              <label style={labelStyle}>Dosage</label>
              <input value={form.dosage} onChange={(e) => set("dosage", e.target.value)}
                placeholder="Ex: 500mg" style={inputStyle} disabled={!!existant} />
            </div>
            <div>
              <label style={labelStyle}>Forme</label>
              <input value={form.forme} onChange={(e) => set("forme", e.target.value)}
                placeholder="Ex: Comprimé, Gélule…" style={inputStyle} disabled={!!existant} />
            </div>
          </div>

          <div className="form-row-2">
            <div>
              <label style={labelStyle}>Fabricant <span style={{ color: "#EF4444" }}>*</span></label>
              <input value={form.fabricant} onChange={(e) => set("fabricant", e.target.value)}
                placeholder="Ex: Sanofi, Pfizer…" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Quantité reçue <span style={{ color: "#EF4444" }}>*</span></label>
              <input type="number" min="1" value={form.quantite} onChange={(e) => set("quantite", e.target.value)}
                placeholder="Ex: 500" style={inputStyle} />
            </div>
          </div>

          <div className="form-row-2">
            <div>
              <label style={labelStyle}>Date de fabrication</label>
              <input type="date" value={form.date_fabrication} onChange={(e) => set("date_fabrication", e.target.value)}
                style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Date d'expiration <span style={{ color: "#EF4444" }}>*</span></label>
              <input type="date" value={form.date_expiration} onChange={(e) => set("date_expiration", e.target.value)}
                style={inputStyle} />
            </div>
          </div>

          <div className="form-row-2">
            <div>
              <label style={labelStyle}>Prix unitaire grossiste (FCFA)</label>
              <input type="number" min="0" value={form.prix_unitaire} onChange={(e) => set("prix_unitaire", e.target.value)}
                placeholder="Ex: 2500" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Prix d'achat unitaire (FCFA)</label>
              <input type="number" min="0" value={form.prix_achat} onChange={(e) => set("prix_achat", e.target.value)}
                placeholder="Ex: 450" style={inputStyle} />
            </div>
          </div>
        </div>

        {err && (
          <div style={{ marginTop: 14, padding: "8px 12px", backgroundColor: "#FEF2F2", borderRadius: 8, fontSize: 12, color: "#DC2626" }}>
            {err}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px", backgroundColor: colors.bgSurface, color: colors.text, border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{ flex: 2, padding: "11px", backgroundColor: saving ? "#E5E7EB" : ACCENT, color: saving ? "#9CA3AF" : "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {saving ? (
              <><div style={{ width: 14, height: 14, border: "2px solid #9CA3AF", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />Enregistrement…</>
            ) : "Réceptionner et générer le lot"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Nouvelle commande fabricant (bon de commande multi-médicaments) ──────
const LIGNE_VIDE = () => ({ id: Date.now() + Math.random(), medicament_id: "", nom: "", dosage: "", quantite: "" });

function ModalCommandeFabricant({ medicaments, distributeurNom, etablissement_id, auth, prefillLignes, onClose, onSuccess }) {
  const { data: fabricants } = useFabricants();
  const [fabricantSelectionId, setFabricantSelectionId] = useState("");
  const [header, setHeader] = useState({ email_fabricant: "", fabricant: "", telephone: "", date_livraison: "", notes: "" });
  const [lignes, setLignes] = useState(() =>
    prefillLignes && prefillLignes.length > 0
      ? prefillLignes.map((l) => {
          const med = medicaments.find((m) => m.id === l.medicament_id);
          return { id: Date.now() + Math.random(), medicament_id: l.medicament_id, nom: med?.nom ?? "", dosage: med?.dosage ?? "", quantite: String(l.quantite) };
        })
      : [LIGNE_VIDE()]
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState(null);

  const setH = (k, v) => setHeader((h) => ({ ...h, [k]: v }));

  const selectFabricant = (id) => {
    setFabricantSelectionId(id);
    const f = fabricants.find((x) => x.id === id);
    if (f) setHeader((h) => ({ ...h, fabricant: f.nom, email_fabricant: f.email || "", telephone: f.telephone || "" }));
  };

  const setLigne = (id, k, v) =>
    setLignes((ls) => ls.map((l) => l.id === id ? { ...l, [k]: v } : l));
  const addLigne  = () => setLignes((ls) => [...ls, LIGNE_VIDE()]);
  const delLigne  = (id) => setLignes((ls) => ls.filter((l) => l.id !== id));

  // Un médicament déjà au catalogue est retrouvé par nom (insensible à la
  // casse, même logique que ModalReception) — sinon la ligne commande un
  // produit hors entrepôt : elle ne rejoint le catalogue qu'à la réception
  // (voir CommandeFabricantCard.handleStatutChange), jamais avant, pour ne
  // pas créer une fiche pour un produit jamais livré si la commande échoue.
  const resolveMedicament = (nom) =>
    medicaments.find((m) => m.nom.trim().toLowerCase() === nom.trim().toLowerCase());

  const totalRefs = lignes.filter((l) => l.nom.trim()).length;
  const totalQty  = lignes.reduce((s, l) => s + (parseInt(l.quantite, 10) || 0), 0);

  const handleSubmit = async () => {
    setErr(null);
    if (!header.fabricant.trim()) { setErr("Le nom du fabricant est obligatoire."); return; }
    if (!header.email_fabricant.trim() || !header.email_fabricant.includes("@")) {
      setErr("Email du fabricant invalide."); return;
    }
    const lignesValides = lignes.filter((l) => l.nom.trim() && parseInt(l.quantite, 10) > 0);
    if (lignesValides.length === 0) {
      setErr("Ajoutez au moins un médicament avec une quantité valide."); return;
    }

    setSaving(true);
    try {
      const lignesPayload = lignesValides.map((l) => {
        const existant = resolveMedicament(l.nom);
        const dosage = l.dosage.trim() || null;
        return {
          medicament_id: existant?.id ?? null,
          medicamentNom: existant ? existant.nom : l.nom.trim(),
          dosage: existant ? null : dosage,
          quantite: parseInt(l.quantite, 10),
        };
      });
      // Le bon de commande / email n'a qu'un seul champ nom (pas de colonne
      // dosage dédiée) — le dosage saisi y est donc affiché en suffixe,
      // séparément du nom plat conservé en base (medicament_nom) pour ne pas
      // le dupliquer plus tard dans la fiche médicament créée à la réception.
      const lignesAffichage = lignesPayload.map((l) =>
        l.dosage ? { ...l, medicamentNom: `${l.medicamentNom} ${l.dosage}` } : l
      );

      // Résout le fabricant : contact existant sélectionné (ou retrouvé par
      // email), sinon nouvelle fiche créée à la volée — réutilisable pour les
      // prochaines commandes, sans jamais créer de compte MedOS.
      let fabricantId = fabricantSelectionId || null;
      if (!fabricantId) {
        const existant = fabricants.find((f) => f.email && f.email.toLowerCase() === header.email_fabricant.trim().toLowerCase());
        if (existant) {
          fabricantId = existant.id;
        } else {
          const nouveau = await insertFabricant({
            nom: header.fabricant.trim(),
            email: header.email_fabricant.trim(),
            telephone: header.telephone.trim() || null,
            actif: true,
            ...(etablissement_id ? { etablissement_id } : {}),
          });
          fabricantId = nouveau.id;
        }
      }

      const reference = "CMD-" + Date.now().toString().slice(-8);
      const commande = await insertCommande({
        reference,
        fabricant_id:          fabricantId,
        statut:                "envoyee",
        date_commande:         new Date().toISOString(),
        date_livraison_prevue: header.date_livraison || null,
        montant_total:         0,
        notes:                 header.notes.trim() || null,
        ...(etablissement_id ? { etablissement_id } : {}),
      });

      await insertCommandeLignes(lignesPayload.map((l) => ({
        commande_id:      commande.id,
        etablissement_id: etablissement_id ?? null,
        medicament_id:    l.medicament_id,
        medicament_nom:   l.medicamentNom,
        dosage:           l.dosage,
        quantite:         l.quantite,
      })));

      const etab = await fetchEtabFromAuth(auth);
      const pieceJointe = await genererPieceJointeBonCommandeFabricant({
        fabricantNom: header.fabricant.trim(), emailFabricant: header.email_fabricant.trim(),
        lignes: lignesAffichage, dateLivraison: header.date_livraison, notes: header.notes.trim(),
        etabNom: etab.nom, reference,
      });

      // L'email est une étape distincte de l'enregistrement de la commande :
      // la commande reste valide même si l'envoi échoue, mais le statut réel
      // est toujours tracé et remonté honnêtement à l'utilisateur.
      let emailStatut = "non_envoye";
      let emailErreur = null;
      try {
        await sendCommandeEmail({
          emailFabricant: header.email_fabricant.trim(),
          fabricant:      header.fabricant.trim(),
          lignes:         lignesAffichage,
          dateLivraison:  header.date_livraison,
          notes:          header.notes.trim(),
          distributeur:   distributeurNom,
          pieceJointe,
        });
        emailStatut = "envoye";
      } catch (emailErr) {
        emailStatut = "echec";
        emailErreur = emailErr.message;
      }
      await updateCommande(commande.id, { email_statut: emailStatut, email_erreur: emailErreur });

      onSuccess({ emailStatut, emailErreur, reference, fabricantNom: header.fabricant.trim(), nbLignes: lignesPayload.length });
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ backgroundColor: colors.bgCard, borderRadius: 16, width: "100%", maxWidth: 680, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>

        {/* ── En-tête fixe ── */}
        <div style={{ padding: "22px 28px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: colors.navy }}>Nouveau bon de commande fabricant</h3>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: colors.textSecondary }}>Le bon de commande sera envoyé par email au fabricant</p>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted, lineHeight: 1, flexShrink: 0 }}>×</button>
          </div>

          {prefillLignes && prefillLignes.length > 0 && (
            <div style={{ marginBottom: 12, padding: "8px 12px", backgroundColor: "#EFF6FF", color: "#2563EB", borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
              {prefillLignes.length > 1 ? `${prefillLignes.length} médicaments pré-remplis depuis les alertes de stock bas.` : "Médicament pré-rempli depuis une alerte de stock bas."}
            </div>
          )}

          {/* Sélection d'un fabricant déjà enregistré (optionnel) */}
          {fabricants.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Fabricant enregistré</label>
              <select value={fabricantSelectionId} onChange={(e) => selectFabricant(e.target.value)} style={{ ...inputStyle, backgroundColor: colors.bgCard }}>
                <option value="">— Nouveau fabricant (saisie libre) —</option>
                {fabricants.map((f) => <option key={f.id} value={f.id}>{f.nom}{f.email ? ` (${f.email})` : ""}</option>)}
              </select>
            </div>
          )}

          {/* Champs en-tête */}
          <div className="form-row-2" style={{ marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Nom du fabricant <span style={{ color: "#EF4444" }}>*</span></label>
              <input value={header.fabricant} onChange={(e) => { setFabricantSelectionId(""); setH("fabricant", e.target.value); }}
                placeholder="Ex : Sanofi, Pfizer…" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Email du fabricant <span style={{ color: "#EF4444" }}>*</span></label>
              <input type="email" value={header.email_fabricant} onChange={(e) => { setFabricantSelectionId(""); setH("email_fabricant", e.target.value); }}
                placeholder="commandes@fabricant.com" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Téléphone</label>
              <input value={header.telephone} onChange={(e) => { setFabricantSelectionId(""); setH("telephone", e.target.value); }}
                placeholder="Ex : +242 06 000 0000" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Date de livraison souhaitée</label>
              <input type="date" value={header.date_livraison} onChange={(e) => setH("date_livraison", e.target.value)}
                style={inputStyle} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Instructions générales</label>
              <input value={header.notes} onChange={(e) => setH("notes", e.target.value)}
                placeholder="Température, conditionnement…" style={inputStyle} />
            </div>
          </div>

          {/* En-tête tableau */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 130px 36px", gap: 8, padding: "8px 12px", backgroundColor: colors.bgSurface, borderRadius: "8px 8px 0 0", border: "1px solid var(--border)", borderBottom: "none" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: colors.textSecondary, textTransform: "uppercase" }}>Médicament</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: colors.textSecondary, textTransform: "uppercase" }}>Quantité</div>
            <div />
          </div>
        </div>

        {/* ── Lignes défilables ── */}
        <div style={{ overflowY: "auto", flexGrow: 1, padding: "0 28px", borderLeft: "none" }}>
          <div style={{ border: "1px solid var(--border)", borderTop: "none", borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
            {lignes.map((l, i) => {
              const existant = l.nom.trim() ? resolveMedicament(l.nom) : null;
              return (
              <div key={l.id} style={{ display: "grid", gridTemplateColumns: "1fr 130px 36px", gap: 8, padding: "8px 12px", borderBottom: i < lignes.length - 1 ? "1px solid var(--border-light)" : "none", alignItems: "start", backgroundColor: i % 2 === 0 ? "white" : "#FAFAFA" }}>
                <div>
                  <input
                    value={l.nom}
                    onChange={(e) => setLigne(l.id, "nom", e.target.value)}
                    placeholder="Médicament — nouveau ou déjà à l'entrepôt"
                    list="entrepot-fabricant-medicaments-existants"
                    style={{ ...inputStyle, fontSize: 12, padding: "7px 10px", backgroundColor: colors.bgCard }}
                  />
                  {l.nom.trim() && (
                    <div style={{ fontSize: 10, color: existant ? "#2563EB" : "#16A34A", marginTop: 3 }}>
                      {existant ? "Déjà à l'entrepôt." : "Hors entrepôt — ajouté au catalogue à la réception."}
                    </div>
                  )}
                  {l.nom.trim() && !existant && (
                    <input
                      value={l.dosage}
                      onChange={(e) => setLigne(l.id, "dosage", e.target.value)}
                      placeholder="Dosage (ex: 500mg)"
                      style={{ ...inputStyle, fontSize: 12, padding: "6px 10px", marginTop: 4 }}
                    />
                  )}
                </div>
                <input
                  type="number" min="1"
                  value={l.quantite}
                  onChange={(e) => setLigne(l.id, "quantite", e.target.value)}
                  placeholder="Qté"
                  style={{ ...inputStyle, fontSize: 12, padding: "7px 10px", textAlign: "right" }}
                />
                <button
                  onClick={() => lignes.length > 1 && delLigne(l.id)}
                  disabled={lignes.length === 1}
                  style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: lignes.length === 1 ? "#F8FAFC" : "#FEF2F2", border: "none", borderRadius: 6, cursor: lignes.length === 1 ? "not-allowed" : "pointer", color: lignes.length === 1 ? "#D1D5DB" : "#EF4444", fontSize: 16, flexShrink: 0 }}
                  title="Supprimer cette ligne"
                >×</button>
              </div>
              );
            })}
          </div>
          <datalist id="entrepot-fabricant-medicaments-existants">
            {medicaments.map((m) => <option key={m.id} value={m.nom} />)}
          </datalist>

          <button
            onClick={addLigne}
            style={{ marginTop: 10, marginBottom: 4, display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", backgroundColor: colors.bgCard, border: `1.5px dashed ${ACCENT}`, borderRadius: 8, fontSize: 12, color: ACCENT, fontWeight: 600, cursor: "pointer" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            Ajouter un médicament
          </button>
        </div>

        {/* ── Pied fixe : total + actions ── */}
        <div style={{ padding: "12px 28px 20px", flexShrink: 0, borderTop: "1px solid var(--border-light)" }}>
          {/* Totaux */}
          <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>
              Références : <strong style={{ color: colors.navy }}>{totalRefs}</strong>
            </div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>
              Quantité totale : <strong style={{ color: colors.navy }}>{totalQty.toLocaleString("fr-FR")} unités</strong>
            </div>
          </div>

          {err && (
            <div style={{ padding: "8px 12px", backgroundColor: "#FEF2F2", borderRadius: 8, fontSize: 12, color: "#DC2626", marginBottom: 12 }}>
              {err}
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: "11px", backgroundColor: colors.bgSurface, color: colors.text, border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
              Annuler
            </button>
            <button
              onClick={async () => {
                const lignesValides = lignes.filter((l) => l.nom.trim() && parseInt(l.quantite, 10) > 0);
                if (lignesValides.length === 0) return;
                const lignesPrint = lignesValides.map((l) => {
                  const existant = resolveMedicament(l.nom);
                  const dosage = l.dosage.trim() || null;
                  return { medicamentNom: existant ? existant.nom : `${l.nom.trim()}${dosage ? " " + dosage : ""}`, quantite: parseInt(l.quantite, 10) };
                });
                const etab = await fetchEtabFromAuth(auth);
                printBonCommandeFabricant({ header, lignes: lignesPrint, etab });
              }}
              style={{ padding: "11px 16px", backgroundColor: colors.bgSurface, color: colors.text, border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              Imprimer
            </button>
            <button onClick={handleSubmit} disabled={saving}
              style={{ flex: 2, padding: "11px", backgroundColor: saving ? "#E5E7EB" : ACCENT, color: saving ? "#9CA3AF" : "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {saving
                ? <><div style={{ width: 14, height: 14, border: "2px solid #9CA3AF", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />Envoi en cours…</>
                : "Envoyer le bon de commande"
              }
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Modal Modifier un médicament ────────────────────────────────────────────
function ModalEditMedicament({ medicament, onClose, onSaved }) {
  const [form, setForm] = useState({
    nom: medicament.nom || "",
    dosage: medicament.dosage || "",
    forme: medicament.forme || "",
    dci: medicament.dci || "",
    categorie: medicament.categorie || "",
    fabricant: medicament.fabricant || "",
    stock_actuel: String(medicament.stock_actuel ?? 0),
    stock_minimum: String(medicament.stock_minimum ?? 0),
    prix_achat: medicament.prix_achat != null ? String(medicament.prix_achat) : "",
    prix_unitaire: medicament.prix_unitaire != null ? String(medicament.prix_unitaire) : "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.nom.trim()) { setErr("Le nom est obligatoire."); return; }
    setSaving(true);
    setErr(null);
    try {
      await updateMedicament(medicament.id, {
        nom: form.nom.trim(),
        dosage: form.dosage.trim() || null,
        forme: form.forme.trim() || null,
        dci: form.dci.trim() || null,
        categorie: form.categorie.trim() || null,
        fabricant: form.fabricant.trim() || null,
        stock_actuel: parseInt(form.stock_actuel, 10) || 0,
        stock_minimum: parseInt(form.stock_minimum, 10) || 0,
        prix_achat: form.prix_achat ? Number(form.prix_achat) : null,
        prix_unitaire: form.prix_unitaire ? Number(form.prix_unitaire) : null,
      });
      onSaved();
      onClose();
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ backgroundColor: colors.bgCard, borderRadius: 16, padding: 28, width: "100%", maxWidth: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: colors.navy }}>Modifier — {medicament.nom}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Nom <span style={{ color: "#EF4444" }}>*</span></label>
            <input style={inputStyle} value={form.nom} onChange={(e) => set("nom", e.target.value)} />
          </div>
          <div className="form-row-2">
            <div>
              <label style={labelStyle}>Dosage</label>
              <input style={inputStyle} value={form.dosage} onChange={(e) => set("dosage", e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Forme</label>
              <input style={inputStyle} value={form.forme} onChange={(e) => set("forme", e.target.value)} />
            </div>
          </div>
          <div className="form-row-2">
            <div>
              <label style={labelStyle}>DCI</label>
              <input style={inputStyle} value={form.dci} onChange={(e) => set("dci", e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Catégorie</label>
              <input style={inputStyle} value={form.categorie} onChange={(e) => set("categorie", e.target.value)} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Fabricant</label>
            <input style={inputStyle} value={form.fabricant} onChange={(e) => set("fabricant", e.target.value)} />
          </div>
          <div className="form-row-2">
            <div>
              <label style={labelStyle}>Stock actuel</label>
              <input style={inputStyle} type="number" min="0" value={form.stock_actuel} onChange={(e) => set("stock_actuel", e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Seuil minimum</label>
              <input style={inputStyle} type="number" min="0" value={form.stock_minimum} onChange={(e) => set("stock_minimum", e.target.value)} />
            </div>
          </div>
          <div className="form-row-2">
            <div>
              <label style={labelStyle}>Prix d'achat unitaire (FCFA)</label>
              <input style={inputStyle} type="number" min="0" value={form.prix_achat} onChange={(e) => set("prix_achat", e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Prix unitaire grossiste (FCFA)</label>
              <input style={inputStyle} type="number" min="0" value={form.prix_unitaire} onChange={(e) => set("prix_unitaire", e.target.value)} />
            </div>
          </div>
        </div>
        {err && (
          <div style={{ marginTop: 14, padding: "8px 12px", backgroundColor: "#FEF2F2", borderRadius: 8, fontSize: 12, color: "#DC2626" }}>{err}</div>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px", backgroundColor: colors.bgSurface, color: colors.text, border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
            Annuler
          </button>
          <button onClick={handleSubmit} disabled={saving}
            style={{ flex: 2, padding: "11px", backgroundColor: saving ? "#E5E7EB" : ACCENT, color: saving ? "#9CA3AF" : "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "Enregistrement…" : "Enregistrer les modifications"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Détail médicament (voir / modifier / supprimer / archiver) ───────────
function ModalDetailMedicament({ medicament, onClose, onEdit, onChanged }) {
  const [lots, setLots] = useState([]);
  const [mouvements, setMouvements] = useState([]);
  const [loadingRel, setLoadingRel] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [blocage, setBlocage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  // Chargement des données liées (lots + mouvements récents) — sert aussi à
  // déterminer si une suppression définitive est possible.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingRel(true);
      const [lotsRes, mvtRes] = await Promise.all([
        supabase.from("lots").select("id, numero_lot, quantite_initiale, date_expiration").eq("medicament_id", medicament.id).order("created_at", { ascending: false }),
        supabase.from("mouvements_stock").select("id, type, quantite, motif, created_at").eq("medicament_id", medicament.id).order("created_at", { ascending: false }).limit(10),
      ]);
      if (cancelled) return;
      setLots(lotsRes.data ?? []);
      setMouvements(mvtRes.data ?? []);
      setLoadingRel(false);
    })();
    return () => { cancelled = true; };
  }, [medicament.id]);

  const handleDeleteClick = async () => {
    setErr(null);
    setBusy(true);
    try {
      const [lotsCount, mvtCount, livrCount, cmdCount] = await Promise.all([
        supabase.from("lots").select("id", { count: "exact", head: true }).eq("medicament_id", medicament.id),
        supabase.from("mouvements_stock").select("id", { count: "exact", head: true }).eq("medicament_id", medicament.id),
        supabase.from("livraison_lignes").select("id", { count: "exact", head: true }).eq("medicament_id", medicament.id),
        supabase.from("commande_lignes").select("id", { count: "exact", head: true }).eq("medicament_id", medicament.id),
      ]);
      const total = (lotsCount.count ?? 0) + (mvtCount.count ?? 0) + (livrCount.count ?? 0) + (cmdCount.count ?? 0);
      if (total > 0) {
        setBlocage({
          lots: lotsCount.count ?? 0, mouvements: mvtCount.count ?? 0,
          livraisons: livrCount.count ?? 0, commandes: cmdCount.count ?? 0,
        });
      } else {
        setConfirmDelete(true);
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    setBusy(true);
    setErr(null);
    try {
      await deleteMedicament(medicament.id);
      onChanged(`${medicament.nom} supprimé.`);
      onClose();
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  const handleArchiveToggle = async () => {
    setBusy(true);
    setErr(null);
    try {
      const nextActif = medicament.actif === false;
      await updateMedicament(medicament.id, { actif: nextActif });
      onChanged(nextActif ? `${medicament.nom} réactivé.` : `${medicament.nom} archivé.`);
      onClose();
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ backgroundColor: colors.bgCard, borderRadius: 16, padding: 28, width: "100%", maxWidth: 560, maxHeight: "88vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: colors.navy }}>
              {medicament.nom}
              {medicament.actif === false && (
                <span style={{ marginLeft: 8, fontSize: 11, padding: "2px 8px", borderRadius: 6, backgroundColor: "#F3F4F6", color: "#6B7280", fontWeight: 700 }}>Archivé</span>
              )}
            </h3>
            <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
              {[medicament.dosage, medicament.forme].filter(Boolean).join(" · ") || "—"}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Stock actuel", value: `${medicament.stock_actuel ?? 0} unités` },
            { label: "Seuil minimum", value: `${medicament.stock_minimum ?? 0} unités` },
            { label: "DCI", value: medicament.dci || "—" },
            { label: "Catégorie", value: medicament.categorie || "—" },
            { label: "Fabricant", value: medicament.fabricant || "—" },
            { label: "Prix d'achat", value: medicament.prix_achat ? `${medicament.prix_achat.toLocaleString("fr-FR")} FCFA` : "—" },
          ].map((f) => (
            <div key={f.label} style={{ padding: "10px 12px", backgroundColor: colors.bgSurface, borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: colors.textMuted, marginBottom: 2 }}>{f.label}</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: colors.navy }}>{f.value}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, color: colors.textSecondary, textTransform: "uppercase", marginBottom: 8 }}>
          Lots enregistrés ({loadingRel ? "…" : lots.length})
        </div>
        {!loadingRel && lots.length === 0 && (
          <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 16 }}>Aucun lot pour ce médicament.</div>
        )}
        {lots.slice(0, 5).map((l) => (
          <div key={l.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 12, borderBottom: "1px solid var(--border-light)" }}>
            <span style={{ fontFamily: "monospace", color: colors.navy }}>{l.numero_lot}</span>
            <span style={{ color: colors.textSecondary }}>{l.quantite_initiale} unités · exp. {l.date_expiration ? new Date(l.date_expiration).toLocaleDateString("fr-FR") : "—"}</span>
          </div>
        ))}

        <div style={{ fontSize: 12, fontWeight: 700, color: colors.textSecondary, textTransform: "uppercase", margin: "16px 0 8px" }}>
          Mouvements récents ({loadingRel ? "…" : mouvements.length})
        </div>
        {!loadingRel && mouvements.length === 0 && (
          <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 8 }}>Aucun mouvement enregistré.</div>
        )}
        {mouvements.slice(0, 5).map((m) => (
          <div key={m.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 12, borderBottom: "1px solid var(--border-light)" }}>
            <span style={{ color: m.type === "entree" ? "#16A34A" : "#DC2626", fontWeight: 600 }}>{m.type === "entree" ? "+ " : "− "}{m.quantite}</span>
            <span style={{ color: colors.textSecondary }}>{m.motif || "—"}</span>
          </div>
        ))}

        {blocage && (
          <div style={{ marginTop: 16, padding: "12px 14px", backgroundColor: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#92400E", marginBottom: 4 }}>
              Suppression impossible — ce médicament est lié à des données existantes
            </div>
            <div style={{ fontSize: 11, color: "#92400E" }}>
              {blocage.lots} lot(s), {blocage.mouvements} mouvement(s), {blocage.livraisons} ligne(s) de livraison,
              {" "}{blocage.commandes} ligne(s) de commande.
            </div>
            <div style={{ fontSize: 11, color: "#92400E", marginTop: 6 }}>
              Vous pouvez l'archiver à la place : il disparaîtra de la liste active sans perdre son historique.
            </div>
          </div>
        )}

        {confirmDelete && (
          <div style={{ marginTop: 16, padding: "12px 14px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#DC2626", marginBottom: 8 }}>
              Confirmer la suppression définitive de "{medicament.nom}" ? Cette action est irréversible.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmDelete(false)} style={{ padding: "6px 14px", backgroundColor: colors.bgCard, border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>Annuler</button>
              <button onClick={handleConfirmDelete} disabled={busy} style={{ padding: "6px 14px", backgroundColor: "#DC2626", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: busy ? "wait" : "pointer" }}>
                {busy ? "Suppression…" : "Supprimer définitivement"}
              </button>
            </div>
          </div>
        )}

        {err && (
          <div style={{ marginTop: 12, padding: "8px 12px", backgroundColor: "#FEF2F2", borderRadius: 8, fontSize: 12, color: "#DC2626" }}>{err}</div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
          <button onClick={onClose} style={{ padding: "9px 16px", backgroundColor: colors.bgSurface, color: colors.text, border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
            Fermer
          </button>
          <button onClick={() => onEdit(medicament)} style={{ padding: "9px 16px", backgroundColor: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Modifier
          </button>
          <button onClick={handleArchiveToggle} disabled={busy} style={{ padding: "9px 16px", backgroundColor: colors.bgSurface, color: colors.text, border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: busy ? "wait" : "pointer" }}>
            {medicament.actif === false ? "Réactiver" : "Archiver"}
          </button>
          {!confirmDelete && !blocage && (
            <button onClick={handleDeleteClick} disabled={busy} style={{ padding: "9px 16px", backgroundColor: "#FEF2F2", color: "#DC2626", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: busy ? "wait" : "pointer" }}>
              {busy ? "Vérification…" : "Supprimer"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Modal Fabricant (ajout + édition d'un contact externe) ─────────────────────
function FabricantModal({ initial, etablissement_id, onClose, onSaved }) {
  const [form, setForm] = useState({
    nom: initial?.nom || "", email: initial?.email || "",
    telephone: initial?.telephone || "", notes: initial?.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const isEdit = !!initial;

  const handleSave = async () => {
    if (!form.nom.trim()) { setErr("Le nom du fabricant est obligatoire."); return; }
    setSaving(true);
    setErr(null);
    try {
      if (isEdit) {
        await updateFabricant(initial.id, form);
      } else {
        await insertFabricant({ ...form, actif: true, ...(etablissement_id ? { etablissement_id } : {}) });
      }
      onSaved();
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ backgroundColor: colors.bgCard, borderRadius: 16, padding: 28, width: "100%", maxWidth: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: colors.navy }}>{isEdit ? `Modifier — ${initial.nom}` : "Ajouter un fabricant"}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Nom du fabricant <span style={{ color: "#EF4444" }}>*</span></label>
            <input value={form.nom} onChange={(e) => set("nom", e.target.value)} placeholder="Ex : Sanofi, Pfizer…" style={inputStyle} autoFocus />
          </div>
          <div className="form-row-2">
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="commandes@fabricant.com" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Téléphone</label>
              <input value={form.telephone} onChange={(e) => set("telephone", e.target.value)} placeholder="Ex : +242 06 000 0000" style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Notes</label>
            <input value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Informations complémentaires…" style={inputStyle} />
          </div>
        </div>
        {err && <div style={{ marginTop: 14, padding: "8px 12px", backgroundColor: "#FEF2F2", borderRadius: 8, fontSize: 12, color: "#DC2626" }}>{err}</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px", backgroundColor: colors.bgSurface, color: colors.text, border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: "11px", backgroundColor: saving ? "#E5E7EB" : ACCENT, color: saving ? "#9CA3AF" : "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "Enregistrement…" : isEdit ? "Enregistrer" : "Ajouter le fabricant"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Onglet Fabricants (contacts externes du distributeur) ──────────────────────
function FabricantsTab({ etablissement_id, success, toastError }) {
  const [filtre, setFiltre] = useState("actifs");
  const { data: liste, loading, total, refetch } = useFabricantsPaginated(filtre);
  const [addModal, setAddModal]   = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [toggling, setToggling]   = useState(null);

  const handleToggleActif = async (f) => {
    setToggling(f.id);
    try {
      await updateFabricant(f.id, { actif: !f.actif });
      success(f.actif ? `${f.nom} désactivé` : `${f.nom} réactivé`);
      refetch();
    } catch (e) {
      toastError("Erreur : " + e.message);
    } finally {
      setToggling(null);
    }
  };

  const FILTRES = [{ key: "actifs", label: "Actifs" }, { key: "inactifs", label: "Inactifs" }, { key: "tous", label: "Tous" }];

  return (
    <div>
      {addModal && (
        <FabricantModal etablissement_id={etablissement_id} onClose={() => setAddModal(false)}
          onSaved={() => { success("Fabricant ajouté avec succès"); refetch(); setAddModal(false); }} />
      )}
      {editModal && (
        <FabricantModal initial={editModal} etablissement_id={etablissement_id} onClose={() => setEditModal(null)}
          onSaved={() => { success(`${editModal.nom} mis à jour`); refetch(); setEditModal(null); }} />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", backgroundColor: colors.bgCard, borderRadius: 10, padding: 3, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", gap: 2 }}>
            {FILTRES.map((f) => (
              <button key={f.key} onClick={() => setFiltre(f.key)}
                style={{ padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", backgroundColor: filtre === f.key ? ACCENT : "transparent", color: filtre === f.key ? "white" : "#6B7280" }}>
                {f.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 13, color: colors.textMuted }}>{loading ? "Chargement…" : `${total} fabricant${total !== 1 ? "s" : ""}`}</div>
        </div>
        <button onClick={() => setAddModal(true)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", backgroundColor: ACCENT, color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Ajouter un fabricant
        </button>
      </div>

      <div className="dash-grid-2">
        {!loading && liste.length === 0 && (
          <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "60px 0", color: colors.textMuted, fontSize: 14 }}>
            {filtre === "inactifs" ? "Aucun fabricant inactif." : "Aucun fabricant enregistré."}
          </div>
        )}
        {!loading && liste.map((f) => {
          const actif = f.actif !== false;
          return (
            <div key={f.id} style={{ backgroundColor: colors.bgCard, borderRadius: 16, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", opacity: actif ? 1 : 0.75 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: colors.navy }}>{f.nom}</div>
                <span style={{ padding: "4px 12px", borderRadius: 12, fontSize: 11, fontWeight: 700, backgroundColor: actif ? "#DCFCE7" : "#F3F4F6", color: actif ? "#16A34A" : "#9CA3AF" }}>{actif ? "actif" : "inactif"}</span>
              </div>
              <div style={{ padding: "10px 12px", backgroundColor: colors.bgSurface, borderRadius: 10, marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: "#3B82F6" }}>{f.email || "—"}</div>
                <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{f.telephone || "—"}</div>
                {f.notes && <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 6 }}>{f.notes}</div>}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setEditModal(f)} style={{ flex: 1, padding: "9px", backgroundColor: colors.bgSurface, color: colors.text, border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Modifier</button>
                <button onClick={() => handleToggleActif(f)} disabled={toggling === f.id}
                  style={{ padding: "9px 12px", backgroundColor: actif ? "#FEF2F2" : "#F0FDF4", color: actif ? "#DC2626" : "#16A34A", border: `1px solid ${actif ? "#FECACA" : "#BBF7D0"}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: toggling === f.id ? "wait" : "pointer", whiteSpace: "nowrap" }}>
                  {toggling === f.id ? "…" : actif ? "Désactiver" : "Réactiver"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Onglet Commandes fabricant (historique) ─────────────────────────────────────
const STATUT_STYLE = {
  brouillon:  { bg: "#F3F4F6", color: colors.textSecondary, label: "Brouillon" },
  envoyee:    { bg: "#FEF9C3", color: "#A16207", label: "Envoyée" },
  confirmee:  { bg: "#DBEAFE", color: "#2563EB", label: "Confirmée" },
  en_transit: { bg: "#E0E7FF", color: "#4F46E5", label: "En transit" },
  livree:     { bg: "#DCFCE7", color: "#16A34A", label: "Reçue" },
  annulee:    { bg: "#FEF2F2", color: "#DC2626", label: "Annulée / refusée" },
};
const STATUT_ACTIONS = {
  envoyee:    [{ label: "Marquer confirmée", next: "confirmee" }, { label: "Annuler", next: "annulee", danger: true }],
  confirmee:  [{ label: "Marquer en transit", next: "en_transit" }, { label: "Annuler", next: "annulee", danger: true }],
  en_transit: [{ label: "Marquer reçue", next: "livree" }, { label: "Annuler", next: "annulee", danger: true }],
};
const STATUT_LABEL_HISTORIQUE = {
  brouillon: "Brouillon créé", envoyee: "Commande envoyée", confirmee: "Confirmée par le fabricant",
  en_transit: "En transit", livree: "Reçue (stock entrepôt mis à jour)", annulee: "Annulée",
};

function CommandeFabricantHistoriqueInline({ commandeId }) {
  const { data: historique, loading } = useCommandeHistorique(commandeId);
  if (loading) return <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 10 }}>Chargement de l'historique…</div>;
  if (historique.length === 0) return null;
  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed var(--border)" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 }}>Historique du statut</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {historique.map((h) => (
          <div key={h.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <span style={{ color: colors.text }}>{STATUT_LABEL_HISTORIQUE[h.statut] ?? h.statut}</span>
            <span style={{ color: colors.textMuted }}>{new Date(h.changed_at).toLocaleString("fr-FR")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CommandeFabricantCard({ commande, auth, medicaments, success, toastError, onChanged }) {
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showScanCamera, setShowScanCamera] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [codeScanne, setCodeScanne] = useState("");
  const s = STATUT_STYLE[commande.statut] || { bg: "#F3F4F6", color: colors.textSecondary, label: commande.statut };
  const actions = STATUT_ACTIONS[commande.statut] || [];
  const lignes = commande.commande_lignes ?? [];
  const ligneNom = (l) => `${l.medicament_nom}${l.dosage ? ` ${l.dosage}` : ""}`;
  const medicamentLabel = lignes.length === 1 ? `${ligneNom(lignes[0])} × ${lignes[0].quantite}` : `${lignes.length} produits`;

  const handleQrScan = (text) => {
    setShowScanCamera(false);
    setCodeScanne(text.trim());
    setShowScanModal(true);
  };

  const handleStatutChange = async (next, label) => {
    if (next === "annulee" && !window.confirm(`Confirmer l'annulation de la commande ${commande.reference ?? ""} ?`)) return;
    setUpdating(true);
    try {
      // "Reçue" incrémente le stock de l'entrepôt pour chaque ligne — le
      // fabricant est un tiers externe, il n'y a pas de flux `livraisons` côté
      // client pour cette réception, contrairement aux clients MedOS.
      // Une ligne "hors entrepôt" (medicament_id nul, voir ModalCommandeFabricant)
      // rejoint le catalogue seulement maintenant — jamais avant, pour ne pas
      // créer de fiche pour un produit jamais reçu si la commande est annulée.
      if (next === "livree") {
        for (const l of lignes) {
          let medicamentId = l.medicament_id;
          if (!medicamentId) {
            const nouveau = await insertMedicament({
              nom: l.medicament_nom,
              dosage: l.dosage || null,
              fabricant: commande.fabricants?.nom || null,
              etablissement_id: auth?.etablissement_id,
              stock_actuel: 0,
              stock_minimum: 10,
            });
            medicamentId = nouveau.id;
          }
          await incrementStock(medicamentId, l.quantite);
        }
      }
      await updateCommande(commande.id, { statut: next });
      success(`${commande.reference ?? "Commande"} — ${label.toLowerCase()}${next === "livree" ? " : stock entrepôt mis à jour" : ""}`);
      onChanged();
    } catch (e) {
      toastError("Erreur : " + e.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Supprimer définitivement le brouillon ${commande.reference ?? ""} ? Cette action est irréversible.`)) return;
    setUpdating(true);
    try {
      await deleteCommande(commande.id);
      success(`${commande.reference ?? "Brouillon"} supprimé.`);
      onChanged();
    } catch (e) {
      toastError("Erreur : " + e.message);
    } finally {
      setUpdating(false);
    }
  };

  const handlePrint = () => {
    const header = { fabricant: commande.fabricants?.nom, email_fabricant: commande.fabricants?.email, date_livraison: commande.date_livraison_prevue, notes: commande.notes };
    fetchEtabFromAuth(auth).then((etab) => printBonCommandeFabricant({ header, lignes: lignes.map((l) => ({ medicamentNom: ligneNom(l), quantite: l.quantite })), etab }));
  };

  return (
    <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "18px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: colors.navy }}>{commande.reference || commande.id.slice(0, 8).toUpperCase()}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: s.color, padding: "2px 8px", backgroundColor: s.bg, borderRadius: 8 }}>{s.label}</span>
            {commande.email_statut === "envoye" && (
              <span title="Email envoyé au fabricant" style={{ fontSize: 10, fontWeight: 700, color: "#16A34A", backgroundColor: "#DCFCE7", padding: "2px 8px", borderRadius: 8 }}>Envoyé</span>
            )}
            {commande.email_statut === "echec" && (
              <span title={commande.email_erreur || "Échec de l'envoi"} style={{ fontSize: 10, fontWeight: 700, color: "#DC2626", backgroundColor: "#FEF2F2", padding: "2px 8px", borderRadius: 8 }}>Non envoyé</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
            {commande.fabricants?.nom ?? "—"} · {medicamentLabel} · {new Date(commande.date_commande).toLocaleDateString("fr-FR")}
          </div>
        </div>
      </div>

      {lignes.length > 1 && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 3 }}>
          {lignes.map((l) => (
            <div key={l.id} style={{ fontSize: 12, color: colors.text, display: "flex", justifyContent: "space-between", padding: "4px 10px", backgroundColor: colors.bgSurface, borderRadius: 6 }}>
              <span>{ligneNom(l)}{!l.medicament_id && <span style={{ marginLeft: 6, fontSize: 10, color: "#2563EB" }}>(hors entrepôt)</span>}</span>
              <span style={{ fontWeight: 700 }}>× {l.quantite}</span>
            </div>
          ))}
        </div>
      )}

      {commande.email_statut === "echec" && commande.email_erreur && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#DC2626", backgroundColor: "#FEF2F2", padding: "6px 10px", borderRadius: 8 }}>{commande.email_erreur}</div>
      )}

      <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
        {actions.map((a) => (
          <button key={a.next} disabled={updating} onClick={() => handleStatutChange(a.next, a.label)}
            style={{ padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: updating ? "wait" : "pointer", border: "none", backgroundColor: a.danger ? "#FEF2F2" : "#EFF6FF", color: a.danger ? "#DC2626" : "#2563EB" }}>
            {a.label}
          </button>
        ))}
        {commande.statut === "brouillon" && (
          <button disabled={updating} onClick={handleDelete} style={{ padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: updating ? "wait" : "pointer", border: "none", backgroundColor: "#FEF2F2", color: "#DC2626" }}>Supprimer</button>
        )}
        {commande.statut === "en_transit" && (
          <button onClick={() => setShowScanCamera(true)} style={{ padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", backgroundColor: "#FFFBEB", color: "#B45309", border: "1px solid #FDE68A" }}>
            Scanner pour réceptionner
          </button>
        )}
        <button onClick={handlePrint} style={{ padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", backgroundColor: colors.bgSurface, color: colors.text, border: "1px solid var(--border)" }}>Voir le bon de commande</button>
        <button onClick={() => setExpanded((e) => !e)} style={{ padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", backgroundColor: "transparent", color: colors.textMuted, border: "none" }}>
          {expanded ? "Masquer l'historique ▲" : "Historique ▾"}
        </button>
      </div>

      {expanded && <CommandeFabricantHistoriqueInline commandeId={commande.id} />}

      {/* Scan-pour-enregistrer directement depuis la réception d'une commande
          fabricant — même composant que l'écran Traçabilité isolé (Point 7),
          pour ne plus obliger un aller-retour entre les deux écrans. */}
      {showScanCamera && <QrScanner onScan={handleQrScan} onClose={() => setShowScanCamera(false)} />}
      {showScanModal && (
        <ModalScanEnregistrer
          nomInitial={lignes.length === 1 ? lignes[0].medicament_nom : ""}
          fabricantInitial={commande.fabricants?.nom ?? ""}
          codeScanne={codeScanne}
          medicaments={medicaments ?? []}
          etablissement_id={auth?.etablissement_id}
          onClose={() => { setShowScanModal(false); setCodeScanne(""); }}
          onSuccess={(lot, qty, nom) => {
            setShowScanModal(false);
            setCodeScanne("");
            success(`Lot ${lot} créé — ${qty} unités de ${nom} ajoutées à l'entrepôt`);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

const STATUTS_FILTRE = [
  { key: "",           label: "Tous" },
  { key: "envoyee",    label: "Envoyée" },
  { key: "confirmee",  label: "Confirmée" },
  { key: "en_transit", label: "En transit" },
  { key: "livree",     label: "Reçue" },
  { key: "annulee",    label: "Annulée" },
];

function CommandesFabricantTab({ etablissement_id, auth, medicaments, success, toastError }) {
  const [filtreStatut, setFiltreStatut] = useState("");
  const [search, setSearch] = useState("");
  const { data: commandes, loading, error, total, page, setPage, totalPages, refetch } =
    useCommandesFabricantPaginated(etablissement_id, 20, { statut: filtreStatut, search });

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 18, backgroundColor: colors.bgCard, padding: 14, borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <input placeholder="Rechercher par référence…" value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ padding: "7px 12px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 12, minWidth: 200 }} />
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {STATUTS_FILTRE.map((s) => (
            <button key={s.key} onClick={() => setFiltreStatut(s.key)}
              style={{ padding: "6px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "none", backgroundColor: filtreStatut === s.key ? ACCENT : "#F3F4F6", color: filtreStatut === s.key ? "white" : "#6B7280" }}>
              {s.label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", fontSize: 12, color: colors.textMuted }}>{loading ? "Chargement…" : `${total} commande${total !== 1 ? "s" : ""}`}</div>
      </div>

      {error && (
        <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "14px 18px", marginBottom: 20, fontSize: 13, color: "#DC2626" }}>Une erreur s'est produite. Veuillez réessayer.</div>
      )}
      {loading && <div style={{ textAlign: "center", padding: "40px 0", color: colors.textMuted, fontSize: 13 }}>Chargement…</div>}
      {!loading && commandes.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: colors.textMuted, fontSize: 14 }}>Aucune commande fabricant trouvée.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {commandes.map((c) => <CommandeFabricantCard key={c.id} commande={c} auth={auth} medicaments={medicaments} success={success} toastError={toastError} onChanged={refetch} />)}
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function Entrepot() {
  const { auth } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: medicamentsAll, loading, refetch } = useMedicaments(auth?.etablissement_id);
  const { toasts, success, error: toastError } = useToast();
  const [tab, setTab]                           = useState("stock"); // "stock" | "fabricants" | "commandes"
  const [showModal, setShowModal]               = useState(false);
  const [showCommande, setShowCommande]         = useState(false);
  const [recherche, setRecherche]               = useState("");
  const [showArchives, setShowArchives]         = useState(false);
  const [detailModal, setDetailModal]           = useState(null);
  const [editModal, setEditModal]               = useState(null);

  // Médicaments pré-remplis venant de l'écran Alertes ("Commander" sur une ou
  // plusieurs alertes de stock bas entrepôt) — ouvre directement le bon de
  // commande fabricant avec le panier déjà rempli. Consommé une seule fois :
  // l'état de navigation est vidé tout de suite pour qu'un rafraîchissement
  // de page ne le redéclenche pas.
  const [prefillLignes, setPrefillLignes] = useState(null);
  useEffect(() => {
    if (location.state?.prefillLignes) {
      setPrefillLignes(location.state.prefillLignes);
      setShowCommande(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const medicaments = medicamentsAll.filter((m) => m.actif !== false);
  const archivesCount = medicamentsAll.length - medicaments.length;
  const affiches = showArchives ? medicamentsAll : medicaments;

  // KPI toujours calculés sur le stock actif — un produit archivé ne doit
  // jamais compter comme "en rupture" ni peser sur la valeur du stock.
  const stockFaible = medicaments.filter((m) => m.stock_actuel < m.stock_minimum);
  const enRupture   = medicaments.filter((m) => m.stock_actuel === 0);

  const filtered = affiches.filter((m) =>
    m.nom.toLowerCase().includes(recherche.toLowerCase())
  );

  const valeurStock = medicaments.reduce((sum, m) => {
    return sum + (m.stock_actuel ?? 0) * (m.prix_achat ?? m.prix_unitaire ?? 0);
  }, 0);

  const handleSuccess = useCallback((lot, qty) => {
    setShowModal(false);
    refetch();
    success(`Lot ${lot} créé — ${qty} unités ajoutées au stock`);
  }, [refetch, success]);

  return (
    <Layout title="Entrepôt" subtitle="Gestion du stock entrepôt — Réception livraisons + génération lots MedOS certifiés">
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
      `}</style>
      <Toast toasts={toasts} />
      {showModal && (
        <ModalReception
          medicaments={medicaments}
          etablissement_id={auth?.etablissement_id}
          onClose={() => setShowModal(false)}
          onSuccess={handleSuccess}
        />
      )}
      {showCommande && (
        <ModalCommandeFabricant
          medicaments={medicaments}
          distributeurNom={auth?.structure ?? "MedDistrib International"}
          etablissement_id={auth?.etablissement_id ?? null}
          auth={auth}
          prefillLignes={prefillLignes}
          onClose={() => { setShowCommande(false); setPrefillLignes(null); }}
          onSuccess={({ emailStatut, emailErreur, reference, fabricantNom, nbLignes }) => {
            setShowCommande(false);
            setPrefillLignes(null);
            if (emailStatut === "envoye") {
              success(`Commande ${reference} envoyée à ${fabricantNom} — ${nbLignes} médicament${nbLignes > 1 ? "s" : ""}.`);
            } else {
              toastError(`Commande ${reference} enregistrée chez ${fabricantNom}, mais l'email n'a pas pu être envoyé : ${emailErreur}`);
            }
          }}
        />
      )}
      {detailModal && (
        <ModalDetailMedicament
          medicament={detailModal}
          onClose={() => setDetailModal(null)}
          onEdit={(m) => { setDetailModal(null); setEditModal(m); }}
          onChanged={(msg) => { refetch(); success(msg); }}
        />
      )}
      {editModal && (
        <ModalEditMedicament
          medicament={editModal}
          onClose={() => setEditModal(null)}
          onSaved={() => { refetch(); success(`${editModal.nom} mis à jour.`); }}
        />
      )}

      {/* ── Onglets ── */}
      <div style={{ display: "flex", gap: 2, backgroundColor: colors.bgCard, borderRadius: 10, padding: 3, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 20, width: "fit-content" }}>
        {[
          { key: "stock", label: "Stock" },
          { key: "fabricants", label: "Fabricants" },
          { key: "commandes", label: "Commandes" },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: "8px 18px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", backgroundColor: tab === t.key ? ACCENT : "transparent", color: tab === t.key ? "white" : "#6B7280" }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "fabricants" && <FabricantsTab etablissement_id={auth?.etablissement_id} success={success} toastError={toastError} />}
      {tab === "commandes" && <CommandesFabricantTab etablissement_id={auth?.etablissement_id} auth={auth} medicaments={medicamentsAll} success={success} toastError={toastError} />}

      {tab === "stock" && (
      <>
      {/* ── KPIs stock ── */}
      <div className="kpi-row" style={{ marginBottom: 20 }}>
        {[
          { label: "Total références",  value: loading ? "…" : medicaments.length,    color: "#F59E0B" },
          { label: "En rupture",        value: loading ? "…" : enRupture.length,      color: enRupture.length > 0 ? "#EF4444" : "#6B7280" },
          { label: "Sous seuil min.",   value: loading ? "…" : stockFaible.length,    color: stockFaible.length > 0 ? "#F59E0B" : "#6B7280" },
          { label: "Valeur du stock",   value: loading ? "…" : `${valeurStock.toLocaleString("fr-FR")} FCFA`, color: "#10B981" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: colors.bgCard, borderRadius: 12, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderLeft: `4px solid ${k.color}`, flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── Alertes stock faible ── */}
      {stockFaible.length > 0 && (
        <div style={{ backgroundColor: "#FEF2F2", borderRadius: 12, padding: "14px 18px", marginBottom: 20, border: "1px solid #FCA5A5", animation: "fadeIn 0.2s ease" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#DC2626", marginBottom: 8 }}>
            Stock faible — {stockFaible.length} produit{stockFaible.length > 1 ? "s" : ""} sous le seuil minimum
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {stockFaible.map((m) => (
              <div key={m.id} style={{ fontSize: 12, padding: "4px 10px", backgroundColor: colors.bgCard, borderRadius: 6, border: "1px solid #FCA5A5", color: "#991B1B", fontWeight: 600 }}>
                {m.nom} — {m.stock_actuel} / {m.stock_minimum} min
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Barre d'actions ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12 }}>
        <input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher un médicament…"
          style={{ flex: 1, maxWidth: 320, padding: "9px 14px", border: "1.5px solid var(--border)", borderRadius: 10, fontSize: 13, outline: "none", color: colors.navy }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: colors.textSecondary }}>
            {loading ? "Chargement…" : `${filtered.length} produit${filtered.length !== 1 ? "s" : ""}`}
          </span>
          {archivesCount > 0 && (
            <button
              onClick={() => setShowArchives((v) => !v)}
              style={{ padding: "8px 14px", backgroundColor: showArchives ? "#F3F4F6" : colors.bgCard, color: colors.textSecondary, border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              {showArchives ? "Masquer les archivés" : `Voir les archivés (${archivesCount})`}
            </button>
          )}
          <button
            onClick={() => setShowCommande(true)}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", backgroundColor: colors.bgCard, color: ACCENT, border: `1.5px solid ${ACCENT}`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-1.5 7h13M10 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm7 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
            </svg>
            Nouvelle commande fabricant
          </button>
          <button
            onClick={() => setShowModal(true)}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", backgroundColor: ACCENT, color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Réceptionner livraison
          </button>
        </div>
      </div>

      {/* ── Tableau stock ── */}
      <div style={{ backgroundColor: colors.bgCard, borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        {/* En-tête */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1.5fr 1fr", gap: 0, padding: "12px 20px", backgroundColor: colors.bgSurface, borderBottom: "1px solid var(--border)" }}>
          {["Médicament", "Stock actuel", "Seuil min.", "Prix grossiste", "Niveau de stock", "Statut"].map((h) => (
            <div key={h} style={{ fontSize: 11, fontWeight: 700, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</div>
          ))}
        </div>

        {/* Skeleton */}
        {loading && [1,2,3,4,5].map((i) => (
          <div key={i} style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-light)", display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1.5fr 1fr", gap: 0, alignItems: "center" }}>
            {[1,2,3,4,5,6].map((j) => (
              <div key={j} style={{ height: 14, backgroundColor: colors.borderLight, borderRadius: 4, animation: "pulse 1.5s ease-in-out infinite", marginRight: 16 }} />
            ))}
          </div>
        ))}

        {/* Lignes */}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: "40px 20px", textAlign: "center", color: colors.textMuted, fontSize: 13 }}>
            {recherche ? "Aucun médicament trouvé" : "Aucun médicament enregistré dans la base"}
          </div>
        )}
        {!loading && filtered.map((m, i) => {
          const faible = m.stock_actuel < m.stock_minimum;
          const vide = m.stock_actuel === 0;
          const pctVal = pct(m.stock_actuel, m.stock_minimum);
          const couleur = stockColor(m.stock_actuel, m.stock_minimum);

          return (
            <div key={m.id} onClick={() => setDetailModal(m)} style={{
              display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1.5fr 1fr",
              gap: 0, padding: "14px 20px",
              borderBottom: i < filtered.length - 1 ? "1px solid var(--border-light)" : "none",
              alignItems: "center", cursor: "pointer",
              backgroundColor: m.actif === false ? "#F9FAFB" : vide ? "#FFF5F5" : faible ? "#FFFBEB" : "white",
              opacity: m.actif === false ? 0.65 : 1,
              animation: "fadeIn 0.2s ease",
            }}>
              {/* Médicament */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy, display: "flex", alignItems: "center", gap: 6 }}>
                  {m.nom}
                  {m.actif === false && (
                    <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 5, backgroundColor: "#E5E7EB", color: "#6B7280", fontWeight: 700 }}>Archivé</span>
                  )}
                </div>
                {m.code && <div style={{ fontSize: 11, color: colors.textMuted, fontFamily: "monospace" }}>{m.code}</div>}
              </div>

              {/* Stock actuel */}
              <div style={{ fontSize: 13, fontWeight: 700, color: couleur }}>
                {m.stock_actuel ?? "—"}
                <span style={{ fontSize: 10, color: colors.textMuted, fontWeight: 400, marginLeft: 3 }}>unités</span>
              </div>

              {/* Seuil minimum */}
              <div style={{ fontSize: 13, color: colors.textSecondary }}>
                {m.stock_minimum ?? "—"}
                <span style={{ fontSize: 10, color: colors.textMuted, marginLeft: 3 }}>min</span>
              </div>

              {/* Prix grossiste */}
              <div style={{ fontSize: 13, color: colors.navy }}>
                {m.prix_achat ? `${m.prix_achat.toLocaleString("fr-FR")} FCFA` : "—"}
              </div>

              {/* Barre de niveau */}
              <div>
                <div style={{ height: 6, backgroundColor: colors.borderLight, borderRadius: 3, overflow: "hidden", marginBottom: 3 }}>
                  <div style={{ height: "100%", width: `${pctVal}%`, backgroundColor: couleur, borderRadius: 3, transition: "width 0.4s ease" }} />
                </div>
                <div style={{ fontSize: 10, color: colors.textMuted }}>{pctVal}% du seuil ×2</div>
              </div>

              {/* Statut badge */}
              <div>
                {vide ? (
                  <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, backgroundColor: "#FEE2E2", color: "#DC2626", fontWeight: 700 }}>Rupture</span>
                ) : faible ? (
                  <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, backgroundColor: "#FEF3C7", color: "#D97706", fontWeight: 700 }}>Stock faible</span>
                ) : (
                  <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, backgroundColor: "#DCFCE7", color: "#16A34A", fontWeight: 700 }}>Normal</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Légende lot MedOS ── */}
      <div style={{ marginTop: 16, padding: "14px 18px", backgroundColor: BG_ACCENT, borderRadius: 10, border: "1px solid #FDE68A", fontSize: 12, color: "#92400E" }}>
        <strong>Comment fonctionne la génération de lots ?</strong> — Chaque réception génère un numéro de lot au format{" "}
        <span style={{ fontFamily: "monospace", fontWeight: 700 }}>MEDOS-AAAA-DIST-XXXXX</span> qui est automatiquement enregistré dans la base MedOS.
        Ce lot sera reconnu comme <strong>certifié</strong> lors d'un scan dans le module Traçabilité, par n'importe quel pharmacien ou hôpital.
      </div>
      </>
      )}
    </Layout>
  );
}
