import { colors } from "../../theme";
import { useState, useEffect, useCallback, useRef } from "react";
import Layout from "../../components/Layout";
import Modal, { Field, Row, ModalFooter, inputStyle, selectStyle } from "../../components/Modal";
import Toast from "../../components/Toast";
import QrScanner from "../../components/QrScanner";
import { useToast } from "../../hooks/useToast";
import { useMedicaments, useFournisseurs } from "../../hooks/useSupabaseData";
import { insertMouvementStock, fetchMouvementsStock, incrementStock, decrementStock } from "../../hooks/useMutations";
import { rechercherLotPourPrefill } from "../../hooks/useVerificationLot";
import { useAuth } from "../../context/AuthContext";
import { useThemeTokens } from "../../context/DarkModeContext";

function fmt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function todayISO() { return new Date().toISOString().slice(0, 10); }

function Skeleton() {
  return [1, 2, 3, 4, 5].map((i) => (
    <tr key={i} style={{ borderBottom: "1px solid var(--border-light)", animation: "pulse 1.5s ease-in-out infinite" }}>
      {[140, 80, 60, 80, 120, 90, 100].map((w, j) => (
        <td key={j} style={{ padding: "13px 16px" }}>
          <div style={{ height: 13, width: w, backgroundColor: colors.borderLight, borderRadius: 6 }} />
        </td>
      ))}
    </tr>
  ));
}

