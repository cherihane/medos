import { useState } from "react";
import Layout from "../../components/Layout";
import Modal, { Field, Row, ModalFooter, inputStyle, selectStyle } from "../../components/Modal";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useMedicaments, useFournisseurs } from "../../hooks/useSupabaseData";
import { updateMedicament, insertMedicament, insertCommande } from "../../hooks/useMutations";

function getStatut(med) {
  if (!med.stock_minimum || med.stock_minimum === 0) return "normal";
  const ratio = med.stock_actuel / med.stock_minimum;
  if (ratio <= 0.2) return "critique";
  if (ratio <= 0.5) return "alerte";
  return "normal";
}

const statusStyle = {
  critique: { bg: "#FEF2F2", color: "#EF4444", label: "Critique" },
  alerte:   { bg: "#FFFBEB", color: "#F59E0B", label: "Alerte"   },
  normal:   { bg: "#DCFCE7", color: "#16A34A", label: "Normal"   },
};

function SkeletonRow() {
  return (
    <tr style={{ borderBottom: "1px solid #F3F4F6", animation: "pulse 1.5s ease-in-out infinite" }}>
      {[80, 160, 90, 60, 100, 120, 80, 70, 100].map((w, i) => (
        <td key={i} style={{ padding: "13px 16px" }}>
          <div style={{ height: 13, width: w, backgroundColor: "#F3F4F6", borderRadius: 6 }} />
        </td>
      ))}
    </tr>
  );
}

