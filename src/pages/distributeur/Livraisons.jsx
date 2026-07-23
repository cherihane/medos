import { colors } from "../../theme";
import { useState, useEffect } from "react";
import Layout from "../../components/Layout";
import Modal, { Field, Row, ModalFooter, inputStyle, selectStyle } from "../../components/Modal";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useLivraisonsPaginated, useDistributeurClients, useMedicaments, useLivraisonLignes } from "../../hooks/useSupabaseData";
import Pagination from "../../components/Pagination";
import {
  updateLivraison, receiveLivraison,
  deleteLivraison, ajusterLigneLivraison, annulerLivraison, updateLivraisonLigneDisponibilite,
} from "../../hooks/useMutations";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../supabaseClient";
import { fetchEtabFromAuth } from "../../utils/MedOSDocument";
import NouvelleLivraisonModal, { printBonLivraison } from "../../components/NouvelleLivraisonModal";

const statusStyle = {
  planifiee:   { bg: "#F3F4F6",  color: colors.textSecondary,  label: "Planifiée" },
  en_transit:  { bg: "#DBEAFE",  color: "#2563EB",  label: "En transit" },
  livree:      { bg: "#DCFCE7",  color: "#16A34A",  label: "Livrée" },
  incident:    { bg: "#FEF2F2",  color: "#EF4444",  label: "Incident" },
  annulee:     { bg: "#E5E7EB",  color: "#4B5563",  label: "Annulée" },
};

function fmt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

