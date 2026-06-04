import { colors } from "../../theme";
import { useState } from "react";
import Layout from "../../components/Layout";
import { useIsMobile } from "../../hooks/useWindowSize";

const PROTOCOLES = [
  {
    id: "paludisme_simple",
    titre: "Paludisme simple",
    couleur: "#F59E0B",
    diagnostic: "Fievre > 37.5C, frissons, cephalees, myalgies. RDT ou frottis positif P. falciparum sans signes de gravite.",
    traitement: "CTA en 1re intention (OMS 2023). Artemether-lumefantrine ou artesunate-amodiaquine.",
    medicaments: [
      { nom: "Artemether 20mg + Lumefantrine 120mg (Coartem)", dose: "4cp J0 debut, 4cp H8, 4cp matin+soir J2 et J3", route: "Oral" },
      { nom: "Paracetamol 500mg", dose: "1g toutes les 6h si fievre > 38.5C", route: "Oral" },
    ],
    notes: "Eviter aspirine chez l'enfant. Controle parasitologique J3.",
  },
  {
    id: "paludisme_severe",
    titre: "Paludisme severe",
    couleur: "#EF4444",
    diagnostic: "Coma (Glasgow < 11), convulsions, detresse respiratoire, Hb < 5 g/dL, glycemie < 2.2 mmol/L, insuffisance renale.",
    traitement: "Artesunate IV EN URGENCE. Hospitalisation USI. Perfusion glucosee 10%.",
    medicaments: [
      { nom: "Artesunate injectable 60mg", dose: "2.4 mg/kg IV a H0, H12, H24, puis 1x/j (min. 3 jours)", route: "IV" },
      { nom: "Glucose 10% 500mL", dose: "Perfusion continue. Bolus si glycemie < 2.2 mmol/L", route: "IV" },
      { nom: "Paracetamol 1g IV", dose: "1g toutes les 6h si T > 38.5C", route: "IV" },
    ],
    notes: "Surveillance horaire conscience, glycemie, diurese, TA. Relais oral par CTA des que possible.",
  },
  {
    id: "typhoide",
    titre: "Typhoide",
    couleur: "#8B5CF6",
    diagnostic: "Fievre progressivement croissante 5-7j, cephalees, bradycardie relative. Confirmation: hemoculture ou Widal > 1/160.",
    traitement: "Azithromycine ou cephalosporines 3G selon resistance locale.",
    medicaments: [
      { nom: "Azithromycine 500mg", dose: "1g J1, puis 500mg J2-J7", route: "Oral" },
      { nom: "Ceftriaxone 1g", dose: "2-4g/j IV si forme severe (7-14 jours)", route: "IV" },
    ],
    notes: "Eviter AINS. Rehydratation orale/IV. Isolement digestif. Notification obligatoire.",
  },
  {
    id: "cholera",
    titre: "Cholera",
    couleur: "#06B6D4",
    diagnostic: "Diarrhee aqueuse profuse subite (eau de riz), vomissements, deshydratation severe. Confirmation: coproculture Vibrio cholerae.",
    traitement: "REHYDRATATION EN URGENCE (priorite absolue) + antibiotiques.",
    medicaments: [
      { nom: "SRO", dose: "75 mL/kg en 4h si forme legere/moderee", route: "Oral" },
      { nom: "Ringer Lactate 500mL", dose: "100 mL/kg en 3h si choc hypovolemique", route: "IV" },
      { nom: "Doxycycline 100mg", dose: "300mg dose unique adulte", route: "Oral" },
      { nom: "Azithromycine 500mg", dose: "1g dose unique enfant/femme enceinte", route: "Oral" },
    ],
    notes: "Isolation stricte. Notification epidemique obligatoire. Pas d'anti-diarrheiques.",
  },
  {
    id: "tuberculose",
    titre: "Tuberculose pulmonaire",
    couleur: "#10B981",
    diagnostic: "Toux > 2 semaines, amaigrissement, sueurs nocturnes, hemoptysies. Confirmation: BAAR / GeneXpert. Radio: infiltrats apex.",
    traitement: "Phase intensive 2 mois RHZE + phase continuation 4 mois RH (OMS 2022 categorie I).",
    medicaments: [
      { nom: "4FDC (R150+H75+Z400+E275)", dose: "Selon poids: 30-39kg=2cp / 40-54kg=3cp / 55-70kg=4cp. 1x/j a jeun. 2 mois.", route: "Oral" },
      { nom: "2FDC (R150+H75)", dose: "Meme tableau poids. Phase continuation 4 mois.", route: "Oral" },
      { nom: "Pyridoxine B6 25mg", dose: "25-50mg/j pendant toute la duree", route: "Oral" },
    ],
    notes: "DOT obligatoire. Test VIH systematique. Notification obligatoire. Controle BK a M2 et M5.",
  },
  {
    id: "meningite",
    titre: "Meningite bacterienne",
    couleur: "#DC2626",
    diagnostic: "Triade: fievre brutale, cephalees intenses, raideur de nuque. Kernig/Brudzinski positif. Photophobie. Confirmation: PL (LCR trouble).",
    traitement: "Antibiotiques EN URGENCE avant resultats si syndrome meningee franc.",
    medicaments: [
      { nom: "Ceftriaxone 2g", dose: "2g x2/j IV 10-14j adulte ; 50mg/kg/j enfant", route: "IV" },
      { nom: "Dexamethasone 8mg", dose: "0.15mg/kg x4/j 4 jours. Avant ou avec 1re dose antibiotique", route: "IV" },
      { nom: "Paracetamol 1g IV", dose: "1g toutes les 6h", route: "IV" },
    ],
    notes: "Isolement respiratoire si meningocoque. Chimioprophylaxie contacts: Rifampicine 600mg x2/j 2j. Notification obligatoire.",
  },
];

