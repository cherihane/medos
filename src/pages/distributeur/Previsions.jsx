import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import Layout from "../../components/Layout";
import PredictionsIA from "../../components/PredictionsIA";
import { useKpiDistributeur, useFournisseurs } from "../../hooks/useSupabaseData";
import { insertCommande } from "../../hooks/useMutations";
import { useAuth } from "../../context/AuthContext";

const forecastData = [
  { mois: "Jan", reel: 22400000, prevision: 23000000 },
  { mois: "Fév", prevision: 25000000 },
  { mois: "Mar", prevision: 28000000 },
  { mois: "Avr", prevision: 26500000 },
  { mois: "Mai", prevision: 31000000 },
  { mois: "Jun", prevision: 29000000 },
];

const prodData = [
  { name: "Paracétamol", actuel: 12450, prevu: 15000 },
  { name: "Amoxicilline", actuel: 8200,  prevu: 10000 },
  { name: "Ibuprofène",   actuel: 6800,  prevu: 7500 },
  { name: "Vitamine C",   actuel: 18000, prevu: 20000 },
  { name: "Metformine",   actuel: 4200,  prevu: 6000 },
];

const inputStyle = {
  width: "100%", padding: "9px 13px", border: "1.5px solid #E5E7EB",
  borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box",
  color: "#0A1628", backgroundColor: "white",
};

