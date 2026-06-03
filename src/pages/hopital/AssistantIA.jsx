import { colors } from "../../theme";
import { useState } from "react";
import Layout from "../../components/Layout";
import { useIsMobile } from "../../hooks/useWindowSize";

const suggestions = [
  "Quels médicaments sont en rupture critique ?",
  "Génère un bon de commande pour Amoxicilline",
  "Analyse la tendance des ordonnances ce mois",
  "Quels patients ont un renouvellement ce week-end ?",
];

const initialMessages = [
  {
    role: "assistant",
    content: "Bonjour, je suis l'Assistant IA MedOS. Je peux vous aider à analyser votre stock, gérer vos ordonnances, ou répondre à vos questions sur la gestion pharmaceutique hospitalière.",
  },
];

export default function AssistantIA() {
  const isMobile = useIsMobile();

  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const fakeResponses = {
    "rupture": "D'après l'inventaire actuel, 4 médicaments sont en rupture critique : Salbutamol inhaler (2 unités), Metformine 850mg (3 unités), Paracétamol 1g (8 unités) et Amoxicilline 500mg (12 unités). Je recommande de passer une commande urgente auprès de PharmaCongo et MedDistrib.",
    "commande": "Voici un bon de commande généré pour Amoxicilline 500mg :\n— Quantité : 500 boîtes\n— Fournisseur : PharmaCongo\n— Priorité : Urgente\n— Délai estimé : 3-5 jours\n\nSouhaitez-vous que je l'envoie directement au fournisseur ?",
    "tendance": "Sur les 30 derniers jours, les ordonnances ont augmenté de 12%. Les pics sont observés les lundis (+28%) et mercredis (+19%). Les antibiotiques représentent 34% des prescriptions, suivis des analgésiques (28%). Aucune anomalie détectée.",
    "renouvellement": "3 patients ont des renouvellements prévus ce week-end : Fatou Diallo (Metformine), Emmanuel Kasongo (Amlodipine + Aspirine), et Kouassi Amlan (Atorvastatine). Souhaitez-vous que je prépare leurs dossiers ?",
  };

  const sendMessage = (text) => {
    const msg = text || input.trim();
    if (!msg) return;
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setInput("");
    setLoading(true);
    setTimeout(() => {
      const key = Object.keys(fakeResponses).find((k) => msg.toLowerCase().includes(k));
      const response = key ? fakeResponses[key] : "Bonne question. D'après les données de votre système, je vais analyser cela. Pour l'instant, les données en temps réel indiquent que vos stocks sont globalement dans les normes, avec quelques points d'attention sur les antibiotiques et les antidiabétiques.";
      setMessages((prev) => [...prev, { role: "assistant", content: response }]);
      setLoading(false);
    }, 1200);
  };

  return (
    <Layout title="Assistant IA" subtitle="Intelligence artificielle au service de la gestion hospitalière">
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 280px", gap: 20, height: "calc(100vh - 160px)" }}>
        {/* Chat */}
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 16, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, marginBottom: 20 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                {msg.role === "assistant" && (
                  <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "#10B981", display: "flex", alignItems: "center", justifyContent: "center", marginRight: 10, flexShrink: 0, marginTop: 2 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                    </svg>
                  </div>
                )}
                <div style={{
                  maxWidth: "72%",
                  padding: "12px 16px",
                  borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  backgroundColor: msg.role === "user" ? "#10B981" : "#F8FAFC",
                  color: msg.role === "user" ? "white" : "#374151",
                  fontSize: 13,
                  lineHeight: 1.6,
                  whiteSpace: "pre-line",
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "#10B981", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10"/></svg>
                </div>
                <div style={{ padding: "10px 16px", backgroundColor: colors.bgSurface, borderRadius: "18px 18px 18px 4px", fontSize: 13, color: colors.textMuted }}>
                  Analyse en cours...
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Posez votre question..."
              style={{ flex: 1, padding: "11px 16px", border: "1.5px solid var(--border)", borderRadius: 12, fontSize: 13, outline: "none" }}
            />
            <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
              style={{ padding: "11px 20px", backgroundColor: "#10B981", color: "white", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Envoyer
            </button>
          </div>
        </div>

        {/* Suggestions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h4 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: colors.navy }}>Questions suggérées</h4>
            {suggestions.map((s) => (
              <button key={s} onClick={() => sendMessage(s)}
                style={{ width: "100%", padding: "10px 14px", backgroundColor: colors.bgSurface, border: "1px solid var(--border)", borderRadius: 10, cursor: "pointer", textAlign: "left", fontSize: 12, color: colors.text, marginBottom: 8, lineHeight: 1.4 }}>
                {s}
              </button>
            ))}
          </div>

          <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h4 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: colors.navy }}>Capacités</h4>
            {[
              "Analyse de stock en temps réel",
              "Prédiction de la demande",
              "Génération de bons de commande",
              "Détection d'anomalies",
              "Rapports automatiques",
            ].map((cap) => (
              <div key={cap} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 12, color: colors.textSecondary }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "#10B981" }} />
                {cap}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
