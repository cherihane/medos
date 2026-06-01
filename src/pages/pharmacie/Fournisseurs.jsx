import { useState } from "react";
import Layout from "../../components/Layout";
import Modal, { Field, Row, ModalFooter, inputStyle } from "../../components/Modal";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useFournisseursPaginated, useCommandesRealtime, useMedicaments } from "../../hooks/useSupabaseData";
import { insertCommande, insertFournisseur, updateFournisseur } from "../../hooks/useMutations";
import { useAuth } from "../../context/AuthContext";
import { openDocument, tableHTML, infoGridHTML, etabFromAuth } from "../../utils/MedOSDocument";
import Pagination from "../../components/Pagination";

function printBonCommandeFournisseur({ fournisseur, medicamentNom, quantite, dateLivraison, notes, montantTotal, auth }) {
  const etab = etabFromAuth(auth);
  const dateFr = new Date().toLocaleDateString("fr-FR");
  openDocument({
    titre: "Bon de commande fournisseur",
    sousTitre: `Émis le ${dateFr}`,
    etablissement: etab,
    sections: [
      {
        titre: "Fournisseur",
        html: infoGridHTML([
          { label: "Nom", value: fournisseur.nom },
          { label: "Téléphone", value: fournisseur.telephone ?? "—" },
          { label: "Email", value: fournisseur.email ?? "—" },
          { label: "Ville", value: fournisseur.ville ?? "—" },
        ]),
      },
      {
        titre: "Détails de la commande",
        html: infoGridHTML([
          { label: "Date de livraison souhaitée", value: dateLivraison ? new Date(dateLivraison).toLocaleDateString("fr-FR") : "Non précisée" },
          { label: "Montant total estimé", value: montantTotal > 0 ? `${montantTotal.toLocaleString("fr-FR")} FCFA` : "—" },
          { label: "Notes", value: notes || "Aucune" },
        ], 3),
      },
      {
        titre: "Médicaments commandés",
        html: tableHTML(["Médicament", "Quantité"], [[medicamentNom, String(quantite)]]),
      },
    ],
  });
}

// ── Statuts commandes ─────────────────────────────────────────────────────────
const STATUT_STYLE = {
  brouillon:  { bg: "#F3F4F6", color: "#6B7280",  label: "Brouillon" },
  envoyee:    { bg: "#FEF9C3", color: "#A16207",  label: "Envoyée" },
  confirmee:  { bg: "#DBEAFE", color: "#2563EB",  label: "Confirmée" },
  en_transit: { bg: "#E0E7FF", color: "#4F46E5",  label: "En transit" },
  livree:     { bg: "#DCFCE7", color: "#16A34A",  label: "Livrée" },
  annulee:    { bg: "#FEF2F2", color: "#DC2626",  label: "Annulée / refusée" },
};

