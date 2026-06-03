import { colors } from "../../theme";
import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts";
import Layout from "../../components/Layout";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../supabaseClient";
import { openDocument, tableHTML, kpiHTML, fetchEtabFromAuth } from "../../utils/MedOSDocument";

// ── Constantes ────────────────────────────────────────────────────────────────
const ACCENT = "#10B981";
const MOIS_LABELS = ["Jan", "Fev", "Mar", "Avr", "Mai", "Jun", "Jul", "Aou", "Sep", "Oct", "Nov", "Dec"];
const SERVICES_LITS = ["Urgences", "Medecine generale", "Maternite", "Pediatrie", "Chirurgie"];
const SERVICE_COLOR = {
  "Medecine generale": "#3B82F6", "Maternite": "#EC4899",
  "Pediatrie": "#F59E0B", "Cardiologie": "#EF4444",
  "Chirurgie": "#8B5CF6", "Urgences": "#DC2626",
  "Neurologie": "#06B6D4", "Ophtalmologie": ACCENT,
};

function fmtKFCFA(n) {
  if (!n) return "0 FCFA";
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M FCFA`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K FCFA`;
  return `${n.toLocaleString("fr-FR")} FCFA`;
}

function ts() { return new Date(); }
function debutMois() { const d = ts(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString(); }
function finMois()   { const d = ts(); return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString(); }

// ── Onglet Activite clinique ──────────────────────────────────────────────────
function OngletActivite({ etabId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const debut = debutMois();
    const fin   = finMois();
    const debut6m = new Date(ts().getFullYear(), ts().getMonth() - 5, 1).toISOString();

    const [hospiRes, consultMoisRes, consultHistoRes, examRes, litsRes, configRes] = await Promise.all([
      supabase.from("hospitalisations").select("id").eq("statut", "hospitalise"),
      supabase.from("consultations").select("id, service, motif").gte("heure_arrivee", debut).lte("heure_arrivee", fin),
      supabase.from("consultations").select("heure_arrivee, service").gte("heure_arrivee", debut6m),
      supabase.from("examens").select("id").in("statut", ["prescrit", "en_cours"]),
      supabase.from("hospitalisations").select("service").eq("statut", "hospitalise"),
      supabase.from("configuration_lits").select("service, capacite_totale"),
    ]);

    const { data: hospiTerminees } = await supabase
      .from("hospitalisations").select("date_entree, date_sortie_reelle")
      .eq("statut", "sorti").gte("date_sortie_reelle", debut).lte("date_sortie_reelle", fin)
      .not("date_entree", "is", null).not("date_sortie_reelle", "is", null);

    const durees = (hospiTerminees ?? []).map((h) => (new Date(h.date_sortie_reelle) - new Date(h.date_entree)) / 86400000).filter((d) => d >= 0);
    const dureeMoyenne = durees.length > 0 ? (durees.reduce((a, b) => a + b, 0) / durees.length).toFixed(1) : 0;

    const moisHisto = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(ts().getFullYear(), ts().getMonth() - (5 - i), 1);
      return { mois: MOIS_LABELS[d.getMonth()], year: d.getFullYear(), month: d.getMonth() };
    });
    (consultHistoRes.data ?? []).forEach((c) => {
      const d = new Date(c.heure_arrivee);
      const m = moisHisto.find((x) => x.year === d.getFullYear() && x.month === d.getMonth());
      if (!m) return;
      const svc = c.service ?? "Autre";
      m[svc] = (m[svc] ?? 0) + 1;
    });

    const motifCount = {};
    (consultMoisRes.data ?? []).forEach((c) => {
      const motif = (c.motif ?? "Non precise").slice(0, 40);
      motifCount[motif] = (motifCount[motif] ?? 0) + 1;
    });
    const top5 = Object.entries(motifCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const litParService = {};
    (litsRes.data ?? []).forEach((h) => { litParService[h.service] = (litParService[h.service] ?? 0) + 1; });
    const capaciteParService = {};
    (configRes.data ?? []).forEach((c) => { capaciteParService[c.service] = c.capacite_totale; });
    const tauxOccup = SERVICES_LITS.map((s) => ({
      service: s,
      occupes: litParService[s] ?? 0,
      capacite: capaciteParService[s] ?? 10,
      taux: Math.round(((litParService[s] ?? 0) / (capaciteParService[s] ?? 10)) * 100),
    }));

    const servicesPresents = [...new Set((consultHistoRes.data ?? []).map((c) => c.service).filter(Boolean))].slice(0, 6);

    setData({ nbHospitalises: hospiRes.data?.length ?? 0, nbConsultMois: consultMoisRes.data?.length ?? 0, dureeMoyenne, nbExamEnAttente: examRes.data?.length ?? 0, consultHisto: moisHisto, servicesPresents, top5, tauxOccup });
    setLoading(false);
  }, [etabId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: colors.textMuted }}>Chargement...</div>;
  if (!data) return null;

  return (
    <div>
      <div className="kpi-row" style={{ marginBottom: 20 }}>
        {[
          { label: "Patients hospitalises",  value: data.nbHospitalises,  color: "#EF4444" },
          { label: "Consultations ce mois",  value: data.nbConsultMois,   color: "#3B82F6" },
          { label: "Duree moy. sejour (j)",  value: data.dureeMoyenne,    color: "#8B5CF6" },
          { label: "Examens en attente",     value: data.nbExamEnAttente, color: "#F59E0B" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: colors.bgCard, padding: "14px 20px", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div className="dash-grid-2" style={{ marginBottom: 20 }}>
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: colors.navy }}>Consultations par service — 6 mois</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.consultHisto}>
              <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
              {data.servicesPresents.map((s) => (
                <Bar key={s} dataKey={s} fill={SERVICE_COLOR[s] ?? "#9CA3AF"} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: colors.navy }}>Occupation des lits par service</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart layout="vertical" data={data.tauxOccup}>
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <YAxis type="category" dataKey="service" tick={{ fontSize: 10 }} width={110} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Bar dataKey="taux" fill={ACCENT} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: colors.navy }}>Top 5 motifs de consultation ce mois</h3>
        {data.top5.length === 0 && <div style={{ color: colors.textMuted, fontSize: 13 }}>Aucune consultation ce mois.</div>}
        {data.top5.map(([motif, count], i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: i < data.top5.length - 1 ? `1px solid ${colors.borderLight}` : "none" }}>
            <span style={{ fontSize: 13, color: colors.text }}>{i + 1}. {motif}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Onglet Finances ───────────────────────────────────────────────────────────
function OngletFinances({ etabId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const debut = debutMois().slice(0, 10);
    const fin   = finMois().slice(0, 10);
    const debut6m = new Date(ts().getFullYear(), ts().getMonth() - 5, 1).toISOString().slice(0, 10);

    const [facturesMoisRes, facturesHistoRes] = await Promise.all([
      supabase.from("factures_hopital").select("sous_total, reste_patient, statut, taux_couverture, type_couverture")
        .in("statut", ["emise", "payee"]).gte("date_facture", debut).lte("date_facture", fin),
      supabase.from("factures_hopital").select("date_facture, sous_total, reste_patient, statut")
        .in("statut", ["emise", "payee"]).gte("date_facture", debut6m),
    ]);

    const moisHisto = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(ts().getFullYear(), ts().getMonth() - (5 - i), 1);
      return { mois: MOIS_LABELS[d.getMonth()], year: d.getFullYear(), month: d.getMonth(), facture: 0, encaisse: 0 };
    });
    (facturesHistoRes.data ?? []).forEach((f) => {
      const d = new Date(f.date_facture);
      const m = moisHisto.find((x) => x.year === d.getFullYear() && x.month === d.getMonth());
      if (!m) return;
      m.facture += f.sous_total ?? 0;
      if (f.statut === "payee") m.encaisse += f.reste_patient ?? 0;
    });

    const fMois = facturesMoisRes.data ?? [];
    const ca        = fMois.reduce((s, f) => s + (f.sous_total ?? 0), 0);
    const encaisse  = fMois.filter((f) => f.statut === "payee").reduce((s, f) => s + (f.reste_patient ?? 0), 0);
    const enAttente = fMois.filter((f) => f.statut === "emise").reduce((s, f) => s + (f.reste_patient ?? 0), 0);
    const tauxMoyen = fMois.length > 0 ? Math.round(fMois.reduce((s, f) => s + (f.taux_couverture ?? 0), 0) / fMois.length) : 0;

    const repCouv = {};
    fMois.forEach((f) => {
      const k = f.type_couverture ?? "";
      if (!repCouv[k]) repCouv[k] = { nb: 0, total: 0 };
      repCouv[k].nb++;
      repCouv[k].total += f.sous_total ?? 0;
    });

    setData({ ca, encaisse, enAttente, tauxMoyen, moisHisto, repCouv, ca });
    setLoading(false);
  }, [etabId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: colors.textMuted }}>Chargement...</div>;
  if (!data) return null;

  const couvertureLabel = { "": "Aucune", assurance: "Assurance", cnss: "CNSS", mutuelle: "Mutuelle" };

  return (
    <div>
      <div className="kpi-row" style={{ marginBottom: 20 }}>
        {[
          { label: "CA du mois",           value: fmtKFCFA(data.ca),        color: "#3B82F6" },
          { label: "Montant encaisse",      value: fmtKFCFA(data.encaisse),  color: ACCENT },
          { label: "En attente",            value: fmtKFCFA(data.enAttente), color: "#EF4444" },
          { label: "Taux couverture moy.",  value: `${data.tauxMoyen}%`,     color: "#8B5CF6" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: colors.bgCard, padding: "14px 20px", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div className="dash-grid-2">
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: colors.navy }}>Recettes mensuelles — 6 mois</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.moisHisto}>
              <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v) => `${Number(v).toLocaleString("fr-FR")} FCFA`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="facture"  stroke="#3B82F6" strokeWidth={2} name="Facture"  dot={{ r: 3 }} />
              <Line type="monotone" dataKey="encaisse" stroke={ACCENT}  strokeWidth={2} name="Encaisse" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: colors.navy }}>Repartition par type de couverture</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ backgroundColor: colors.bgSurface }}>
                {["Type", "Factures", "Montant", "% CA"].map((h) => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: colors.textSecondary, borderBottom: `1px solid ${colors.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.repCouv).map(([k, v]) => (
                <tr key={k} style={{ borderBottom: `1px solid ${colors.borderLight}` }}>
                  <td style={{ padding: "8px 10px", fontWeight: 600 }}>{couvertureLabel[k] ?? k}</td>
                  <td style={{ padding: "8px 10px" }}>{v.nb}</td>
                  <td style={{ padding: "8px 10px" }}>{fmtKFCFA(v.total)}</td>
                  <td style={{ padding: "8px 10px", color: ACCENT, fontWeight: 700 }}>{data.ca > 0 ? `${Math.round((v.total / data.ca) * 100)}%` : "—"}</td>
                </tr>
              ))}
              {Object.keys(data.repCouv).length === 0 && (
                <tr><td colSpan={4} style={{ padding: 16, textAlign: "center", color: colors.textMuted }}>Aucune facture ce mois</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Onglet Stock & Medicaments ────────────────────────────────────────────────
function OngletStock({ etabId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const debut  = debutMois();
    const fin    = finMois();
    const debut6m = new Date(ts().getFullYear(), ts().getMonth() - 5, 1).toISOString();

    const [medRes, dispMoisRes, dispHistoRes, ordRes] = await Promise.all([
      supabase.from("medicaments").select("id, nom, stock_actuel, stock_minimum, prix_unitaire"),
      supabase.from("dispensations").select("medicament_id, quantite, medicaments(nom)").gte("created_at", debut).lte("created_at", fin),
      supabase.from("dispensations").select("created_at, quantite").gte("created_at", debut6m),
      supabase.from("ordonnances").select("id, statut").eq("statut", "en_attente"),
    ]);

    const meds        = medRes.data ?? [];
    const ruptures    = meds.filter((m) => (m.stock_actuel ?? 0) === 0).length;
    const valeurStock = meds.reduce((s, m) => s + (m.stock_actuel ?? 0) * (m.prix_unitaire ?? 0), 0);
    const tauxDispo   = meds.length > 0 ? Math.round(((meds.length - ruptures) / meds.length) * 100) : 0;

    const dispMap = {};
    (dispMoisRes.data ?? []).forEach((d) => {
      const id = d.medicament_id;
      if (!dispMap[id]) dispMap[id] = { nom: d.medicaments?.nom ?? "—", total: 0 };
      dispMap[id].total += d.quantite ?? 0;
    });
    const top10 = Object.values(dispMap).sort((a, b) => b.total - a.total).slice(0, 10);

    const moisHisto = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(ts().getFullYear(), ts().getMonth() - (5 - i), 1);
      return { mois: MOIS_LABELS[d.getMonth()], year: d.getFullYear(), month: d.getMonth(), dispensations: 0 };
    });
    (dispHistoRes.data ?? []).forEach((d) => {
      const dt = new Date(d.created_at);
      const m = moisHisto.find((x) => x.year === dt.getFullYear() && x.month === dt.getMonth());
      if (m) m.dispensations += d.quantite ?? 1;
    });

    setData({ ruptures, valeurStock, tauxDispo, top10, moisHisto, ordEnAttente: ordRes.data?.length ?? 0 });
    setLoading(false);
  }, [etabId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: colors.textMuted }}>Chargement...</div>;
  if (!data) return null;

  return (
    <div>
      <div className="kpi-row" style={{ marginBottom: 20 }}>
        {[
          { label: "Valeur totale stock",    value: fmtKFCFA(data.valeurStock), color: "#3B82F6" },
          { label: "Ruptures de stock",      value: data.ruptures,              color: data.ruptures > 0 ? "#EF4444" : "#9CA3AF" },
          { label: "Taux de disponibilite",  value: `${data.tauxDispo}%`,       color: ACCENT },
          { label: "Ordonnances en attente", value: data.ordEnAttente,          color: "#F59E0B" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: colors.bgCard, padding: "14px 20px", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div className="dash-grid-2">
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: colors.navy }}>Dispensations mensuelles — 6 mois</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.moisHisto}>
              <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="dispensations" fill={ACCENT} radius={[4, 4, 0, 0]} name="Dispensations" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: colors.navy }}>Top 10 medicaments dispenses ce mois</h3>
          {data.top10.length === 0 && <div style={{ color: colors.textMuted, fontSize: 13 }}>Aucune dispensation ce mois.</div>}
          {data.top10.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < data.top10.length - 1 ? `1px solid ${colors.borderLight}` : "none" }}>
              <span style={{ fontSize: 12 }}>{i + 1}. {m.nom}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>{m.total} unites</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Onglet Rapports imprimes ──────────────────────────────────────────────────
function OngletRapports({ etabId, auth }) {
  const [loading, setLoading] = useState({});
  const setLoad = (key, val) => setLoading((prev) => ({ ...prev, [key]: val }));

  const genActivite = async () => {
    setLoad("activite", true);
    try {
      const etab = await fetchEtabFromAuth(auth);
      const debut = debutMois(); const fin = finMois();
      const [hospiRes, consultRes, examRes] = await Promise.all([
        supabase.from("hospitalisations").select("id").eq("statut", "hospitalise"),
        supabase.from("consultations").select("service, motif").gte("heure_arrivee", debut).lte("heure_arrivee", fin),
        supabase.from("examens").select("id").in("statut", ["prescrit", "en_cours"]),
      ]);
      const consultParService = {};
      (consultRes.data ?? []).forEach((c) => { const s = c.service ?? "Autre"; consultParService[s] = (consultParService[s] ?? 0) + 1; });
      const motifCount = {};
      (consultRes.data ?? []).forEach((c) => { const m = (c.motif ?? "Non precise").slice(0, 40); motifCount[m] = (motifCount[m] ?? 0) + 1; });
      const top5 = Object.entries(motifCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
      openDocument({
        titre: "Rapport d'activite mensuel",
        sousTitre: `${ts().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })} — Genere le ${ts().toLocaleDateString("fr-FR")}`,
        etablissement: etab,
        sections: [
          { titre: "Indicateurs cles", html: kpiHTML([
            { label: "Hospitalises",      value: String(hospiRes.data?.length ?? 0), color: "#EF4444" },
            { label: "Consultations",     value: String(consultRes.data?.length ?? 0), color: "#3B82F6" },
            { label: "Examens en attente",value: String(examRes.data?.length ?? 0), color: "#F59E0B" },
          ]) },
          { titre: "Consultations par service", html: tableHTML(["Service", "Consultations"], Object.entries(consultParService).sort((a, b) => b[1] - a[1]).map(([s, n]) => [s, String(n)])) },
          top5.length > 0 ? { titre: "Top 5 motifs", html: tableHTML(["Motif", "Occurrences"], top5.map(([m, n]) => [m, String(n)])) } : null,
        ].filter(Boolean),
      });
    } finally { setLoad("activite", false); }
  };

  const genFinancier = async () => {
    setLoad("financier", true);
    try {
      const etab = await fetchEtabFromAuth(auth);
      const debut = debutMois().slice(0, 10); const fin = finMois().slice(0, 10);
      const { data: factures } = await supabase.from("factures_hopital")
        .select("numero_facture, sous_total, montant_couverture, reste_patient, statut, type_couverture, taux_couverture, date_facture")
        .in("statut", ["emise", "payee"]).gte("date_facture", debut).lte("date_facture", fin);
      const fac = factures ?? [];
      const ca      = fac.reduce((s, f) => s + (f.sous_total ?? 0), 0);
      const enc     = fac.filter((f) => f.statut === "payee").reduce((s, f) => s + (f.reste_patient ?? 0), 0);
      const att     = fac.filter((f) => f.statut === "emise").reduce((s, f) => s + (f.reste_patient ?? 0), 0);
      openDocument({
        titre: "Rapport financier mensuel",
        sousTitre: `${ts().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })} — Genere le ${ts().toLocaleDateString("fr-FR")}`,
        etablissement: etab,
        sections: [
          { titre: "Indicateurs financiers", html: kpiHTML([
            { label: "CA",       value: fmtKFCFA(ca),  color: "#3B82F6" },
            { label: "Encaisse", value: fmtKFCFA(enc), color: ACCENT },
            { label: "Attente",  value: fmtKFCFA(att), color: "#EF4444" },
          ]) },
          fac.length > 0 ? { titre: "Detail des factures", html: tableHTML(
            ["Numero", "Date", "Sous-total", "Couverture", "Reste", "Statut"],
            fac.map((f) => [f.numero_facture, f.date_facture ?? "—", `${Number(f.sous_total ?? 0).toLocaleString("fr-FR")} FCFA`, `${f.taux_couverture ?? 0}% ${f.type_couverture ?? ""}`, `${Number(f.reste_patient ?? 0).toLocaleString("fr-FR")} FCFA`, f.statut]),
          ) } : null,
        ].filter(Boolean),
      });
    } finally { setLoad("financier", false); }
  };

  const genStock = async () => {
    setLoad("stock", true);
    try {
      const etab = await fetchEtabFromAuth(auth);
      const { data: meds } = await supabase.from("medicaments").select("nom, stock_actuel, stock_minimum, prix_unitaire").order("nom");
      const rows = (meds ?? []).map((m) => [
        m.nom, String(m.stock_actuel ?? 0), String(m.stock_minimum ?? 0),
        `${Number(m.prix_unitaire ?? 0).toLocaleString("fr-FR")} FCFA`,
        `${((m.stock_actuel ?? 0) * (m.prix_unitaire ?? 0)).toLocaleString("fr-FR")} FCFA`,
        (m.stock_actuel ?? 0) === 0 ? "Rupture" : (m.stock_actuel ?? 0) < (m.stock_minimum ?? 0) ? "Alerte" : "OK",
      ]);
      openDocument({
        titre: "Rapport de stock",
        sousTitre: `Genere le ${ts().toLocaleDateString("fr-FR")}`,
        etablissement: etab,
        sections: [{ titre: "Inventaire complet", html: tableHTML(["Medicament", "Stock actuel", "Seuil min.", "Prix unit.", "Valeur", "Statut"], rows) }],
      });
    } finally { setLoad("stock", false); }
  };

  const genOccupation = async () => {
    setLoad("occupation", true);
    try {
      const etab = await fetchEtabFromAuth(auth);
      const [litsRes, configRes, hospRes] = await Promise.all([
        supabase.from("hospitalisations").select("service").eq("statut", "hospitalise"),
        supabase.from("configuration_lits").select("service, capacite_totale"),
        supabase.from("hospitalisations").select("*, patients(prenom, nom)").eq("statut", "hospitalise").order("service"),
      ]);
      const litParService = {};
      (litsRes.data ?? []).forEach((h) => { litParService[h.service] = (litParService[h.service] ?? 0) + 1; });
      const capacite = {};
      (configRes.data ?? []).forEach((c) => { capacite[c.service] = c.capacite_totale; });
      const syntheseRows = SERVICES_LITS.map((s) => {
        const occ = litParService[s] ?? 0; const cap = capacite[s] ?? 10;
        return [s, String(cap), String(occ), String(cap - occ), `${Math.round((occ / cap) * 100)}%`];
      });
      const detailRows = (hospRes.data ?? []).map((h) => [
        h.patients ? `${h.patients.prenom} ${h.patients.nom}` : "—",
        h.service ?? "—", h.lit ?? "—", h.chambre ?? "—",
        h.date_entree ? new Date(h.date_entree).toLocaleDateString("fr-FR") : "—",
        h.date_sortie_prevue ? new Date(h.date_sortie_prevue).toLocaleDateString("fr-FR") : "—",
      ]);
      openDocument({
        titre: "Rapport d'occupation des lits",
        sousTitre: `Au ${ts().toLocaleDateString("fr-FR")}`,
        etablissement: etab,
        sections: [
          { titre: "Synthese par service", html: tableHTML(["Service", "Capacite", "Occupes", "Libres", "Taux"], syntheseRows) },
          detailRows.length > 0 ? { titre: "Detail hospitalisations", html: tableHTML(["Patient", "Service", "Lit", "Chambre", "Entree", "Sortie prevue"], detailRows) } : null,
        ].filter(Boolean),
      });
    } finally { setLoad("occupation", false); }
  };

  const rapports = [
    { key: "activite",   label: "Rapport d'activite mensuel complet",    desc: "KPIs cliniques + consultations par service + top diagnostics + finances", fn: genActivite },
    { key: "financier",  label: "Rapport financier mensuel",              desc: "CA / encaisse / en attente + detail factures + repartition couverture",   fn: genFinancier },
    { key: "stock",      label: "Rapport de stock",                       desc: "Inventaire complet des medicaments avec statuts et valeurs",              fn: genStock },
    { key: "occupation", label: "Rapport d'occupation des lits",          desc: "Capacite / occupes / taux par service + liste patients hospitalises",     fn: genOccupation },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {rapports.map((r) => (
        <div key={r.key} style={{ backgroundColor: colors.bgCard, borderRadius: 12, padding: "18px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: colors.navy }}>{r.label}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 3 }}>{r.desc}</div>
          </div>
          <button onClick={r.fn} disabled={loading[r.key]}
            style={{ padding: "8px 18px", backgroundColor: loading[r.key] ? "#D1D5DB" : ACCENT, color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: loading[r.key] ? "wait" : "pointer", flexShrink: 0, marginLeft: 16 }}>
            {loading[r.key] ? "Generation..." : "Generer"}
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function Rapports() {
  const { auth } = useAuth();
  const [onglet, setOnglet] = useState("activite");
  const [etabId, setEtabId] = useState(auth?.etablissement_id ?? null);

  useEffect(() => {
    if (auth?.etablissement_id) { setEtabId(auth.etablissement_id); return; }
    if (auth?.user?.email) {
      supabase.from("etablissements").select("id").eq("email", auth.user.email).maybeSingle()
        .then(({ data }) => { if (data?.id) setEtabId(data.id); });
    }
  }, [auth]);

  const onglets = [
    { key: "activite",  label: "Activite clinique" },
    { key: "finances",  label: "Finances" },
    { key: "stock",     label: "Stock & Medicaments" },
    { key: "rapports",  label: "Rapports imprimes" },
  ];

  return (
    <Layout title="Rapports Hospitaliers" subtitle="Tableau de bord de direction medicale">
      <div style={{ display: "flex", gap: 2, marginBottom: 24, borderBottom: `2px solid ${colors.border}` }}>
        {onglets.map((o) => (
          <button key={o.key} onClick={() => setOnglet(o.key)}
            style={{ padding: "10px 20px", background: "none", border: "none", borderBottom: onglet === o.key ? `3px solid ${ACCENT}` : "3px solid transparent", marginBottom: -2, fontSize: 13, fontWeight: onglet === o.key ? 800 : 400, color: onglet === o.key ? ACCENT : colors.textSecondary, cursor: "pointer" }}>
            {o.label}
          </button>
        ))}
      </div>

      {onglet === "activite" && <OngletActivite etabId={etabId} />}
      {onglet === "finances" && <OngletFinances etabId={etabId} />}
      {onglet === "stock"    && <OngletStock    etabId={etabId} />}
      {onglet === "rapports" && <OngletRapports etabId={etabId} auth={auth} />}
    </Layout>
  );
}
