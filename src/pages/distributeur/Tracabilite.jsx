/**
 * Traçabilité — version Distributeur
 * Même moteur de vérification que Scanner pharmacie/hôpital,
 * adapté au contexte distributeur avec liste des lots MedOS.
 */
import { colors } from "../../theme";
import { useState, useCallback, useEffect, useRef } from "react";
import { Camera, Search, PackagePlus } from "lucide-react";
import Layout from "../../components/Layout";
import QrScanner from "../../components/QrScanner";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useVerificationLot, rechercherLotPourPrefill } from "../../hooks/useVerificationLot";
import { useLots, useMedicaments } from "../../hooks/useSupabaseData";
import { insertMedicament, insertLot, incrementStock } from "../../hooks/useMutations";
import { useAuth } from "../../context/AuthContext";

const STATUTS = {
  certifie: { label: "Certifié MedOS",          color: "#16A34A", bg: "#DCFCE7", border: "#86EFAC" },
  bdpm:     { label: "Authentique BDPM France", color: "#1D4ED8", bg: "#DBEAFE", border: "#93C5FD" },
  suspect:  { label: "Lot suspect",             color: "#DC2626", bg: "#FEF2F2", border: "#FCA5A5" },
};

function fmt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

/** Génère MEDOS-AAAA-DIST-XXXXX — un numéro de lot par médicament reçu. */
function genererNumeroLot(annee = new Date().getFullYear()) {
  const suffix = Math.random().toString(36).toUpperCase().slice(2, 7);
  return `MEDOS-${annee}-DIST-${suffix}`;
}

const inputStyle = {
  width: "100%", padding: "9px 12px", border: "1.5px solid var(--border)",
  borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", color: colors.navy,
};
const labelStyle = { fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 5 };