const suggestions = [
  "Quel est le protocole OMS pour le paludisme sévère ?",
  "Quelles sont les contre-indications de la quinine ?",
  "Comment interpréter une NFS avec Hb à 7 g/dL ?",
  "Signes de gravité du choléra chez l'enfant ?",
  "Protocole de réhydratation orale — dosage adulte",
  "Interactions médicamenteuses : artéméther + halofantrine",
];

const initialMessages = [
  { role: "assistant", content: "Bonjour, je suis l'Assistant IA MedOS. Je peux vous aider a analyser votre stock, gerer vos ordonnances, ou afficher les protocoles OMS pour les maladies tropicales d'Afrique centrale." },
];

function ProtocoleCard({ protocole, onSelect }) {
  return (
    <button onClick={() => onSelect(protocole)} style={{ width: "100%", textAlign: "left", padding: "9px 12px", backgroundColor: colors.bgSurface, border: `1px solid ${colors.border}`, borderLeft: `3px solid ${protocole.couleur}`, borderRadius: 8, cursor: "pointer", marginBottom: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: protocole.couleur }}>{protocole.titre}</div>
    </button>
  );
}

function protocoleToMessage(p) {
  const meds = p.medicaments.map((m) => `  - ${m.nom}\n    Dose : ${m.dose} | Voie : ${m.route}`).join("\n");
  return `PROTOCOLE OMS — ${p.titre.toUpperCase()}\n\nDIAGNOSTIC\n${p.diagnostic}\n\nTRAITEMENT\n${p.traitement}\n\nMEDICAMENTS\n${meds}\n\nNOTES\n${p.notes}`;
}