// ── Modal Modifier une livraison (tant que non "livree") ─────────────────────
// Transporteur/dates modifiables librement ; le panier (ajout/retrait/quantité)
// passe par ajuster_ligne_livraison côté serveur pour réconcilier le stock
// entrepôt à chaque changement — jamais un simple update local qui désynchro-
// niserait le stock réel. La disponibilité par ligne (point c) est éditable
// ici aussi, sans impact sur le stock.
function EditModal({ livraison, medicaments, distributeurId, auth, onClose, onSaved }) {
  const { data: lignesExistantes, loading: loadingLignes } = useLivraisonLignes(livraison.id);
  const [form, setForm] = useState({
    transporteur: livraison.transporteur || "",
    date_depart: livraison.date_depart ? livraison.date_depart.slice(0, 10) : "",
    date_arrivee_prevue: livraison.date_arrivee_prevue ? livraison.date_arrivee_prevue.slice(0, 10) : "",
  });
  const [cart, setCart] = useState(null);
  const [medicamentId, setMedicamentId] = useState("");
  const [quantite, setQuantite] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const set = (k) => (e) => { setFormError(null); setForm((f) => ({ ...f, [k]: e.target.value })); };

  useEffect(() => {
    if (!loadingLignes && cart === null) {
      setCart(lignesExistantes.map((l) => ({
        medicament_id: l.medicament_id, nom: l.medicament_nom,
        quantite: l.quantite, original_quantite: l.quantite,
        disponible: l.disponible !== false, original_disponible: l.disponible !== false,
      })));
    }
  }, [loadingLignes, lignesExistantes, cart]);

  const addToCart = () => {
    if (!medicamentId) { setFormError("Choisissez un médicament."); return; }
    const qty = parseInt(quantite, 10);
    if (!qty || qty <= 0) { setFormError("Quantité invalide."); return; }
    const med = medicaments.find((m) => m.id === medicamentId);
    if (!med) return;
    setFormError(null);
    setCart((c) => {
      const existing = c.find((it) => it.medicament_id === medicamentId);
      if (existing) {
        return c.map((it) => it.medicament_id === medicamentId ? { ...it, quantite: (Number(it.quantite) || 0) + qty } : it);
      }
      const nom = `${med.nom}${med.dosage ? ` ${med.dosage}` : ""}${med.forme ? ` (${med.forme})` : ""}`;
      return [...c, { medicament_id: med.id, nom, quantite: qty, original_quantite: 0, disponible: true, original_disponible: true }];
    });
    setMedicamentId("");
    setQuantite("");
  };

  const updateCartQuantite = (medicament_id, val) => {
    const n = parseInt(val, 10);
    setCart((c) => c.map((it) => it.medicament_id === medicament_id ? { ...it, quantite: Number.isNaN(n) ? "" : n } : it));
  };
  const removeFromCart = (medicament_id) => setCart((c) => c.filter((it) => it.medicament_id !== medicament_id));
  const toggleDisponible = (medicament_id) => setCart((c) => c.map((it) => it.medicament_id === medicament_id ? { ...it, disponible: !it.disponible } : it));

  const handleSave = async () => {
    if (!cart) return;
    for (const it of cart) {
      if (!it.quantite || it.quantite <= 0) { setFormError(`Quantité invalide pour "${it.nom}".`); return; }
    }
    setSaving(true);
    setFormError(null);
    try {
      await updateLivraison(livraison.id, {
        transporteur: form.transporteur || null,
        date_depart: form.date_depart || null,
        date_arrivee_prevue: form.date_arrivee_prevue || null,
        traite_par_id: auth?.user?.id ?? null,
        traite_par_email: auth?.user?.email ?? null,
      });

      const cartIds = new Set(cart.map((it) => it.medicament_id));
      const supprimees = lignesExistantes.filter((l) => !cartIds.has(l.medicament_id));

      const echecs = [];
      for (const l of supprimees) {
        const res = await ajusterLigneLivraison(livraison.id, l.medicament_id, l.medicament_nom, 0, distributeurId);
        if (res !== "ok") echecs.push({ nom: l.medicament_nom, res });
      }
      for (const it of cart) {
        if (it.quantite !== it.original_quantite) {
          const res = await ajusterLigneLivraison(livraison.id, it.medicament_id, it.nom, it.quantite, distributeurId);
          if (res !== "ok") echecs.push({ nom: it.nom, res });
        }
        if (it.disponible !== it.original_disponible) {
          await updateLivraisonLigneDisponibilite(livraison.id, it.medicament_id, it.disponible);
        }
      }

      if (echecs.length > 0) {
        setFormError(
          "Certaines lignes n'ont pas pu être ajustées : " +
          echecs.map((e) => `${e.nom} (${e.res === "stock_insuffisant" ? "stock insuffisant" : e.res})`).join(", ")
        );
        setSaving(false);
        return;
      }

      onSaved();
      onClose();
    } catch (e) {
      setFormError("Erreur : " + e.message);
      setSaving(false);
    }
  };

  return (
    <Modal title={`Modifier — ${livraison.numero_suivi ?? ""}`} onClose={onClose} width={520}>
      <Field label="Transporteur">
        <input style={inputStyle} value={form.transporteur} onChange={set("transporteur")} placeholder="Ex: DHL, Transport Koné…" />
      </Field>
      <Row>
        <Field label="Date de départ">
          <input style={inputStyle} type="date" value={form.date_depart} onChange={set("date_depart")} />
        </Field>
        <Field label="Arrivée prévue">
          <input style={inputStyle} type="date" value={form.date_arrivee_prevue} onChange={set("date_arrivee_prevue")} />
        </Field>
      </Row>

      <Field label="Médicaments">
        <div style={{ display: "flex", gap: 8 }}>
          <select style={{ ...selectStyle, flex: 2 }} value={medicamentId} onChange={(e) => setMedicamentId(e.target.value)}>
            <option value="">— Ajouter un médicament de l'entrepôt —</option>
            {medicaments.map((m) => (
              <option key={m.id} value={m.id}>{m.nom}{m.dosage ? ` ${m.dosage}` : ""} — stock {m.stock_actuel ?? 0}</option>
            ))}
          </select>
          <input style={{ ...inputStyle, flex: 1 }} type="number" min="1" value={quantite} onChange={(e) => setQuantite(e.target.value)} placeholder="Qté" />
          <button type="button" onClick={addToCart} style={{ padding: "0 14px", backgroundColor: "#F59E0B", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            + Ajouter
          </button>
        </div>
      </Field>

      {loadingLignes || cart === null ? (
        <div style={{ fontSize: 12, color: colors.textMuted, padding: "12px 0" }}>Chargement du panier…</div>
      ) : cart.length > 0 && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", marginBottom: 14 }}>
          {cart.map((it) => (
            <div key={it.medicament_id} style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-light)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, fontSize: 12, color: colors.navy, fontWeight: 600 }}>{it.nom}</div>
                <input
                  type="number" min="1"
                  value={it.quantite}
                  onChange={(e) => updateCartQuantite(it.medicament_id, e.target.value)}
                  style={{ ...inputStyle, width: 70, padding: "6px 8px", fontSize: 12 }}
                />
                <button type="button" onClick={() => removeFromCart(it.medicament_id)} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 16, fontWeight: 700 }}>×</button>
              </div>
              <button
                type="button"
                onClick={() => toggleDisponible(it.medicament_id)}
                style={{
                  marginTop: 6, padding: "3px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", border: "none",
                  backgroundColor: it.disponible ? "#DCFCE7" : "#FEF2F2",
                  color: it.disponible ? "#16A34A" : "#DC2626",
                }}
              >
                {it.disponible ? "Disponible" : "En rupture, à reporter"}
              </button>
            </div>
          ))}
        </div>
      )}

      {formError && (
        <div style={{ padding: "10px 14px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 13, color: "#DC2626" }}>
          {formError}
        </div>
      )}
      <ModalFooter onCancel={onClose} onSubmit={handleSave} submitLabel="Enregistrer les modifications" saving={saving} />
    </Modal>
  );
}

