import { colors } from "../../theme";
import { useState, useCallback } from "react";
import Layout from "../../components/Layout";
import Modal from "../../components/Modal";
import AjouterClientModal from "../../components/AjouterClientModal";
import { useAuth } from "../../context/AuthContext";
import { useNetwork } from "../../context/NetworkContext";
import { useSyncQueue } from "../../context/SyncContext";
import { useCachedQuery } from "../../offline/useCachedQuery";
import { supabase } from "../../supabaseClient";

const inputStyle = {
  width: "100%", padding: "9px 12px", border: "1.5px solid var(--border)",
  borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", color: colors.navy,
};
const labelStyle = { fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 5 };

// ── Modal Fiche client ─────────────────────────────────────────────────────────
// Deux sections : les coordonnées (lecture seule — issues du compte MedOS
// du client, ou de la saisie manuelle faite à l'ajout) et les annotations de
// relation (Point 8 : contact, horaires, licence/agrément, notes internes,
// type précis) — celles-ci appartiennent au distributeur et sont éditables
// ici quel que soit le type de client, MedOS ou manuel.
function FicheModal({ client, onClose, onSaved }) {
  const { enqueueOrRun } = useSyncQueue();
  const [form, setForm] = useState({
    contact_nom: client.contact_nom || "",
    horaires_ouverture: client.horaires_ouverture || "",
    numero_licence: client.numero_licence || "",
    notes_internes: client.notes_internes || "",
    type_etablissement_precis: client.type_etablissement_precis || "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    setErr(null);
    try {
      const { queued } = await enqueueOrRun("updateDistributeurClient", [client.relationId, {
        contact_nom: form.contact_nom.trim() || null,
        horaires_ouverture: form.horaires_ouverture.trim() || null,
        numero_licence: form.numero_licence.trim() || null,
        notes_internes: form.notes_internes.trim() || null,
        type_etablissement_precis: form.type_etablissement_precis.trim() || null,
      }], {
        description: `Fiche client — ${client.nom}`,
        module: "distributeur.clients",
      });
      onSaved(queued);
      onClose();
    } catch (e) {
      setErr("Erreur : " + e.message);
      setSaving(false);
    }
  };

  return (
    <Modal title={client.nom} onClose={onClose} width={520}>
      <div style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, textTransform: "uppercase", marginBottom: 8 }}>
        Coordonnées
      </div>
      <div className="form-row-2" style={{ marginBottom: 20 }}>
        {[
          { label: "Type de compte", value: client.estManuel ? "Client manuel" : (client.type || "—") },
          { label: "Ville",          value: client.ville || "—" },
          { label: "Utilise MedOS",  value: client.derniere_connexion ? "Oui" : "Non" },
          { label: "Téléphone",      value: client.telephone || "—" },
          { label: "Email",          value: client.email || "—" },
          { label: "Adresse",        value: client.adresse || "—" },
        ].map((item) => (
          <div key={item.label} style={{ padding: "10px 14px", backgroundColor: colors.bgSurface, borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 3 }}>{item.label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, textTransform: "uppercase", marginBottom: 8 }}>
        Notes de la relation — propres à votre réseau, éditables
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label style={labelStyle}>Type d'établissement précis</label>
          <input style={inputStyle} value={form.type_etablissement_precis} onChange={set("type_etablissement_precis")} placeholder="Ex: Pharmacie de garde, clinique privée pédiatrique…" />
        </div>
        <div className="form-row-2">
          <div>
            <label style={labelStyle}>Personne de contact</label>
            <input style={inputStyle} value={form.contact_nom} onChange={set("contact_nom")} placeholder="Ex: Jean Dupont" />
          </div>
          <div>
            <label style={labelStyle}>N° de licence / agrément</label>
            <input style={inputStyle} value={form.numero_licence} onChange={set("numero_licence")} placeholder="Si pertinent" />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Horaires d'ouverture</label>
          <input style={inputStyle} value={form.horaires_ouverture} onChange={set("horaires_ouverture")} placeholder="Ex: Lun-Sam 8h-20h, dimanche fermé" />
        </div>
        <div>
          <label style={labelStyle}>Notes internes</label>
          <textarea
            value={form.notes_internes}
            onChange={set("notes_internes")}
            placeholder="Remarques libres visibles uniquement par votre équipe…"
            rows={3}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
          />
        </div>
      </div>

      {err && (
        <div style={{ marginTop: 14, padding: "8px 12px", backgroundColor: "#FEF2F2", borderRadius: 8, fontSize: 12, color: "#DC2626" }}>{err}</div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button onClick={onClose} style={{ flex: 1, padding: "10px", backgroundColor: colors.bgSurface, border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, cursor: "pointer" }}>Fermer</button>
        <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: "10px", backgroundColor: saving ? "#E5E7EB" : "#F59E0B", color: saving ? "#9CA3AF" : "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </Modal>
  );
}

// Répertoire de TOUS vos clients réels (relation distributeur_clients — jamais
// un annuaire de tous les établissements MedOS), qu'ils utilisent MedOS ou non
// — beaucoup de clients réels n'ont pas d'outils informatiques. La vue enrichie
// avec alertes de stock et historique d'achat détaillé vit dans Réseau clients ;
// cet écran reste volontairement un simple répertoire de fiches.
export default function Clients() {
  const { auth } = useAuth();
  const { online } = useNetwork();
  // useDistributeurClients() n'est pas paginé côté serveur (tout le
  // répertoire est chargé en une fois) — repli direct sur useCachedQuery
  // avec la même requête, sans branche online/offline séparée.
  const relKey = `distributeur_clients:${auth?.etablissement_id ?? "global"}`;
  const fetchAllRelations = useCallback(async () => {
    const { data, error } = await supabase.from("distributeur_clients").select(`
      id, source, created_at,
      nom_manuel, adresse_manuel, ville_manuel, contact_manuel, telephone_manuel, email_manuel,
      contact_nom, horaires_ouverture, numero_licence, notes_internes, type_etablissement_precis,
      client:client_etablissement_id ( id, nom, ville, type, email, telephone, actif, derniere_connexion )
    `).order("created_at", { ascending: false }).limit(500);
    if (error) throw error;
    return data ?? [];
  }, []);
  const { data: relationsRaw, loading, error, refetch, fromCache, cachedAt } = useCachedQuery(relKey, fetchAllRelations, [relKey]);
  // Même enrichissement que useDistributeurClients (Point 8 — fiche +
  // repli manuel/MedOS), reproduit ici a l'identique pour ne pas toucher au
  // hook partagé (utilisé aussi par ReseauClients.jsx, non audité cette passe).
  const fiche = (r) => ({
    contact_nom:               r.contact_nom || r.contact_manuel || "",
    horaires_ouverture:        r.horaires_ouverture || "",
    numero_licence:            r.numero_licence || "",
    notes_internes:            r.notes_internes || "",
    type_etablissement_precis: r.type_etablissement_precis || "",
  });
  const relations = relationsRaw.map((r) => ({
    ...r,
    client: r.client ? { ...r.client, relationId: r.id, ...fiche(r) } : {
      id: r.id,
      relationId: r.id,
      nom: r.nom_manuel,
      ville: r.ville_manuel,
      adresse: r.adresse_manuel,
      type: "manuel",
      email: r.email_manuel,
      telephone: r.telephone_manuel,
      actif: true,
      derniere_connexion: null,
      estManuel: true,
      ...fiche(r),
    },
  }));
  const etabs = relations.map((r) => r.client).filter(Boolean);
  const [ficheModal, setFicheModal] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  return (
    <Layout title="Clients" subtitle="Répertoire de tous vos clients réels — fiches et coordonnées, MedOS ou non">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, backgroundColor: "#10B981", color: "white", padding: "12px 20px", borderRadius: 10, fontWeight: 600, fontSize: 13, zIndex: 2000, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
          {toast}
        </div>
      )}

      {ficheModal && (
        <FicheModal
          client={ficheModal}
          onClose={() => setFicheModal(null)}
          onSaved={(queued) => { showToast(queued ? "Fiche mise à jour — en attente de synchronisation" : "Fiche mise à jour"); refetch(); }}
        />
      )}
      {showModal && (
        <AjouterClientModal
          onClose={() => setShowModal(false)}
          onSaved={(msg) => { showToast(msg); refetch(); }}
        />
      )}

      {error && (
        <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "14px 18px", marginBottom: 16, fontSize: 13, color: "#DC2626" }}>
          Une erreur s'est produite. Veuillez réessayer.
        </div>
      )}

      <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: colors.navy, display: "flex", alignItems: "center", gap: 8 }}>
            Vos clients ({loading ? "…" : etabs.length})
            {!online && fromCache && (
              <span style={{ fontSize: 11, fontWeight: 600, color: "#B45309", backgroundColor: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 8, padding: "2px 8px" }}>
                Hors-ligne — {cachedAt ? new Date(cachedAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "?"}
              </span>
            )}
          </h3>
          <button onClick={() => setShowModal(true)} style={{ padding: "7px 14px", backgroundColor: "#F59E0B", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            + Ajouter un client
          </button>
        </div>
        <div className="table-scroll"><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: colors.bgSurface }}>
              {["Client", "Ville", "Type", "Email", "MedOS", "Actions"].map((h) => (
                <th key={h} style={{ padding: "12px 18px", textAlign: "left", fontSize: 12, fontWeight: 700, color: colors.textSecondary, borderBottom: "1px solid var(--border)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && [1,2,3,4].map((i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border-light)", animation: "pulse 1.5s ease-in-out infinite" }}>
                {[180,100,80,140,60,100].map((w, j) => (
                  <td key={j} style={{ padding: "14px 18px" }}><div style={{ height: 13, width: w, backgroundColor: colors.borderLight, borderRadius: 6 }} /></td>
                ))}
              </tr>
            ))}
            {!loading && etabs.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: colors.textMuted, fontSize: 13 }}>Aucun client pour l'instant — ajoutez-en un, MedOS ou non.</td></tr>
            )}
            {!loading && etabs.map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                <td style={{ padding: "14px 18px", fontWeight: 600, color: colors.navy }}>{c.nom}</td>
                <td style={{ padding: "14px 18px", color: colors.textSecondary }}>{c.ville || "—"}</td>
                <td style={{ padding: "14px 18px", color: colors.textSecondary, textTransform: c.type_etablissement_precis ? "none" : "capitalize" }}>{c.type_etablissement_precis || (c.estManuel ? "Manuel" : c.type)}</td>
                <td style={{ padding: "14px 18px", color: colors.textSecondary, fontSize: 12 }}>{c.email ?? "—"}</td>
                <td style={{ padding: "14px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: c.derniere_connexion ? "#10B981" : "#9CA3AF" }} />
                    <span style={{ fontSize: 12, color: c.derniere_connexion ? "#16A34A" : "#9CA3AF", fontWeight: 600 }}>{c.derniere_connexion ? "oui" : "non"}</span>
                  </div>
                </td>
                <td style={{ padding: "14px 18px" }}>
                  <button
                    onClick={() => setFicheModal(c)}
                    style={{ padding: "4px 12px", backgroundColor: colors.bgSurface, color: colors.text, border: "1px solid var(--border)", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>
                    Fiche
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </Layout>
  );
}