// ── Modal Éditer ──────────────────────────────────────────────────────────────
function EditModal({ med, onClose, onSaved }) {
  const [form, setForm] = useState({
    nom:           med.nom           ?? "",
    stock_actuel:  med.stock_actuel  ?? 0,
    stock_minimum: med.stock_minimum ?? 0,
    prix_unitaire: med.prix_unitaire ?? 0,
    categorie:     med.categorie     ?? "",
    forme:         med.forme         ?? "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMedicament(med.id, {
        nom:           form.nom,
        stock_actuel:  Number(form.stock_actuel),
        stock_minimum: Number(form.stock_minimum),
        prix_unitaire: Number(form.prix_unitaire),
        categorie:     form.categorie,
        forme:         form.forme,
      });
      onSaved();
      onClose();
    } catch (e) {
      alert("Erreur : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Éditer — ${med.nom}`} onClose={onClose}>
      <Field label="Nom du médicament">
        <input style={inputStyle} value={form.nom} onChange={set("nom")} />
      </Field>
      <Row>
        <Field label="Stock actuel">
          <input style={inputStyle} type="number" min="0" value={form.stock_actuel} onChange={set("stock_actuel")} />
        </Field>
        <Field label="Seuil minimum">
          <input style={inputStyle} type="number" min="0" value={form.stock_minimum} onChange={set("stock_minimum")} />
        </Field>
      </Row>
      <Row>
        <Field label="Prix unitaire (FCFA)">
          <input style={inputStyle} type="number" min="0" value={form.prix_unitaire} onChange={set("prix_unitaire")} />
        </Field>
        <Field label="Catégorie">
          <input style={inputStyle} value={form.categorie} onChange={set("categorie")} placeholder="Ex: Antibiotiques" />
        </Field>
      </Row>
      <Field label="Forme galénique">
        <select style={selectStyle} value={form.forme} onChange={set("forme")}>
          <option value="">— Sélectionner —</option>
          {["Comprimé", "Gélule", "Sirop", "Injectable", "Crème", "Suppositoire", "Patch"].map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </Field>
      <ModalFooter onCancel={onClose} onSubmit={handleSave} submitLabel="Sauvegarder" saving={saving} />
    </Modal>
  );
}

// ── Modal Commander ───────────────────────────────────────────────────────────
function CommanderModal({ med, fournisseurs, onClose, onSaved }) {
  const [form, setForm] = useState({
    fournisseur_id:        fournisseurs[0]?.id ?? "",
    quantite:              med.stock_minimum ?? 100,
    date_livraison_prevue: "",
    notes:                 "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.fournisseur_id) return alert("Veuillez sélectionner un fournisseur.");
    setSaving(true);
    try {
      await insertCommande({
        fournisseur_id:        form.fournisseur_id,
        statut:                "en_attente",
        date_commande:         new Date().toISOString(),
        date_livraison_prevue: form.date_livraison_prevue || null,
        notes:                 `${med.nom} — Qté : ${form.quantite}${form.notes ? " — " + form.notes : ""}`,
        montant_total:         0,
      });
      onSaved();
      onClose();
    } catch (e) {
      alert("Erreur : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Commander — ${med.nom}`} onClose={onClose}>
      <Field label="Fournisseur">
        <select style={selectStyle} value={form.fournisseur_id} onChange={set("fournisseur_id")}>
          <option value="">— Sélectionner —</option>
          {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
        </select>
      </Field>
      <Row>
        <Field label="Quantité à commander">
          <input style={inputStyle} type="number" min="1" value={form.quantite} onChange={set("quantite")} />
        </Field>
        <Field label="Date livraison souhaitée">
          <input style={inputStyle} type="date" value={form.date_livraison_prevue} onChange={set("date_livraison_prevue")} />
        </Field>
      </Row>
      <Field label="Notes (optionnel)">
        <input style={inputStyle} value={form.notes} onChange={set("notes")} placeholder="Instructions particulières…" />
      </Field>
      <ModalFooter onCancel={onClose} onSubmit={handleSave} submitLabel="Passer la commande" saving={saving} />
    </Modal>
  );
}

// ── Modal Nouveau produit ──────────────────────────────────────────────────────
function NouveauModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    nom: "", code: "", categorie: "", forme: "",
    stock_actuel: 0, stock_minimum: 0,
    prix_achat: 0, prix_unitaire: 0,
    fabricant: "", dci: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.nom.trim()) return alert("Le nom est obligatoire.");
    setSaving(true);
    try {
      await insertMedicament({
        nom:           form.nom,
        code:          form.code || null,
        categorie:     form.categorie || null,
        forme:         form.forme || null,
        stock_actuel:  Number(form.stock_actuel),
        stock_minimum: Number(form.stock_minimum),
        prix_achat:    Number(form.prix_achat),
        prix_unitaire: Number(form.prix_unitaire),
        fabricant:     form.fabricant || null,
        dci:           form.dci || null,
      });
      onSaved();
      onClose();
    } catch (e) {
      alert("Erreur : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Nouveau médicament" onClose={onClose} width={600}>
      <Row>
        <Field label="Nom *">
          <input style={inputStyle} value={form.nom} onChange={set("nom")} placeholder="Ex: Amoxicilline 500mg" />
        </Field>
        <Field label="Code">
          <input style={inputStyle} value={form.code} onChange={set("code")} placeholder="Ex: AMX-500" />
        </Field>
      </Row>
      <Row>
        <Field label="DCI (principe actif)">
          <input style={inputStyle} value={form.dci} onChange={set("dci")} />
        </Field>
        <Field label="Fabricant">
          <input style={inputStyle} value={form.fabricant} onChange={set("fabricant")} />
        </Field>
      </Row>
      <Row>
        <Field label="Catégorie">
          <input style={inputStyle} value={form.categorie} onChange={set("categorie")} placeholder="Ex: Antibiotiques" />
        </Field>
        <Field label="Forme galénique">
          <select style={selectStyle} value={form.forme} onChange={set("forme")}>
            <option value="">— Sélectionner —</option>
            {["Comprimé", "Gélule", "Sirop", "Injectable", "Crème", "Suppositoire", "Patch"].map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </Field>
      </Row>
      <Row>
        <Field label="Stock initial">
          <input style={inputStyle} type="number" min="0" value={form.stock_actuel} onChange={set("stock_actuel")} />
        </Field>
        <Field label="Seuil minimum">
          <input style={inputStyle} type="number" min="0" value={form.stock_minimum} onChange={set("stock_minimum")} />
        </Field>
      </Row>
      <Row>
        <Field label="Prix d'achat (FCFA)">
          <input style={inputStyle} type="number" min="0" value={form.prix_achat} onChange={set("prix_achat")} />
        </Field>
        <Field label="Prix de vente (FCFA)">
          <input style={inputStyle} type="number" min="0" value={form.prix_unitaire} onChange={set("prix_unitaire")} />
        </Field>
      </Row>
      <ModalFooter onCancel={onClose} onSubmit={handleSave} submitLabel="Ajouter le médicament" saving={saving} />
    </Modal>
  );
}

export default function Inventaire() {
  const { data: medicaments, loading, error, refetch } = useMedicaments();
  const { data: fournisseurs } = useFournisseurs();
  const { toasts, success } = useToast();
  const [filter, setFilter] = useState("tous");
  const [search, setSearch] = useState("");
  const [editMed, setEditMed] = useState(null);
  const [commandMed, setCommandMed] = useState(null);
  const [showNouveau, setShowNouveau] = useState(false);

  const enriched = medicaments.map((m) => ({ ...m, statut: getStatut(m) }));
  const filtered = enriched.filter((m) => {
    const matchSearch = m.nom.toLowerCase().includes(search.toLowerCase())
      || (m.categorie || "").toLowerCase().includes(search.toLowerCase())
      || (m.code || "").toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "tous" || m.statut === filter;
    return matchSearch && matchFilter;
  });

  const counts = {
    total:    enriched.length,
    critique: enriched.filter((m) => m.statut === "critique").length,
    alerte:   enriched.filter((m) => m.statut === "alerte").length,
    normal:   enriched.filter((m) => m.statut === "normal").length,
  };

  const handleEditSaved = () => { refetch(); success("Médicament mis à jour avec succès"); };
  const handleCommandSaved = () => { refetch(); success("Commande passée avec succès"); };
  const handleNouveauSaved = () => { refetch(); success("Médicament ajouté à l'inventaire"); };

  return (
    <Layout title="Inventaire Produits" subtitle="Gestion du stock et des niveaux de réapprovisionnement">
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      <Toast toasts={toasts} />

      {editMed && (
        <EditModal
          med={editMed}
          onClose={() => setEditMed(null)}
          onSaved={handleEditSaved}
        />
      )}
      {commandMed && (
        <CommanderModal
          med={commandMed}
          fournisseurs={fournisseurs}
          onClose={() => setCommandMed(null)}
          onSaved={handleCommandSaved}
        />
      )}
      {showNouveau && (
        <NouveauModal
          onClose={() => setShowNouveau(false)}
          onSaved={handleNouveauSaved}
        />
      )}

      {/* ── Barre de filtres ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {["tous", "normal", "alerte", "critique"].map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
              border: filter === f ? "2px solid #3B82F6" : "1.5px solid #E5E7EB",
              backgroundColor: filter === f ? "#EFF6FF" : "white",
              color: filter === f ? "#2563EB" : "#6B7280",
              textTransform: "capitalize",
            }}>
              {f}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "8px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 13, outline: "none", width: 220 }}
          />
          <button
            onClick={() => setShowNouveau(true)}
            style={{ padding: "8px 16px", backgroundColor: "#3B82F6", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            + Nouveau produit
          </button>
        </div>
      </div>

      {/* ── KPI mini ── */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total produits",  value: loading ? "…" : counts.total,    color: "#3B82F6" },
          { label: "Stock critique",  value: loading ? "…" : counts.critique,  color: "#EF4444" },
          { label: "En alerte",       value: loading ? "…" : counts.alerte,    color: "#F59E0B" },
          { label: "Stock normal",    value: loading ? "…" : counts.normal,    color: "#10B981" },
        ].map((s) => (
          <div key={s.label} style={{ backgroundColor: "white", padding: "14px 20px", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${s.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "14px 18px", marginBottom: 20, fontSize: 13, color: "#DC2626" }}>
          Erreur de connexion Supabase : {error.message}
        </div>
      )}

      {/* ── Tableau ── */}
      <div style={{ backgroundColor: "white", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: "#F8FAFC" }}>
              {["Code", "Produit", "Catégorie", "Stock", "Seuil min", "Prix unitaire", "Forme", "Statut", "Actions"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6B7280", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && [1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}
            {!loading && !error && filtered.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: "40px", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
                  {search || filter !== "tous" ? "Aucun médicament correspond aux filtres" : "Aucun médicament dans la base de données"}
                </td>
              </tr>
            )}
            {!loading && filtered.map((m) => {
              const s = statusStyle[m.statut];
              const stockColor = m.statut === "critique" ? "#EF4444" : m.statut === "alerte" ? "#F59E0B" : "#374151";
              return (
                <tr key={m.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "13px 16px", color: "#9CA3AF", fontSize: 12, fontFamily: "monospace" }}>{m.code || "—"}</td>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ fontWeight: 600, color: "#0A1628" }}>{m.nom}</div>
                    {m.dci && <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>{m.dci}</div>}
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ padding: "3px 10px", backgroundColor: "#EFF6FF", color: "#2563EB", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>
                      {m.categorie || "—"}
                    </span>
                  </td>
                  <td style={{ padding: "13px 16px", fontWeight: 800, color: stockColor, fontSize: 15 }}>{m.stock_actuel ?? "—"}</td>
                  <td style={{ padding: "13px 16px", color: "#6B7280", fontSize: 12 }}>{m.stock_minimum ?? "—"}</td>
                  <td style={{ padding: "13px 16px", color: "#374151" }}>
                    {m.prix_unitaire != null ? `${m.prix_unitaire.toLocaleString()} FCFA` : "—"}
                  </td>
                  <td style={{ padding: "13px 16px", color: "#6B7280" }}>{m.forme || "—"}</td>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ padding: "3px 10px", backgroundColor: s.bg, color: s.color, borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{s.label}</span>
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => setEditMed(m)}
                        style={{ padding: "4px 10px", backgroundColor: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                        Éditer
                      </button>
                      <button
                        onClick={() => setCommandMed(m)}
                        style={{ padding: "4px 10px", backgroundColor: "#DCFCE7", color: "#16A34A", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                        Commander
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
