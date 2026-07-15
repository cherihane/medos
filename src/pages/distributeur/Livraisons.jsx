import { colors } from "../../theme";
import { useState } from "react";
import Layout from "../../components/Layout";
import Modal, { Field, Row, ModalFooter, inputStyle, selectStyle } from "../../components/Modal";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useLivraisonsPaginated, useEtablissements } from "../../hooks/useSupabaseData";
import Pagination from "../../components/Pagination";
import { insertLivraison, updateLivraison, receiveLivraison, insertMouvementStock } from "../../hooks/useMutations";

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
function NouvelleModal({ etablissements, onClose, onSaved }) {
  const [form, setForm] = useState({
    etablissement_id: "", transporteur: "",
    date_depart: new Date().toISOString().slice(0, 10), date_arrivee_prevue: "",
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const set = (k) => (e) => { setFormError(null); setForm((f) => ({ ...f, [k]: e.target.value })); };

  const handleSave = async () => {
    if (!form.etablissement_id) { setFormError("Sélectionnez un établissement destinataire."); return; }
    setSaving(true);
    try {
      await insertLivraison({
        etablissement_id: form.etablissement_id,
        statut: "planifiee",
        transporteur: form.transporteur || null,
        numero_suivi: "LIV-" + Date.now().toString().slice(-8),
        date_depart: form.date_depart || null,
        date_arrivee_prevue: form.date_arrivee_prevue || null,
      });
      onSaved();
      onClose();
    } catch (e) {
      setFormError("Erreur : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Nouvelle livraison" onClose={onClose}>
      <Field label="Destinataire *">
        <select style={selectStyle} value={form.etablissement_id} onChange={set("etablissement_id")}>
          <option value="">— Sélectionner un établissement —</option>
          {etablissements.map((e) => <option key={e.id} value={e.id}>{e.nom} ({e.ville})</option>)}
        </select>
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
  const [statut, setStatut] = useState(livraison.statut);
  const [lignesLivraison, setLignesLivraison] = useState([{ nom: "", quantite: "" }]);
  const [stockWarn, setStockWarn] = useState(null);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState(null);

  function addLigneL() { setLignesLivraison((prev) => [...prev, { nom: "", quantite: "" }]); }
  function updateLigneL(i, key, val) { setLignesLivraison((prev) => prev.map((l, idx) => idx === i ? { ...l, [key]: val } : l)); }
  function removeLigneL(i) { setLignesLivraison((prev) => prev.filter((_, idx) => idx !== i)); }

  const handleSave = async () => {
    setSaving(true);
    setStockWarn(null);
    try {
      const update = { statut };
      if (statut === "livree") {
        update.date_arrivee_reelle = new Date().toISOString();
        const lignesValides = lignesLivraison.filter((l) => l.nom.trim() && parseInt(l.quantite) > 0);
        const lignesResults = [];

        for (const ligne of lignesValides) {
          const res = await receiveLivraison(ligne.nom.trim(), parseInt(ligne.quantite), livraison.etablissement_id);
          const status = res === "ok" ? "ok" : "introuvable";
          lignesResults.push({ nom: ligne.nom.trim(), quantite: parseInt(ligne.quantite), status });

          if (status === "ok") {
            try {
              await insertMouvementStock({
                etablissement_id: livraison.etablissement_id,
                medicament_nom: ligne.nom.trim(),
                type: "entree",
                quantite: parseInt(ligne.quantite),
                motif: "Livraison recue — N° " + livraison.numero_suivi,
                created_at: new Date().toISOString(),
              });
            } catch (_) {}
          }
        }

        update.lignes_livrees = JSON.stringify(lignesValides);
        update.quantite_livree = lignesValides.reduce((s, l) => s + (parseInt(l.quantite) || 0), 0);
        await updateLivraison(livraison.id, update);
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
            Renseignez les medicaments livres pour incrementer le stock du destinataire.
          </div>
          {lignesLivraison.map((l, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
              <input
                value={l.nom}
                onChange={(e) => updateLigneL(i, "nom", e.target.value)}
                placeholder="Nom du medicament"
                style={{ ...inputStyle, flex: 2 }}
              />
              <input
                type="number"
                min="1"
                value={l.quantite}
                onChange={(e) => updateLigneL(i, "quantite", e.target.value)}
                placeholder="Qte"
                style={{ ...inputStyle, width: 80, flex: "none" }}
              />
              {lignesLivraison.length > 1 && (
                <button type="button" onClick={() => removeLigneL(i)}
                  style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 18, fontWeight: 700, padding: "0 4px" }}>
                  ×
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addLigneL}
            style={{ fontSize: 11, padding: "4px 12px", borderRadius: 6, backgroundColor: "#FEF3C7", color: "#92400E", border: "1px solid #F59E0B", cursor: "pointer", fontWeight: 600, marginTop: 4 }}>
            + Ajouter un medicament
          </button>
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
  const [filter, setFilter] = useState("tous");
  const { data: livraisons, loading, error, total, page, setPage, totalPages, refetch } = useLivraisonsPaginated(filter);
  const { data: etablissements } = useEtablissements();
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
          etablissements={etablissements}
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
              {["N° Suivi", "Destinataire", "Transporteur", "Départ", "Arrivée prévue", "Statut", "Actions"].map((h) => (
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
              const s = statusStyle[l.statut] ?? statusStyle.preparation;
              const dest = l.etablissements?.nom ?? "—";
              return (
                <tr key={l.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "14px 16px", fontFamily: "monospace", color: colors.textSecondary, fontSize: 12 }}>{l.numero_suivi ?? "—"}</td>
                  <td style={{ padding: "14px 16px", fontWeight: 600, color: colors.navy }}>
                    {dest}
                    {l.etablissements?.ville && <div style={{ fontSize: 11, color: colors.textMuted }}>{l.etablissements.ville}</div>}
                  </td>
                  <td style={{ padding: "14px 16px", color: colors.textSecondary }}>{l.transporteur ?? "—"}</td>
                  <td style={{ padding: "14px 16px", color: colors.textSecondary, fontSize: 12 }}>{fmt(l.date_depart)}</td>
                  <td style={{ padding: "14px 16px", color: colors.textSecondary, fontSize: 12 }}>{fmt(l.date_arrivee_prevue)}</td>
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
