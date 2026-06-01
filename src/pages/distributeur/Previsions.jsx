import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import Layout from "../../components/Layout";
import PredictionsIA from "../../components/PredictionsIA";
import { useKpiDistributeur } from "../../hooks/useSupabaseData";
import { insertCommande } from "../../hooks/useMutations";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../supabaseClient";

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

const RESEND_KEY  = "re_iUaDVQFG_LAX2mHCRxm6rf216167mGdJY";

async function sendCommandeEmail({ emailFabricant, fabricant, medicament, quantite, dateLivraison, notes, distributeur }) {
  const dateStr = dateLivraison
    ? new Date(dateLivraison).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
    : "Non précisée";
  const now = new Date().toLocaleString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const html = `
<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
  <div style="background:#F59E0B;padding:28px 32px">
    <h1 style="color:white;margin:0;font-size:20px;font-weight:700">Commande de médicaments</h1>
    <p style="color:rgba(255,255,255,0.88);margin:6px 0 0;font-size:13px">MedOS — Plateforme de distribution médicale</p>
  </div>

  <div style="padding:28px 32px">
    <p style="font-size:14px;color:#374151;margin:0 0 20px">Bonjour,</p>
    <p style="font-size:14px;color:#374151;margin:0 0 20px">
      Le distributeur <strong>${distributeur}</strong> vous adresse une commande via la plateforme MedOS.
      Veuillez en prendre note et confirmer la disponibilité dans les meilleurs délais.
    </p>

    <div style="background:#F8FAFC;border-radius:10px;padding:20px;margin-bottom:20px">
      <h2 style="font-size:14px;font-weight:700;color:#0A1628;margin:0 0 14px">Détails de la commande</h2>
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:9px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;width:46%">Médicament</td>
          <td style="padding:9px 0;border-bottom:1px solid #e5e7eb;font-weight:700;font-size:13px;color:#0A1628">${medicament}</td>
        </tr>
        <tr>
          <td style="padding:9px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px">Fabricant destinataire</td>
          <td style="padding:9px 0;border-bottom:1px solid #e5e7eb;font-weight:700;font-size:13px;color:#0A1628">${fabricant}</td>
        </tr>
        <tr>
          <td style="padding:9px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px">Quantité commandée</td>
          <td style="padding:9px 0;border-bottom:1px solid #e5e7eb;font-weight:700;font-size:13px;color:#0A1628">${quantite} unités</td>
        </tr>
        <tr>
          <td style="padding:9px 0;border-bottom:${notes ? "1px solid #e5e7eb" : "none"};color:#6b7280;font-size:13px">Date de livraison souhaitée</td>
          <td style="padding:9px 0;border-bottom:${notes ? "1px solid #e5e7eb" : "none"};font-weight:700;font-size:13px;color:#0A1628">${dateStr}</td>
        </tr>
        ${notes ? `
        <tr>
          <td style="padding:9px 0;color:#6b7280;font-size:13px">Instructions particulières</td>
          <td style="padding:9px 0;font-size:13px;color:#374151">${notes}</td>
        </tr>` : ""}
      </table>
    </div>

    <div style="background:#FFFBEB;border-left:4px solid #F59E0B;border-radius:6px;padding:12px 16px;margin-bottom:24px">
      <p style="font-size:12px;color:#92400E;margin:0">
        Cette commande a été générée automatiquement par MedOS suite à une prévision de la demande.
        Merci de répondre directement à cet email ou de contacter le distributeur pour confirmer.
      </p>
    </div>

    <p style="font-size:13px;color:#6b7280;margin:0">
      Commande émise le ${now}
    </p>
  </div>

  <div style="background:#F8FAFC;padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center">
    <p style="font-size:12px;color:#9CA3AF;margin:0">
      MedOS — Plateforme de distribution médicale &nbsp;·&nbsp; Côte d'Ivoire
    </p>
  </div>
</div>`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from:    "MedOS Distribution <onboarding@resend.dev>",
      to:      [emailFabricant],
      subject: `Commande MedOS — ${medicament} (${quantite} unités)`,
      html,
    }),
  });
}