// ── Modal Scan-pour-enregistrer : réception directe dans l'entrepôt ────────────
// Depuis un scan (ou une saisie manuelle) en Traçabilité, enregistre la
// quantité reçue directement dans l'entrepôt du distributeur — sans repasser
// par l'écran Entrepôt. Si le code scanné correspond à un lot déjà certifié
// MedOS, les champs sont pré-remplis (même pattern que le "scan-pour-ajouter"
// de l'Inventaire pharmacie, via rechercherLotPourPrefill). Un numéro de lot
// MedOS est généré automatiquement, un par médicament reçu.
export function ModalScanEnregistrer({ nomInitial, fabricantInitial, codeScanne, medicaments, etablissement_id, onClose, onSuccess }) {
  const [form, setForm] = useState({
    nom: nomInitial || "", dosage: "", forme: "", fabricant: fabricantInitial || "",
    quantite: "", date_fabrication: "", date_expiration: "",
    prix_unitaire: "", prix_achat: "",
  });
  const [lotGenere, setLotGenere] = useState(genererNumeroLot());
  const [prefillInfo, setPrefillInfo] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!codeScanne) return;
    rechercherLotPourPrefill(codeScanne).then((infos) => {
      if (!infos) return;
      setForm((f) => ({
        ...f,
        nom: infos.nom || f.nom,
        forme: infos.forme || f.forme,
        fabricant: infos.fabricant || f.fabricant,
        prix_achat: infos.prix_achat !== "" ? infos.prix_achat : f.prix_achat,
        prix_unitaire: infos.prix_unitaire !== "" ? infos.prix_unitaire : f.prix_unitaire,
        date_expiration: infos.date_peremption || f.date_expiration,
      }));
      setPrefillInfo(`Lot certifié MedOS reconnu — champs pré-remplis automatiquement (${infos.nom}).`);
    }).catch(() => {});
  }, [codeScanne]);

  // Un produit déjà présent dans l'entrepôt réutilise sa fiche médicament
  // (nom identique, insensible à la casse) — sinon une nouvelle fiche est
  // créée, comme pour la réception classique depuis l'écran Entrepôt.
  const existant = medicaments.find((m) => m.nom.trim().toLowerCase() === form.nom.trim().toLowerCase());

  const handleSubmit = async () => {
    if (!form.nom.trim() || !form.fabricant.trim() || !form.quantite) {
      setErr("Remplissez le nom, le fabricant et la quantité.");
      return;
    }
    const qty = parseInt(form.quantite, 10);
    if (isNaN(qty) || qty <= 0) { setErr("Quantité invalide."); return; }

    setSaving(true);
    setErr(null);
    try {
      let medicamentId = existant?.id;
      if (!medicamentId) {
        const nouveau = await insertMedicament({
          nom: form.nom.trim(),
          dosage: form.dosage.trim() || null,
          forme: form.forme.trim() || null,
          fabricant: form.fabricant.trim(),
          etablissement_id,
          stock_actuel: 0,
          stock_minimum: 10,
          prix_unitaire: form.prix_unitaire ? Number(form.prix_unitaire) : null,
          prix_achat: form.prix_achat ? Number(form.prix_achat) : null,
        });
        medicamentId = nouveau.id;
      }
      await insertLot({
        numero_lot: lotGenere,
        medicament_id: medicamentId,
        fabricant: form.fabricant.trim(),
        quantite_initiale: qty,
        date_fabrication: form.date_fabrication || null,
        date_expiration: form.date_expiration || null,
        qr_code: JSON.stringify({ lot: lotGenere, medicament_id: medicamentId }),
        ...(form.prix_achat ? { prix_achat: Number(form.prix_achat) } : {}),
      });
      await incrementStock(medicamentId, qty);
      onSuccess(lotGenere, qty, form.nom.trim());
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ backgroundColor: colors.bgCard, borderRadius: 16, padding: 28, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: colors.navy }}>Enregistrer dans l'entrepôt</h3>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: colors.textSecondary }}>Un lot MedOS certifié sera généré automatiquement</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ backgroundColor: "#FFFBEB", borderRadius: 10, padding: "12px 16px", marginBottom: 20, border: "1px solid #FDE68A", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 11, color: "#92400E", fontWeight: 600, marginBottom: 2 }}>Numéro de lot MedOS généré</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#B45309", fontFamily: "monospace" }}>{lotGenere}</div>
          </div>
          <button onClick={() => setLotGenere(genererNumeroLot())} style={{ fontSize: 11, padding: "5px 10px", backgroundColor: colors.bgCard, border: "1px solid #FCD34D", borderRadius: 6, cursor: "pointer", color: "#B45309", fontWeight: 600 }}>
            Regénérer
          </button>
        </div>

        {prefillInfo && (
          <div style={{ marginBottom: 16, padding: "8px 12px", backgroundColor: "#DCFCE7", color: "#16A34A", borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
            {prefillInfo}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Médicament <span style={{ color: "#EF4444" }}>*</span></label>
            <input value={form.nom} onChange={(e) => set("nom", e.target.value)} placeholder="Nom du médicament" style={inputStyle} />
            {form.nom.trim() && (
              <div style={{ fontSize: 11, color: existant ? "#2563EB" : "#16A34A", marginTop: 4 }}>
                {existant ? "Produit déjà dans votre catalogue — le stock sera incrémenté." : "Nouveau produit — une fiche sera créée dans votre catalogue."}
              </div>
            )}
          </div>
          <div className="form-row-2">
            <div>
              <label style={labelStyle}>Fabricant <span style={{ color: "#EF4444" }}>*</span></label>
              <input value={form.fabricant} onChange={(e) => set("fabricant", e.target.value)} placeholder="Ex : Sanofi, Pfizer…" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Quantité reçue <span style={{ color: "#EF4444" }}>*</span></label>
              <input type="number" min="1" value={form.quantite} onChange={(e) => set("quantite", e.target.value)} placeholder="Ex : 100" style={inputStyle} />
            </div>
          </div>
          <div className="form-row-2">
            <div>
              <label style={labelStyle}>Date de fabrication</label>
              <input type="date" value={form.date_fabrication} onChange={(e) => set("date_fabrication", e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Date d'expiration</label>
              <input type="date" value={form.date_expiration} onChange={(e) => set("date_expiration", e.target.value)} style={inputStyle} />
            </div>
          </div>
        </div>

        {err && (
          <div style={{ marginTop: 14, padding: "8px 12px", backgroundColor: "#FEF2F2", borderRadius: 8, fontSize: 12, color: "#DC2626" }}>{err}</div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px", backgroundColor: colors.bgSurface, color: colors.text, border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
            Annuler
          </button>
          <button onClick={handleSubmit} disabled={saving}
            style={{ flex: 2, padding: "11px", backgroundColor: saving ? "#E5E7EB" : "#F59E0B", color: saving ? "#9CA3AF" : "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {saving ? "Enregistrement…" : "Enregistrer et générer le lot"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Tracabilite() {
  const { auth } = useAuth();
  const { loading, result, error, verifier, reset } = useVerificationLot();
  const { data: lotsDB, loading: lotsLoading } = useLots();
  const { data: medicaments } = useMedicaments(auth?.etablissement_id);
  const { toasts, success, error: toastError } = useToast();

  const [nomMedicament, setNomMedicament] = useState("");
  const [numerolot, setNumerolot] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [historique, setHistorique] = useState([]);
  const [showReception, setShowReception] = useState(false);
  const [dernierCodeScanne, setDernierCodeScanne] = useState("");

  const lastHandledResult = useRef(null);
  const scanContextRef = useRef({ nom: "", lot: "" });

  const handleVerifier = useCallback(async () => {
    if (!nomMedicament.trim() && !numerolot.trim()) {
      toastError("Saisissez un nom de médicament ou un numéro de lot");
      return;
    }
    scanContextRef.current = { nom: nomMedicament.trim(), lot: numerolot.trim() };
    await verifier({
      nomMedicament: nomMedicament.trim(),
      numerolot: numerolot.trim(),
      scannePar: "Traçabilité — Distributeur",
    });
  }, [nomMedicament, numerolot, verifier, toastError]);

  useEffect(() => {
    if (!result) return;
    if (result === lastHandledResult.current) return;
    lastHandledResult.current = result;
    const { nom, lot } = scanContextRef.current;
    setHistorique((prev) => [
      { id: Date.now(), nom, lot, result, ts: Date.now() },
      ...prev.slice(0, 9),
    ]);
    if (result.statut === "suspect") {
      toastError("Lot suspect — alerte envoyée aux autorités");
    } else {
      success(result.statut === "certifie" ? "Certifié MedOS" : "Référencé BDPM France");
    }
  }, [result, toastError, success]);

  const handleQrScan = (text) => {
    setShowCamera(false);
    setDernierCodeScanne(text.trim());
    try {
      const obj = JSON.parse(text);
      if (obj.lot) setNumerolot(obj.lot);
      if (obj.nom) setNomMedicament(obj.nom);
    } catch {
      if (/^[A-Z0-9\-]+$/i.test(text.trim()) && text.length < 30) {
        setNumerolot(text.trim());
      } else {
        setNomMedicament(text.trim());
      }
    }
    success("Code scanné !");
  };

  return (
    <Layout title="Traçabilité" subtitle="Suivi de bout en bout — Vérification lots + chaîne pharmaceutique">
      <style>{`
        @keyframes spin   { to { transform: rotate(360deg) } }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:.4} }
      `}</style>
      <Toast toasts={toasts} />
      {showCamera && <QrScanner onScan={handleQrScan} onClose={() => setShowCamera(false)} />}
      {showReception && (
        <ModalScanEnregistrer
          nomInitial={nomMedicament}
          codeScanne={dernierCodeScanne}
          medicaments={medicaments}
          etablissement_id={auth?.etablissement_id}
          onClose={() => setShowReception(false)}
          onSuccess={(lot, qty, nom) => {
            setShowReception(false);
            setDernierCodeScanne("");
            success(`Lot ${lot} créé — ${qty} unités de ${nom} ajoutées à l'entrepôt`);
          }}
        />
      )}

      <div className="dash-grid-2">

        {/* ── Gauche : scanner ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ backgroundColor: colors.bgCard, borderRadius: 16, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.navy }}>Scanner un produit</h3>
              <button
                onClick={() => setShowCamera(true)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", backgroundColor: "#FFFBEB", color: "#D97706", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                Caméra
              </button>
            </div>

            {/* Zone caméra OFF */}
            <div
              onClick={() => setShowCamera(true)}
              style={{ width: "100%", height: 160, backgroundColor: "#0A1628", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, cursor: "pointer", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, rgba(245,158,11,0.15) 0%, transparent 70%)" }} />
              <div style={{ textAlign: "center", position: "relative" }}>
                <Camera size={32} color="rgba(255,255,255,0.5)" style={{ marginBottom: 8 }} />
                <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>Cliquer pour activer la caméra</div>
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 2 }}>QR code / Code-barres</div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input
                value={nomMedicament}
                onChange={(e) => { setNomMedicament(e.target.value); reset(); }}
                onKeyDown={(e) => e.key === "Enter" && handleVerifier()}
                placeholder="Nom du médicament…"
                style={{ padding: "10px 14px", border: "1.5px solid var(--border)", borderRadius: 10, fontSize: 13, outline: "none", color: colors.navy }}
              />
              <input
                value={numerolot}
                onChange={(e) => { setNumerolot(e.target.value); reset(); }}
                onKeyDown={(e) => e.key === "Enter" && handleVerifier()}
                placeholder="Numéro de lot (optionnel)…"
                style={{ padding: "10px 14px", border: "1.5px solid var(--border)", borderRadius: 10, fontSize: 13, outline: "none", color: colors.navy, fontFamily: "monospace" }}
              />
              <button
                onClick={handleVerifier}
                disabled={loading || (!nomMedicament.trim() && !numerolot.trim())}
                style={{
                  padding: "11px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                  cursor: loading || (!nomMedicament.trim() && !numerolot.trim()) ? (loading ? "wait" : "not-allowed") : "pointer",
                  border: "none",
                  backgroundColor: loading || (!nomMedicament.trim() && !numerolot.trim()) ? "#E5E7EB" : "#F59E0B",
                  color: loading || (!nomMedicament.trim() && !numerolot.trim()) ? "#9CA3AF" : "white",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                {loading
                  ? <><div style={{ width: 14, height: 14, border: "2px solid #9CA3AF", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />Vérification…</>
                  : <><Search size={14} />Vérifier l'authenticité</>}
              </button>
              <button
                onClick={() => setShowReception(true)}
                disabled={!nomMedicament.trim()}
                style={{
                  padding: "11px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                  cursor: nomMedicament.trim() ? "pointer" : "not-allowed",
                  border: `1.5px solid ${nomMedicament.trim() ? "#F59E0B" : "var(--border)"}`,
                  backgroundColor: colors.bgCard,
                  color: nomMedicament.trim() ? "#B45309" : "#9CA3AF",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                <PackagePlus size={14} />Enregistrer dans l'entrepôt
              </button>
            </div>
            {error && <div style={{ marginTop: 10, padding: "8px 12px", backgroundColor: "#FEF2F2", borderRadius: 8, fontSize: 12, color: "#DC2626" }}>Erreur : {error}</div>}
          </div>

          {/* Historique session */}
          {historique.length > 0 && (
            <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: colors.navy }}>Historique ({historique.length})</h4>
                <button onClick={() => setHistorique([])} style={{ fontSize: 11, color: colors.textMuted, background: "none", border: "none", cursor: "pointer" }}>Effacer</button>
              </div>
              {historique.map((item) => {
                const s = STATUTS[item.result.statut];
                return (
                  <div key={item.id}
                    onClick={() => { setNumerolot(item.lot || ""); setNomMedicament(item.nom || ""); reset(); }}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", backgroundColor: colors.bgSurface, borderRadius: 8, marginBottom: 6, border: `1px solid ${s.border}`, cursor: "pointer" }}>
                    <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: colors.navy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.nom || item.lot || "—"}
                    </div>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, backgroundColor: s.bg, color: s.color, fontWeight: 700 }}>
                      {item.result.statut === "certifie" ? "MedOS" : item.result.statut === "bdpm" ? "BDPM" : "Suspect"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Droite : résultat + lots récents ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Résultat */}
          <div style={{ backgroundColor: colors.bgCard, borderRadius: 16, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: colors.navy }}>Résultat</h3>
            {!result && !loading && (
              <div style={{ textAlign: "center", color: colors.textMuted, padding: "30px 0" }}>
                <Search size={32} color={colors.textMuted} style={{ marginBottom: 8 }} />
                <div style={{ fontSize: 13 }}>En attente de scan…</div>
              </div>
            )}
            {loading && (
              <div style={{ textAlign: "center", padding: "30px 0" }}>
                <div style={{ width: 32, height: 32, border: "3px solid #E5E7EB", borderTopColor: "#F59E0B", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
                <div style={{ fontSize: 13, color: colors.textSecondary }}>Consultation MedOS → BDPM France…</div>
              </div>
            )}
            {result && !loading && (() => {
              const s = STATUTS[result.statut];
              return (
                <div style={{ animation: "fadeIn 0.25s ease" }}>
                  <div style={{ padding: "14px 16px", backgroundColor: s.bg, borderRadius: 12, border: `1px solid ${s.border}`, marginBottom: 16, textAlign: "center" }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{s.label}</div>
                  </div>
                  {Object.entries(result.details).map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--border-light)" }}>
                      <span style={{ fontSize: 12, color: colors.textSecondary }}>{k}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: colors.navy, textAlign: "right", maxWidth: "55%" }}>{v}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 10, fontSize: 10, color: colors.textMuted, textAlign: "right" }}>
                    Source : {result.source === "supabase" ? "Base MedOS" : result.source === "bdpm" ? "BDPM France" : "Introuvable"}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Lots MedOS enregistrés */}
          <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h4 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: colors.navy }}>
              Lots enregistrés MedOS ({lotsLoading ? "…" : lotsDB.length})
            </h4>
            <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
              {lotsLoading && [1,2,3].map((i) => (
                <div key={i} style={{ height: 44, backgroundColor: colors.bgSurface, borderRadius: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
              ))}
              {!lotsLoading && lotsDB.length === 0 && (
                <div style={{ padding: "20px", textAlign: "center", color: colors.textMuted, fontSize: 13 }}>
                  Aucun lot enregistré dans MedOS
                </div>
              )}
              {!lotsLoading && lotsDB.slice(0, 15).map((lot) => {
                const expired = lot.date_expiration && new Date(lot.date_expiration) < new Date();
                return (
                  <div key={lot.id}
                    onClick={() => { setNumerolot(lot.numero_lot); setNomMedicament(lot.medicaments?.nom || ""); reset(); }}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", backgroundColor: colors.bgSurface, borderRadius: 8, cursor: "pointer", borderLeft: `3px solid ${expired ? "#EF4444" : "#10B981"}` }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: colors.navy }}>{lot.medicaments?.nom || "—"}</div>
                      <div style={{ fontSize: 11, color: colors.textMuted, fontFamily: "monospace" }}>{lot.numero_lot}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 11, color: expired ? "#EF4444" : "#10B981", fontWeight: 600 }}>
                        {expired ? "Expiré" : fmt(lot.date_expiration)}
                      </div>
                      <div style={{ fontSize: 10, color: colors.textMuted }}>{lot.fabricant || "—"}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 8 }}>Cliquez sur un lot pour le vérifier</div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