export default function AssistantIA() {
  const isMobile = useIsMobile();
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("suggestions");

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg) return;

    const newMessages = [...messages, { role: "user", content: msg }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.REACT_APP_ANTHROPIC_API_KEY ?? "",
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-opus-4-5",
          max_tokens: 1000,
          system: `Tu es l'Assistant IA MedOS, un assistant médical expert pour les hôpitaux d'Afrique centrale.
Tu aides les médecins, infirmières et pharmaciens dans leur travail quotidien.
Tu connais les protocoles OMS pour les maladies tropicales (paludisme, typhoïde, choléra, tuberculose, méningite, VIH, hépatite B).
Tu réponds toujours en français, de façon claire et professionnelle.
Tu ne poses pas de diagnostic définitif — tu aides à la décision clinique.
Tes réponses sont concises et orientées action.`,
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await response.json();
      const reply = data.content?.[0]?.text ?? "Je n'ai pas pu générer une réponse. Veuillez réessayer.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "Connexion impossible pour le moment. Vérifiez votre connexion internet et réessayez.",
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="Assistant IA" subtitle="Intelligence artificielle et protocoles cliniques OMS — Afrique centrale">
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 300px", gap: 20, height: "calc(100vh - 160px)" }}>
        {/* Chat */}
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 16, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, marginBottom: 20 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                {msg.role === "assistant" && (
                  <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "#10B981", display: "flex", alignItems: "center", justifyContent: "center", marginRight: 10, flexShrink: 0, marginTop: 2 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                  </div>
                )}
                <div style={{ maxWidth: "75%", padding: "12px 16px", borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px", backgroundColor: msg.role === "user" ? "#10B981" : colors.bgSurface, color: msg.role === "user" ? "white" : colors.text, fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-line", fontFamily: msg.content.startsWith("PROTOCOLE") ? "monospace" : "inherit" }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "#10B981", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10"/></svg>
                </div>
                <div style={{ padding: "10px 16px", backgroundColor: colors.bgSurface, borderRadius: "18px 18px 18px 4px", fontSize: 13, color: colors.textMuted }}>Analyse en cours...</div>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, borderTop: `1px solid ${colors.border}`, paddingTop: 16 }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} placeholder="Posez votre question..." style={{ flex: 1, padding: "11px 16px", border: `1.5px solid ${colors.border}`, borderRadius: 12, fontSize: 13, outline: "none", backgroundColor: colors.bgCard, color: colors.text }} />
            <button onClick={() => sendMessage()} disabled={!input.trim() || loading} style={{ padding: "11px 20px", backgroundColor: "#10B981", color: "white", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Envoyer</button>
          </div>
        </div>

        {/* Panneau lateral */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", marginBottom: 0 }}>
            {[{ key: "suggestions", label: "Suggestions" }, { key: "protocoles", label: "Protocoles OMS" }].map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, padding: "9px 6px", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, backgroundColor: tab === t.key ? colors.bgCard : colors.bgSurface, color: tab === t.key ? "#10B981" : colors.textSecondary, borderBottom: tab === t.key ? "2px solid #10B981" : `2px solid ${colors.border}`, borderRadius: "8px 8px 0 0" }}>{t.label}</button>
            ))}
          </div>
          <div style={{ backgroundColor: colors.bgCard, borderRadius: "0 0 14px 14px", padding: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, overflowY: "auto" }}>
            {tab === "suggestions" && (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, color: colors.navy, marginBottom: 10 }}>Questions suggerees</div>
                {suggestions.map((s) => (
                  <button key={s} onClick={() => sendMessage(s)} style={{ width: "100%", padding: "9px 12px", backgroundColor: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, cursor: "pointer", textAlign: "left", fontSize: 12, color: colors.text, marginBottom: 8, lineHeight: 1.4 }}>{s}</button>
                ))}
                <div style={{ fontSize: 12, fontWeight: 700, color: colors.navy, margin: "14px 0 8px" }}>Capacites</div>
                {["Analyse stock temps reel", "Prediction de la demande", "Bons de commande auto", "Detection anomalies", "Rapports automatiques"].map((cap) => (
                  <div key={cap} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7, fontSize: 12, color: colors.textSecondary }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "#10B981", flexShrink: 0 }} />
                    {cap}
                  </div>
                ))}
              </>
            )}
            {tab === "protocoles" && (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, color: colors.navy, marginBottom: 4 }}>Maladies tropicales — Afrique centrale</div>
                <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 10 }}>Cliquez pour afficher le protocole OMS dans le chat.</div>
                {PROTOCOLES.map((p) => <ProtocoleCard key={p.id} protocole={p} onSelect={(proto) => setMessages((prev) => [...prev, { role: "assistant", content: protocoleToMessage(proto) }])} />)}
                <div style={{ fontSize: 10, color: colors.textMuted, marginTop: 8, lineHeight: 1.4 }}>Source : OMS 2023. Protocoles indicatifs — adapter selon contexte clinique local.</div>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
