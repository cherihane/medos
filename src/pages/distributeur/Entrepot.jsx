/**
 * Entrepôt — Distributeur
 *
 * - Liste de tous les médicaments avec stock, seuil, prix grossiste
 * - Alertes stock faible
 * - Modal "Réceptionner livraison" : génère un numéro de lot MedOS unique,
 *   l'insère dans la table `lots` (authentifié) et incrémente le stock
 */
import { colors } from "../../theme";
import { useState, useCallback } from "react";
import Layout from "../../components/Layout";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useMedicaments } from "../../hooks/useSupabaseData";
import { insertLot, incrementStock, insertCommande, insertMedicament } from "../../hooks/useMutations";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../supabaseClient";
import { openDocument, tableHTML, infoGridHTML, fetchEtabFromAuth } from "../../utils/MedOSDocument";

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

// lignes = [{ medicamentNom, quantite }]
async function sendCommandeEmail({ emailFabricant, fabricant, lignes, dateLivraison, notes, distributeur }) {
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

  await supabase.functions.invoke("send-app-email", {
    body: {
      to:      emailFabricant,
      subject: `Bon de commande MedOS — ${lignes.length} médicament${lignes.length > 1 ? "s" : ""} (${totalQty.toLocaleString("fr-FR")} unités)`,
      html,
    },
  });
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
const LIGNE_VIDE = () => ({ id: Date.now() + Math.random(), medicament_id: "", quantite: "" });

function ModalCommandeFabricant({ medicaments, distributeurNom, etablissement_id, auth, onClose, onSuccess }) {
  const [header, setHeader] = useState({ email_fabricant: "", fabricant: "", date_livraison: "", notes: "" });
  const [lignes, setLignes] = useState([LIGNE_VIDE()]);
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState(null);

  const setH = (k, v) => setHeader((h) => ({ ...h, [k]: v }));

  const setLigne = (id, k, v) =>
    setLignes((ls) => ls.map((l) => l.id === id ? { ...l, [k]: v } : l));
  const addLigne  = () => setLignes((ls) => [...ls, LIGNE_VIDE()]);
  const delLigne  = (id) => setLignes((ls) => ls.filter((l) => l.id !== id));

  const totalRefs = lignes.filter((l) => l.medicament_id).length;
  const totalQty  = lignes.reduce((s, l) => s + (parseInt(l.quantite, 10) || 0), 0);

  const handleSubmit = async () => {
    setErr(null);
    if (!header.email_fabricant.trim() || !header.email_fabricant.includes("@")) {
      setErr("Email du fabricant invalide."); return;
    }
    const lignesValides = lignes.filter((l) => l.medicament_id && parseInt(l.quantite, 10) > 0);
    if (lignesValides.length === 0) {
      setErr("Ajoutez au moins un médicament avec une quantité valide."); return;
    }

    setSaving(true);
    try {
      const lignesPayload = lignesValides.map((l) => {
        const med = medicaments.find((m) => m.id === l.medicament_id);
        return { medicament_id: l.medicament_id, medicamentNom: med?.nom ?? "", quantite: parseInt(l.quantite, 10) };
      });

      const notesJSON = JSON.stringify({
        fabricant:      header.fabricant.trim() || null,
        email_fabricant: header.email_fabricant.trim(),
        livraison:      header.date_livraison || null,
        instructions:   header.notes.trim() || null,
        lignes:         lignesPayload.map(({ medicamentNom, quantite }) => ({ medicamentNom, quantite })),
      });

      await insertCommande({
        statut:                "envoyee",
        date_commande:         new Date().toISOString(),
        date_livraison_prevue: header.date_livraison || null,
        montant_total:         0,
        notes:                 notesJSON,
        ...(etablissement_id ? { etablissement_id } : {}),
      });

      await sendCommandeEmail({
        emailFabricant: header.email_fabricant.trim(),
        fabricant:      header.fabricant.trim(),
        lignes:         lignesPayload,
        dateLivraison:  header.date_livraison,
        notes:          header.notes.trim(),
        distributeur:   distributeurNom,
      });

      onSuccess(`Bon de commande envoyé à ${header.email_fabricant.trim()} — ${lignesPayload.length} médicament${lignesPayload.length > 1 ? "s" : ""}.`);
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

          {/* Champs en-tête */}
          <div className="form-row-2" style={{ marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Email du fabricant <span style={{ color: "#EF4444" }}>*</span></label>
              <input type="email" value={header.email_fabricant} onChange={(e) => setH("email_fabricant", e.target.value)}
                placeholder="commandes@fabricant.com" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Nom du fabricant</label>
              <input value={header.fabricant} onChange={(e) => setH("fabricant", e.target.value)}
                placeholder="Ex : Sanofi, Pfizer…" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Date de livraison souhaitée</label>
              <input type="date" value={header.date_livraison} onChange={(e) => setH("date_livraison", e.target.value)}
                style={inputStyle} />
            </div>
            <div>
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
            {lignes.map((l, i) => (
              <div key={l.id} style={{ display: "grid", gridTemplateColumns: "1fr 130px 36px", gap: 8, padding: "8px 12px", borderBottom: i < lignes.length - 1 ? "1px solid var(--border-light)" : "none", alignItems: "center", backgroundColor: i % 2 === 0 ? "white" : "#FAFAFA" }}>
                <select
                  value={l.medicament_id}
                  onChange={(e) => setLigne(l.id, "medicament_id", e.target.value)}
                  style={{ ...inputStyle, fontSize: 12, padding: "7px 10px", backgroundColor: colors.bgCard }}
                >
                  <option value="">— Médicament —</option>
                  {medicaments.map((m) => (
                    <option key={m.id} value={m.id}>{m.nom}{m.dosage ? ` ${m.dosage}` : ""}</option>
                  ))}
                </select>
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
            ))}
          </div>

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
                const lignesValides = lignes.filter((l) => l.medicament_id && parseInt(l.quantite, 10) > 0);
                if (lignesValides.length === 0) return;
                const lignesPrint = lignesValides.map((l) => {
                  const med = medicaments.find((m) => m.id === l.medicament_id);
                  return { medicamentNom: med?.nom ?? "—", quantite: parseInt(l.quantite, 10) };
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

// ── Page principale ───────────────────────────────────────────────────────────
export default function Entrepot() {
  const { auth } = useAuth();
  const { data: medicaments, loading, refetch } = useMedicaments(auth?.etablissement_id);
  const { toasts, success, error: toastError } = useToast();
  const [showModal, setShowModal]               = useState(false);
  const [showCommande, setShowCommande]         = useState(false);
  const [recherche, setRecherche]               = useState("");

  const stockFaible = medicaments.filter((m) => m.stock_actuel < m.stock_minimum);
  const enRupture   = medicaments.filter((m) => m.stock_actuel === 0);

  const filtered = medicaments.filter((m) =>
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
          onClose={() => setShowCommande(false)}
          onSuccess={(msg) => { setShowCommande(false); success(msg); }}
        />
      )}

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
            <div key={m.id} style={{
              display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1.5fr 1fr",
              gap: 0, padding: "14px 20px",
              borderBottom: i < filtered.length - 1 ? "1px solid var(--border-light)" : "none",
              alignItems: "center",
              backgroundColor: vide ? "#FFF5F5" : faible ? "#FFFBEB" : "white",
              animation: "fadeIn 0.2s ease",
            }}>
              {/* Médicament */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>{m.nom}</div>
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
    </Layout>
  );
}
