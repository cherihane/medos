import { colors } from "../../theme";
import { useState, useEffect, useMemo } from "react";
import Layout from "../../components/Layout";
import { useIsMobile } from "../../hooks/useWindowSize";
import { usePatients } from "../../hooks/useSupabaseData";
import { supabase } from "../../supabaseClient";

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
  {
    id: "vih_primo",
    titre: "VIH — Primo-infection / Initiation ARV",
    couleur: "#7C3AED",
    diagnostic: "Test ELISA/TDR positif confirme. Bilan initial : CD4, charge virale, NFS, transaminases, creatinine, glycemie.",
    traitement: "Initiation ARV le jour meme si possible (OMS 2021). Schema preferentiel : TDF + 3TC + DTG.",
    medicaments: [
      { nom: "TDF 300mg + 3TC 300mg + DTG 50mg (FDC)", dose: "1 comprime 1x/j au repas. A vie.", route: "Oral" },
      { nom: "Cotrimoxazole 960mg (prophylaxie si CD4 < 200)", dose: "1 cp/j. Arreter si CD4 > 350 > 6 mois", route: "Oral" },
    ],
    notes: "Eviter Rifampicine + DTG (remplacer DTG par EFV si TB active). Counseling adherence. Notification partenaires.",
  },
  {
    id: "hepatite_b",
    titre: "Hepatite B chronique",
    couleur: "#F59E0B",
    diagnostic: "AgHBs positif > 6 mois. Bilan : AgHBe, Ac anti-HBe, charge virale HBV, ALAT, echographie hepatique.",
    traitement: "Traitement si charge virale > 2000 UI/mL et/ou ALAT elevees et/ou fibrose significative.",
    medicaments: [
      { nom: "Tenofovir disoproxil 300mg (TDF)", dose: "300mg 1x/j. Traitement long terme.", route: "Oral" },
    ],
    notes: "Surveillance ALAT et charge virale tous les 6 mois. Depistage CHC : echographie + AFP tous les 6 mois si cirrhose. Vacciner entourage.",
  },
  {
    id: "drepanocytose",
    titre: "Drepanocytose — Crise vaso-occlusive",
    couleur: "#EF4444",
    diagnostic: "Douleurs osseuses/abdominales intenses chez patient SS connu. Fievre possible. Eliminer infection associee.",
    traitement: "Analgesie rapide + hydratation + traitement etiologique.",
    medicaments: [
      { nom: "Morphine 0.1mg/kg IV", dose: "Titration toutes les 5-10 min jusqu'a soulagement. Max 0.5mg/kg", route: "IV" },
      { nom: "Ketorolac 30mg", dose: "30mg IV toutes les 6h (adulte, 5 jours max)", route: "IV" },
      { nom: "Paracetamol 1g", dose: "1g toutes les 6h en alternance", route: "IV/Oral" },
      { nom: "Ringer Lactate 500mL", dose: "500mL en 1h puis 125mL/h", route: "IV" },
    ],
    notes: "Antibiotiques si fievre > 38.5 (Ceftriaxone). O2 si SpO2 < 95%. Transfusion si Hb < 5g/dL ou aggravation.",
  },
  {
    id: "hypertension",
    titre: "HTA — Urgence hypertensive",
    couleur: "#06B6D4",
    diagnostic: "TA > 180/120 mmHg avec signes de souffrance organique (cephalees, troubles visuels, douleur thoracique, oligurie).",
    traitement: "Reduction progressive de 20-25% en 1h. Pas de normalisation trop rapide.",
    medicaments: [
      { nom: "Nicardipine 10mg IV", dose: "Perfusion 2-4mg/h, titration jusqu'a 10mg/h", route: "IV" },
      { nom: "Captopril 25mg (si pas IV disponible)", dose: "25mg sublingual. Effet en 15-30 min.", route: "Sublingual" },
      { nom: "Furosemide 40mg (si OAP)", dose: "40mg IV si signes de surcharge", route: "IV" },
    ],
    notes: "ECG, fond d'oeil, creatinine en urgence. Surveillance TA toutes les 15 min. Pas de nifedipine sublingual (hypotension brutale).",
  },
  {
    id: "diabete_urgence",
    titre: "Diabete — Cetoacidose",
    couleur: "#8B5CF6",
    diagnostic: "Glycemie > 13.9 mmol/L + cetones urinaires/sanguines + pH < 7.3 ou bicarbonates < 15 mmol/L.",
    traitement: "Rehydratation + insulinotherapie IV + correction electrolytique.",
    medicaments: [
      { nom: "NaCl 0.9% 1000mL", dose: "1L en 1h, puis 500mL/h x2h, puis 250mL/h selon etat", route: "IV" },
      { nom: "Insuline rapide (Actrapid)", dose: "0.1 UI/kg/h IVSE. Passer a 0.05 UI/kg/h si glycemie < 11 mmol/L", route: "IV" },
      { nom: "KCl", dose: "Si K+ < 3.5 : 40 mEq/h. Si K+ 3.5-5 : 20 mEq/h. Si K+ > 5 : ne pas supplementer", route: "IV" },
    ],
    notes: "Surveiller glycemie horaire. Bilan initial : ionogramme, pH, lactates, ECG. Chercher facteur declenchant (infection, ecart de regime).",
  },
  {
    id: "malnutrition",
    titre: "Malnutrition severe aigue",
    couleur: "#10B981",
    diagnostic: "Perimetre brachial < 115mm OU P/T < -3 Z-scores OMS OU oedemes bilateraux membres inferieurs. Kwashiorkor ou Marasme.",
    traitement: "Phase stabilisation (J1-J7) + phase rehabilitation (J8-J56). Protocole PCIMA.",
    medicaments: [
      { nom: "F-75 (lait therapeutique)", dose: "Phase 1 : 100kcal/kg/j. 8 repas/24h.", route: "Oral/SNG" },
      { nom: "F-100 ou ATPE", dose: "Phase 2 : 150-220kcal/kg/j. 5-6 repas/j.", route: "Oral" },
      { nom: "Amoxicilline 40mg/kg/j", dose: "En 2 prises, 7 jours systematiquement", route: "Oral" },
      { nom: "Vitamine A", dose: "Jour 1 : 200 000 UI (> 1 an). 100 000 UI (6-12 mois)", route: "Oral" },
    ],
    notes: "Ne pas donner fer en phase stabilisation. Traiter hypoglycemie (glucose 10% 5mL/kg IV). Chaleur, affection, stimulation.",
  },
];

