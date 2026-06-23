import { colors } from "../../theme";
import { useState } from "react";
import Layout from "../../components/Layout";
import Modal, { Field, Row, ModalFooter, inputStyle, selectStyle } from "../../components/Modal";
import Tooltip from "../../components/Tooltip";
import ErrorRetry from "../../components/ErrorRetry";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useOrdonnancesPaginated, usePatients, useMedicaments } from "../../hooks/useSupabaseData";
import Pagination from "../../components/Pagination";
import { updateOrdonnance, insertOrdonnance, insertVentes, decrementStock, insertJournalCaisse } from "../../hooks/useMutations";
import { useAuth } from "../../context/AuthContext";
import { useIsMobile } from "../../hooks/useWindowSize";

const MODES_PAIEMENT = ["Especes", "Mobile Money", "Carte", "Cheque", "Assurance"];

// ── Modal Dispensation pharmacie externe ──────────────────────────────────────
function ModalDispensationPharmacie({ ordonnance, medicaments, auth, etabId, onClose, onSaved }) {
  const { success, error: toastError } = useToast();

  const lignesSource = (() => {
    if (ordonnance.lignes && Array.isArray(ordonnance.lignes)) return ordonnance.lignes;
    try { const p = JSON.parse(ordonnance.notes ?? "{}"); return p.lignes ?? []; } catch { return []; }
  })();

  const [items, setItems] = useState(() =>
    lignesSource.length > 0
      ? lignesSource.map((l) => ({ nom: l.medicament_nom ?? l.nom ?? "", med_id: "", quantite: 1, prix_unitaire: 0 }))
      : [{ nom: "", med_id: "", quantite: 1, prix_unitaire: 0 }]
  );
  const [modePaiement, setModePaiement] = useState("Especes");
  const [saving, setSaving] = useState(false);

  const setItem = (idx, k, v) => setItems((prev) => prev.map((it, i) => i === idx ? { ...it, [k]: v } : it));
  const montantTotal = items.reduce((s, i) => s + (Number(i.quantite) * Number(i.prix_unitaire)), 0);

  const handleSave = async () => {
    const valides = items.filter((i) => i.med_id && Number(i.quantite) > 0);
    if (!valides.length) { toastError("Associez au moins un medicament en stock."); return; }
    setSaving(true);
    try {
      const ventesRows = valides.map((i) => {
        const med = medicaments.find((m) => m.id === i.med_id);
        return { etablissement_id: etabId, patient_id: ordonnance.patient_id ?? null, medicament_id: i.med_id, medicament_nom: med?.nom ?? i.nom, quantite: Number(i.quantite), prix_unitaire: Number(i.prix_unitaire), montant_total: Number(i.quantite) * Number(i.prix_unitaire), mode_paiement: modePaiement, type_vente: "ordonnance", ordonnance_id: ordonnance.id };
      });
      await insertVentes(ventesRows);
      for (const item of valides) {
        await decrementStock(item.med_id, Number(item.quantite));
      }
      if (montantTotal > 0 && etabId) {
        await insertJournalCaisse({ etablissement_id: etabId, caissier_email: auth?.user?.email ?? null, montant_total: montantTotal, montant_recu: montantTotal, monnaie_rendue: 0, mode_paiement: modePaiement, nb_articles: valides.length }).catch(() => {});
      }
      await updateOrdonnance(ordonnance.id, { statut: "dispensee" });
      success("Ordonnance dispensee avec succes");
      onSaved(); onClose();
    } catch (e) { toastError("Erreur : " + e.message); } finally { setSaving(false); }
  };

  const inpSt = { width: "100%", padding: "8px 10px", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 12, outline: "none", boxSizing: "border-box", color: colors.navy, backgroundColor: "white" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: colors.bgCard, borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "92vh", overflowY: "auto", padding: "24px 28px", boxShadow: "0 20px 60px rgba(0,0,0,0.22)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.navy }}>Dispensation — {ordonnance.reference ?? "—"}</h3>
            <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>Associez chaque medicament prescrit a votre stock</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.textMuted }}>x</button>
        </div>

        {items.map((item, idx) => (
          <div key={idx} style={{ backgroundColor: colors.bgSurface, borderRadius: 10, padding: "12px 14px", marginBottom: 8, border: `1px solid ${colors.border}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: colors.navy, marginBottom: 8 }}>{item.nom || `Medicament ${idx + 1}`}</div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", marginBottom: 4, textTransform: "uppercase" }}>Stock</div>
                <select style={inpSt} value={item.med_id} onChange={(e) => {
                  const med = medicaments.find((m) => m.id === e.target.value);
                  setItem(idx, "med_id", e.target.value);
                  if (med) setItem(idx, "prix_unitaire", med.prix_unitaire ?? 0);
                }}>
                  <option value="">-- Lier au stock --</option>
                  {medicaments.map((m) => <option key={m.id} value={m.id}>{m.nom} ({m.stock_actuel ?? 0})</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", marginBottom: 4, textTransform: "uppercase" }}>Qte</div>
                <input style={inpSt} type="number" min="1" value={item.quantite} onChange={(e) => setItem(idx, "quantite", e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", marginBottom: 4, textTransform: "uppercase" }}>Prix FCFA</div>
                <input style={inpSt} type="number" min="0" value={item.prix_unitaire} onChange={(e) => setItem(idx, "prix_unitaire", e.target.value)} />
              </div>
            </div>
          </div>
        ))}

        <button type="button" onClick={() => setItems((prev) => [...prev, { nom: "", med_id: "", quantite: 1, prix_unitaire: 0 }])}
          style={{ width: "100%", padding: "8px 0", background: "none", border: "1.5px dashed #10B981", borderRadius: 8, color: "#10B981", fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 14 }}>
          + Ajouter une ligne
        </button>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginBottom: 4 }}>Mode de paiement</div>
            <select style={inpSt} value={modePaiement} onChange={(e) => setModePaiement(e.target.value)}>
              {MODES_PAIEMENT.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <div style={{ fontSize: 11, color: colors.textMuted, textTransform: "uppercase", fontWeight: 700 }}>Total</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#10B981" }}>{montantTotal.toLocaleString("fr-FR")} FCFA</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, background: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 10, background: saving ? "#D1D5DB" : "#10B981", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "Traitement..." : "Valider la dispensation"}
          </button>
        </div>
      </div>
    </div>
  );
}

const statusStyle = {
  traitee:    { bg: "#DCFCE7", color: "#16A34A",  label: "Traitée" },
  en_attente: { bg: "#DBEAFE", color: "#2563EB",  label: "En attente" },
  validee:    { bg: "#EDE9FE", color: "#7C3AED",  label: "Validée" },
  refusee:    { bg: "#FEF2F2", color: "#EF4444",  label: "Refusée" },
  expiree:    { bg: "#F3F4F6", color: colors.textSecondary,  label: "Expirée" },
};

function fmt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

function SkeletonRow() {
  return (
    <tr style={{ borderBottom: "1px solid var(--border-light)", animation: "pulse 1.5s ease-in-out infinite" }}>
      {[100, 140, 120, 80, 70].map((w, i) => (
        <td key={i} style={{ padding: "13px 16px" }}>
          <div style={{ height: 13, width: w, backgroundColor: colors.borderLight, borderRadius: 6 }} />
        </td>
      ))}
    </tr>
  );
}

// ── Modal Nouvelle ordonnance ──────────────────────────────────────────────────
function NouvelleModal({ patients, onClose, onSaved }) {
  const [form, setForm] = useState({
    patient_id: "",
    medecin_nom: "",
    date_emission: new Date().toISOString().slice(0, 10),
    date_expiration: "",
    notes: "",
    statut: "en_attente",
  });
  const [lignes, setLignes] = useState([
    { medicament_nom: "", dose: "", frequence: "", duree: "", voie: "Oral" }
  ]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const set = (k) => (e) => { setFormError(null); setForm((f) => ({ ...f, [k]: e.target.value })); };

  function addLigne() {
    setLignes((prev) => [...prev, { medicament_nom: "", dose: "", frequence: "", duree: "", voie: "Oral" }]);
  }
  function removeLigne(i) {
    setLignes((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateLigne(i, key, val) {
    setLignes((prev) => prev.map((l, idx) => idx === i ? { ...l, [key]: val } : l));
  }

  const handleSave = async () => {
    if (!form.patient_id) { setFormError("Veuillez sélectionner un patient."); return; }
    setSaving(true);
    try {
      const ref = "ORD-" + Date.now().toString().slice(-8);
      await insertOrdonnance({
        patient_id: form.patient_id,
        medecin_nom: form.medecin_nom || null,
        date_emission: form.date_emission,
        date_expiration: form.date_expiration || null,
        notes: form.notes || null,
        statut: form.statut,
        reference: ref,
        lignes: lignes.filter((l) => l.medicament_nom.trim() !== ""),
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
    <Modal title="Nouvelle ordonnance" onClose={onClose}>
      <Field label="Patient *">
        <select style={selectStyle} value={form.patient_id} onChange={set("patient_id")}>
          <option value="">— Sélectionner un patient —</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>
          ))}
        </select>
      </Field>
      <Field label="Médecin prescripteur">
        <input style={inputStyle} value={form.medecin_nom} onChange={set("medecin_nom")} placeholder="Dr. Nom Prénom" />
      </Field>
      <Row>
        <Field label="Date d'émission">
          <input style={inputStyle} type="date" value={form.date_emission} onChange={set("date_emission")} />
        </Field>
        <Field label="Date d'expiration">
          <input style={inputStyle} type="date" value={form.date_expiration} onChange={set("date_expiration")} />
        </Field>
      </Row>
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: colors.text }}>Medicaments prescrits</label>
          <button type="button" onClick={addLigne} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, backgroundColor: "#DCFCE7", color: "#16A34A", border: "none", cursor: "pointer", fontWeight: 700 }}>
            + Ajouter
          </button>
        </div>
        {lignes.map((ligne, i) => (
          <div key={i} style={{ backgroundColor: colors.bgSurface, borderRadius: 8, padding: "10px 12px", marginBottom: 6, border: `1px solid ${colors.border}` }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <input
                style={{ ...inputStyle, flex: "2 1 140px", minWidth: 0 }}
                value={ligne.medicament_nom}
                onChange={(e) => updateLigne(i, "medicament_nom", e.target.value)}
                placeholder="Medicament"
              />
              <input
                style={{ ...inputStyle, flex: "1 1 80px", minWidth: 0 }}
                value={ligne.dose}
                onChange={(e) => updateLigne(i, "dose", e.target.value)}
                placeholder="Dose (ex: 500mg)"
              />
              <input
                style={{ ...inputStyle, flex: "1 1 100px", minWidth: 0 }}
                value={ligne.frequence}
                onChange={(e) => updateLigne(i, "frequence", e.target.value)}
                placeholder="Frequence (ex: 3x/j)"
              />
              <input
                style={{ ...inputStyle, flex: "1 1 80px", minWidth: 0 }}
                value={ligne.duree}
                onChange={(e) => updateLigne(i, "duree", e.target.value)}
                placeholder="Duree (ex: 7j)"
              />
              <select
                style={{ ...selectStyle, flex: "1 1 80px", minWidth: 0 }}
                value={ligne.voie}
                onChange={(e) => updateLigne(i, "voie", e.target.value)}
              >
                {["Oral", "IV", "IM", "SC", "Topique", "Sublingual", "Inhalation"].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              {lignes.length > 1 && (
                <button type="button" onClick={() => removeLigne(i)} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 16, fontWeight: 700, padding: "0 4px" }}>
                  x
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <Field label="Notes complémentaires">
        <textarea
          style={{ ...inputStyle, height: 60, resize: "vertical" }}
          value={form.notes}
          onChange={set("notes")}
          placeholder="Observations, instructions particulières..."
        />
      </Field>
      {formError && (
        <div style={{ padding: "10px 14px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 13, color: "#DC2626" }}>
          {formError}
        </div>
      )}
      <ModalFooter onCancel={onClose} onSubmit={handleSave} submitLabel="Créer l'ordonnance" saving={saving} />
    </Modal>
  );
}

export default function Ordonnances() {
  const isMobile = useIsMobile();
  const { auth } = useAuth();

  const [statutFilter, setStatutFilter] = useState("");
  const { data: ordonnances, loading, error, total, page, setPage, totalPages, refetch } = useOrdonnancesPaginated(statutFilter);
  const { data: patients } = usePatients(auth?.etablissement_id);
  const { data: medicaments } = useMedicaments();
  const { toasts, success, error: toastError } = useToast();
  const [selected, setSelected] = useState(null);
  const [showNouvelle, setShowNouvelle] = useState(false);
  const [modalDisp, setModalDisp] = useState(null);
  const [actioning, setActioning] = useState(false);
  const etabId = auth?.etablissement_id ?? null;

  const handleAction = async (statut) => {
    if (!selected) return;
    setActioning(true);
    try {
      await updateOrdonnance(selected.id, { statut });
      refetch();
      setSelected((prev) => ({ ...prev, statut }));
      success(`Ordonnance ${statut === "validee" ? "validée" : "refusée"}`);
    } catch (e) {
      toastError("Erreur : " + e.message);
    } finally {
      setActioning(false);
    }
  };

  return (
    <Layout title="Ordonnances" subtitle="Traitement et validation des prescriptions médicales">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <Toast toasts={toasts} />

      {showNouvelle && (
        <NouvelleModal
          patients={patients}
          onClose={() => setShowNouvelle(false)}
          onSaved={() => { refetch(); success("Ordonnance créée"); }}
        />
      )}
      {modalDisp && (
        <ModalDispensationPharmacie
          ordonnance={modalDisp}
          medicaments={medicaments}
          auth={auth}
          etabId={etabId}
          onClose={() => setModalDisp(null)}
          onSaved={() => { setModalDisp(null); refetch(); setSelected(null); }}
        />
      )}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 380px", gap: 20 }}>
        {/* ── Liste ── */}
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: colors.navy }}>
              Ordonnances ({loading ? "…" : total})
            </h3>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select
                value={statutFilter}
                onChange={(e) => setStatutFilter(e.target.value)}
                style={{ padding: "6px 10px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 12, outline: "none" }}
              >
                <option value="">Tous les statuts</option>
                {Object.entries(statusStyle).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <button onClick={() => setShowNouvelle(true)} style={{ padding: "7px 14px", backgroundColor: "#3B82F6", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                + Nouvelle
              </button>
            </div>
          </div>

          <div className="table-scroll"><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: colors.bgSurface }}>
                {["Référence", "Patient", "Médecin", "Date", "Statut"].map((h) => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: colors.textSecondary, borderBottom: "1px solid var(--border)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && [1,2,3,4,5].map((i) => <SkeletonRow key={i} />)}
              {error && !loading && (
                <tr><td colSpan={5} style={{ padding: 24 }}>
                  <ErrorRetry
                    message="Impossible de charger les ordonnances."
                    compact
                  />
                </td></tr>
              )}
              {!loading && !error && ordonnances.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: colors.textMuted, fontSize: 13 }}>
                  {statutFilter ? "Aucune ordonnance pour ce statut" : "Aucune ordonnance enregistrée"}
                </td></tr>
              )}
              {!loading && ordonnances.map((o) => {
                const s = statusStyle[o.statut] ?? statusStyle.en_attente;
                const patientNom = o.patients ? `${o.patients.prenom} ${o.patients.nom}` : "—";
                return (
                  <tr key={o.id} onClick={() => setSelected(o)}
                    style={{ borderBottom: "1px solid var(--border-light)", cursor: "pointer", backgroundColor: selected?.id === o.id ? "#EFF6FF" : "white" }}>
                    <td style={{ padding: "13px 16px", fontWeight: 600, color: "#3B82F6", fontSize: 12, fontFamily: "monospace" }}>{o.reference ?? o.id.slice(0,8).toUpperCase()}</td>
                    <td style={{ padding: "13px 16px", fontWeight: 600, color: colors.navy }}>{patientNom}</td>
                    <td style={{ padding: "13px 16px", color: colors.textSecondary }}>{o.medecin_nom ?? "—"}</td>
                    <td style={{ padding: "13px 16px", color: colors.textSecondary, fontSize: 12 }}>{fmt(o.date_emission)}</td>
                    <td style={{ padding: "13px 16px" }}>
                      <span style={{ padding: "3px 10px", backgroundColor: s.bg, color: s.color, borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{s.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
          <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
        </div>

        {/* ── Détail ── */}
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          {!selected ? (
            <div style={{ textAlign: "center", color: colors.textMuted, fontSize: 13, paddingTop: 60 }}>
              <div style={{ width: 48, height: 48, backgroundColor: colors.bg, borderRadius: 12, margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              Sélectionnez une ordonnance
            </div>
          ) : (() => {
            const s = statusStyle[selected.statut] ?? statusStyle.en_attente;
            const patNom = selected.patients ? `${selected.patients.prenom} ${selected.patients.nom}` : "—";
            return (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                  <div>
                    <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 800, color: colors.navy, fontFamily: "monospace" }}>
                      {selected.reference ?? selected.id.slice(0,8).toUpperCase()}
                    </h3>
                    <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 10, fontWeight: 700, backgroundColor: s.bg, color: s.color }}>{s.label}</span>
                  </div>
                  <span style={{ fontSize: 12, color: colors.textMuted }}>{fmt(selected.date_emission)}</span>
                </div>

                {[
                  { label: "Patient",      value: patNom },
                  { label: "Prescripteur", value: selected.medecin_nom ?? "—" },
                  { label: "Émission",     value: fmt(selected.date_emission) },
                  { label: "Expiration",   value: fmt(selected.date_expiration) },
                ].map((f) => (
                  <div key={f.label} style={{ padding: "12px 14px", backgroundColor: colors.bgSurface, borderRadius: 10, marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 3 }}>{f.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: colors.navy }}>{f.value}</div>
                  </div>
                ))}

                {selected.notes && (
                  <div style={{ padding: "12px 14px", backgroundColor: "#FFFBEB", borderRadius: 10, marginBottom: 16, fontSize: 13, color: "#92400E" }}>
                    {selected.notes}
                  </div>
                )}

                {selected.statut === "en_attente" && (
                  <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                    <button
                      disabled={actioning}
                      onClick={() => handleAction("validee")}
                      style={{ flex: 1, padding: "10px", backgroundColor: actioning ? "#E5E7EB" : "#10B981", color: actioning ? "#9CA3AF" : "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: actioning ? "wait" : "pointer" }}>
                      {actioning ? "…" : "Valider"}
                    </button>
                    <button
                      disabled={actioning}
                      onClick={() => handleAction("refusee")}
                      style={{ flex: 1, padding: "10px", backgroundColor: "#FEF2F2", color: "#EF4444", border: "1px solid #FCA5A5", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: actioning ? "wait" : "pointer" }}>
                      Refuser
                    </button>
                  </div>
                )}

                {selected.statut === "validee" && (
                  <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                    <button
                      onClick={() => setModalDisp(selected)}
                      style={{ flex: 2, padding: "10px", backgroundColor: "#10B981", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                      Dispenser
                    </button>
                    <button
                      disabled={actioning}
                      onClick={() => handleAction("traitee")}
                      style={{ flex: 1, padding: "10px", backgroundColor: "#8B5CF6", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                      Traiter
                    </button>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>
    </Layout>
  );
}
