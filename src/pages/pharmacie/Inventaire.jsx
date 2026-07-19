import { colors } from "../../theme";
import { useState, useMemo } from "react";
import Layout from "../../components/Layout";
import Modal, { Field, Row, ModalFooter, inputStyle, selectStyle } from "../../components/Modal";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useMedicamentsPaginated, useMedicamentStats, useFournisseurs } from "../../hooks/useSupabaseData";
import { updateMedicament, insertMedicament, insertCommande, upsertMedicaments } from "../../hooks/useMutations";
import Pagination from "../../components/Pagination";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { useAuth } from "../../context/AuthContext";
import QrScanner from "../../components/QrScanner";

const FORMES_GALENIQUES = ["Comprimé", "Gélule", "Sirop", "Injectable", "Crème", "Suppositoire", "Patch"];

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
    <tr style={{ borderBottom: "1px solid var(--border-light)", animation: "pulse 1.5s ease-in-out infinite" }}>
      {[80, 160, 90, 60, 100, 120, 80, 70, 100].map((w, i) => (
        <td key={i} style={{ padding: "13px 16px" }}>
          <div style={{ height: 13, width: w, backgroundColor: colors.borderLight, borderRadius: 6 }} />
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
    date_peremption: med.date_peremption ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const set = (k) => (e) => { setFormError(null); setForm((f) => ({ ...f, [k]: e.target.value })); };

  const handleSave = async () => {
    if (!form.nom.trim()) { setFormError("Le nom du médicament est obligatoire."); return; }
    if (Number(form.stock_actuel) < 0) { setFormError("Le stock actuel ne peut pas être négatif."); return; }
    setSaving(true);
    try {
      await updateMedicament(med.id, {
        nom:           form.nom.trim(),
        stock_actuel:  Number(form.stock_actuel),
        stock_minimum: Number(form.stock_minimum),
        prix_unitaire: Number(form.prix_unitaire),
        categorie:     form.categorie,
        forme:         form.forme,
        date_peremption: form.date_peremption || null,
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
    <Modal title={`Éditer — ${med.nom}`} onClose={onClose}>
      <Field label="Nom du médicament *">
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
      <Row>
        <Field label="Forme galénique">
          <select style={selectStyle} value={form.forme} onChange={set("forme")}>
            <option value="">— Sélectionner —</option>
            {FORMES_GALENIQUES.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </Field>
        <Field label="Date de péremption">
          <input style={inputStyle} type="date" value={form.date_peremption ?? ""} onChange={set("date_peremption")} />
        </Field>
      </Row>
      {formError && (
        <div style={{ padding: "10px 14px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 13, color: "#DC2626" }}>
          {formError}
        </div>
      )}
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
  const [formError, setFormError] = useState(null);
  const set = (k) => (e) => { setFormError(null); setForm((f) => ({ ...f, [k]: e.target.value })); };

  const handleSave = async () => {
    if (!form.fournisseur_id) { setFormError("Veuillez sélectionner un fournisseur."); return; }
    if (Number(form.quantite) <= 0) { setFormError("La quantité doit être supérieure à 0."); return; }
    setSaving(true);
    try {
      await insertCommande({
        fournisseur_id:        form.fournisseur_id,
        statut:                "envoyee",
        date_commande:         new Date().toISOString(),
        date_livraison_prevue: form.date_livraison_prevue || null,
        notes:                 `${med.nom} — Qté : ${form.quantite}${form.notes ? " — " + form.notes : ""}`,
        montant_total:         0,
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
      {formError && (
        <div style={{ padding: "10px 14px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 13, color: "#DC2626" }}>
          {formError}
        </div>
      )}
      <ModalFooter onCancel={onClose} onSubmit={handleSave} submitLabel="Passer la commande" saving={saving} />
    </Modal>
  );
}

// ── Modal Nouveau produit ──────────────────────────────────────────────────────
function NouveauModal({ onClose, onSaved }) {
  const { auth } = useAuth();
  const { success, error: showError } = useToast();
  const [form, setForm] = useState({
    nom: "", code: "", categorie: "", forme: "",
    stock_actuel: 0, stock_minimum: 0,
    prix_achat: 0, prix_unitaire: 0,
    fabricant: "", dci: "", date_peremption: "",
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [showInlineScanner, setShowInlineScanner] = useState(false);
  const set = (k) => (e) => { setFormError(null); setForm((f) => ({ ...f, [k]: e.target.value })); };

  const handleSave = async () => {
    if (!form.nom.trim()) { setFormError("Le nom du médicament est obligatoire."); return; }
    if (Number(form.stock_actuel) < 0) { setFormError("Le stock initial ne peut pas être négatif."); return; }
    setSaving(true);
    try {
      await insertMedicament({
        nom:              form.nom.trim(),
        code:             form.code || null,
        categorie:        form.categorie || null,
        forme:            form.forme || null,
        stock_actuel:     Number(form.stock_actuel),
        stock_minimum:    Number(form.stock_minimum),
        prix_achat:       Number(form.prix_achat),
        prix_unitaire:    Number(form.prix_unitaire),
        fabricant:        form.fabricant || null,
        dci:              form.dci || null,
        date_peremption:  form.date_peremption || null,
        etablissement_id: auth?.etablissement_id ?? null,
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
    <Modal title="Nouveau médicament" onClose={onClose} width={600}>
      <Row>
        <Field label="Nom *">
          <input style={inputStyle} value={form.nom} onChange={set("nom")} placeholder="Ex: Amoxicilline 500mg" />
        </Field>
        <Field label="Code-barres / QR Code">
          <div style={{ display: "flex", gap: 8 }}>
            <input style={{ ...inputStyle, flex: 1 }} value={form.code} onChange={set("code")} placeholder="Ex: 3400935959691" />
            <button type="button" onClick={() => setShowInlineScanner(true)} style={{ padding: "8px 14px", borderRadius: 8, border: `1.5px solid ${colors.border}`, backgroundColor: colors.bgSurface, cursor: "pointer", fontSize: 12, fontWeight: 600, color: colors.navy, whiteSpace: "nowrap" }}>
              Scanner
            </button>
          </div>
          {showInlineScanner && (
            <div style={{ marginTop: 8 }}>
              <QrScanner
                onScan={(text) => {
                  setForm((f) => ({ ...f, code: text ?? "" }));
                  setShowInlineScanner(false);
                  success("Code scanne : " + text);
                }}
                onClose={() => setShowInlineScanner(false)}
              />
              <button type="button" onClick={() => setShowInlineScanner(false)} style={{ marginTop: 6, fontSize: 12, color: colors.textMuted, background: "none", border: "none", cursor: "pointer" }}>
                Annuler le scan
              </button>
            </div>
          )}
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
            {FORMES_GALENIQUES.map((f) => (
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
      <Field label="Date de péremption">
        <input style={inputStyle} type="date" value={form.date_peremption} onChange={set("date_peremption")} />
      </Field>
      {formError && (
        <div style={{ padding: "10px 14px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 13, color: "#DC2626" }}>
          {formError}
        </div>
      )}
      <ModalFooter onCancel={onClose} onSubmit={handleSave} submitLabel="Ajouter le médicament" saving={saving} />
    </Modal>
  );
}

// ── Modal Import CSV/Excel ────────────────────────────────────────────────────
const CSV_COLS = ["nom", "categorie", "stock_actuel", "stock_minimum", "prix_achat", "prix_unitaire", "date_peremption"];

function parseRows(rawRows) {
  return rawRows
    .filter((r) => r.nom && r.nom.trim())
    .map((r) => ({
      nom:            r.nom?.trim() ?? "",
      categorie:      r.categorie?.trim() || null,
      stock_actuel:   parseInt(r.stock_actuel ?? r.stock ?? 0, 10) || 0,
      stock_minimum:  parseInt(r.stock_minimum ?? r.minimum ?? 0, 10) || 0,
      prix_unitaire:  parseFloat(r.prix_unitaire ?? r.prix_vente ?? 0) || 0,
      date_peremption: r.date_peremption || null,
    }));
}

function ImportModal({ auth, onClose, onImported }) {
  const [preview, setPreview] = useState(null);
  const [rows, setRows]       = useState([]);
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    const ext = file.name.split(".").pop().toLowerCase();

    if (ext === "csv") {
      Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: (res) => { const parsed = parseRows(res.data); setRows(parsed); setPreview(parsed.slice(0, 5)); },
        error: (er) => setErr("Erreur CSV : " + er.message),
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const wb = XLSX.read(ev.target.result, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(ws, { defval: "" });
          const parsed = parseRows(data);
          setRows(parsed);
          setPreview(parsed.slice(0, 5));
        } catch (e) { setErr("Erreur Excel : " + e.message); }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setErr("Format non supporté. Utilisez CSV ou XLSX.");
    }
  };

  const handleImport = async () => {
    if (rows.length === 0) return;
    setSaving(true);
    setErr(null);
    try {
      const payload = rows.map((r) => ({
        ...r,
        etablissement_id: auth?.etablissement_id ?? null,
      }));
      await upsertMedicaments(payload);
      onImported(rows.length);
      onClose();
    } catch (e) {
      setErr("Erreur import : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Importer un inventaire CSV / Excel" onClose={onClose} width={640}>
      <p style={{ fontSize: 12, color: colors.textSecondary, margin: "0 0 14px" }}>
        Colonnes attendues : <code style={{ backgroundColor: colors.borderLight, padding: "1px 5px", borderRadius: 4, fontSize: 11 }}>nom, catégorie, stock_actuel, stock_minimum, prix_unitaire, date_peremption</code>
      </p>
      <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} style={{ fontSize: 13, marginBottom: 14 }} />
      {err && <div style={{ fontSize: 12, color: "#EF4444", backgroundColor: "#FEF2F2", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>{err}</div>}
      {preview && preview.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: colors.text, marginBottom: 8 }}>
            Aperçu — {rows.length} ligne{rows.length !== 1 ? "s" : ""} détectée{rows.length !== 1 ? "s" : ""}
          </div>
          <div className="table-scroll">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ backgroundColor: colors.bgSurface }}>
                  {["Nom", "Catégorie", "Stock", "Minimum", "Prix unitaire", "Péremption"].map((h) => (
                    <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600, color: colors.textSecondary, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border-light)" }}>
                    <td style={{ padding: "6px 10px", fontWeight: 600 }}>{r.nom}</td>
                    <td style={{ padding: "6px 10px", color: colors.textSecondary }}>{r.categorie ?? "—"}</td>
                    <td style={{ padding: "6px 10px" }}>{r.stock_actuel}</td>
                    <td style={{ padding: "6px 10px" }}>{r.stock_minimum}</td>
                    <td style={{ padding: "6px 10px" }}>{r.prix_unitaire.toLocaleString()} FCFA</td>
                    <td style={{ padding: "6px 10px", color: colors.textSecondary }}>{r.date_peremption ?? "—"}</td>
                  </tr>
                ))}
                {rows.length > 5 && (
                  <tr>
                    <td colSpan={6} style={{ padding: "6px 10px", color: colors.textMuted, fontSize: 11 }}>… et {rows.length - 5} autre{rows.length - 5 !== 1 ? "s" : ""} ligne{rows.length - 5 !== 1 ? "s" : ""}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <ModalFooter
        onCancel={onClose}
        onSubmit={handleImport}
        submitLabel={`Importer${rows.length > 0 ? " " + rows.length + " produits" : ""}`}
        saving={saving}
      />
    </Modal>
  );
}

export default function Inventaire() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("tous");
  const { data: medicaments, loading, error, total, page, setPage, totalPages, refetch } = useMedicamentsPaginated(search);
  const { data: statsData } = useMedicamentStats();
  const { data: fournisseurs } = useFournisseurs();
  const { toasts, success } = useToast();
  const { auth } = useAuth();
  const [editMed, setEditMed] = useState(null);
  const [commandMed, setCommandMed] = useState(null);
  const [showNouveau, setShowNouveau] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // KPI globaux calculés sur toutes les lignes (stock_actuel + stock_minimum seulement)
  const counts = useMemo(() => {
    const all = statsData.map((m) => ({ ...m, statut: getStatut(m) }));
    return {
      total:    all.length,
      critique: all.filter((m) => m.statut === "critique").length,
      alerte:   all.filter((m) => m.statut === "alerte").length,
      normal:   all.filter((m) => m.statut === "normal").length,
    };
  }, [statsData]);

  // Filtre de statut appliqué côté client sur la page courante (20 items)
  const enriched = medicaments.map((m) => ({ ...m, statut: getStatut(m) }));
  const filtered = filter === "tous" ? enriched : enriched.filter((m) => m.statut === filter);

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
      {showImport && (
        <ImportModal
          auth={auth}
          onClose={() => setShowImport(false)}
          onImported={(n) => { refetch(); success(`${n} produit${n !== 1 ? "s" : ""} importé${n !== 1 ? "s" : ""}`); }}
        />
      )}

      {/* ── Barre de filtres ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {["tous", "normal", "alerte", "critique"].map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
              border: filter === f ? "2px solid #3B82F6" : "1.5px solid var(--border)",
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
            style={{ padding: "8px 14px", border: "1.5px solid var(--border)", borderRadius: 10, fontSize: 13, outline: "none", width: 220 }}
          />
          <button
            onClick={() => setShowImport(true)}
            style={{ padding: "8px 16px", backgroundColor: "#F59E0B", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Importer CSV/Excel
          </button>
          <button
            onClick={() => setShowNouveau(true)}
            style={{ padding: "8px 16px", backgroundColor: "#3B82F6", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            + Nouveau produit
          </button>
        </div>
      </div>

      {/* ── KPI mini ── */}
      <div className="kpi-row">
        {[
          { label: "Total produits",  value: loading ? "…" : counts.total,    color: "#3B82F6" },
          { label: "Stock critique",  value: loading ? "…" : counts.critique,  color: "#EF4444" },
          { label: "En alerte",       value: loading ? "…" : counts.alerte,    color: "#F59E0B" },
          { label: "Stock normal",    value: loading ? "…" : counts.normal,    color: "#10B981" },
        ].map((s) => (
          <div key={s.label} style={{ backgroundColor: colors.bgCard, padding: "14px 20px", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${s.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{s.label}</div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "14px 18px", marginBottom: 20, fontSize: 13, color: "#DC2626" }}>
          Impossible de charger les données. Veuillez réessayer.
        </div>
      )}

      {/* ── Tableau ── */}
      <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div className="table-scroll"><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: colors.bgSurface }}>
              {["Code", "Produit", "Catégorie", "Stock", "Seuil min", "Prix unitaire", "Forme", "Statut", "Actions"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: colors.textSecondary, borderBottom: "1px solid var(--border)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && [1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}
            {!loading && !error && filtered.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: "40px", textAlign: "center", color: colors.textMuted, fontSize: 13 }}>
                  {search || filter !== "tous" ? "Aucun médicament correspond aux filtres" : "Aucun médicament dans la base de données"}
                </td>
              </tr>
            )}
            {!loading && filtered.map((m) => {
              const s = statusStyle[m.statut];
              const stockColor = m.statut === "critique" ? "#EF4444" : m.statut === "alerte" ? "#F59E0B" : "#374151";
              return (
                <tr key={m.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "13px 16px", color: colors.textMuted, fontSize: 12, fontFamily: "monospace" }}>{m.code || "—"}</td>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ fontWeight: 600, color: colors.navy }}>{m.nom}</div>
                    {m.dci && <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>{m.dci}</div>}
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ padding: "3px 10px", backgroundColor: "#EFF6FF", color: "#2563EB", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>
                      {m.categorie || "—"}
                    </span>
                  </td>
                  <td style={{ padding: "13px 16px", fontWeight: 800, color: stockColor, fontSize: 15 }}>{m.stock_actuel ?? "—"}</td>
                  <td style={{ padding: "13px 16px", color: colors.textSecondary, fontSize: 12 }}>{m.stock_minimum ?? "—"}</td>
                  <td style={{ padding: "13px 16px", color: colors.text }}>
                    {m.prix_unitaire != null ? `${m.prix_unitaire.toLocaleString()} FCFA` : "—"}
                  </td>
                  <td style={{ padding: "13px 16px", color: colors.textSecondary }}>{m.forme || "—"}</td>
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
        </table></div>
        <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
      </div>
    </Layout>
  );
}