const suggestions = [
  "Protocole paludisme severe enfant 15kg",
  "Interpretation NFS : Hb 7g/dL, GB 12000, Plaquettes 450000",
  "Interactions : artemether + halofantrine ?",
  "Signes de gravite meningite bacterienne",
  "Dose ceftriaxone enfant 25kg en IV",
  "Bilan initial diabete type 2 nouvellement diagnostique",
  "Comment distinguer paludisme simple et typhoide ?",
  "Protocole rehydratation cholera adulte",
];

const initialMessages = [
  { role: "assistant", content: "Bonjour, je suis l'Assistant IA MedOS. Je suis votre assistant clinique pour les maladies tropicales et les situations d'urgence. Vous pouvez charger un patient actif dans l'onglet 'Patient actif' pour des reponses personnalisees a son contexte." },
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
  const { data: patients } = usePatients();
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("suggestions");
  const [patientContext, setPatientContext] = useState(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [filtrePatient, setFiltrePatient] = useState("");

  const patientsFiltres = useMemo(() => {
    const q = filtrePatient.toLowerCase();
    return patients.filter((p) =>
      !q || `${p.prenom} ${p.nom}`.toLowerCase().includes(q) || (p.numero_dossier ?? "").includes(q)
    ).slice(0, 60);
  }, [patients, filtrePatient]);

  async function chargerContextePatient(patient_id) {
    if (!patient_id) return;
    setLoadingContext(true);
    try {
      const [constRes, ordRes, exRes, patRes] = await Promise.all([
        supabase.from("constantes_vitales").select("*").eq("patient_id", patient_id).order("created_at", { ascending: false }).limit(3),
        supabase.from("ordonnances").select("*").eq("patient_id", patient_id).order("date_emission", { ascending: false }).limit(5),
        supabase.from("examens").select("*").eq("patient_id", patient_id).order("created_at", { ascending: false }).limit(5),
        supabase.from("patients").select("allergies, antecedents, date_naissance, genre, groupe_sanguin, prenom, nom").eq("id", patient_id).maybeSingle(),
      ]);
      const pat = patRes.data;
      setPatientContext({
        patient_id,
        nom: pat ? `${pat.prenom} ${pat.nom}` : "Inconnu",
        constantes: constRes.data ?? [],
        ordonnances: ordRes.data ?? [],
        examens: exRes.data ?? [],
        allergies: pat?.allergies ?? [],
        antecedents: pat?.antecedents ?? [],
        date_naissance: pat?.date_naissance,
        genre: pat?.genre,
        groupe_sanguin: pat?.groupe_sanguin,
      });
    } catch { /* noop */ }
    finally { setLoadingContext(false); }
  }

  const systemPrompt = useMemo(() => {
    const base = `Tu es l'Assistant IA MedOS, expert medical pour les hopitaux d'Afrique centrale.
Tu aides les medecins dans leur travail clinique quotidien.
Tu connais les protocoles OMS pour les maladies tropicales (paludisme, typhoide, cholera, tuberculose, meningite, VIH, hepatite B, drepanocytose, hypertension, diabete, malnutrition severe).
Tu reponds en francais, de facon concise et orientee action clinique.
Tu ne poses pas de diagnostic definitif. Tu aides a la decision.`;

    if (!patientContext) return base;

    const c = patientContext;
    const age = c.date_naissance ? Math.floor((Date.now() - new Date(c.date_naissance)) / 31557600000) + " ans" : "inconnu";
    const dernieresConstantes = c.constantes.length > 0
      ? `T ${c.constantes[0].temperature ?? "--"}C, TA ${c.constantes[0].tension_systolique ?? "--"}/${c.constantes[0].tension_diastolique ?? "--"}, Pouls ${c.constantes[0].pouls ?? "--"}, SpO2 ${c.constantes[0].saturation_o2 ?? "--"}%`
      : "non disponibles";
    const ordsRecentes = c.ordonnances.slice(0, 3).map((o) => o.reference ?? "ord.").join(", ") || "aucune";
    const examRecents  = c.examens.slice(0, 3).map((e) => `${e.type_examen ?? "examen"} (${e.statut})`).join(", ") || "aucun";

    return `${base}

CONTEXTE PATIENT ACTIF : ${c.nom}
- Age : ${age}
- Genre : ${c.genre ?? "inconnu"}
- Groupe sanguin : ${c.groupe_sanguin ?? "inconnu"}
- Allergies : ${c.allergies.length > 0 ? c.allergies.join(", ") : "aucune connue"}
- Antecedents : ${c.antecedents.length > 0 ? c.antecedents.join(", ") : "aucun"}
- Dernieres constantes : ${dernieresConstantes}
- Ordonnances recentes : ${ordsRecentes}
- Examens recents : ${examRecents}
Utilise ce contexte pour personnaliser tes reponses cliniques.`;
  }, [patientContext]);

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
          max_tokens: 1024,
          system: systemPrompt,
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await response.json();
      const reply = data.content?.[0]?.text ?? "Je n'ai pas pu generer une reponse. Veuillez reessayer.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "Connexion impossible pour le moment. Verifiez votre connexion internet et reessayez.",
      }]);
    } finally {
      setLoading(false);
    }
  };

  const TABS = [
    { key: "suggestions", label: "Suggestions" },
    { key: "protocoles",  label: "Protocoles OMS" },
    { key: "patient",     label: "Patient actif" },
  ];

  return (
    <Layout title="Assistant IA" subtitle="Intelligence artificielle et protocoles cliniques OMS — Afrique centrale">
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 300px", gap: 20, height: "calc(100vh - 160px)" }}>
        {/* Chat */}
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 16, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column" }}>
          {patientContext && (
            <div style={{ padding: "8px 14px", backgroundColor: "#EFF6FF", borderRadius: 8, marginBottom: 12, fontSize: 12, color: "#2563EB", fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Patient actif : {patientContext.nom}</span>
              <button onClick={() => setPatientContext(null)} style={{ background: "none", border: "none", fontSize: 14, cursor: "pointer", color: "#93C5FD" }}>x</button>
            </div>
          )}
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
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} placeholder="Posez votre question clinique..." style={{ flex: 1, padding: "11px 16px", border: `1.5px solid ${colors.border}`, borderRadius: 12, fontSize: 13, outline: "none", backgroundColor: colors.bgCard, color: colors.text }} />
            <button onClick={() => sendMessage()} disabled={!input.trim() || loading} style={{ padding: "11px 20px", backgroundColor: "#10B981", color: "white", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Envoyer</button>
          </div>
        </div>

        {/* Panneau lateral */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", marginBottom: 0 }}>
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, padding: "9px 4px", border: "none", cursor: "pointer", fontSize: 10, fontWeight: 700, backgroundColor: tab === t.key ? colors.bgCard : colors.bgSurface, color: tab === t.key ? "#10B981" : colors.textSecondary, borderBottom: tab === t.key ? "2px solid #10B981" : `2px solid ${colors.border}`, borderRadius: "8px 8px 0 0" }}>{t.label}</button>
            ))}
          </div>
          <div style={{ backgroundColor: colors.bgCard, borderRadius: "0 0 14px 14px", padding: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, overflowY: "auto" }}>

            {tab === "suggestions" && (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, color: colors.navy, marginBottom: 10 }}>Questions suggerees</div>
                {suggestions.map((s) => (
                  <button key={s} onClick={() => sendMessage(s)} style={{ width: "100%", padding: "9px 12px", backgroundColor: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, cursor: "pointer", textAlign: "left", fontSize: 11, color: colors.text, marginBottom: 8, lineHeight: 1.4 }}>{s}</button>
                ))}
                <div style={{ fontSize: 12, fontWeight: 700, color: colors.navy, margin: "14px 0 8px" }}>Capacites</div>
                {["Protocoles OMS maladies tropicales", "Aide a la decision clinique", "Calcul de doses pediatriques", "Interactions medicamenteuses", "Interpretation des examens", "Prise en charge urgences"].map((cap) => (
                  <div key={cap} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7, fontSize: 11, color: colors.textSecondary }}>
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

            {tab === "patient" && (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, color: colors.navy, marginBottom: 8 }}>Charger le contexte d'un patient</div>
                <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 12, lineHeight: 1.5 }}>
                  Selectionnez un patient pour que l'IA reponde en tenant compte de ses antecedents, allergies, constantes et ordonnances.
                </div>
                <input
                  placeholder="Rechercher un patient..."
                  value={filtrePatient}
                  onChange={(e) => setFiltrePatient(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", border: `1.5px solid ${colors.border}`, borderRadius: 8, fontSize: 12, outline: "none", marginBottom: 6, boxSizing: "border-box", backgroundColor: colors.bgCard, color: colors.text }}
                />
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", border: `1.5px solid ${colors.border}`, borderRadius: 8, fontSize: 12, outline: "none", marginBottom: 10, boxSizing: "border-box", backgroundColor: colors.bgCard, color: colors.text, cursor: "pointer" }}
                >
                  <option value="">-- Selectionner un patient --</option>
                  {patientsFiltres.map((p) => <option key={p.id} value={p.id}>{p.prenom} {p.nom}{p.numero_dossier ? ` — ${p.numero_dossier}` : ""}</option>)}
                </select>
                <button
                  onClick={() => chargerContextePatient(selectedPatientId)}
                  disabled={!selectedPatientId || loadingContext}
                  style={{ width: "100%", padding: "9px", backgroundColor: !selectedPatientId || loadingContext ? "#D1D5DB" : "#10B981", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: !selectedPatientId || loadingContext ? "wait" : "pointer", marginBottom: 14 }}
                >
                  {loadingContext ? "Chargement..." : "Charger ce patient"}
                </button>

                {patientContext && (
                  <div style={{ backgroundColor: "#F0FDF4", borderRadius: 10, padding: "12px 14px", border: "1.5px solid #86EFAC" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#16A34A", marginBottom: 8 }}>Contexte charge : {patientContext.nom}</div>
                    {[
                      ["Allergies", patientContext.allergies.join(", ") || "Aucune"],
                      ["Antecedents", patientContext.antecedents.join(", ") || "Aucun"],
                      ["Constantes", patientContext.constantes.length > 0 ? `T ${patientContext.constantes[0].temperature ?? "--"}C, SpO2 ${patientContext.constantes[0].saturation_o2 ?? "--"}%` : "Non disponibles"],
                      ["Ordonnances", `${patientContext.ordonnances.length} en base`],
                      ["Examens", `${patientContext.examens.length} en base`],
                    ].map(([l, v]) => (
                      <div key={l} style={{ fontSize: 11, color: colors.text, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, color: "#16A34A" }}>{l} : </span>{v}
                      </div>
                    ))}
                    <div style={{ fontSize: 11, color: "#16A34A", marginTop: 8, fontWeight: 600 }}>L'IA prend maintenant ce contexte en compte dans ses reponses.</div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