// ── Panneau commandes temps réel ──────────────────────────────────────────────
function MesCommandesPanel({ etablissement_id }) {
  const { data: commandes, loading } = useCommandesRealtime(etablissement_id);
  if (loading || commandes.length === 0) return null;
  return (
    <div style={{ backgroundColor: "white", borderRadius: 14, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Mes commandes en cours</h3>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, backgroundColor: "#DCFCE7", color: "#16A34A", padding: "3px 8px", borderRadius: 10 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#16A34A", display: "inline-block", animation: "livePulse 1.5s ease-in-out infinite" }} />
          TEMPS RÉEL
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {commandes.slice(0, 8).map((c) => {
          const s = STATUT_STYLE[c.statut] || { bg: "#F3F4F6", color: "#6B7280", label: c.statut };
          return (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", backgroundColor: s.bg, borderRadius: 10, borderLeft: `3px solid ${s.color}`, animation: "fadeIn 0.3s ease" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0A1628" }}>{c.fournisseurs?.nom ?? "—"}</div>
                <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>
                  {c.reference ?? c.id.slice(0, 8).toUpperCase()} · {new Date(c.date_commande).toLocaleDateString("fr-FR")}
                  {c.notes && ` · ${c.notes.slice(0, 50)}${c.notes.length > 50 ? "…" : ""}`}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, marginLeft: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#374151" }}>{(c.montant_total ?? 0).toLocaleString()} FCFA</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: s.color, padding: "2px 8px", backgroundColor: "white", borderRadius: 8, whiteSpace: "nowrap" }}>{s.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Skeleton chargement ───────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div style={{ backgroundColor: "white", borderRadius: 16, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", animation: "pulse 1.5s ease-in-out infinite" }}>
      <div style={{ display: "flex", gap: 14, marginBottom: 16 }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: "#F3F4F6" }} />
        <div style={{ flex: 1 }}>
          <div style={{ width: 140, height: 14, backgroundColor: "#F3F4F6", borderRadius: 6, marginBottom: 8 }} />
          <div style={{ width: 80, height: 12, backgroundColor: "#F3F4F6", borderRadius: 6 }} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        {[1, 2, 3, 4].map((i) => <div key={i} style={{ height: 52, backgroundColor: "#F8FAFC", borderRadius: 10 }} />)}
      </div>
      <div style={{ height: 48, backgroundColor: "#F8FAFC", borderRadius: 10 }} />
    </div>
  );
}

// ── Modal Fournisseur (ajout + édition) ───────────────────────────────────────
const EMPTY_FORM = {
  nom: "", pays: "", delai_livraison: "", conditions_paiement: "",
  contact_nom: "", email: "", telephone: "", notes: "",
};

function FournisseurModal({ initial, onClose, onSaved }) {
  const [form, setForm] = useState(initial
    ? {
        nom:                  initial.nom               || "",
        pays:                 initial.pays              || "",
        delai_livraison:      initial.delai_livraison   || "",
        conditions_paiement:  initial.conditions_paiement || "",
        contact_nom:          initial.contact_nom       || "",
        email:                initial.email             || "",
        telephone:            initial.telephone         || "",
        notes:                initial.notes             || "",
      }
    : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const isEdit = !!initial;

  const handleSave = async () => {
    if (!form.nom.trim()) return alert("Le nom du fournisseur est obligatoire.");
    setSaving(true);
    try {
      if (isEdit) {
        await updateFournisseur(initial.id, form);
      } else {
        await insertFournisseur({ ...form, actif: true });
      }
      onSaved();
      onClose();
    } catch (e) {
      alert("Erreur : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? `Modifier — ${initial.nom}` : "Ajouter un fournisseur"} onClose={onClose} width={520}>
      <Field label="Nom du fournisseur *">
        <input style={inputStyle} value={form.nom} onChange={set("nom")} placeholder="Ex: PharmaDistrib Congo" autoFocus />
      </Field>
      <Row>
        <Field label="Pays">
          <input style={inputStyle} value={form.pays} onChange={set("pays")} placeholder="Ex: Congo, France…" />
        </Field>
        <Field label="Délai de livraison">
          <input style={inputStyle} value={form.delai_livraison} onChange={set("delai_livraison")} placeholder="Ex: 5-7 jours" />
        </Field>
      </Row>
      <Field label="Conditions de paiement">
        <input style={inputStyle} value={form.conditions_paiement} onChange={set("conditions_paiement")} placeholder="Ex: 30 jours net, virement…" />
      </Field>
      <Row>
        <Field label="Nom du contact">
          <input style={inputStyle} value={form.contact_nom} onChange={set("contact_nom")} placeholder="Ex: Jean Dupont" />
        </Field>
        <Field label="Téléphone">
          <input style={inputStyle} value={form.telephone} onChange={set("telephone")} placeholder="Ex: +242 06 000 0000" />
        </Field>
      </Row>
      <Field label="Email">
        <input style={inputStyle} type="email" value={form.email} onChange={set("email")} placeholder="contact@fournisseur.com" />
      </Field>
      <Field label="Notes">
        <input style={inputStyle} value={form.notes} onChange={set("notes")} placeholder="Informations complémentaires…" />
      </Field>
      <ModalFooter
        onCancel={onClose}
        onSubmit={handleSave}
        submitLabel={isEdit ? "Enregistrer les modifications" : "Ajouter le fournisseur"}
        saving={saving}
      />
    </Modal>
  );
}

// ── Modal Passer commande ─────────────────────────────────────────────────────
function CommandeModal({ fournisseur, etablissement_id, auth, onClose, onSaved }) {
  const { data: medicaments, loading: loadingMeds } = useMedicaments();
  const [medicamentId, setMedicamentId]   = useState("");
  const [quantite, setQuantite]           = useState("");
  const [dateLivraison, setDateLivraison] = useState("");
  const [notes, setNotes]                 = useState("");
  const [saving, setSaving]               = useState(false);

  // Médicament sélectionné et calcul automatique du montant
  const selectedMed  = medicaments.find((m) => m.id === medicamentId) || null;
  const prixUnitaire = selectedMed?.prix_unitaire ?? 0;
  const qty          = parseInt(quantite, 10) || 0;
  const montantTotal = qty * prixUnitaire;

  const handleSave = async () => {
    if (!medicamentId) return alert("Veuillez sélectionner un médicament.");
    if (qty <= 0)      return alert("Veuillez saisir une quantité valide.");
    setSaving(true);
    try {
      await insertCommande({
        fournisseur_id:        fournisseur.id,
        statut:                "envoyee",
        date_commande:         new Date().toISOString(),
        date_livraison_prevue: dateLivraison || null,
        montant_total:         montantTotal,
        notes: `${selectedMed.nom} — Qté : ${qty}${notes ? " — " + notes : ""}`,
        ...(etablissement_id ? { etablissement_id } : {}),
      });
      onSaved();
      onClose();
    } catch (e) {
      alert("Erreur : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const selectStyle = {
    ...inputStyle,
    backgroundColor: "white",
    cursor: loadingMeds ? "wait" : "pointer",
  };

  const readonlyStyle = {
    ...inputStyle,
    backgroundColor: "#F8FAFC",
    color: montantTotal > 0 ? "#0A1628" : "#9CA3AF",
    fontWeight: montantTotal > 0 ? 700 : 400,
    cursor: "default",
  };

  return (
    <Modal title={`Commander chez ${fournisseur.nom}`} onClose={onClose}>
      {/* Sélection médicament */}
      <Field label="Médicament *">
        <select
          style={selectStyle}
          value={medicamentId}
          onChange={(e) => setMedicamentId(e.target.value)}
          autoFocus
        >
          <option value="">{loadingMeds ? "Chargement…" : "— Sélectionner un médicament —"}</option>
          {medicaments.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nom}{m.dosage ? ` ${m.dosage}` : ""}{m.forme ? ` (${m.forme})` : ""}
            </option>
          ))}
        </select>
      </Field>

      {/* Prix unitaire affiché si médicament sélectionné */}
      {selectedMed && (
        <div style={{ fontSize: 12, color: "#6B7280", marginTop: -8, marginBottom: 12, paddingLeft: 2 }}>
          Prix unitaire : <strong style={{ color: "#0A1628" }}>
            {prixUnitaire > 0 ? `${prixUnitaire.toLocaleString("fr-FR")} FCFA / ${selectedMed.unite || "unité"}` : "non renseigné"}
          </strong>
        </div>
      )}

      <Row>
        {/* Quantité */}
        <Field label="Quantité *">
          <input
            style={inputStyle}
            type="number"
            min="1"
            value={quantite}
            onChange={(e) => setQuantite(e.target.value)}
            placeholder="Ex : 500"
          />
        </Field>

        {/* Montant calculé automatiquement — lecture seule */}
        <Field label="Montant total (FCFA)">
          <input
            style={readonlyStyle}
            readOnly
            tabIndex={-1}
            value={
              montantTotal > 0
                ? montantTotal.toLocaleString("fr-FR")
                : qty > 0 && prixUnitaire === 0
                  ? "Prix non renseigné"
                  : "—"
            }
          />
        </Field>
      </Row>

      <Field label="Date de livraison souhaitée">
        <input
          style={inputStyle}
          type="date"
          value={dateLivraison}
          onChange={(e) => setDateLivraison(e.target.value)}
        />
      </Field>

      <Field label="Notes complémentaires">
        <input
          style={inputStyle}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Instructions particulières…"
        />
      </Field>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", padding: "16px 0 0" }}>
        <button onClick={onClose} style={{ padding: "9px 18px", background: "white", border: "1.5px solid #E5E7EB", borderRadius: 9, fontSize: 13, color: "#6B7280", cursor: "pointer" }}>Annuler</button>
        {selectedMed && qty > 0 && (
          <button
            onClick={() => printBonCommandeFournisseur({ fournisseur, medicamentNom: selectedMed.nom, quantite: qty, dateLivraison, notes, montantTotal, auth })}
            style={{ padding: "9px 16px", background: "#F8FAFC", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Imprimer
          </button>
        )}
        <button onClick={handleSave} disabled={saving} style={{ padding: "9px 18px", background: saving ? "#E5E7EB" : "#10B981", color: saving ? "#9CA3AF" : "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
          {saving ? "Envoi…" : "Passer la commande"}
        </button>
      </div>
    </Modal>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function Fournisseurs() {
  const { auth } = useAuth();
  const etablissement_id = auth?.etablissement_id ?? null;
  const [filtre, setFiltre] = useState("actifs"); // "actifs" | "inactifs" | "tous"
  const { data: liste, loading, error, total, page, setPage, totalPages, refetch } = useFournisseursPaginated(filtre);
  const { toasts, success, error: toastError } = useToast();

  const [addModal, setAddModal]         = useState(false);
  const [editModal, setEditModal]       = useState(null);   // fournisseur à éditer
  const [commandModal, setCommandModal] = useState(null);   // fournisseur à commander
  const [toggling, setToggling]         = useState(null);   // id en cours de désactivation

  const handleToggleActif = async (f) => {
    setToggling(f.id);
    try {
      await updateFournisseur(f.id, { actif: !f.actif });
      success(f.actif ? `${f.nom} désactivé` : `${f.nom} réactivé`);
      refetch();
    } catch (e) {
      toastError("Erreur : " + e.message);
    } finally {
      setToggling(null);
    }
  };

  const FILTRES = [
    { key: "actifs",   label: "Actifs" },
    { key: "inactifs", label: "Inactifs" },
    { key: "tous",     label: "Tous" },
  ];

  return (
    <Layout title="Fournisseurs" subtitle="Gestion des partenaires et des approvisionnements">
      <style>{`
        @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes livePulse{ 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes fadeIn   { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
      <Toast toasts={toasts} />

      {/* Modals */}
      {addModal && (
        <FournisseurModal
          onClose={() => setAddModal(false)}
          onSaved={() => { success("Fournisseur ajouté avec succès"); refetch(); }}
        />
      )}
      {editModal && (
        <FournisseurModal
          initial={editModal}
          onClose={() => setEditModal(null)}
          onSaved={() => { success(`${editModal.nom} mis à jour`); refetch(); setEditModal(null); }}
        />
      )}
      {commandModal && (
        <CommandeModal
          fournisseur={commandModal}
          etablissement_id={etablissement_id}
          auth={auth}
          onClose={() => setCommandModal(null)}
          onSaved={() => success(`Commande envoyée chez ${commandModal.nom}`)}
        />
      )}

      {/* Commandes temps réel */}
      <MesCommandesPanel etablissement_id={etablissement_id} />

      {/* Barre d'actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Filtres */}
          <div style={{ display: "flex", backgroundColor: "white", borderRadius: 10, padding: 3, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", gap: 2 }}>
            {FILTRES.map((f) => (
              <button
                key={f.key}
                onClick={() => setFiltre(f.key)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  border: "none",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  backgroundColor: filtre === f.key ? "#3B82F6" : "transparent",
                  color: filtre === f.key ? "white" : "#6B7280",
                  transition: "all 0.15s",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 13, color: "#9CA3AF" }}>
            {loading ? "Chargement…" : `${total} fournisseur${total !== 1 ? "s" : ""}`}
          </div>
        </div>

        {/* Bouton ajouter */}
        <button
          onClick={() => setAddModal(true)}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "9px 18px",
            backgroundColor: "#3B82F6", color: "white",
            border: "none", borderRadius: 10,
            fontSize: 13, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 2px 8px rgba(59,130,246,0.3)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Ajouter un fournisseur
        </button>
      </div>

      {error && (
        <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "14px 18px", marginBottom: 20, fontSize: 13, color: "#DC2626" }}>
          Impossible de charger les fournisseurs : {error.message}
        </div>
      )}

      {/* Grille */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {loading && [1, 2, 3, 4].map((i) => <Skeleton key={i} />)}

        {!loading && liste.length === 0 && (
          <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "60px 0", color: "#9CA3AF", fontSize: 14 }}>
            {filtre === "inactifs" ? "Aucun fournisseur inactif." : "Aucun fournisseur trouvé."}
          </div>
        )}

        {!loading && liste.map((s) => {
          const actif = s.actif !== false;
          return (
            <div key={s.id} style={{ backgroundColor: "white", borderRadius: 16, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", opacity: actif ? 1 : 0.75 }}>

              {/* En-tête carte */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: actif ? "#EFF6FF" : "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={actif ? "#3B82F6" : "#9CA3AF"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
                      <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "#0A1628" }}>{s.nom}</div>
                    <div style={{ fontSize: 12, color: "#9CA3AF" }}>{s.pays || "—"}</div>
                  </div>
                </div>
                <span style={{ padding: "4px 12px", borderRadius: 12, fontSize: 11, fontWeight: 700, backgroundColor: actif ? "#DCFCE7" : "#F3F4F6", color: actif ? "#16A34A" : "#9CA3AF", flexShrink: 0 }}>
                  {actif ? "actif" : "inactif"}
                </span>
              </div>

              {/* Infos */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                {[
                  { label: "Délai livraison",      value: s.delai_livraison       || "—" },
                  { label: "Conditions paiement",  value: s.conditions_paiement   || "—" },
                  { label: "Contact",              value: s.contact_nom           || "—" },
                  { label: "Référence",            value: s.id?.slice(0, 8).toUpperCase() },
                ].map((item) => (
                  <div key={item.label} style={{ padding: "10px 12px", backgroundColor: "#F8FAFC", borderRadius: 10 }}>
                    <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontWeight: 700, fontSize: 12, color: "#0A1628" }}>{item.value}</div>
                  </div>
                ))}
              </div>

              {/* Contact email / tél */}
              <div style={{ padding: "10px 12px", backgroundColor: "#F8FAFC", borderRadius: 10, marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 2 }}>Contact</div>
                <div style={{ fontSize: 13, color: "#3B82F6" }}>{s.email || "—"}</div>
                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{s.telephone || "—"}</div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 6 }}>
                {actif && (
                  <button
                    onClick={() => setCommandModal(s)}
                    style={{ flex: 1, padding: "9px", backgroundColor: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                  >
                    Commander
                  </button>
                )}
                <button
                  onClick={() => setEditModal(s)}
                  style={{ flex: 1, padding: "9px", backgroundColor: "#F8FAFC", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  Modifier
                </button>
                <button
                  onClick={() => handleToggleActif(s)}
                  disabled={toggling === s.id}
                  style={{
                    padding: "9px 12px",
                    backgroundColor: actif ? "#FEF2F2" : "#F0FDF4",
                    color: actif ? "#DC2626" : "#16A34A",
                    border: `1px solid ${actif ? "#FECACA" : "#BBF7D0"}`,
                    borderRadius: 8, fontSize: 12, fontWeight: 600,
                    cursor: toggling === s.id ? "wait" : "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {toggling === s.id ? "…" : actif ? "Désactiver" : "Réactiver"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
    </Layout>
  );
}