// ── Modal Nouvelle réception (scan multi-produits + ajout manuel) ─────────────
function ReceptionModal({ medicaments, fournisseurs, auth, onClose, onSaved }) {
  const [header, setHeader] = useState({
    numero_bl: "",
    fournisseur: "",
    motif: "Reception commande",
  });
  const [cart, setCart] = useState([]); // { tempId, medicament_id, nom, quantite }
  const [showScanner, setShowScanner] = useState(false);
  const [scannerKey, setScannerKey] = useState(0);
  const [scanMsg, setScanMsg] = useState(null); // { ok: bool, text: string }
  const [manualMedId, setManualMedId] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const scanLockRef = useRef(false); // évite les décodages multiples d'un même scan (voir handleScan)
  const setHeaderField = (k) => (e) => setHeader((f) => ({ ...f, [k]: e.target.value }));

  const focusQuantite = (tempId) => {
    setTimeout(() => document.getElementById(`cart-qty-${tempId}`)?.focus(), 60);
  };

  // Le updater de setCart doit rester pur (React 18 StrictMode l'invoque deux fois
  // en dev) : le tempId est généré et le focus déclenché en dehors du updater,
  // jamais à l'intérieur — sinon compteur et focus se désynchronisent (observé
  // en test : id "cart-qty-2" généré pour le tout premier article ajouté).
  const addOrIncrementCart = (medicament_id, nom) => {
    const existing = cart.find((it) => it.medicament_id === medicament_id);
    if (existing) {
      setCart((c) => c.map((it) => it.medicament_id === medicament_id ? { ...it, quantite: it.quantite + 1 } : it));
      focusQuantite(existing.tempId);
      return;
    }
    const tempId = crypto.randomUUID();
    setCart((c) => [...c, { tempId, medicament_id, nom, quantite: 1 }]);
    focusQuantite(tempId);
  };

  const handleScan = async (text) => {
    // html5-qrcode peut invoquer ce callback plusieurs fois pour un seul scan
    // physique (le temps que stop() prenne effet, la même étiquette reste dans
    // le champ et redéclenche un décodage) : verrou synchrone pour n'en traiter
    // qu'un seul par session caméra — observé en test avec des dizaines de
    // décodages en rafale sans ce garde-fou.
    if (scanLockRef.current) return;
    scanLockRef.current = true;
    setShowScanner(false);
    const infos = await rechercherLotPourPrefill(text).catch(() => null);
    if (infos && infos.medicament_id) {
      addOrIncrementCart(infos.medicament_id, infos.nom || "Médicament");
      setScanMsg({ ok: true, text: `✓ ${infos.nom} ajouté à la réception.` });
    } else {
      setScanMsg({ ok: false, text: `⚠ Code "${text}" non reconnu — ajoutez ce produit manuellement ci-dessous.` });
    }
  };

  const relancerScanner = () => {
    scanLockRef.current = false;
    setScannerKey((k) => k + 1);
    setScanMsg(null);
    setShowScanner(true);
  };

  const addManuel = () => {
    if (!manualMedId) return;
    const med = medicaments.find((m) => m.id === manualMedId);
    if (!med) return;
    addOrIncrementCart(med.id, med.nom);
    setManualMedId("");
  };

  const updateQuantite = (tempId, val) => {
    const n = parseInt(val, 10);
    setCart((c) => c.map((it) => it.tempId === tempId ? { ...it, quantite: Number.isNaN(n) ? "" : n } : it));
  };

  const removeItem = (tempId) => setCart((c) => c.filter((it) => it.tempId !== tempId));

  const handleSave = async () => {
    if (cart.length === 0) { setFormError("Ajoutez au moins un produit (scanné ou manuel)."); return; }
    for (const it of cart) {
      if (!it.quantite || it.quantite <= 0) { setFormError(`Quantité invalide pour "${it.nom}".`); return; }
    }
    setSaving(true);
    setFormError(null);
    try {
      for (const it of cart) {
        await insertMouvementStock({
          etablissement_id: auth?.etablissement_id ?? null,
          medicament_id:    it.medicament_id,
          type:             "entree",
          quantite:         it.quantite,
          motif:            header.motif || "Reception",
          numero_bl:        header.numero_bl || null,
          fournisseur:      header.fournisseur || null,
          created_by:       auth?.user?.id ?? null,
        });
        await incrementStock(it.medicament_id, it.quantite);
      }
      onSaved(cart.length);
      onClose();
    } catch (e) {
      setFormError("Erreur : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Nouvelle réception de stock" onClose={onClose} width={640}>
      <Row>
        <Field label="N° de bon de livraison">
          <input style={inputStyle} value={header.numero_bl} onChange={setHeaderField("numero_bl")} placeholder="BL-2026-001" />
        </Field>
        <Field label="Fournisseur">
          <select style={selectStyle} value={header.fournisseur} onChange={setHeaderField("fournisseur")}>
            <option value="">Fournisseur libre ou liste…</option>
            {fournisseurs.map((f) => (
              <option key={f.id} value={f.nom}>{f.nom}</option>
            ))}
          </select>
        </Field>
      </Row>
      <Field label="Motif">
        <input style={inputStyle} value={header.motif} onChange={setHeaderField("motif")} placeholder="Reception commande, Don, Transfert…" />
      </Field>

      <Field label="Scanner les produits reçus">
        {!showScanner && (
          <button type="button" onClick={relancerScanner} style={{ padding: "9px 16px", borderRadius: 8, border: `1.5px solid ${colors.border}`, backgroundColor: colors.bgSurface, cursor: "pointer", fontSize: 13, fontWeight: 600, color: colors.navy }}>
            {cart.length === 0 ? "Scanner un produit" : "Scanner le produit suivant"}
          </button>
        )}
        {showScanner && (
          <div style={{ marginTop: 8 }}>
            <QrScanner key={scannerKey} onScan={handleScan} onClose={() => setShowScanner(false)} />
            <button type="button" onClick={() => setShowScanner(false)} style={{ marginTop: 6, fontSize: 12, color: colors.textMuted, background: "none", border: "none", cursor: "pointer" }}>
              Terminer le scan
            </button>
          </div>
        )}
        {scanMsg && (
          <div style={{ marginTop: 8, padding: "8px 12px", backgroundColor: scanMsg.ok ? "#DCFCE7" : "#FEF3C7", color: scanMsg.ok ? "#16A34A" : "#B45309", borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
            {scanMsg.text}
          </div>
        )}
      </Field>

      <Field label="Ou ajouter manuellement">
        <div style={{ display: "flex", gap: 8 }}>
          <select style={{ ...selectStyle, flex: 1 }} value={manualMedId} onChange={(e) => setManualMedId(e.target.value)}>
            <option value="">Choisir un médicament…</option>
            {medicaments.map((m) => (
              <option key={m.id} value={m.id}>{m.nom} — stock actuel : {m.stock_actuel ?? 0}</option>
            ))}
          </select>
          <button type="button" onClick={addManuel} disabled={!manualMedId} style={{ padding: "9px 16px", borderRadius: 8, border: "none", backgroundColor: manualMedId ? "#0A1628" : "#E5E7EB", color: manualMedId ? "white" : "#9CA3AF", cursor: manualMedId ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
            + Ajouter
          </button>
        </div>
      </Field>

      {cart.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
            Produits de la réception ({cart.length})
          </label>
          <div style={{ border: "1.5px solid #E5E7EB", borderRadius: 10, overflow: "hidden" }}>
            {cart.map((it, i) => (
              <div key={it.tempId} data-medicament-id={it.medicament_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderBottom: i < cart.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#0A1628" }}>{it.nom}</div>
                <input
                  id={`cart-qty-${it.tempId}`}
                  type="number"
                  min="1"
                  value={it.quantite}
                  onChange={(e) => updateQuantite(it.tempId, e.target.value)}
                  style={{ width: 80, padding: "6px 8px", border: "1.5px solid #E5E7EB", borderRadius: 6, fontSize: 13, textAlign: "center" }}
                />
                <button type="button" onClick={() => removeItem(it.tempId)} style={{ width: 26, height: 26, borderRadius: "50%", border: "none", backgroundColor: "#FEF2F2", color: "#DC2626", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {formError && (
        <div style={{ fontSize: 12, color: "#EF4444", padding: "8px 12px", backgroundColor: "#FEF2F2", borderRadius: 8, marginBottom: 4 }}>
          {formError}
        </div>
      )}
      <ModalFooter
        onCancel={onClose}
        onSubmit={handleSave}
        submitLabel={cart.length > 1 ? `Enregistrer la réception (${cart.length} produits)` : "Enregistrer la réception"}
        saving={saving}
      />
    </Modal>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function Mouvements() {
  const t = useThemeTokens();
  const { auth } = useAuth();
  const { data: medicaments } = useMedicaments();
  const { data: fournisseurs } = useFournisseurs();
  const { toasts, success, error: toastError } = useToast();

  const [mouvements, setMouvements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showReception, setShowReception] = useState(false);

  // Filtres
  const [filtreType, setFiltreType] = useState("");
  const [filtreDebut, setFiltreDebut] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10);
  });
  const [filtreFin, setFiltreFin] = useState(todayISO());
  const [filtreMed, setFiltreMed] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMouvementsStock({
        etablissement_id: auth?.etablissement_id ?? null,
        medicament_id:    filtreMed || undefined,
        type:             filtreType || undefined,
        dateDebut:        filtreDebut,
        dateFin:          filtreFin,
        limit:            200,
      });
      setMouvements(data);
    } catch (e) {
      toastError("Erreur chargement : " + e.message);
    } finally {
      setLoading(false);
    }
  }, [auth?.etablissement_id, filtreMed, filtreType, filtreDebut, filtreFin]);

  useEffect(() => { load(); }, [load]);

  function exportCSV() {
    const header = ["Date", "Médicament", "Catégorie", "Type", "Quantité", "N° BL", "Fournisseur", "Motif"].join(";");
    const rows = mouvements.map((m) => [
      fmt(m.created_at),
      m.medicaments?.nom ?? "—",
      m.medicaments?.categorie ?? "—",
      m.type === "entree" ? "Entrée" : "Sortie",
      m.quantite,
      m.numero_bl ?? "",
      m.fournisseur ?? "",
      m.motif ?? "",
    ].join(";"));
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mouvements_stock_${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalEntrees = mouvements.filter((m) => m.type === "entree").reduce((s, m) => s + (m.quantite ?? 0), 0);
  const totalSorties = mouvements.filter((m) => m.type === "sortie").reduce((s, m) => s + (m.quantite ?? 0), 0);

  return (
    <Layout title="Mouvements de stock" subtitle="Historique entrées et sorties">
      <Toast toasts={toasts} />
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      {showReception && (
        <ReceptionModal
          medicaments={medicaments}
          fournisseurs={fournisseurs}
          auth={auth}
          onClose={() => setShowReception(false)}
          onSaved={(count) => { success(count > 1 ? `Réception enregistrée — ${count} produits` : "Réception enregistrée"); load(); }}
        />
      )}

      {/* KPI */}
      <div className="kpi-row" style={{ marginBottom: 20 }}>
        {[
          { label: "Mouvements sur la période", value: mouvements.length, color: "#3B82F6" },
          { label: "Total entrees (unités)", value: totalEntrees.toLocaleString(), color: "#10B981" },
          { label: "Total sorties (unités)", value: totalSorties.toLocaleString(), color: "#EF4444" },
        ].map((k) => (
          <div key={k.label} style={{ flex: 1, backgroundColor: t.bgCard, borderRadius: 14, padding: "18px 22px", boxShadow: t.shadow, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: t.textLight, marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filtres + bouton */}
      <div style={{ backgroundColor: t.bgCard, borderRadius: 14, padding: "18px 20px", boxShadow: t.shadow, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: t.textLight, display: "block", marginBottom: 4 }}>Type</label>
            <select value={filtreType} onChange={(e) => setFiltreType(e.target.value)} style={{ padding: "8px 12px", border: `1.5px solid ${t.inputBorder}`, borderRadius: 8, fontSize: 13, backgroundColor: t.inputBg, color: t.textHeavy }}>
              <option value="">Tous</option>
              <option value="entree">Entrées</option>
              <option value="sortie">Sorties</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: t.textLight, display: "block", marginBottom: 4 }}>Du</label>
            <input type="date" value={filtreDebut} onChange={(e) => setFiltreDebut(e.target.value)} style={{ padding: "8px 12px", border: `1.5px solid ${t.inputBorder}`, borderRadius: 8, fontSize: 13, backgroundColor: t.inputBg, color: t.textHeavy }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: t.textLight, display: "block", marginBottom: 4 }}>Au</label>
            <input type="date" value={filtreFin} onChange={(e) => setFiltreFin(e.target.value)} style={{ padding: "8px 12px", border: `1.5px solid ${t.inputBorder}`, borderRadius: 8, fontSize: 13, backgroundColor: t.inputBg, color: t.textHeavy }} />
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: t.textLight, display: "block", marginBottom: 4 }}>Médicament</label>
            <select value={filtreMed} onChange={(e) => setFiltreMed(e.target.value)} style={{ width: "100%", padding: "8px 12px", border: `1.5px solid ${t.inputBorder}`, borderRadius: 8, fontSize: 13, backgroundColor: t.inputBg, color: t.textHeavy }}>
              <option value="">Tous les médicaments</option>
              {medicaments.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            <button onClick={exportCSV} disabled={mouvements.length === 0} style={{ padding: "9px 16px", backgroundColor: mouvements.length === 0 ? "#E5E7EB" : "#0A1628", color: mouvements.length === 0 ? "#9CA3AF" : "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: mouvements.length === 0 ? "not-allowed" : "pointer" }}>
              Exporter CSV
            </button>
            <button onClick={() => setShowReception(true)} style={{ padding: "9px 18px", backgroundColor: "#10B981", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Nouvelle réception
            </button>
          </div>
        </div>
      </div>

      {/* Tableau */}
      <div style={{ backgroundColor: t.bgCard, borderRadius: 14, boxShadow: t.shadow, overflow: "hidden" }}>
        <div className="table-scroll">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: t.bgSurface }}>
                {["Date", "Médicament", "Catégorie", "Type", "Quantité", "N° BL", "Fournisseur", "Motif"].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: t.textLight, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <Skeleton />}
              {!loading && mouvements.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: "40px 16px", textAlign: "center", color: t.textMuted, fontSize: 13 }}>
                    Aucun mouvement sur cette période.
                  </td>
                </tr>
              )}
              {!loading && mouvements.map((m) => (
                <tr key={m.id} style={{ borderBottom: `1px solid ${t.borderLight}` }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = t.bgSurface} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ""}>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: t.textLight, whiteSpace: "nowrap" }}>{fmt(m.created_at)}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: t.textHeavy }}>{m.medicaments?.nom ?? "—"}</td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: t.textLight }}>{m.medicaments?.categorie ?? "—"}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, backgroundColor: m.type === "entree" ? "#DCFCE7" : "#FEF2F2", color: m.type === "entree" ? "#16A34A" : "#DC2626" }}>
                      {m.type === "entree" ? "Entrée" : "Sortie"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 800, color: m.type === "entree" ? "#16A34A" : "#DC2626" }}>
                    {m.type === "entree" ? "+" : "–"}{m.quantite}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: t.textLight, fontFamily: "monospace" }}>{m.numero_bl ?? "—"}</td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: t.textLight }}>{m.fournisseur ?? "—"}</td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: t.textLight }}>{m.motif ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
