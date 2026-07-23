/**
 * AjouterClientModal — ajout d'un client au réseau d'un distributeur.
 * Deux modes : rattacher un établissement déjà inscrit sur MedOS (recherche
 * par email exact, jamais un annuaire parcourable) ou enregistrer un client
 * purement manuel (beaucoup de clients réels n'ont pas d'outils informatiques
 * — nom, coordonnées, sans compte MedOS associé).
 */
import { colors } from "../theme";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { insertDistributeurClient, rechercherClientParEmail } from "../hooks/useMutations";

const inputStyle = {
  width: "100%", padding: "9px 13px", border: "1.5px solid var(--border)",
  borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box",
  color: colors.navy, backgroundColor: colors.bgCard,
};

const EMPTY_MANUEL = { nom: "", adresse: "", ville: "", contact: "", telephone: "", email: "" };

export default function AjouterClientModal({ onClose, onSaved }) {
  const { auth } = useAuth();
  const [mode, setMode] = useState("medos"); // "medos" | "manuel"

  // ── mode MedOS (recherche par email) ──────────────────────────────────────
  const [email, setEmail] = useState("");
  const [found, setFound] = useState(null);
  const [searching, setSearching] = useState(false);

  // ── mode manuel ────────────────────────────────────────────────────────────
  const [manuel, setManuel] = useState(EMPTY_MANUEL);
  const setManuelField = (k) => (e) => setManuel((f) => ({ ...f, [k]: e.target.value }));

  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState(null);

  const handleSearch = async () => {
    if (!email.trim()) { setErreur("Saisissez l'email de l'établissement."); return; }
    setErreur(null);
    setFound(null);
    setSearching(true);
    try {
      const res = await rechercherClientParEmail(email.trim());
      if (!res) setErreur("Aucun établissement pharmacie/hôpital actif trouvé avec cet email.");
      else setFound(res);
    } catch (e) {
      setErreur("Erreur : " + e.message);
    } finally {
      setSearching(false);
    }
  };

  const handleAddMedOS = async () => {
    if (!found) return;
    setSaving(true);
    setErreur(null);
    try {
      await insertDistributeurClient({
        distributeur_id: auth?.etablissement_id,
        client_etablissement_id: found.id,
      });
      onSaved(`${found.nom} ajouté à votre réseau clients.`);
      onClose();
    } catch (e) {
      setErreur("Erreur : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddManuel = async () => {
    if (!manuel.nom.trim()) { setErreur("Le nom du client est obligatoire."); return; }
    setSaving(true);
    setErreur(null);
    try {
      await insertDistributeurClient({
        distributeur_id: auth?.etablissement_id,
        nom_manuel:       manuel.nom.trim(),
        adresse_manuel:   manuel.adresse.trim() || null,
        ville_manuel:     manuel.ville.trim() || null,
        contact_manuel:   manuel.contact.trim() || null,
        telephone_manuel: manuel.telephone.trim() || null,
        email_manuel:     manuel.email.trim() || null,
      });
      onSaved(`${manuel.nom.trim()} ajouté à votre réseau clients.`);
      onClose();
    } catch (e) {
      setErreur("Erreur : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ backgroundColor: colors.bgCard, borderRadius: 16, width: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ padding: "20px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: colors.navy }}>Ajouter un client</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted }}>×</button>
        </div>

        <div style={{ padding: "16px 24px 0" }}>
          {/* Choix explicite MedOS/manuel — bordure + couleur de marque sur l'onglet
              actif pour rester lisible en clair ET en sombre (l'ancien style, blanc
              sur fond gris très clair, était quasiment invisible en mode clair —
              signalé comme "je ne vois que le mode MedOS", corrigé ici). */}
          <div style={{ display: "flex", gap: 6, marginBottom: 4, border: "1.5px solid var(--border)", borderRadius: 8, padding: 4 }}>
            {[{ key: "medos", label: "Client MedOS" }, { key: "manuel", label: "Client manuel" }].map((t) => (
              <button key={t.key} type="button" onClick={() => { setMode(t.key); setErreur(null); }} style={{
                flex: 1, padding: "8px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer",
                border: mode === t.key ? "1.5px solid #F59E0B" : "1.5px solid transparent",
                backgroundColor: mode === t.key ? "#FFFBEB" : "transparent",
                color: mode === t.key ? "#D97706" : colors.textSecondary,
              }}>
                {t.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: colors.textMuted, margin: "6px 2px 12px" }}>
            {mode === "medos" ? "Rattacher un établissement déjà inscrit sur MedOS." : "Enregistrer un client sans compte MedOS."}
          </div>
        </div>

        <div style={{ padding: "0 24px 16px" }}>
          {mode === "medos" ? (
            <>
              <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 14 }}>
                Rattachez un établissement déjà inscrit sur MedOS (pharmacie, hôpital) en saisissant
                son email exact — un client devient automatiquement visible ici dès sa première
                commande passée chez vous, cette recherche ne sert qu'à l'ajouter avant coup.
              </div>
              <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Email de l'établissement</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  style={inputStyle}
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setFound(null); setErreur(null); }}
                  placeholder="contact@pharmacie.com"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <button onClick={handleSearch} disabled={searching} style={{ padding: "9px 16px", backgroundColor: colors.bgSurface, border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: searching ? "wait" : "pointer", whiteSpace: "nowrap" }}>
                  {searching ? "…" : "Rechercher"}
                </button>
              </div>

              {found && (
                <div style={{ marginTop: 14, padding: "12px 14px", backgroundColor: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>{found.nom}</div>
                    <div style={{ fontSize: 11, color: colors.textMuted, textTransform: "capitalize" }}>{found.type} · {found.ville}</div>
                  </div>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#F59E0B" }} />
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 14 }}>
                Ce client n'a pas besoin d'utiliser MedOS — enregistrez-le simplement avec ses
                coordonnées. Vous pourrez suivre son historique de commandes/livraisons chez vous,
                sans visibilité sur un stock qu'il ne gère pas sur la plateforme.
              </div>
              <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>
                Nom du client <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <input style={{ ...inputStyle, marginBottom: 12 }} value={manuel.nom} onChange={setManuelField("nom")} placeholder="Ex: Pharmacie du Marché" />

              <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Adresse</label>
              <input style={{ ...inputStyle, marginBottom: 12 }} value={manuel.adresse} onChange={setManuelField("adresse")} placeholder="Ex: 12 Avenue de la Paix" />

              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Ville</label>
                  <input style={inputStyle} value={manuel.ville} onChange={setManuelField("ville")} placeholder="Ex: Brazzaville" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Contact</label>
                  <input style={inputStyle} value={manuel.contact} onChange={setManuelField("contact")} placeholder="Ex: Jean Dupont" />
                </div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Téléphone</label>
                  <input style={inputStyle} value={manuel.telephone} onChange={setManuelField("telephone")} placeholder="Ex: +242 06 000 0000" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 4 }}>Email</label>
                  <input style={inputStyle} type="email" value={manuel.email} onChange={setManuelField("email")} placeholder="contact@client.com" />
                </div>
              </div>
            </>
          )}

          {erreur && (
            <div style={{ marginTop: 12, padding: "9px 13px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 12, color: "#DC2626" }}>
              {erreur}
            </div>
          )}
        </div>

        <div style={{ padding: "14px 24px 20px", display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid var(--border-light)" }}>
          <button onClick={onClose} style={{ padding: "9px 18px", backgroundColor: colors.bgCard, border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 13, color: colors.textSecondary, cursor: "pointer" }}>
            Annuler
          </button>
          {mode === "medos" ? (
            <button onClick={handleAddMedOS} disabled={!found || saving} style={{ padding: "9px 18px", backgroundColor: (!found || saving) ? "#E5E7EB" : "#F59E0B", color: (!found || saving) ? "#9CA3AF" : "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: (!found || saving) ? "not-allowed" : "pointer" }}>
              {saving ? "Ajout…" : "Ajouter au réseau"}
            </button>
          ) : (
            <button onClick={handleAddManuel} disabled={saving} style={{ padding: "9px 18px", backgroundColor: saving ? "#E5E7EB" : "#F59E0B", color: saving ? "#9CA3AF" : "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>
              {saving ? "Ajout…" : "Ajouter le client"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
