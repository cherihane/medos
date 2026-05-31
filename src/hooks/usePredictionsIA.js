/**
 * usePredictionsIA — Analyse les données Supabase et appelle Groq API
 * pour générer des prédictions intelligentes de rupture, saisonnières
 * et des suggestions de commande automatique.
 */
import { useState, useCallback } from "react";
import { supabase } from "../supabaseClient";

const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_API = "https://api.groq.com/openai/v1/chat/completions";

async function fetchStockData() {
  const { data, error } = await supabase
    .from("medicaments")
    .select("id, nom, categorie, stock_actuel, stock_minimum, unite, prix_unitaire")
    .order("nom");
  if (error) throw new Error("Erreur Supabase medicaments : " + error.message);
  return data || [];
}

async function fetchAlertesData() {
  const { data, error } = await supabase
    .from("alertes")
    .select("id, medicament_id, type, severite, created_at, message")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return []; // alertes are optional
  return data || [];
}

async function callGroq(prompt) {
  const apiKey = process.env.REACT_APP_GROQ_API_KEY;
  if (!apiKey) throw new Error("Clé API Groq manquante (REACT_APP_GROQ_API_KEY)");

  const response = await fetch(GROQ_API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: 2048,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `Tu es un expert en gestion de stocks pharmaceutiques pour l'Afrique centrale (Cameroun).
Tu analyses les données de stock réelles et génères des prédictions précises.
Réponds UNIQUEMENT en JSON valide, sans texte avant ni après, sans balises markdown.
La date actuelle est ${new Date().toLocaleDateString("fr-FR")}.`,
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Erreur API Groq ${response.status}`);
  }

  const body = await response.json();
  const text = body.choices?.[0]?.message?.content;
  if (!text) throw new Error("Réponse Groq vide");

  try {
    // Strip possible markdown code fences
    const clean = text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    return JSON.parse(clean);
  } catch {
    throw new Error("Réponse Groq non-JSON : " + text.slice(0, 200));
  }
}

function buildPrompt(medicaments, alertes) {
  const stockLines = medicaments.map((m) => {
    const pct = m.stock_minimum > 0
      ? Math.round((m.stock_actuel / m.stock_minimum) * 100)
      : 999;
    return `- ${m.nom} | stock: ${m.stock_actuel} ${m.unite || "unités"} | seuil: ${m.stock_minimum} | ratio: ${pct}% | catégorie: ${m.categorie || "N/A"}`;
  }).join("\n");

  const alerteLines = alertes.slice(0, 20).map((a) =>
    `- ${a.type} (${a.severite}) : ${a.message || ""} [${new Date(a.created_at).toLocaleDateString("fr-FR")}]`
  ).join("\n");

  const mois = new Date().getMonth() + 1; // 1-12

  return `
Voici les données de stock réelles de la pharmacie/hôpital :

STOCKS ACTUELS (${medicaments.length} médicaments) :
${stockLines || "Aucune donnée de stock"}

ALERTES RÉCENTES :
${alerteLines || "Aucune alerte récente"}

CONTEXTE SAISONNIER :
Mois actuel : ${mois} (${["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"][mois-1]})
Région : Afrique centrale (Cameroun)
- Saison paludisme (pics) : Mars-Juin et Septembre-Novembre
- Saison choléra : Juin-Octobre (saison des pluies)
- Méningite : Janvier-Avril (saison sèche)

Génère une analyse JSON avec exactement cette structure :

{
  "ruptures": [
    {
      "nom": "Nom du médicament",
      "risque7j": 85,
      "risque14j": 95,
      "risque30j": 99,
      "stock_actuel": 50,
      "stock_minimum": 100,
      "urgence": "critique|alerte|modere"
    }
  ],
  "saisonnier": [
    {
      "maladie": "Paludisme",
      "niveau": "pic|normal|bas",
      "medicaments_prioritaires": ["Artémether", "Quinine"],
      "message": "Pic saisonnier détecté — augmenter les stocks de 40%",
      "couleur": "#DC2626"
    }
  ],
  "commandes": [
    {
      "nom": "Nom du médicament",
      "quantite_recommandee": 500,
      "priorite": "urgente|haute|normale",
      "raison": "Stock à 12% du seuil minimum"
    }
  ],
  "resume": "Résumé général en 1 phrase de la situation du stock"
}

Inclure dans "ruptures" uniquement les médicaments avec un ratio stock/seuil inférieur à 200%.
Trier par urgence (critique en premier).
Maximum 6 ruptures, 3 alertes saisonnières, 8 commandes.
`.trim();
}

/**
 * Hook principal
 * Usage : const { predictions, loading, error, analyser } = usePredictionsIA();
 */
export function usePredictionsIA() {
  const [predictions, setPredictions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const analyser = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [medicaments, alertes] = await Promise.all([
        fetchStockData(),
        fetchAlertesData(),
      ]);

      if (medicaments.length === 0) {
        setPredictions({
          ruptures: [],
          saisonnier: [],
          commandes: [],
          resume: "Aucun médicament enregistré dans la base de données.",
        });
        return;
      }

      const prompt = buildPrompt(medicaments, alertes);
      const result = await callGroq(prompt);
      setPredictions(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { predictions, loading, error, analyser };
}
