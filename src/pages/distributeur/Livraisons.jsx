import { colors } from "../../theme";
import { useState } from "react";
import Layout from "../../components/Layout";
import Modal, { Field, Row, ModalFooter, inputStyle, selectStyle } from "../../components/Modal";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useLivraisonsPaginated, useDistributeurClients, useMedicaments, useLivraisonLignes } from "../../hooks/useSupabaseData";
import Pagination from "../../components/Pagination";
import { insertLivraison, insertLivraisonLignes, updateLivraison, receiveLivraison, expedierLigneLivraison } from "../../hooks/useMutations";
import { useAuth } from "../../context/AuthContext";

const statusStyle = {
  planifiee:   { bg: "#F3F4F6",  color: colors.textSecondary,  label: "Planifiée" },
  en_transit:  { bg: "#DBEAFE",  color: "#2563EB",  label: "En transit" },
  livree:      { bg: "#DCFCE7",  color: "#16A34A",  label: "Livrée" },
  incident:    { bg: "#FEF2F2",  color: "#EF4444",  label: "Incident" },
};

function fmt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

// ── Modal Nouvelle livraison ───────────────────────────────────────────────────
// Le panier de médicaments est fixé ici, à la création — c'est le seul
// moment où l'on décrémente le stock entrepôt du distributeur (l'expédition
// réelle des produits), voir handleSave.
function NouvelleModal({ clients, medicaments, distributeurId, onClose, onSaved }) {
  const [form, setForm] = useState({
    etablissement_id: "", transporteur: "",
    date_depart: new Date().toISOString().slice(0, 10), date_arrivee_prevue: "",
  });
  const [cart, setCart] = useState([]);
  const [medicamentId, setMedicamentId] = useState("");
  const [quantite, setQuantite] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [partiel, setPartiel] = useState(null);
  const set = (k) => (e) => { setFormError(null); setForm((f) => ({ ...f, [k]: e.target.value })); };

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
      return [...c, { medicament_id: med.id, nom, quantite: qty, stock_disponible: med.stock_actuel ?? 0 }];
    });
    setMedicamentId("");
    setQuantite("");
  };

  const updateCartQuantite = (medicament_id, val) => {
    const n = parseInt(val, 10);
    setCart((c) => c.map((it) => it.medicament_id === medicament_id ? { ...it, quantite: Number.isNaN(n) ? "" : n } : it));
  };
  const removeFromCart = (medicament_id) => setCart((c) => c.filter((it) => it.medicament_id !== medicament_id));

  const handleSave = async () => {
    if (!form.etablissement_id) { setFormError("Sélectionnez un établissement destinataire."); return; }
    if (cart.length === 0) { setFormError("Ajoutez au moins un médicament à la livraison."); return; }
    for (const it of cart) {
      if (!it.quantite || it.quantite <= 0) { setFormError(`Quantité invalide pour "${it.nom}".`); return; }
      if (it.quantite > it.stock_disponible) {
        setFormError(`Stock entrepôt insuffisant pour "${it.nom}" (disponible : ${it.stock_disponible}, demandé : ${it.quantite}).`);
        return;
      }
    }
    setSaving(true);
    setFormError(null);
    try {
      const livraison = await insertLivraison({
        etablissement_id: form.etablissement_id,
        distributeur_id: distributeurId,
        statut: "planifiee",
        transporteur: form.transporteur || null,
        numero_suivi: "LIV-" + Date.now().toString().slice(-8),
        date_depart: form.date_depart || null,
        date_arrivee_prevue: form.date_arrivee_prevue || null,
      });

      await insertLivraisonLignes(cart.map((it) => ({
        livraison_id: livraison.id,
        medicament_id: it.medicament_id,
        medicament_nom: it.nom,
        quantite: it.quantite,
      })));

      // Décrément entrepôt, ligne par ligne, vérifié et appliqué côté
      // serveur (voir expedier_ligne_livraison). Si une ligne échoue après
      // que d'autres ont déjà été décrémentées (rare, concurrence), la
      // livraison existe déjà avec un état partiellement appliqué — on ne
      // le cache pas, on l'affiche clairement plutôt que de prétendre un
      // succès complet.
      const echecs = [];
      for (const it of cart) {
        const res = await expedierLigneLivraison(it.medicament_id, it.quantite, distributeurId);
        if (res !== "ok") echecs.push({ nom: it.nom, res });
      }

      if (echecs.length > 0) {
        setPartiel({ numero_suivi: livraison.numero_suivi, echecs, total: cart.length });
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

  if (partiel) {
    return (
      <Modal title="Livraison créée avec une anomalie" onClose={() => { onSaved(); onClose(); }} width={480}>
        <div style={{ padding: "10px 14px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 12, color: "#DC2626", marginBottom: 12 }}>
          La livraison {partiel.numero_suivi} a été créée, mais le décrément du stock entrepôt a
          échoué pour {partiel.echecs.length} produit{partiel.echecs.length > 1 ? "s" : ""} sur {partiel.total} —
          vérifiez le stock manuellement dans Entrepôt.
        </div>
        {partiel.echecs.map((e, i) => (
          <div key={i} style={{ padding: "8px 12px", backgroundColor: "#FFFBEB", borderRadius: 8, marginBottom: 6, fontSize: 12, color: "#92400E" }}>
            {e.nom} — {e.res === "stock_insuffisant" ? "stock insuffisant" : "produit introuvable"}
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <button onClick={() => { onSaved(); onClose(); }} style={{ padding: "8px 20px", backgroundColor: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Fermer
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Nouvelle livraison" onClose={onClose} width={520}>
      <Field label="Destinataire *">
        <select style={selectStyle} value={form.etablissement_id} onChange={set("etablissement_id")}>
          <option value="">— Sélectionner un client —</option>
          {clients.map((e) => <option key={e.id} value={e.id}>{e.nom} ({e.ville})</option>)}
        </select>
        {clients.length === 0 && (
          <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
            Aucun client pour l'instant — ajoutez-en un depuis "Réseau clients".
          </div>
        )}
      </Field>
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

      <Field label="Médicaments à expédier *">
        <div style={{ display: "flex", gap: 8 }}>
          <select style={{ ...selectStyle, flex: 2 }} value={medicamentId} onChange={(e) => setMedicamentId(e.target.value)}>
            <option value="">— Médicament de l'entrepôt —</option>
            {medicaments.map((m) => (
              <option key={m.id} value={m.id}>{m.nom}{m.dosage ? ` ${m.dosage}` : ""} — stock {m.stock_actuel ?? 0}</option>
            ))}
          </select>
          <input style={{ ...inputStyle, flex: 1 }} type="number" min="1" value={quantite} onChange={(e) => setQuantite(e.target.value)} placeholder="Qté" />
          <button type="button" onClick={addToCart} style={{ padding: "0 14px", backgroundColor: "#F59E0B", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            + Ajouter
          </button>
        </div>
        {medicaments.length === 0 && (
          <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
            Aucun médicament dans votre entrepôt — réceptionnez-en d'abord depuis "Entrepôt".
          </div>
        )}
      </Field>

      {cart.length > 0 && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", marginBottom: 14 }}>
          {cart.map((it) => (
            <div key={it.medicament_id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid var(--border-light)" }}>
              <div style={{ flex: 1, fontSize: 12, color: colors.navy, fontWeight: 600 }}>{it.nom}</div>
              <input
                type="number" min="1"
                value={it.quantite}
                onChange={(e) => updateCartQuantite(it.medicament_id, e.target.value)}
                style={{ ...inputStyle, width: 70, padding: "6px 8px", fontSize: 12 }}
              />
              <span style={{ fontSize: 11, color: it.quantite > it.stock_disponible ? "#DC2626" : colors.textMuted }}>
                / {it.stock_disponible} dispo
              </span>
              <button type="button" onClick={() => removeFromCart(it.medicament_id)} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 16, fontWeight: 700 }}>×</button>
            </div>
          ))}
        </div>
      )}

      {formError && (
        <div style={{ padding: "10px 14px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 13, color: "#DC2626" }}>
          {formError}
        </div>
      )}
      <ModalFooter onCancel={onClose} onSubmit={handleSave} submitLabel="Créer la livraison" saving={saving} />
    </Modal>
  );
}

// ── Modal Update statut ───────────────────────────────────────────────────────
function StatutModal({ livraison, onClose, onSaved }) {
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
          {Object.entries(statusStyle).map(([key, val]) => (
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
              <span style={{ color: colors.navy, fontWeight: 600 }}>{l.medicament_nom}</span>
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
  const clients = relations.map((r) => r.client).filter(Boolean);
  const { data: medicaments } = useMedicaments(auth?.etablissement_id);
  const { toasts, success, error: toastError } = useToast();
  const [showNouvelle, setShowNouvelle] = useState(false);
  const [statutModal, setStatutModal] = useState(null);
  const [detailModal, setDetailModal] = useState(null);

  const filtered = livraisons;

  return (
    <Layout title="Livraisons" subtitle="Suivi des livraisons en temps réel">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <Toast toasts={toasts} />

      {showNouvelle && (
        <NouvelleModal
          clients={clients}
          medicaments={medicaments}
          distributeurId={auth?.etablissement_id}
          onClose={() => setShowNouvelle(false)}
          onSaved={() => { refetch(); success("Livraison créée avec succès"); }}
        />
      )}
      {statutModal && (
        <StatutModal
          livraison={statutModal}
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
              const dest = l.etablissements?.nom ?? "—";
              const lignes = l.livraison_lignes ?? [];
              return (
                <tr key={l.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "14px 16px", fontFamily: "monospace", color: colors.textSecondary, fontSize: 12 }}>{l.numero_suivi ?? "—"}</td>
                  <td style={{ padding: "14px 16px", fontWeight: 600, color: colors.navy }}>
                    {dest}
                    {l.etablissements?.ville && <div style={{ fontSize: 11, color: colors.textMuted }}>{l.etablissements.ville}</div>}
                  </td>
                  <td style={{ padding: "14px 16px", color: colors.textSecondary, fontSize: 12 }} title={lignes.map(x => `${x.medicament_nom} ×${x.quantite}`).join(", ")}>
                    {lignes.length === 0 ? "—" : `${lignes.length} produit${lignes.length > 1 ? "s" : ""}`}
                  </td>
                  <td style={{ padding: "14px 16px", color: colors.textSecondary }}>{l.transporteur ?? "—"}</td>
                  <td style={{ padding: "14px 16px", color: colors.textSecondary, fontSize: 12 }}>{fmt(l.date_depart)}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ padding: "3px 10px", backgroundColor: s.bg, color: s.color, borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{s.label}</span>
                  </td>
                  <td style={{ padding: "14px 16px", display: "flex", gap: 6, alignItems: "center" }}>
                    {l.statut !== "livree" && l.statut !== "incident" && (
                      <button
                        onClick={() => setStatutModal(l)}
                        style={{ padding: "4px 12px", backgroundColor: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                        Mettre à jour
                      </button>
                    )}
                    {l.statut === "livree" && (
                      <button
                        onClick={() => setDetailModal(l)}
                        style={{ padding: "4px 12px", backgroundColor: "#DCFCE7", color: "#16A34A", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                        Voir detail
                      </button>
                    )}
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
