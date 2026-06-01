/**
 * Entrepôt — Distributeur
 *
 * - Liste de tous les médicaments avec stock, seuil, prix grossiste
 * - Alertes stock faible
 * - Modal "Réceptionner livraison" : génère un numéro de lot MedOS unique,
 *   l'insère dans la table `lots` (authentifié) et incrémente le stock
 */
import { useState, useCallback } from "react";
import Layout from "../../components/Layout";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useMedicaments } from "../../hooks/useSupabaseData";
import { insertLot, incrementStock, insertCommande } from "../../hooks/useMutations";
import { useAuth } from "../../context/AuthContext";

// ── Resend ────────────────────────────────────────────────────────────────────
const RESEND_KEY = "re_iUaDVQFG_LAX2mHCRxm6rf216167mGdJY";

async function sendCommandeEmail({ emailFabricant, medicamentNom, fabricant, quantite, dateLivraison, notes, distributeur }) {
  const dateStr = dateLivraison
    ? new Date(dateLivraison).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
    : "Non précisée";
  const now = new Date().toLocaleString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const html = `
<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
  <div style="background:#F59E0B;padding:28px 32px">
    <h1 style="color:white;margin:0;font-size:20px;font-weight:700">Commande de médicaments</h1>
    <p style="color:rgba(255,255,255,0.88);margin:6px 0 0;font-size:13px">MedOS — Plateforme de distribution médicale</p>
  </div>
  <div style="padding:28px 32px">
    <p style="font-size:14px;color:#374151;margin:0 0 20px">Bonjour,</p>
    <p style="font-size:14px;color:#374151;margin:0 0 20px">
      Le distributeur <strong>${distributeur}</strong> vous adresse une commande via la plateforme MedOS.
      Veuillez en prendre note et confirmer la disponibilité dans les meilleurs délais.
    </p>
    <div style="background:#F8FAFC;border-radius:10px;padding:20px;margin-bottom:20px">
      <h2 style="font-size:14px;font-weight:700;color:#0A1628;margin:0 0 14px">Détails de la commande</h2>
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:9px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;width:46%">Médicament</td>
          <td style="padding:9px 0;border-bottom:1px solid #e5e7eb;font-weight:700;font-size:13px;color:#0A1628">${medicamentNom}</td>
        </tr>
        ${fabricant ? `<tr>
          <td style="padding:9px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px">Fabricant</td>
          <td style="padding:9px 0;border-bottom:1px solid #e5e7eb;font-weight:700;font-size:13px;color:#0A1628">${fabricant}</td>
        </tr>` : ""}
        <tr>
          <td style="padding:9px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px">Quantité commandée</td>
          <td style="padding:9px 0;border-bottom:1px solid #e5e7eb;font-weight:700;font-size:13px;color:#0A1628">${quantite} unités</td>
        </tr>
        <tr>
          <td style="padding:9px 0;border-bottom:${notes ? "1px solid #e5e7eb" : "none"};color:#6b7280;font-size:13px">Date de livraison souhaitée</td>
          <td style="padding:9px 0;border-bottom:${notes ? "1px solid #e5e7eb" : "none"};font-weight:700;font-size:13px;color:#0A1628">${dateStr}</td>
        </tr>
        ${notes ? `<tr>
          <td style="padding:9px 0;color:#6b7280;font-size:13px">Instructions particulières</td>
          <td style="padding:9px 0;font-size:13px;color:#374151">${notes}</td>
        </tr>` : ""}
      </table>
    </div>
    <div style="background:#FFFBEB;border-left:4px solid #F59E0B;border-radius:6px;padding:12px 16px;margin-bottom:24px">
      <p style="font-size:12px;color:#92400E;margin:0">
        Merci de répondre directement à cet email ou de contacter le distributeur pour confirmer la disponibilité et le délai de livraison.
      </p>
    </div>
    <p style="font-size:13px;color:#6b7280;margin:0">Commande émise le ${now}</p>
  </div>
  <div style="background:#F8FAFC;padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center">
    <p style="font-size:12px;color:#9CA3AF;margin:0">MedOS — ${distributeur}</p>
  </div>
</div>`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from:    "MedOS Distribution <onboarding@resend.dev>",
      to:      [emailFabricant],
      subject: `Commande MedOS — ${medicamentNom} (${quantite} unités)`,
      html,
    }),
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
  width: "100%", padding: "9px 12px", border: "1.5px solid #E5E7EB",
  borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", color: "#0A1628",
};
const labelStyle = { fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 };