// ── Modal Traçabilité — lots liés aux médicaments d'une livraison ────────────
function TracabiliteModal({ livraison, onClose }) {
  const [lots, setLots] = useState(null);
  const lignes = livraison.livraison_lignes ?? [];

  useEffect(() => {
    const ids = [...new Set(lignes.map((l) => l.medicament_id).filter(Boolean))];
    if (ids.length === 0) { setLots([]); return; }
    supabase
      .from("lots")
      .select("id, medicament_id, numero_lot, fabricant, date_fabrication, date_expiration")
      .in("medicament_id", ids)
      .order("date_expiration", { ascending: true })
      .then(({ data }) => setLots(data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livraison.id]);

  const employes = [
    { label: "Créée par",   value: livraison.cree_par_email },
    { label: "Traitée par", value: livraison.traite_par_email },
    { label: "Expédiée par", value: livraison.expedie_par_email },
  ].filter((e) => e.value);

  return (
    <Modal title={`Traçabilité — ${livraison.numero_suivi ?? ""}`} onClose={onClose} width={520}>
      {employes.length > 0 && (
        <div style={{ marginBottom: 18, paddingBottom: 14, borderBottom: "1px solid var(--border-light)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: colors.textSecondary, textTransform: "uppercase", marginBottom: 8 }}>
            Traçabilité employé
          </div>
          {employes.map((e) => (
            <div key={e.label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12 }}>
              <span style={{ color: colors.textMuted }}>{e.label}</span>
              <span style={{ color: colors.navy, fontWeight: 600 }}>{e.value}</span>
            </div>
          ))}
        </div>
      )}
      {lignes.map((l) => {
        const lotsProduit = (lots ?? []).filter((lo) => lo.medicament_id === l.medicament_id);
        return (
          <div key={l.id} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy, marginBottom: 6 }}>{l.medicament_nom} × {l.quantite}</div>
            {lots === null ? (
              <div style={{ fontSize: 12, color: colors.textMuted }}>Chargement…</div>
            ) : lotsProduit.length === 0 ? (
              <div style={{ fontSize: 12, color: colors.textMuted }}>Aucun lot certifié MedOS enregistré pour ce médicament.</div>
            ) : (
              lotsProduit.map((lo) => (
                <div key={lo.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", backgroundColor: colors.bgSurface, borderRadius: 8, marginBottom: 4, fontSize: 12 }}>
                  <span style={{ fontFamily: "monospace", color: colors.navy, fontWeight: 700 }}>{lo.numero_lot}</span>
                  <span style={{ color: colors.textSecondary }}>{lo.fabricant ?? "—"}</span>
                  <span style={{ color: colors.textSecondary }}>Péremption {fmt(lo.date_expiration)}</span>
                </div>
              ))
            )}
          </div>
        );
      })}
      {lignes.length === 0 && (
        <div style={{ fontSize: 13, color: colors.textMuted, padding: "12px 0" }}>Aucun médicament sur cette livraison.</div>
      )}
      <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
        <button onClick={onClose} style={{ padding: "8px 20px", backgroundColor: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          Fermer
        </button>
      </div>
    </Modal>
  );
}

// ── Modal Update statut ───────────────────────────────────────────────────────
function StatutModal({ livraison, auth, onClose, onSaved }) {
  const { data: lignes } = useLivraisonLignes(livraison.id);
  const [statut, setStatut] = useState(livraison.statut);
  const [saving, setSaving] = useState(false);
  const [stockWarn, setStockWarn] = useState(null);
  const [results, setResults] = useState(null);

  const handleSave = async () => {
    setSaving(true);
    setStockWarn(null);
    try {
      const update = { statut };
      // "Expédiée" = passage à en_transit, la livraison quitte physiquement
      // l'entrepôt — ne s'écrit qu'à cette transition précise, jamais réécrit
      // ensuite (livree/incident ne repassent pas par ce champ).
      if (statut === "en_transit" && livraison.statut !== "en_transit") {
        update.expedie_par_id = auth?.user?.id ?? null;
        update.expedie_par_email = auth?.user?.email ?? null;
      }
      if (statut === "livree") {
        update.date_arrivee_reelle = new Date().toISOString();
        update.lignes_livrees = JSON.stringify(lignes.map((l) => ({ nom: l.medicament_nom, quantite: l.quantite })));
        update.quantite_livree = lignes.reduce((s, l) => s + (l.quantite || 0), 0);

        // L'écriture du statut passe en premier et seule : si elle échoue,
        // aucun mouvement de stock n'a été appliqué et un nouvel essai
        // reste sûr — jamais rejoué après un succès partiel.
        await updateLivraison(livraison.id, update);

        const lignesResults = [];
        for (const ligne of lignes) {
          const res = await receiveLivraison(ligne.medicament_nom, ligne.quantite, livraison.etablissement_id);
          lignesResults.push({ nom: ligne.medicament_nom, quantite: ligne.quantite, status: res === "ok" ? "ok" : "introuvable" });
        }

        onSaved(statut);
        setResults(lignesResults);
      } else {
        await updateLivraison(livraison.id, update);
        onSaved(statut);
        onClose();
      }
    } catch (e) {
      setStockWarn("Erreur : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (results !== null) {
    return (
      <Modal title="Recapitulatif de la livraison" onClose={onClose} width={480}>
        <div style={{ marginBottom: 16 }}>
          {results.map((r, i) => (
            <div key={i} style={{
              padding: "10px 14px", marginBottom: 8, borderRadius: 8,
              backgroundColor: r.status === "ok" ? "#F0FDF4" : "#FFFBEB",
              border: `1px solid ${r.status === "ok" ? "#BBF7D0" : "#FDE68A"}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <span style={{ fontWeight: 800, color: r.status === "ok" ? "#16A34A" : "#D97706", fontSize: 15 }}>
                  {r.status === "ok" ? "✓" : "⚠"}
                </span>
                <span style={{ fontWeight: 600, color: r.status === "ok" ? "#15803D" : "#92400E" }}>
                  {r.nom} × {r.quantite}
                </span>
              </div>
              {r.status === "introuvable" && (
                <div style={{ marginTop: 4, fontSize: 12, color: "#92400E", paddingLeft: 23 }}>
                  Ce medicament n'existe pas encore dans l'inventaire du destinataire — ajoutez-le manuellement
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{ padding: "8px 20px", backgroundColor: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Fermer
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Modifier le statut" onClose={onClose} width={480}>
      <Field label="Nouveau statut">
        <select style={selectStyle} value={statut} onChange={(e) => { setStatut(e.target.value); setStockWarn(null); }}>
          {Object.entries(statusStyle).filter(([key]) => key !== "annulee").map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
      </Field>

      {statut === "livree" && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 8, padding: "8px 12px", backgroundColor: colors.bgSurface, borderRadius: 8 }}>
            Le stock du destinataire sera incrémenté d'après le panier de cette livraison.
          </div>
          {lignes.length === 0 && (
            <div style={{ fontSize: 12, color: "#DC2626" }}>Aucun médicament enregistré pour cette livraison.</div>
          )}
          {lignes.map((l) => (
            <div key={l.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}>
              <span style={{ color: colors.navy, fontWeight: 600 }}>
                {l.medicament_nom}
                {l.disponible === false && <span style={{ marginLeft: 6, fontSize: 10, color: "#DC2626", fontWeight: 700 }}>EN RUPTURE</span>}
              </span>
              <span style={{ color: colors.textSecondary }}>× {l.quantite}</span>
            </div>
          ))}
          {stockWarn && (
            <div style={{ marginTop: 10, padding: "8px 12px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 12, color: "#DC2626" }}>
              {stockWarn}
            </div>
          )}
        </div>
      )}

      <ModalFooter onCancel={onClose} onSubmit={handleSave} submitLabel="Mettre à jour" saving={saving} />
    </Modal>
  );
}

// ── Modal Détail livraison livrée ─────────────────────────────────────────────
function DetailModal({ livraison, onClose }) {
  const lignes = (() => {
    try { return JSON.parse(livraison.lignes_livrees); } catch { return []; }
  })();
  return (
    <Modal title={`Detail — ${livraison.numero_suivi}`} onClose={onClose} width={480}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, fontSize: 13 }}>
        <span style={{ color: colors.textSecondary }}>Date d'arrivee reelle</span>
        <span style={{ fontWeight: 600, color: colors.navy }}>{fmt(livraison.date_arrivee_reelle)}</span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: colors.textSecondary, textTransform: "uppercase", marginBottom: 8 }}>
        Medicaments livres
      </div>
      {lignes.length === 0 && (
        <div style={{ fontSize: 13, color: colors.textMuted, padding: "12px 0" }}>Aucun detail disponible.</div>
      )}
      {lignes.map((l, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-light)", fontSize: 13 }}>
          <span style={{ fontWeight: 600, color: colors.navy }}>{l.nom}</span>
          <span style={{ color: colors.textSecondary }}>x {l.quantite}</span>
        </div>
      ))}
      <div style={{ marginTop: 12, fontSize: 13, color: colors.textSecondary }}>
        Quantite totale : <strong style={{ color: colors.navy }}>{livraison.quantite_livree ?? 0}</strong>
      </div>
      <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={onClose}
          style={{ padding: "8px 20px", backgroundColor: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          Fermer
        </button>
      </div>
    </Modal>
  );
}

export default function Livraisons() {
  const { auth } = useAuth();
  const [filter, setFilter] = useState("tous");
  const { data: livraisons, loading, error, total, page, setPage, totalPages, refetch } = useLivraisonsPaginated(filter);
  const { data: relations } = useDistributeurClients();
  const relationsById = Object.fromEntries(relations.map((r) => [r.id, r]));
  const { data: medicaments } = useMedicaments(auth?.etablissement_id);
  const { toasts, success, error: toastError } = useToast();
  const [showNouvelle, setShowNouvelle] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [statutModal, setStatutModal] = useState(null);
  const [detailModal, setDetailModal] = useState(null);
  const [tracabiliteModal, setTracabiliteModal] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const filtered = livraisons;

  const destNom = (l) => l.etablissements?.nom ?? relationsById[l.distributeur_clients_id]?.client?.nom ?? "—";
  const destVille = (l) => l.etablissements?.ville ?? relationsById[l.distributeur_clients_id]?.client?.ville ?? "";

  const handleAnnuler = async (l) => {
    if (!window.confirm(`Annuler la livraison ${l.numero_suivi} ? Le stock entrepôt sera restitué.`)) return;
    setBusyId(l.id);
    try {
      const res = await annulerLivraison(l.id, auth?.etablissement_id);
      if (res !== "ok") { toastError("Impossible d'annuler : " + res); return; }
      refetch();
      success("Livraison annulée, stock entrepôt restitué.");
    } catch (e) {
      toastError("Erreur : " + e.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleSupprimer = async (l) => {
    if (!window.confirm(`Supprimer définitivement la livraison ${l.numero_suivi} ? Cette action est irréversible.`)) return;
    setBusyId(l.id);
    try {
      await deleteLivraison(l.id);
      refetch();
      success("Livraison supprimée.");
    } catch (e) {
      toastError("Erreur : " + e.message);
    } finally {
      setBusyId(null);
    }
  };

  // Revoir/réimprimer le bon de livraison depuis l'historique — même document
  // que celui joint à l'email d'origine, régénéré à la demande.
  const handleVoirBon = async (l) => {
    const etab = await fetchEtabFromAuth(auth);
    printBonLivraison({
      numeroSuivi: l.numero_suivi,
      destinataireNom: destNom(l),
      lignes: l.livraison_lignes ?? [],
      dateDepart: l.date_depart,
      etab,
    });
  };

  return (
    <Layout title="Livraisons" subtitle="Suivi des livraisons en temps réel">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <Toast toasts={toasts} />

      {showNouvelle && (
        <NouvelleLivraisonModal
          relations={relations}
          medicaments={medicaments}
          distributeurId={auth?.etablissement_id}
          distributeurNom={auth?.structure ?? "Votre Distributeur"}
          auth={auth}
          onClose={() => setShowNouvelle(false)}
          onSaved={() => { refetch(); success("Livraison créée avec succès"); }}
        />
      )}
      {editModal && (
        <EditModal
          livraison={editModal}
          medicaments={medicaments}
          distributeurId={auth?.etablissement_id}
          auth={auth}
          onClose={() => setEditModal(null)}
          onSaved={() => { refetch(); success("Livraison modifiée avec succès"); }}
        />
      )}
      {statutModal && (
        <StatutModal
          livraison={statutModal}
          auth={auth}
          onClose={() => setStatutModal(null)}
          onSaved={(newStatut) => {
            refetch();
            success(`Livraison mise à jour : ${statusStyle[newStatut]?.label ?? newStatut}`);
          }}
        />
      )}
      {detailModal && (
        <DetailModal livraison={detailModal} onClose={() => setDetailModal(null)} />
      )}
      {tracabiliteModal && (
        <TracabiliteModal livraison={tracabiliteModal} onClose={() => setTracabiliteModal(null)} />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 16 }}>
          {[
            { label: "En transit",  value: loading ? "…" : livraisons.filter(l => l.statut === "en_transit").length,  color: "#3B82F6" },
            { label: "Livrées",     value: loading ? "…" : livraisons.filter(l => l.statut === "livree").length,       color: "#10B981" },
            { label: "Planifiées",  value: loading ? "…" : livraisons.filter(l => l.statut === "planifiee").length,    color: "#F59E0B" },
            { label: "Incidents",   value: loading ? "…" : livraisons.filter(l => l.statut === "incident").length,     color: "#EF4444" },
          ].map((k) => (
            <div key={k.label} style={{ backgroundColor: colors.bgCard, padding: "14px 18px", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderLeft: `4px solid ${k.color}` }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 11, color: colors.textSecondary }}>{k.label}</div>
            </div>
          ))}
        </div>
        <button
          onClick={() => setShowNouvelle(true)}
          style={{ padding: "9px 18px", backgroundColor: "#F59E0B", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + Nouvelle livraison
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["tous", ...Object.keys(statusStyle)].map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", textTransform: "capitalize",
            border: filter === f ? "2px solid #F59E0B" : "1.5px solid var(--border)",
            backgroundColor: filter === f ? "#FFFBEB" : "white",
            color: filter === f ? "#D97706" : "#6B7280",
          }}>
            {f === "tous" ? "Toutes" : statusStyle[f]?.label ?? f}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ backgroundColor: "#FEF2F2", padding: "14px 18px", borderRadius: 12, marginBottom: 16, fontSize: 13, color: "#DC2626" }}>
          Une erreur s'est produite. Veuillez réessayer.
        </div>
      )}

      <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div className="table-scroll"><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: colors.bgSurface }}>
              {["N° Suivi", "Destinataire", "Produits", "Transporteur", "Départ", "Statut", "Actions"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: colors.textSecondary, borderBottom: "1px solid var(--border)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && [1,2,3].map((i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border-light)", animation: "pulse 1.5s ease-in-out infinite" }}>
                {[120,160,120,80,90,80,100].map((w, j) => (
                  <td key={j} style={{ padding: "14px 16px" }}><div style={{ height: 13, width: w, backgroundColor: colors.borderLight, borderRadius: 6 }} /></td>
                ))}
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: colors.textMuted, fontSize: 13 }}>Aucune livraison trouvée</td></tr>
            )}
            {!loading && filtered.map((l) => {
              const s = statusStyle[l.statut] ?? statusStyle.planifiee;
              const lignes = l.livraison_lignes ?? [];
              const modifiable = !["livree", "annulee"].includes(l.statut);
              return (
                <tr key={l.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "14px 16px", fontFamily: "monospace", color: colors.textSecondary, fontSize: 12 }}>{l.numero_suivi ?? "—"}</td>
                  <td style={{ padding: "14px 16px", fontWeight: 600, color: colors.navy }}>
                    {destNom(l)}
                    {destVille(l) && <div style={{ fontSize: 11, color: colors.textMuted }}>{destVille(l)}</div>}
                    {l.email_statut === "envoye" && <div style={{ fontSize: 10, color: "#16A34A", fontWeight: 700 }}>Bon envoyé par email</div>}
                    {l.email_statut === "echec" && <div style={{ fontSize: 10, color: "#DC2626", fontWeight: 700 }} title={l.email_erreur ?? ""}>Échec envoi email</div>}
                  </td>
                  <td style={{ padding: "14px 16px", color: colors.textSecondary, fontSize: 12 }} title={lignes.map(x => `${x.medicament_nom} ×${x.quantite}`).join(", ")}>
                    {lignes.length === 0 ? "—" : `${lignes.length} produit${lignes.length > 1 ? "s" : ""}`}
                    {lignes.some((x) => x.disponible === false) && (
                      <div style={{ color: "#DC2626", fontWeight: 700, fontSize: 10 }}>rupture signalée</div>
                    )}
                  </td>
                  <td style={{ padding: "14px 16px", color: colors.textSecondary }}>{l.transporteur ?? "—"}</td>
                  <td style={{ padding: "14px 16px", color: colors.textSecondary, fontSize: 12 }}>{fmt(l.date_depart)}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ padding: "3px 10px", backgroundColor: s.bg, color: s.color, borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{s.label}</span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {modifiable && (
                        <button onClick={() => setEditModal(l)} style={{ padding: "4px 10px", backgroundColor: "#FFFBEB", color: "#D97706", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                          Modifier
                        </button>
                      )}
                      {modifiable && (
                        <button onClick={() => setStatutModal(l)} style={{ padding: "4px 10px", backgroundColor: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                          Statut
                        </button>
                      )}
                      {l.statut === "livree" && (
                        <button onClick={() => setDetailModal(l)} style={{ padding: "4px 10px", backgroundColor: "#DCFCE7", color: "#16A34A", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                          Détail
                        </button>
                      )}
                      <button onClick={() => setTracabiliteModal(l)} style={{ padding: "4px 10px", backgroundColor: colors.bgSurface, color: colors.text, border: "1px solid var(--border)", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                        Traçabilité
                      </button>
                      {lignes.length > 0 && (
                        <button onClick={() => handleVoirBon(l)} style={{ padding: "4px 10px", backgroundColor: colors.bgSurface, color: colors.text, border: "1px solid var(--border)", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                          Bon de livraison
                        </button>
                      )}
                      {modifiable && (
                        <button onClick={() => handleAnnuler(l)} disabled={busyId === l.id} style={{ padding: "4px 10px", backgroundColor: "#FEF2F2", color: "#DC2626", border: "none", borderRadius: 6, fontSize: 11, cursor: busyId === l.id ? "wait" : "pointer", fontWeight: 600 }}>
                          Annuler
                        </button>
                      )}
                      {l.statut === "planifiee" && (
                        <button onClick={() => handleSupprimer(l)} disabled={busyId === l.id} style={{ padding: "4px 10px", backgroundColor: "transparent", color: "#9CA3AF", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11, cursor: busyId === l.id ? "wait" : "pointer", fontWeight: 600 }}>
                          Supprimer
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
        <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
      </div>
    </Layout>
  );
}
