import { useState } from "react";
import Layout from "../../components/Layout";
import { useEtablissements } from "../../hooks/useSupabaseData";
import { supabase } from "../../supabaseClient";
import { useIsMobile } from "../../hooks/useWindowSize";

const inputStyle = {
  width: "100%", padding: "9px 13px", border: "1.5px solid #E5E7EB",
  borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box",
  color: "#0A1628", backgroundColor: "white",
};

// ─── Modal Nouveau client ─────────────────────────────────────────────────────
function NouveauClientModal({ onClose, onSaved, etabsMedOS }) {
  const [mode, setMode] = useState("medos"); // "medos" | "manuel"
  const [selected, setSelected] = useState(null);
  const [filtre, setFiltre] = useState("");
  const [form, setForm] = useState({ nom: "", ville: "", type: "pharmacie", email: "", telephone: "" });
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const etabsFiltres = etabsMedOS.filter((e) =>
    e.nom.toLowerCase().includes(filtre.toLowerCase()) ||
    (e.ville ?? "").toLowerCase().includes(filtre.toLowerCase())
  );

  const handleSave = async () => {
    setErreur(null);
    setSaving(true);
    try {
      if (mode === "medos") {
        if (!selected) { setErreur("Sélectionnez un établissement."); setSaving(false); return; }
        // L'établissement est déjà dans Supabase — on note juste le lien
        // (pas de duplication — l'établissement devient visible dans la liste)
        onSaved(`${selected.nom} ajouté au réseau.`);
      } else {
        if (!form.nom.trim()) { setErreur("Le nom est obligatoire."); setSaving(false); return; }
        if (!form.ville.trim()) { setErreur("La ville est obligatoire."); setSaving(false); return; }
        const { error } = await supabase.from("etablissements").insert({
          nom: form.nom.trim(),
          ville: form.ville.trim(),
          type: form.type,
          email: form.email.trim() || null,
          telephone: form.telephone.trim() || null,
          actif: true,
          statut_inscription: "validee",
        });
        if (error) throw error;
        onSaved(`${form.nom.trim()} créé et ajouté au réseau.`);
      }
      onClose();
    } catch (e) {
      setErreur("Erreur : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ backgroundColor: "white", borderRadius: 16, width: 520, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        {/* Header */}
        <div style={{ padding: "20px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0A1628" }}>Ajouter un client</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF" }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, margin: "16px 24px 0", backgroundColor: "#F3F4F6", borderRadius: 8, padding: 4 }}>
          {[{ key: "medos", label: "Etablissement MedOS" }, { key: "manuel", label: "Client manuel" }].map((t) => (
            <button key={t.key} onClick={() => setMode(t.key)} style={{ flex: 1, padding: "7px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", backgroundColor: mode === t.key ? "white" : "transparent", color: mode === t.key ? "#0A1628" : "#6B7280", boxShadow: mode === t.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: "16px 24px", overflowY: "auto", flex: 1 }}>
          {mode === "medos" ? (
            <>
              <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 12 }}>
                Sélectionnez un établissement déjà enregistré dans MedOS pour l'ajouter à votre réseau commercial.
              </div>
              <input
                value={filtre}
                onChange={(e) => setFiltre(e.target.value)}
                placeholder="Rechercher par nom ou ville…"
                style={{ ...inputStyle, marginBottom: 10 }}
              />
              <div style={{ maxHeight: 280, overflowY: "auto", border: "1px solid #E5E7EB", borderRadius: 8 }}>
                {etabsFiltres.length === 0 && (
                  <div style={{ padding: 20, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Aucun résultat</div>
                )}
                {etabsFiltres.map((e) => (
                  <div key={e.id} onClick={() => setSelected(e)} style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", backgroundColor: selected?.id === e.id ? "#EFF6FF" : "white", borderBottom: "1px solid #F3F4F6" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#0A1628" }}>{e.nom}</div>
                      <div style={{ fontSize: 11, color: "#9CA3AF" }}>{e.type} · {e.ville}</div>
                    </div>
                    {selected?.id === e.id && <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#3B82F6" }} />}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 14 }}>
                Créez un nouveau client qui n'est pas encore enregistré dans MedOS.
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Nom <span style={{ color: "#EF4444" }}>*</span></label>
                <input style={inputStyle} value={form.nom} onChange={set("nom")} placeholder="Ex: Clinique Sainte-Marie" />
              </div>
              <div className="form-row-2" style={{ marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Ville <span style={{ color: "#EF4444" }}>*</span></label>
                  <input style={inputStyle} value={form.ville} onChange={set("ville")} placeholder="Ex: Abidjan" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Type</label>
                  <select style={{ ...inputStyle, cursor: "pointer" }} value={form.type} onChange={set("type")}>
                    <option value="pharmacie">Pharmacie</option>
                    <option value="hopital">Hôpital</option>
                    <option value="clinique">Clinique</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Email</label>
                <input style={inputStyle} type="email" value={form.email} onChange={set("email")} placeholder="contact@client.com" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Téléphone</label>
                <input style={inputStyle} type="tel" value={form.telephone} onChange={set("telephone")} placeholder="Ex: +225 07 00 00 00 00" />
              </div>
            </>
          )}

          {erreur && (
            <div style={{ marginTop: 12, padding: "9px 13px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 12, color: "#DC2626" }}>
              {erreur}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px 20px", display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid #F3F4F6" }}>
          <button onClick={onClose} style={{ padding: "9px 18px", backgroundColor: "white", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 13, color: "#6B7280", cursor: "pointer" }}>
            Annuler
          </button>
          <button onClick={handleSave} disabled={saving} style={{ padding: "9px 18px", backgroundColor: saving ? "#E5E7EB" : "#F59E0B", color: saving ? "#9CA3AF" : "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "Enregistrement…" : "Ajouter au réseau"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function ReseauClients() {
  const isMobile = useIsMobile();

  const { data: etabs, loading, refetch } = useEtablissements();
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  return (
    <Layout title="Réseau Clients" subtitle="Gestion du portefeuille client et des relations commerciales">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, backgroundColor: "#10B981", color: "white", padding: "12px 20px", borderRadius: 10, fontWeight: 600, fontSize: 13, zIndex: 2000, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
          {toast}
        </div>
      )}

      {showModal && (
        <NouveauClientModal
          onClose={() => setShowModal(false)}
          onSaved={(msg) => { showToast(msg); refetch(); }}
          etabsMedOS={etabs}
        />
      )}

      <div className="kpi-row">
        {[
          { label: "Clients actifs",  value: loading ? "…" : etabs.filter(e => e.actif).length, color: "#F59E0B" },
          { label: "Hôpitaux",        value: loading ? "…" : etabs.filter(e => e.type === "hopital").length, color: "#10B981" },
          { label: "Pharmacies",      value: loading ? "…" : etabs.filter(e => e.type === "pharmacie").length, color: "#3B82F6" },
          { label: "Total",           value: loading ? "…" : etabs.length, color: "#8B5CF6" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: "white", borderRadius: 14, padding: "18px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 360px", gap: 20 }}>
        <div style={{ backgroundColor: "white", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0A1628" }}>Tous les établissements ({loading ? "…" : etabs.length})</h3>
            <button onClick={() => setShowModal(true)} style={{ padding: "7px 14px", backgroundColor: "#F59E0B", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              + Nouveau client
            </button>
          </div>
          {loading && [1,2,3,4].map((i) => (
            <div key={i} style={{ padding: "13px 20px", display: "flex", gap: 12, borderBottom: "1px solid #F3F4F6", animation: "pulse 1.5s ease-in-out infinite" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: "#F3F4F6" }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 13, width: 160, backgroundColor: "#F3F4F6", borderRadius: 6, marginBottom: 6 }} />
                <div style={{ height: 11, width: 100, backgroundColor: "#F3F4F6", borderRadius: 6 }} />
              </div>
            </div>
          ))}
          {!loading && etabs.map((c) => (
            <div key={c.id} onClick={() => setSelected(c)}
              style={{ padding: "13px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", borderBottom: "1px solid #F3F4F6", backgroundColor: selected?.id === c.id ? "#FFFBEB" : "white" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: "#FFFBEB", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: "#F59E0B" }}>
                  {c.nom.charAt(0)}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#0A1628" }}>{c.nom}</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF" }}>{c.type} · {c.ville}</div>
                </div>
              </div>
              <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: c.actif ? "#10B981" : "#9CA3AF" }} />
            </div>
          ))}
        </div>

        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          {!selected ? (
            <div style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, paddingTop: 60 }}>
              Sélectionnez un établissement pour voir sa fiche
            </div>
          ) : (
            <>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", backgroundColor: "#FFFBEB", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", fontSize: 22, fontWeight: 800, color: "#F59E0B" }}>
                  {selected.nom.charAt(0)}
                </div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0A1628" }}>{selected.nom}</h3>
                <div style={{ fontSize: 12, color: "#9CA3AF" }}>{selected.type} · {selected.ville}</div>
              </div>
              {[
                { label: "Email",     value: selected.email ?? "—" },
                { label: "Téléphone", value: selected.telephone ?? "—" },
                { label: "Adresse",   value: selected.adresse ?? "—" },
                { label: "Statut",    value: selected.actif ? "Actif" : "Inactif" },
              ].map((f) => (
                <div key={f.label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #F3F4F6" }}>
                  <span style={{ fontSize: 13, color: "#6B7280" }}>{f.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0A1628", textTransform: "capitalize" }}>{f.value}</span>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                <button style={{ flex: 1, padding: "9px", backgroundColor: "#F59E0B", color: "white", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Créer commande</button>
                <button style={{ flex: 1, padding: "9px", backgroundColor: "#F8FAFC", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 12, cursor: "pointer" }}>Historique</button>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