function ModalReception({ medicaments, onClose, onSuccess }) {
  const [form, setForm] = useState({
    medicament_id: "",
    fabricant: "",
    quantite: "",
    date_fabrication: "",
    date_expiration: "",
    prix_unitaire: "",
  });
  const [lotGenere, setLotGenere] = useState(genererNumeroLot());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = useCallback(async () => {
    if (!form.medicament_id || !form.fabricant || !form.quantite || !form.date_expiration) {
      setErr("Remplissez les champs obligatoires.");
      return;
    }
    const qty = parseInt(form.quantite, 10);
    if (isNaN(qty) || qty <= 0) { setErr("Quantité invalide."); return; }

    setSaving(true);
    setErr(null);
    try {
      // 1. Insérer le lot dans Supabase → alimentera le scanner
      await insertLot({
        numero_lot: lotGenere,
        medicament_id: form.medicament_id,
        fabricant: form.fabricant,
        quantite_initiale: qty,
        date_fabrication: form.date_fabrication || null,
        date_expiration: form.date_expiration,
        qr_code: JSON.stringify({ lot: lotGenere, medicament_id: form.medicament_id }),
      });
      // 2. Incrémenter le stock du médicament
      await incrementStock(form.medicament_id, qty);
      onSuccess(lotGenere, qty);
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  }, [form, lotGenere, onSuccess]);

  return (
    <div style={{
      position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)",
      zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{ backgroundColor: "white", borderRadius: 16, padding: 28, width: "100%", maxWidth: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0A1628" }}>Réceptionner une livraison</h3>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6B7280" }}>Un lot MedOS certifié sera généré automatiquement</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF", lineHeight: 1 }}>×</button>
        </div>

        {/* Numéro de lot généré */}
        <div style={{ backgroundColor: "#FFFBEB", borderRadius: 10, padding: "12px 16px", marginBottom: 20, border: "1px solid #FDE68A", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 11, color: "#92400E", fontWeight: 600, marginBottom: 2 }}>Numéro de lot MedOS généré</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#B45309", fontFamily: "monospace" }}>{lotGenere}</div>
          </div>
          <button
            onClick={() => setLotGenere(genererNumeroLot())}
            style={{ fontSize: 11, padding: "5px 10px", backgroundColor: "white", border: "1px solid #FCD34D", borderRadius: 6, cursor: "pointer", color: "#B45309", fontWeight: 600 }}
          >
            Regénérer
          </button>
        </div>

        {/* Formulaire */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Médicament <span style={{ color: "#EF4444" }}>*</span></label>
            <select value={form.medicament_id} onChange={(e) => set("medicament_id", e.target.value)}
              style={{ ...inputStyle, backgroundColor: "white" }}>
              <option value="">— Sélectionner —</option>
              {medicaments.map((m) => (
                <option key={m.id} value={m.id}>{m.nom}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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

          <div>
            <label style={labelStyle}>Prix unitaire grossiste (FCFA)</label>
            <input type="number" min="0" value={form.prix_unitaire} onChange={(e) => set("prix_unitaire", e.target.value)}
              placeholder="Ex: 2500" style={inputStyle} />
          </div>
        </div>

        {err && (
          <div style={{ marginTop: 14, padding: "8px 12px", backgroundColor: "#FEF2F2", borderRadius: 8, fontSize: 12, color: "#DC2626" }}>
            {err}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px", backgroundColor: "#F8FAFC", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
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

// ── Modal Nouvelle commande fabricant ─────────────────────────────────────────
function ModalCommandeFabricant({ medicaments, distributeurNom, etablissement_id, onClose, onSuccess }) {
  const [form, setForm] = useState({
    medicament_id:  "",
    email_fabricant: "",
    fabricant:      "",
    quantite:       "",
    date_livraison: "",
    notes:          "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const medicamentNom = medicaments.find((m) => m.id === form.medicament_id)?.nom ?? "";

  const handleSubmit = async () => {
    setErr(null);
    if (!form.medicament_id)                              { setErr("Sélectionnez un médicament."); return; }
    if (!form.email_fabricant.trim() || !form.email_fabricant.includes("@")) { setErr("Email du fabricant invalide."); return; }
    const qty = parseInt(form.quantite, 10);
    if (!qty || qty <= 0)                                 { setErr("Quantité invalide."); return; }

    setSaving(true);
    try {
      const notesFinales = [
        `Médicament : ${medicamentNom}`,
        form.fabricant.trim() ? `Fabricant : ${form.fabricant.trim()}` : null,
        `Email fabricant : ${form.email_fabricant.trim()}`,
        `Quantité commandée : ${qty} unités`,
        `Livraison souhaitée : ${form.date_livraison || "Non précisée"}`,
        form.notes.trim() ? `Instructions : ${form.notes.trim()}` : null,
      ].filter(Boolean).join(" | ");

      await insertCommande({
        statut:                "envoyee",
        date_commande:         new Date().toISOString(),
        date_livraison_prevue: form.date_livraison || null,
        montant_total:         0,
        notes:                 notesFinales,
        ...(etablissement_id ? { etablissement_id } : {}),
      });

      await sendCommandeEmail({
        emailFabricant: form.email_fabricant.trim(),
        medicamentNom,
        fabricant:      form.fabricant.trim(),
        quantite:       qty,
        dateLivraison:  form.date_livraison,
        notes:          form.notes.trim(),
        distributeur:   distributeurNom,
      });

      onSuccess(`Commande envoyée à ${form.email_fabricant.trim()} pour ${medicamentNom}.`);
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ backgroundColor: "white", borderRadius: 16, padding: 28, width: "100%", maxWidth: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0A1628" }}>Nouvelle commande fabricant</h3>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6B7280" }}>Un email de commande sera envoyé automatiquement au fabricant</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF", lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Médicament */}
          <div>
            <label style={labelStyle}>Médicament <span style={{ color: "#EF4444" }}>*</span></label>
            <select value={form.medicament_id} onChange={(e) => set("medicament_id", e.target.value)}
              style={{ ...inputStyle, backgroundColor: "white" }}>
              <option value="">— Sélectionner un médicament —</option>
              {medicaments.map((m) => (
                <option key={m.id} value={m.id}>{m.nom}{m.dosage ? ` ${m.dosage}` : ""}{m.forme ? ` — ${m.forme}` : ""}</option>
              ))}
            </select>
          </div>

          {/* Fabricant (optionnel) + Email (obligatoire) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Nom du fabricant</label>
              <input value={form.fabricant} onChange={(e) => set("fabricant", e.target.value)}
                placeholder="Ex: Sanofi, Pfizer…" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Email du fabricant <span style={{ color: "#EF4444" }}>*</span></label>
              <input type="email" value={form.email_fabricant} onChange={(e) => set("email_fabricant", e.target.value)}
                placeholder="commandes@fabricant.com" style={inputStyle} />
            </div>
          </div>

          {/* Quantité + Date */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Quantité souhaitée <span style={{ color: "#EF4444" }}>*</span></label>
              <input type="number" min="1" value={form.quantite} onChange={(e) => set("quantite", e.target.value)}
                placeholder="Ex: 1000" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Date de livraison souhaitée</label>
              <input type="date" value={form.date_livraison} onChange={(e) => set("date_livraison", e.target.value)}
                style={inputStyle} />
            </div>
          </div>

          {/* Instructions */}
          <div>
            <label style={labelStyle}>Instructions particulières</label>
            <input value={form.notes} onChange={(e) => set("notes", e.target.value)}
              placeholder="Conditionnement, urgence, température de transport…" style={inputStyle} />
          </div>
        </div>

        {err && (
          <div style={{ marginTop: 14, padding: "8px 12px", backgroundColor: "#FEF2F2", borderRadius: 8, fontSize: 12, color: "#DC2626" }}>
            {err}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px", backgroundColor: "#F8FAFC", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
            Annuler
          </button>
          <button onClick={handleSubmit} disabled={saving}
            style={{ flex: 2, padding: "11px", backgroundColor: saving ? "#E5E7EB" : ACCENT, color: saving ? "#9CA3AF" : "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {saving ? (
              <><div style={{ width: 14, height: 14, border: "2px solid #9CA3AF", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />Envoi en cours…</>
            ) : "Envoyer la commande"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function Entrepot() {
  const { auth } = useAuth();
  const { data: medicaments, loading, refetch } = useMedicaments();
  const { toasts, success, error: toastError } = useToast();
  const [showModal, setShowModal]               = useState(false);
  const [showCommande, setShowCommande]         = useState(false);
  const [recherche, setRecherche]               = useState("");

  const stockFaible = medicaments.filter((m) => m.stock_actuel < m.stock_minimum);

  const filtered = medicaments.filter((m) =>
    m.nom.toLowerCase().includes(recherche.toLowerCase())
  );

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
          onClose={() => setShowModal(false)}
          onSuccess={handleSuccess}
        />
      )}
      {showCommande && (
        <ModalCommandeFabricant
          medicaments={medicaments}
          distributeurNom={auth?.structure ?? "MedDistrib International"}
          etablissement_id={auth?.etablissement_id ?? null}
          onClose={() => setShowCommande(false)}
          onSuccess={(msg) => { setShowCommande(false); success(msg); }}
        />
      )}

      {/* ── Alertes stock faible ── */}
      {stockFaible.length > 0 && (
        <div style={{ backgroundColor: "#FEF2F2", borderRadius: 12, padding: "14px 18px", marginBottom: 20, border: "1px solid #FCA5A5", animation: "fadeIn 0.2s ease" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#DC2626", marginBottom: 8 }}>
            Stock faible — {stockFaible.length} produit{stockFaible.length > 1 ? "s" : ""} sous le seuil minimum
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {stockFaible.map((m) => (
              <div key={m.id} style={{ fontSize: 12, padding: "4px 10px", backgroundColor: "white", borderRadius: 6, border: "1px solid #FCA5A5", color: "#991B1B", fontWeight: 600 }}>
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
          style={{ flex: 1, maxWidth: 320, padding: "9px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 13, outline: "none", color: "#0A1628" }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "#6B7280" }}>
            {loading ? "Chargement…" : `${filtered.length} produit${filtered.length !== 1 ? "s" : ""}`}
          </span>
          <button
            onClick={() => setShowCommande(true)}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", backgroundColor: "white", color: ACCENT, border: `1.5px solid ${ACCENT}`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
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
      <div style={{ backgroundColor: "white", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        {/* En-tête */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1.5fr 1fr", gap: 0, padding: "12px 20px", backgroundColor: "#F8FAFC", borderBottom: "1px solid #E5E7EB" }}>
          {["Médicament", "Stock actuel", "Seuil min.", "Prix grossiste", "Niveau de stock", "Statut"].map((h) => (
            <div key={h} style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</div>
          ))}
        </div>

        {/* Skeleton */}
        {loading && [1,2,3,4,5].map((i) => (
          <div key={i} style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1.5fr 1fr", gap: 0, alignItems: "center" }}>
            {[1,2,3,4,5,6].map((j) => (
              <div key={j} style={{ height: 14, backgroundColor: "#F3F4F6", borderRadius: 4, animation: "pulse 1.5s ease-in-out infinite", marginRight: 16 }} />
            ))}
          </div>
        ))}

        {/* Lignes */}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
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
              borderBottom: i < filtered.length - 1 ? "1px solid #F3F4F6" : "none",
              alignItems: "center",
              backgroundColor: vide ? "#FFF5F5" : faible ? "#FFFBEB" : "white",
              animation: "fadeIn 0.2s ease",
            }}>
              {/* Médicament */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0A1628" }}>{m.nom}</div>
                {m.code && <div style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "monospace" }}>{m.code}</div>}
              </div>

              {/* Stock actuel */}
              <div style={{ fontSize: 13, fontWeight: 700, color: couleur }}>
                {m.stock_actuel ?? "—"}
                <span style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 400, marginLeft: 3 }}>unités</span>
              </div>

              {/* Seuil minimum */}
              <div style={{ fontSize: 13, color: "#6B7280" }}>
                {m.stock_minimum ?? "—"}
                <span style={{ fontSize: 10, color: "#9CA3AF", marginLeft: 3 }}>min</span>
              </div>

              {/* Prix grossiste */}
              <div style={{ fontSize: 13, color: "#0A1628" }}>
                {m.prix_achat ? `${m.prix_achat.toLocaleString("fr-FR")} FCFA` : "—"}
              </div>

              {/* Barre de niveau */}
              <div>
                <div style={{ height: 6, backgroundColor: "#F3F4F6", borderRadius: 3, overflow: "hidden", marginBottom: 3 }}>
                  <div style={{ height: "100%", width: `${pctVal}%`, backgroundColor: couleur, borderRadius: 3, transition: "width 0.4s ease" }} />
                </div>
                <div style={{ fontSize: 10, color: "#9CA3AF" }}>{pctVal}% du seuil ×2</div>
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