// ─── Modal Agir ───────────────────────────────────────────────────────────────
function AgirModal({ action, onClose, onSaved, etablissement_id, distributeurNom }) {
  const [fabricant, setFabricant]         = useState("");
  const [fabricants, setFabricants]       = useState([]);
  const [loadingFab, setLoadingFab]       = useState(true);
  const [emailFabricant, setEmailFabricant] = useState("");
  const [quantite, setQuantite]           = useState(String(action.quantite ?? 500));
  const [dateLivraison, setDateLivraison] = useState("");
  const [notes, setNotes]                 = useState("");
  const [saving, setSaving]               = useState(false);
  const [erreur, setErreur]               = useState(null);

  const urgenceBg = action.urgence === "haute" ? "#FEF2F2" : action.urgence === "normale" ? "#FFFBEB" : "#F0F9FF";

  // Charger les fabricants distincts depuis lots → medicaments
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingFab(true);
      try {
        const { data: meds } = await supabase
          .from("medicaments")
          .select("id")
          .ilike("nom", `${action.medicament.split(" ")[0]}%`);

        const ids = (meds ?? []).map((m) => m.id);
        let liste = [];
        if (ids.length > 0) {
          const { data: lots } = await supabase
            .from("lots")
            .select("fabricant")
            .in("medicament_id", ids)
            .not("fabricant", "is", null);
          liste = [...new Set((lots ?? []).map((l) => l.fabricant).filter(Boolean))].sort();
        }
        if (!cancelled) setFabricants(liste);
      } catch {
        // silencieux
      } finally {
        if (!cancelled) setLoadingFab(false);
      }
    })();
    return () => { cancelled = true; };
  }, [action.medicament]);

  const handleSave = async () => {
    setErreur(null);
    if (!fabricant.trim()) { setErreur("Sélectionnez ou saisissez un fabricant."); return; }
    if (!emailFabricant.trim() || !emailFabricant.includes("@")) { setErreur("Email du fabricant invalide."); return; }
    const qty = parseInt(quantite, 10);
    if (!qty || qty <= 0) { setErreur("Quantité invalide."); return; }
    setSaving(true);
    try {
      const notesFinales = [
        `Médicament : ${action.medicament}`,
        `Fabricant : ${fabricant.trim()}`,
        `Email fabricant : ${emailFabricant.trim()}`,
        `Quantité commandée : ${qty} unités`,
        `Livraison souhaitée : ${dateLivraison || "Non précisée"}`,
        `Prévision IA : ${action.motif}`,
        notes.trim() ? `Instructions : ${notes.trim()}` : null,
      ].filter(Boolean).join(" | ");

      await insertCommande({
        statut:                "envoyee",
        date_commande:         new Date().toISOString(),
        date_livraison_prevue: dateLivraison || null,
        montant_total:         0,
        notes:                 notesFinales,
        ...(etablissement_id ? { etablissement_id } : {}),
      });

      await sendCommandeEmail({
        emailFabricant: emailFabricant.trim(),
        fabricant:      fabricant.trim(),
        medicament:     action.medicament,
        quantite:       qty,
        dateLivraison,
        notes:          notes.trim(),
        distributeur:   distributeurNom,
      });

      onSaved(`Commande envoyée à ${fabricant.trim()} (${emailFabricant.trim()}).`);
      onClose();
    } catch (e) {
      setErreur("Erreur : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ backgroundColor: "white", borderRadius: 16, width: 500, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        {/* En-tête */}
        <div style={{ padding: "20px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Passer une commande fabricant</h3>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 3 }}>{action.action}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF", flexShrink: 0 }}>×</button>
        </div>

        <div style={{ padding: "18px 24px" }}>
          {/* Motif IA */}
          <div style={{ backgroundColor: urgenceBg, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#374151" }}>
            <strong>Prévision IA :</strong> {action.motif}
          </div>

          {/* Médicament pré-rempli (lecture seule) */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Médicament concerné</label>
            <input
              style={{ ...inputStyle, backgroundColor: "#F8FAFC", color: "#6B7280", cursor: "not-allowed" }}
              value={action.medicament}
              readOnly
            />
          </div>

          {/* Fabricant */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
              Fabricant <span style={{ color: "#EF4444" }}>*</span>
            </label>
            {loadingFab ? (
              <div style={{ ...inputStyle, backgroundColor: "#F8FAFC", color: "#9CA3AF" }}>Chargement…</div>
            ) : fabricants.length > 0 ? (
              <select style={{ ...inputStyle, cursor: "pointer" }} value={fabricant} onChange={(e) => setFabricant(e.target.value)}>
                <option value="">— Sélectionner un fabricant —</option>
                {fabricants.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            ) : (
              <input
                style={inputStyle}
                value={fabricant}
                onChange={(e) => setFabricant(e.target.value)}
                placeholder="Nom du fabricant"
              />
            )}
          </div>

          {/* Email fabricant */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
              Email du fabricant <span style={{ color: "#EF4444" }}>*</span>
              <span style={{ fontSize: 10, color: "#6B7280", fontWeight: 400, marginLeft: 6 }}>— un email de commande lui sera envoyé automatiquement</span>
            </label>
            <input
              style={inputStyle}
              type="email"
              value={emailFabricant}
              onChange={(e) => setEmailFabricant(e.target.value)}
              placeholder="commandes@fabricant.com"
            />
          </div>

          {/* Quantité + Date */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
                Quantité (unités) <span style={{ fontSize: 10, color: "#F59E0B", fontWeight: 500 }}>suggérée par IA</span>
              </label>
              <input style={inputStyle} type="number" min="1" value={quantite} onChange={(e) => setQuantite(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Date de livraison souhaitée</label>
              <input style={inputStyle} type="date" value={dateLivraison} onChange={(e) => setDateLivraison(e.target.value)} />
            </div>
          </div>

          {/* Notes libres */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Instructions particulières</label>
            <input style={inputStyle} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Conditionnement spécifique, urgence, etc." />
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
              {saving ? "Envoi en cours…" : "Envoyer la commande"}
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
    { action: "Commander Paracétamol 1g",     medicament: "Paracétamol 1g",   quantite: 5000, motif: "Demande prévue +24% en février",  urgence: "haute"   },
    { action: "Commander Metformine 500mg",   medicament: "Metformine 500mg", quantite: 3000, motif: "Demande +42% sur 3 mois",          urgence: "haute"   },
    { action: "Réduire stock Ibuprofène",     medicament: "Ibuprofène 400mg", quantite: 500,  motif: "Surstock prévu de 18%",            urgence: "normale" },
    { action: "Renégocier tarifs Vitamine C", medicament: "Vitamine C 500mg", quantite: 8000, motif: "Volume x1.5 prévu sur 6 mois",    urgence: "faible"  },
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
          etablissement_id={auth?.etablissement_id ?? null}
          distributeurNom={auth?.structure ?? "MedDistrib International"}
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