// ─── Modal Agir ───────────────────────────────────────────────────────────────
function AgirModal({ action, onClose, onSaved, fournisseurs, etablissement_id }) {
  const [fournisseurId, setFournisseurId] = useState("");
  const [quantite, setQuantite] = useState("500");
  const [dateLivraison, setDateLivraison] = useState("");
  const [notes, setNotes] = useState(action.action);
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState(null);

  const handleSave = async () => {
    setErreur(null);
    if (!fournisseurId) { setErreur("Sélectionnez un fournisseur."); return; }
    if (!quantite || parseInt(quantite, 10) <= 0) { setErreur("Quantité invalide."); return; }
    setSaving(true);
    try {
      await insertCommande({
        fournisseur_id: fournisseurId,
        statut: "brouillon",
        date_commande: new Date().toISOString(),
        date_livraison_prevue: dateLivraison || null,
        montant_total: 0,
        notes: notes.trim(),
        ...(etablissement_id ? { etablissement_id } : {}),
      });
      onSaved("Commande créée en brouillon.");
      onClose();
    } catch (e) {
      setErreur("Erreur : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ backgroundColor: "white", borderRadius: 16, width: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ padding: "20px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Créer une commande fournisseur</h3>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 3 }}>Basée sur la prévision : {action.action}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF", flexShrink: 0 }}>×</button>
        </div>

        <div style={{ padding: "18px 24px" }}>
          <div style={{ backgroundColor: action.urgence === "haute" ? "#FEF2F2" : action.urgence === "normale" ? "#FFFBEB" : "#F0F9FF", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#374151" }}>
            <strong>Motif :</strong> {action.motif}
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Fournisseur <span style={{ color: "#EF4444" }}>*</span></label>
            <select style={{ ...inputStyle, cursor: "pointer" }} value={fournisseurId} onChange={(e) => setFournisseurId(e.target.value)}>
              <option value="">— Sélectionner un fournisseur —</option>
              {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Quantité estimée</label>
              <input style={inputStyle} type="number" min="1" value={quantite} onChange={(e) => setQuantite(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Livraison souhaitée</label>
              <input style={inputStyle} type="date" value={dateLivraison} onChange={(e) => setDateLivraison(e.target.value)} />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Notes</label>
            <input style={inputStyle} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Instructions particulières…" />
          </div>

          {erreur && (
            <div style={{ padding: "9px 13px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 12, color: "#DC2626", marginBottom: 12 }}>
              {erreur}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "9px 18px", backgroundColor: "white", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 13, color: "#6B7280", cursor: "pointer" }}>
              Annuler
            </button>
            <button onClick={handleSave} disabled={saving} style={{ padding: "9px 18px", backgroundColor: saving ? "#E5E7EB" : "#F59E0B", color: saving ? "#9CA3AF" : "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>
              {saving ? "Création…" : "Créer la commande"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function Previsions() {
  const { auth } = useAuth();
  const { data: kpi, loading: loadKpi } = useKpiDistributeur();
  const { data: fournisseurs } = useFournisseurs();
  const [agirAction, setAgirAction] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  const kpiCards = [
    { label: "Chiffre d'affaires total", value: loadKpi ? "…" : `${((kpi?.ca ?? 0) / 1000000).toFixed(1)}M FCFA`, color: "#F59E0B" },
    { label: "Commandes actives",         value: loadKpi ? "…" : kpi?.commandesActives ?? 0,                        color: "#10B981" },
    { label: "Clients actifs",            value: loadKpi ? "…" : kpi?.clients ?? 0,                                 color: "#3B82F6" },
    { label: "Livraisons en cours",       value: loadKpi ? "…" : kpi?.livraisonsEnCours ?? 0,                       color: "#8B5CF6" },
  ];

  const actionsRecommandees = [
    { action: "Commander Paracétamol 1g",   motif: "Demande prévue +24% en février",       urgence: "haute" },
    { action: "Réduire stock Ibuprofène",   motif: "Surstock prévu de 18%",                urgence: "normale" },
    { action: "Anticiper rupture Metformine", motif: "Demande +42% sur 3 mois",             urgence: "haute" },
    { action: "Renégocier tarifs Vitamine C", motif: "Volume x1.5 prévu sur 6 mois",       urgence: "faible" },
  ];

  return (
    <Layout title="Prévisions" subtitle="Anticipation de la demande et planification des approvisionnements">
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, backgroundColor: "#10B981", color: "white", padding: "12px 20px", borderRadius: 10, fontWeight: 600, fontSize: 13, zIndex: 2000, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
          {toast}
        </div>
      )}

      {agirAction && (
        <AgirModal
          action={agirAction}
          fournisseurs={fournisseurs}
          etablissement_id={auth?.etablissement_id ?? null}
          onClose={() => setAgirAction(null)}
          onSaved={(msg) => { showToast(msg); }}
        />
      )}

      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {kpiCards.map((k) => (
          <div key={k.label} style={{ backgroundColor: "white", borderRadius: 14, padding: "18px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 20, minWidth: 0 }}>
        <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Prévisions CA — 6 prochains mois (FCFA)</h3>
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={forecastData}>
              <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
              <Tooltip formatter={(v) => `${(v / 1000000).toFixed(1)}M FCFA`} />
              <Line type="monotone" dataKey="reel" stroke="#F59E0B" strokeWidth={2.5} dot={{ r: 5, fill: "#F59E0B" }} name="Réel" />
              <Line type="monotone" dataKey="prevision" stroke="#D97706" strokeWidth={2} strokeDasharray="7 4" dot={{ r: 4 }} name="Prévision IA" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <PredictionsIA />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", minWidth: 0 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Volume prévu vs actuel (unités)</h3>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={prodData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="actuel" fill="#F59E0B" radius={[0, 4, 4, 0]} name="Actuel" />
                <Bar dataKey="prevu" fill="#FDE68A" radius={[0, 4, 4, 0]} name="Prévu" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Actions recommandées</h3>
          {actionsRecommandees.map((a, i) => (
            <div key={i} style={{ padding: "12px 14px", backgroundColor: a.urgence === "haute" ? "#FEF2F2" : a.urgence === "normale" ? "#FFFBEB" : "#F0F9FF", borderRadius: 10, marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#0A1628", marginBottom: 3 }}>{a.action}</div>
              <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 8 }}>{a.motif}</div>
              <button
                onClick={() => setAgirAction(a)}
                style={{ padding: "4px 12px", backgroundColor: "#F59E0B", color: "white", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}
              >
                Agir
              </button>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
